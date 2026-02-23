import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ModelCategory } from "@runanywhere/web";
import { TextGeneration } from "@runanywhere/web-llamacpp";
import { useModelLoader } from "../hooks/useModelLoader";
import { ModelBanner } from "./ModelBanner";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  stats?: { tokens: number; tokPerSec: number; latencyMs: number };
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function ChatTab() {
  // ⚠️ IMPORTANT: confirm your LLM category. If Language is wrong,
  // change it after checking ModelManager.getModels().
  const loader = useModelLoader(ModelCategory.Language, true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  const cancelRef = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ✅ Only allow send when ready
  const canSend = useMemo(() => {
    return input.trim().length > 0 && !generating && loader.state === "ready";
  }, [input, generating, loader.state]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // ✅ cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  const updateById = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const ensureModel = useCallback(async () => {
    if (loader.state === "ready") return true;
    const ok = await loader.ensure();
    return ok;
  }, [loader]);

  const handleCancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setGenerating(false);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) return;

    const ok = await ensureModel();
    if (!ok) return;

    const userId = uid();
    const assistantId = uid();

    setInput("");
    setGenerating(true);

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text },
      { id: assistantId, role: "assistant", text: "" },
    ]);

    try {
      // Optional: add a light system prompt for better responses
      const prompt = `You are a helpful on-device assistant.\nUser: ${text}\nAssistant:`;

      const { stream, result: resultPromise, cancel } = await TextGeneration.generateStream(prompt, {
        maxTokens: 512,
        temperature: 0.7,
      });

      cancelRef.current = cancel;

      let accumulated = "";
      for await (const token of stream) {
        accumulated += token;
        updateById(assistantId, { text: accumulated });
      }

      const result = await resultPromise;

      updateById(assistantId, {
        text: result.text || accumulated || "No output returned.",
        stats: {
          tokens: result.tokensUsed ?? 0,
          tokPerSec: result.tokensPerSecond ?? 0,
          latencyMs: result.latencyMs ?? 0,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateById(assistantId, { text: `Error: ${msg}` });
    } finally {
      cancelRef.current = null;
      setGenerating(false);
    }
  }, [input, generating, ensureModel, updateById]);

  return (
    <div className="tab-panel chat-panel improved-chat">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />

      <div className="message-list improved-message-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-state improved-empty">
            <h3>Start a conversation</h3>
            <p>Chat with your on-device AI model. Your messages stay local.</p>
            {loader.state !== "ready" && (
              <p style={{ marginTop: 8, opacity: 0.8 }}>
                Model status: <b>{loader.state}</b>
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message message-${msg.role} improved-message`}>
              <div className="message-bubble improved-bubble">
                <div className="bubble-text">
                  {msg.text || (msg.role === "assistant" ? "Thinking…" : "")}
                </div>

                {msg.stats && (
                  <div className="message-stats improved-stats">
                    {msg.stats.tokens} tokens · {msg.stats.tokPerSec.toFixed(1)} tok/s ·{" "}
                    {msg.stats.latencyMs.toFixed(0)}ms
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="chat-input improved-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          placeholder={loader.state === "ready" ? "Message…" : "Model not ready yet…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={generating || loader.state !== "ready"}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) void send();
            }
          }}
        />

        {generating ? (
          <button type="button" className="btn" onClick={handleCancel}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!canSend}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}