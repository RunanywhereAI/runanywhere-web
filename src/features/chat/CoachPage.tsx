import { useMemo, useState } from 'react';
import { generate, getModelStatus, loadProvidedLanguageModel } from '../../lib/runanywhere';
import { appendChatMessage, createAssistantMessage, createUserMessage } from '../../lib/storage';
import { buildFallbackResponse, safeParseCoachResponse } from '../../lib/chat-schema';
import type { ChatSession } from '../../types/chat';
import { useVoice } from '../voice/useVoice';

const quickPrompts = ['Make a weekly plan', 'High-protein veg diet', 'Warm-up routine', 'Fix squat form'];

const baseSystemPrompt = `You are a privacy-first Health & Fitness Coach. Return valid JSON only with keys:
 type,title,summary,content_markdown,plan,warnings,follow_up_questions.
 type must be one of answer/workout_plan/diet_plan/tips.
 Include safety disclaimers for injuries/medical concerns. No diagnosis.`;

export function CoachPage({
  session,
  setSession,
  onSavePlan,
  autoSpeak,
  pushToast,
}: {
  session: ChatSession;
  setSession: (updater: (current: ChatSession) => ChatSession) => void;
  onSavePlan: (title: string, content: string) => void;
  autoSpeak: boolean;
  pushToast: (message: string, kind?: 'error' | 'info') => void;
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready for private coaching.');
  const [error, setError] = useState<string | null>(null);
  const voice = useVoice(autoSpeak);

  const canSend = input.trim().length > 0 && !busy;

  const sendPrompt = async (text: string) => {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    setStatus('Loading provided local model...');

    const userMsg = createUserMessage(trimmed);
    setSession((current) => appendChatMessage(current, userMsg));

    const loaded = await loadProvidedLanguageModel();
    if (!loaded) {
      const err = getModelStatus().lastError ?? 'Unable to load provided model.';
      setError(err);
      pushToast(err, 'error');
      setSession((current) => appendChatMessage(current, createAssistantMessage(`Error: ${err}`)));
      setBusy(false);
      return;
    }

    const recentHistory = [...session.messages, userMsg]
      .slice(-8)
      .map((m) => `${m.role}: ${m.text}`)
      .join('\n');
    const prompt = `${baseSystemPrompt}\nConversation:\n${recentHistory}\nUser query: ${trimmed}`;

    setStatus('Generating response locally...');

    try {
      let raw = await generate(prompt, { maxTokens: 900, temperature: 0.1 });
      let parsed = safeParseCoachResponse(raw);

      if (!parsed) {
        raw = await generate(`${baseSystemPrompt}\nSTRICT MODE: Output JSON only without markdown fences.\nUser: ${trimmed}`, { maxTokens: 900, temperature: 0 });
        parsed = safeParseCoachResponse(raw);
      }

      const safe = parsed ?? buildFallbackResponse(raw || 'Unable to parse response.');
      const assistantText = `${safe.title}\n\n${safe.summary}\n\n${safe.content_markdown}`;
      setSession((current) => appendChatMessage(current, createAssistantMessage(assistantText, safe)));
      voice.maybeAutoSpeak(`${safe.title}. ${safe.summary}`);
      setStatus('Response complete.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pushToast(message, 'error');
      setSession((current) => appendChatMessage(current, createAssistantMessage(`Error: ${message}`)));
      setStatus('Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const waveform = useMemo(() => (voice.recording ? '▁▃▅▇▆▃▁' : '▁▁▁▁▁▁'), [voice.recording]);

  return (
    <div className="page card coach-page">
      <h2>AI Coach</h2>
      <p className="muted">Private on-device assistant. Health guidance only; no diagnosis.</p>
      <div className="quick-prompts">
        {quickPrompts.map((p) => (
          <button key={p} disabled={busy} onClick={() => void sendPrompt(p)}>{p}</button>
        ))}
      </div>

      <div className="chat-list" aria-live="polite">
        {session.messages.length === 0 ? (
          <div className="empty">Ask a fitness or diet question to begin.</div>
        ) : (
          session.messages.map((m) => (
            <article key={m.id} className={`msg ${m.role}`}>
              <pre>{m.text}</pre>
              {m.parsed?.plan && <button className="secondary" onClick={() => onSavePlan(m.parsed?.title ?? 'Plan', JSON.stringify(m.parsed?.plan, null, 2))}>Save as plan</button>}
              {m.role === 'assistant' && <button className="secondary" onClick={() => voice.speak(m.text)}>Speak</button>}
            </article>
          ))
        )}
        {busy && <article className="msg assistant skeleton" aria-label="AI is generating"><pre>Thinking locally...</pre></article>}
      </div>

      <div className="status">{status}</div>
      {error && <div className="error">{error}</div>}
      {voice.voiceError && <div className="error">{voice.voiceError}</div>}

      <div className="voice-row">
        <button className={voice.recording ? 'danger' : ''} onClick={() => (voice.recording ? voice.stopRecording() : voice.startRecording((t) => { setInput(t); void sendPrompt(t); }))}>
          {voice.recording ? 'Stop mic' : 'Start mic'}
        </button>
        <span aria-live="polite">{waveform}</span>
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) {
            void sendPrompt(input);
            setInput('');
          }
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about workouts, diet, or form"
          aria-label="Chat input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) {
                void sendPrompt(input);
                setInput('');
              }
            }
          }}
        />
        <button type="submit" disabled={!canSend}>{busy ? 'Sending...' : 'Send'}</button>
      </form>
    </div>
  );
}
