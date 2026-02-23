import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generate, getModelStatus, loadProvidedLanguageModel } from "../../lib/runanywhere";
import { appendChatMessage, createAssistantMessage, createUserMessage } from "../../lib/storage";
import { buildFallbackResponse, safeParseCoachResponse } from "../../lib/chat-schema";
import type { ChatSession } from "../../types/chat";
import { useVoice } from "../voice/useVoice";

const quickPrompts = ["Make a weekly plan", "High-protein veg diet", "Warm-up routine", "Fix squat form"] as const;

const baseSystemPrompt = `You are a privacy-first Health & Fitness Coach.
You MUST return VALID JSON ONLY (no markdown fences, no extra text) with keys:
type,title,summary,content_markdown,plan,warnings,follow_up_questions.
"type" must be one of: answer | workout_plan | diet_plan | tips.
If user mentions pain/injury/medical issue, add safety disclaimer and suggest professional help.
No diagnosis.` as const;

type ModelUIState = "idle" | "loading" | "ready" | "error";

function withTimeout<T>(p: Promise<T>, ms: number, label = "Operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = globalThis.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => {
      globalThis.clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      globalThis.clearTimeout(t);
      reject(e);
    });
  });
}

function buildRecentHistory(messages: ChatSession["messages"]) {
  return messages
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");
}

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
  pushToast: (message: string, kind?: "error" | "info") => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState("Ready for private coaching.");
  const [error, setError] = useState<string | null>(null);

  const [modelState, setModelState] = useState<ModelUIState>("idle");
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<{ modelId?: string; modelName?: string }>({});

  const voice = useVoice(autoSpeak);

  // keep latest session in a ref to avoid stale reads
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refreshModelUI = useCallback(() => {
    const ms = getModelStatus();
    setModelInfo({ modelId: ms.modelId, modelName: ms.modelName });

    if (ms.ready) {
      setModelState("ready");
      setModelError(null);
      return;
    }
    if (ms.loading) {
      setModelState("loading");
      setModelError(null);
      return;
    }
    if (ms.lastError) {
      setModelState("error");
      setModelError(ms.lastError);
      return;
    }
    setModelState("idle");
    setModelError(null);
  }, []);

  // robust model loader (with timeout + proper status sync)
  const ensureModelReady = useCallback(async (): Promise<boolean> => {
    setModelState("loading");
    setModelError(null);
    setStatus("Loading provided local model...");

    try {
      const ok = await withTimeout(loadProvidedLanguageModel(), 45000, "loadProvidedLanguageModel()");
      refreshModelUI();

      const ms = getModelStatus();
      if (!ok || ms.lastError) {
        const err = ms.lastError ?? "Unable to load provided model.";
        setModelState("error");
        setModelError(err);
        setStatus("Model load failed.");
        pushToast(err, "error");
        return false;
      }

      // some SDKs need a short warm-up; poll briefly
      const start = Date.now();
      while (!getModelStatus().ready && Date.now() - start < 8000) {
        await new Promise((r) => setTimeout(r, 250));
      }

      const ms2 = getModelStatus();
      refreshModelUI();

      if (!ms2.ready) {
        setModelState(ms2.loading ? "loading" : "idle");
        setStatus(ms2.loading ? "Model warming up..." : "Model not ready yet.");
        return false;
      }

      setModelState("ready");
      setModelError(null);
      setStatus("Model ready. Ask your question.");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setModelState("error");
      setModelError(msg);
      setStatus("Model load failed.");
      pushToast(msg, "error");
      return false;
    }
  }, [pushToast, refreshModelUI]);

  // initial load on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await ensureModelReady();
      if (cancelled) return;
      if (!ok) {
        // already handled by ensureModelReady
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureModelReady]);

  const retryLoadModel = useCallback(() => {
    void ensureModelReady();
  }, [ensureModelReady]);

  const canSend = input.trim().length > 0 && !busy && modelState === "ready";

  const sendPrompt = useCallback(
    async (text: string) => {
      if (busy) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      // always check real status
      const ms = getModelStatus();
      if (!ms.ready) {
        refreshModelUI();
        const err = ms.lastError ?? modelError ?? "Model is not ready yet.";
        pushToast(err, "error");
        setStatus("Cannot generate: model not ready.");
        return;
      }

      setBusy(true);
      setError(null);

      const userMsg = createUserMessage(trimmed);
      setSession((current) => appendChatMessage(current, userMsg));
      setStatus("Generating response locally...");

      try {
        const latest = sessionRef.current;
        const history = buildRecentHistory([...latest.messages, userMsg]);

        const prompt = `${baseSystemPrompt}

Conversation (latest):
${history}

USER_QUERY:
${trimmed}
`;

        const raw = await withTimeout(
          generate(prompt, { maxTokens: 900, temperature: 0.2 }),
          45000,
          "generate()"
        );

        let parsed = safeParseCoachResponse(raw);

        if (!parsed) {
          const raw2 = await withTimeout(
            generate(`${baseSystemPrompt}\nSTRICT: Output JSON ONLY.\nUSER_QUERY:\n${trimmed}`, {
              maxTokens: 900,
              temperature: 0,
            }),
            45000,
            "generate(strict)"
          );
          parsed = safeParseCoachResponse(raw2) ?? safeParseCoachResponse(raw);
        }

        const safe = parsed ?? buildFallbackResponse(raw || "No response.");
        const assistantText = `${safe.title}\n\n${safe.summary}\n\n${safe.content_markdown}`;

        setSession((current) => appendChatMessage(current, createAssistantMessage(assistantText, safe)));
        voice.maybeAutoSpeak(`${safe.title}. ${safe.summary}`);
        setStatus("Response complete.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        pushToast(msg, "error");
        setSession((current) => appendChatMessage(current, createAssistantMessage(`Error: ${msg}`)));
        setStatus("Generation failed.");
      } finally {
        setBusy(false);
      }
    },
    [busy, modelError, pushToast, refreshModelUI, setSession, voice]
  );

  const waveform = useMemo(() => (voice.recording ? "Listening…" : "Mic ready"), [voice.recording]);

  const statusBadge = useMemo(() => {
    if (modelState === "ready") return { text: "Ready", cls: "ok" };
    if (modelState === "loading") return { text: "Loading", cls: "loading" };
    if (modelState === "error") return { text: "Error", cls: "err" };
    return { text: "Idle", cls: "idle" };
  }, [modelState]);

  return (
    <div className="coach">
      <div className="coachHeader">
        <div>
          <h2 className="coachTitle">AI Coach</h2>
          <p className="coachSub">Private on-device assistant. Health guidance only; no diagnosis.</p>
        </div>

        <div className={`coachBadge ${statusBadge.cls}`}>
          <span className="dot" />
          {statusBadge.text}
        </div>
      </div>

      <div className="modelCard">
        <div className="modelTop">
          <div>
            <div className="modelLabel">Model</div>
            <div className="modelName">
              {modelInfo.modelName ?? "—"}{" "}
              <span className="modelId">{modelInfo.modelId ? `(${modelInfo.modelId})` : ""}</span>
            </div>
          </div>

          {modelState !== "ready" && (
            <button className="btn btnGhost" onClick={retryLoadModel} type="button">
              Retry
            </button>
          )}
        </div>

        {modelError && <div className="alert">{modelError}</div>}

        <div className="quickRow">
          {quickPrompts.map((p) => (
            <button
              key={p}
              className="chip"
              disabled={busy || modelState !== "ready"}
              onClick={() => {
                setInput("");
                void sendPrompt(p);
              }}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="chatCard">
        <div className="chatBody" aria-live="polite">
          {session.messages.length === 0 ? (
            <div className="emptyState">
              <div className="emptyTitle">Ask anything about fitness, diet, or form</div>
              <div className="emptyHint">
                Examples: “Give me a 20-min home workout” • “Fix my squat form” • “Veg high-protein foods”
              </div>
            </div>
          ) : (
            session.messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`bubbleRow ${isUser ? "right" : "left"}`}>
                  <div className={`bubble ${isUser ? "user" : "ai"}`}>
                    <div className="bubbleText">{m.text}</div>

                    {!isUser && (
                      <div className="bubbleActions">
                        {m.parsed?.plan && (
                          <button
                            className="btn btnSmall"
                            type="button"
                            onClick={() => onSavePlan(m.parsed?.title ?? "Plan", JSON.stringify(m.parsed?.plan, null, 2))}
                          >
                            Save plan
                          </button>
                        )}
                        <button className="btn btnSmall btnGhost" type="button" onClick={() => voice.speak(m.text)}>
                          Speak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {busy && (
            <div className="bubbleRow left">
              <div className="bubble ai">
                <div className="typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="chatFooter">
          <button
            className={`micBtn ${voice.recording ? "on" : ""}`}
            disabled={modelState !== "ready"}
            onClick={() =>
              voice.recording
                ? voice.stopRecording()
                : voice.startRecording((t) => {
                    setInput(t);
                    void sendPrompt(t);
                    setInput("");
                  })
            }
            aria-label="Microphone"
            title="Voice input"
            type="button"
          >
            {voice.recording ? "■" : "🎤"}
          </button>

          <div className="composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={modelState === "ready" ? "Ask about workouts, diet, or form…" : "Model not ready yet"}
              aria-label="Chat input"
              disabled={modelState !== "ready"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canSend) {
                    void sendPrompt(input);
                    setInput("");
                  }
                }
              }}
            />
            <button
              className="btn btnPrimary"
              disabled={!canSend}
              onClick={() => {
                void sendPrompt(input);
                setInput("");
              }}
              type="button"
            >
              {busy ? "Thinking…" : "Send"}
            </button>
          </div>

          <div className="footerMeta">
            <span className="mutedSmall">{waveform}</span>
            <span className="mutedSmall">{status}</span>
          </div>

          {error && <div className="alert">{error}</div>}
          {voice.voiceError && <div className="alert">{voice.voiceError}</div>}
        </div>
      </div>
    </div>
  );
}