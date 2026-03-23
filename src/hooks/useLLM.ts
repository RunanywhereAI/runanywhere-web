/**
 * useLLM — React hook wrapping RunAnywhere SDK singleton.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initPrivateIDE,
  generate,
  generateStream,
  getAccelerationMode,
  isModelLoaded,
  onProgress,
  onStatus,
} from '../lib/llm/init';
import type { LLMStatus, GenerationMetrics } from '../types';

export interface UseLLMReturn {
  status: LLMStatus;
  progress: number;
  statusMessage: string;
  acceleration: string;
  generate: (prompt: string, opts?: GenOpts) => Promise<string>;
  streamGenerate: (
    prompt: string,
    onToken: (fullText: string) => void,
    opts?: GenOpts
  ) => Promise<{ text: string; metrics: GenerationMetrics }>;
  cancel: () => void;
}

interface GenOpts {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export function useLLM(): UseLLMReturn {
  const [status, setStatus] = useState<LLMStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing…');
  const [acceleration, setAcceleration] = useState('cpu');
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onProgress((p) => setProgress(p));
    onStatus((msg) => setStatusMessage(msg));

    setStatus('downloading');
    initPrivateIDE()
      .then(() => {
        setStatus('ready');
        setAcceleration(getAccelerationMode());
      })
      .catch((err) => {
        console.error('LLM init failed:', err);
        setStatusMessage(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, []);

  const gen = useCallback(
    async (prompt: string, opts?: GenOpts): Promise<string> => {
      if (!isModelLoaded()) throw new Error('Model not loaded');
      setStatus('generating');
      try {
        const result = await generate(prompt, opts);
        return result.text;
      } finally {
        setStatus('ready');
      }
    },
    []
  );

  const streamGen = useCallback(
    async (
      prompt: string,
      onToken: (fullText: string) => void,
      opts?: GenOpts
    ): Promise<{ text: string; metrics: GenerationMetrics }> => {
      if (!isModelLoaded()) throw new Error('Model not loaded');
      setStatus('generating');
      try {
        const { stream, result, cancel } = await generateStream(prompt, opts);
        cancelRef.current = cancel;

        let fullText = '';
        for await (const token of stream) {
          fullText += token;
          onToken(fullText);
        }

        const final = await result;
        const metrics: GenerationMetrics = {
          tokensUsed: final.tokensUsed,
          tokensPerSecond: final.tokensPerSecond,
          latencyMs: final.latencyMs,
        };
        return { text: fullText, metrics };
      } finally {
        cancelRef.current = null;
        setStatus('ready');
      }
    },
    []
  );

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus('ready');
  }, []);

  return {
    status,
    progress,
    statusMessage,
    acceleration,
    generate: gen,
    streamGenerate: streamGen,
    cancel,
  };
}
