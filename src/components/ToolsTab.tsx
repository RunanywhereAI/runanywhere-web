import {
  ModelCategory,
  RunAnywhere,
  ToolCallFormatName,
  ToolParameterType,
  type ToolCall,
  type ToolCallingResult,
  type ToolDefinition,
  type ToolResult,
  type ToolValue,
} from '@runanywhere/web';
import { useState, useRef, useEffect, useCallback } from 'react';

import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

// ---------------------------------------------------------------------------
// ToolValue helpers — hand-rolled (the web-llamacpp toToolValue/getStringArg/
// getNumberArg helpers were removed; the proto ToolValue oneof is trivial to
// build/read directly).
// ---------------------------------------------------------------------------

function tv(value: string | number | boolean): ToolValue {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { numberValue: value };
  return { boolValue: value };
}

function toolValueString(value: ToolValue | undefined): string | null {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.numberValue !== undefined) return String(value.numberValue);
  return null;
}

function toolValueNumber(value: ToolValue | undefined): number | null {
  if (!value) return null;
  if (value.numberValue !== undefined) return value.numberValue;
  if (value.stringValue !== undefined) {
    const parsed = Number(value.stringValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Readable label for a ToolParameterType wire value. */
function paramTypeLabel(type: ToolParameterType): string {
  switch (type) {
    case ToolParameterType.TOOL_PARAMETER_TYPE_STRING: return 'string';
    case ToolParameterType.TOOL_PARAMETER_TYPE_NUMBER: return 'number';
    case ToolParameterType.TOOL_PARAMETER_TYPE_BOOLEAN: return 'boolean';
    case ToolParameterType.TOOL_PARAMETER_TYPE_OBJECT: return 'object';
    case ToolParameterType.TOOL_PARAMETER_TYPE_ARRAY: return 'array';
    default: return 'unknown';
  }
}

/** Best-effort readable JSON summary of a ToolCall/ToolResult JSON payload. */
function summarizeJson(json: string | undefined): string {
  if (!json) return '{}';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// ---------------------------------------------------------------------------
// Built-in demo tools
// ---------------------------------------------------------------------------

type ToolExecutor = Parameters<typeof RunAnywhere.toolCalling.registerTool>[1];

const DEMO_TOOLS: { def: ToolDefinition; executor: ToolExecutor }[] = [
  {
    def: {
      name: 'get_weather',
      description: 'Gets the current weather for a city. Returns temperature in Fahrenheit and a short condition.',
      parameters: [
        {
          name: 'location',
          type: ToolParameterType.TOOL_PARAMETER_TYPE_STRING,
          description: 'City name (e.g. "San Francisco")',
          required: true,
          enumValues: [],
        },
      ],
      category: 'Utility',
      metadata: {},
    },
    executor: async (args) => {
      const city = toolValueString(args.location) ?? 'Unknown';
      const conditions = ['Sunny', 'Partly Cloudy', 'Overcast', 'Rainy', 'Windy', 'Foggy'];
      const temp = Math.round(45 + Math.random() * 50);
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      return {
        location: tv(city),
        temperature_f: tv(temp),
        condition: tv(condition),
        humidity_pct: tv(Math.round(30 + Math.random() * 60)),
      };
    },
  },
  {
    def: {
      name: 'calculate',
      description: 'Evaluates a mathematical expression and returns the numeric result.',
      parameters: [
        {
          name: 'expression',
          type: ToolParameterType.TOOL_PARAMETER_TYPE_STRING,
          description: 'Math expression (e.g. "2 + 3 * 4")',
          required: true,
          enumValues: [],
        },
      ],
      category: 'Math',
      metadata: {},
    },
    executor: async (args): Promise<Record<string, ToolValue>> => {
      const expr = toolValueString(args.expression) ?? '0';
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s^]/g, '');
        const val = Function(`"use strict"; return (${sanitized})`)();
        return { result: tv(Number(val)), expression: tv(expr) };
      } catch {
        return { error: tv(`Invalid expression: ${expr}`) };
      }
    },
  },
  {
    def: {
      name: 'get_time',
      description: 'Returns the current date and time, optionally for a specific timezone.',
      parameters: [
        {
          name: 'timezone',
          type: ToolParameterType.TOOL_PARAMETER_TYPE_STRING,
          description: 'IANA timezone (e.g. "America/New_York"). Defaults to UTC.',
          required: false,
          enumValues: [],
        },
      ],
      category: 'Utility',
      metadata: {},
    },
    executor: async (args): Promise<Record<string, ToolValue>> => {
      const tz = toolValueString(args.timezone) ?? 'UTC';
      try {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
        return { datetime: tv(formatted), timezone: tv(tz) };
      } catch {
        return { datetime: tv(new Date().toISOString()), timezone: tv('UTC'), note: tv('Fell back to UTC — invalid timezone') };
      }
    },
  },
  {
    def: {
      name: 'random_number',
      description: 'Generates a random integer between min and max (inclusive).',
      parameters: [
        {
          name: 'min',
          type: ToolParameterType.TOOL_PARAMETER_TYPE_NUMBER,
          description: 'Minimum value',
          required: true,
          enumValues: [],
        },
        {
          name: 'max',
          type: ToolParameterType.TOOL_PARAMETER_TYPE_NUMBER,
          description: 'Maximum value',
          required: true,
          enumValues: [],
        },
      ],
      category: 'Math',
      metadata: {},
    },
    executor: async (args) => {
      const min = toolValueNumber(args.min) ?? 1;
      const max = toolValueNumber(args.max) ?? 100;
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      return { value: tv(value), min: tv(min), max: tv(max) };
    },
  },
];

// ---------------------------------------------------------------------------
// Types for the execution trace
// ---------------------------------------------------------------------------

interface TraceStep {
  type: 'user' | 'tool_call' | 'tool_result' | 'response';
  content: string;
  detail?: ToolCall | ToolResult;
}

// ---------------------------------------------------------------------------
// Custom tool form state
// ---------------------------------------------------------------------------

interface ParamDraft {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

const EMPTY_PARAM: ParamDraft = { name: '', type: 'string', description: '', required: true };

const PARAM_TYPE_WIRE: Record<ParamDraft['type'], ToolParameterType> = {
  string: ToolParameterType.TOOL_PARAMETER_TYPE_STRING,
  number: ToolParameterType.TOOL_PARAMETER_TYPE_NUMBER,
  boolean: ToolParameterType.TOOL_PARAMETER_TYPE_BOOLEAN,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolsTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_LANGUAGE);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [registeredTools, setRegisteredTools] = useState<ToolDefinition[]>([]);
  const [showToolForm, setShowToolForm] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const traceRef = useRef<HTMLDivElement>(null);

  // Custom tool form state
  const [toolName, setToolName] = useState('');
  const [toolDesc, setToolDesc] = useState('');
  const [toolParams, setToolParams] = useState<ParamDraft[]>([{ ...EMPTY_PARAM }]);

  // Register demo tools on mount
  useEffect(() => {
    RunAnywhere.toolCalling.clearTools();
    for (const { def, executor } of DEMO_TOOLS) {
      RunAnywhere.toolCalling.registerTool(def, executor);
    }
    setRegisteredTools(RunAnywhere.toolCalling.getRegisteredTools());
    return () => { RunAnywhere.toolCalling.clearTools(); };
  }, []);

  // Auto-scroll trace
  useEffect(() => {
    traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight, behavior: 'smooth' });
  }, [trace]);

  const refreshRegistry = useCallback(() => {
    setRegisteredTools(RunAnywhere.toolCalling.getRegisteredTools());
  }, []);

  // -------------------------------------------------------------------------
  // Generate with tools
  // -------------------------------------------------------------------------

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) return;

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    setInput('');
    setGenerating(true);
    setTrace([{ type: 'user', content: text }]);

    try {
      const result: ToolCallingResult = await RunAnywhere.generateWithTools(text, {
        autoExecute,
        maxToolCalls: 5,
        temperature: 0.3,
        maxTokens: 512,
        format: ToolCallFormatName.TOOL_CALL_FORMAT_NAME_JSON,
      });

      // Build trace from result
      const steps: TraceStep[] = [{ type: 'user', content: text }];

      for (let i = 0; i < result.toolCalls.length; i++) {
        const call = result.toolCalls[i];
        const argSummary = Object.entries(JSON.parse(call.argumentsJson || '{}') as Record<string, unknown>)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ');
        steps.push({
          type: 'tool_call',
          content: `${call.name}(${argSummary})`,
          detail: call,
        });

        if (result.toolResults[i]) {
          const res = result.toolResults[i];
          const resultStr = res.success ? summarizeJson(res.resultJson) : (res.error ?? 'Unknown error');
          steps.push({
            type: 'tool_result',
            content: res.success ? resultStr : `Error: ${resultStr}`,
            detail: res,
          });
        }
      }

      if (result.text) {
        steps.push({ type: 'response', content: result.text });
      }

      setTrace(steps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTrace((prev) => [...prev, { type: 'response', content: `Error: ${msg}` }]);
    } finally {
      setGenerating(false);
    }
  }, [input, generating, autoExecute, loader]);

  // -------------------------------------------------------------------------
  // Register custom tool
  // -------------------------------------------------------------------------

  const addParam = () => setToolParams((p) => [...p, { ...EMPTY_PARAM }]);

  const updateParam = (idx: number, field: keyof ParamDraft, value: string | boolean) => {
    setToolParams((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removeParam = (idx: number) => {
    setToolParams((prev) => prev.filter((_, i) => i !== idx));
  };

  const registerCustomTool = () => {
    const name = toolName.trim().replace(/\s+/g, '_').toLowerCase();
    const desc = toolDesc.trim();
    if (!name || !desc) return;

    const params = toolParams
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        type: PARAM_TYPE_WIRE[p.type],
        description: p.description.trim() || p.name.trim(),
        required: p.required,
        enumValues: [],
      }));

    const def: ToolDefinition = { name, description: desc, parameters: params, category: 'Custom', metadata: {} };

    // Mock executor that returns the args back as acknowledgement
    const executor: ToolExecutor = async (args) => {
      const result: Record<string, ToolValue> = {
        status: tv('executed'),
        tool: tv(name),
      };
      for (const [k, v] of Object.entries(args)) {
        result[`input_${k}`] = v;
      }
      return result;
    };

    RunAnywhere.toolCalling.registerTool(def, executor);
    refreshRegistry();
    setToolName('');
    setToolDesc('');
    setToolParams([{ ...EMPTY_PARAM }]);
    setShowToolForm(false);
  };

  const unregisterTool = (name: string) => {
    RunAnywhere.toolCalling.unregisterTool(name);
    refreshRegistry();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="tab-panel tools-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />

      {/* Toolbar */}
      <div className="tools-toolbar">
        <button
          className={`btn btn-sm ${showRegistry ? 'btn-primary' : ''}`}
          onClick={() => { setShowRegistry(!showRegistry); setShowToolForm(false); }}
        >
          🔧 Tools ({registeredTools.length})
        </button>
        <button
          className={`btn btn-sm ${showToolForm ? 'btn-primary' : ''}`}
          onClick={() => { setShowToolForm(!showToolForm); setShowRegistry(false); }}
        >
          + Add Tool
        </button>
        <label className="tools-toggle">
          <input type="checkbox" checked={autoExecute} onChange={(e) => setAutoExecute(e.target.checked)} />
          Auto-execute
        </label>
      </div>

      {/* Tool registry panel */}
      {showRegistry && (
        <div className="tools-registry">
          <h4>Registered Tools</h4>
          {registeredTools.length === 0 && <p className="text-muted">No tools registered</p>}
          {registeredTools.map((t) => (
            <div key={t.name} className="tool-card">
              <div className="tool-card-header">
                <strong>{t.name}</strong>
                {t.category && <span className="tool-category">{t.category}</span>}
                <button className="btn btn-sm tool-remove" onClick={() => unregisterTool(t.name)}>×</button>
              </div>
              <p className="tool-card-desc">{t.description}</p>
              {t.parameters.length > 0 && (
                <div className="tool-params">
                  {t.parameters.map((p) => (
                    <span key={p.name} className="tool-param">
                      {p.name}: {paramTypeLabel(p.type)}{p.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Custom tool form */}
      {showToolForm && (
        <div className="tools-form">
          <h4>Register Custom Tool</h4>
          <input
            className="tools-input"
            placeholder="Tool name (e.g. search_web)"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
          />
          <input
            className="tools-input"
            placeholder="Description (e.g. Searches the web for a query)"
            value={toolDesc}
            onChange={(e) => setToolDesc(e.target.value)}
          />
          <div className="tools-form-section">
            <span className="tools-form-label">Parameters</span>
            {toolParams.map((p, i) => (
              <div key={i} className="tools-param-row">
                <input
                  className="tools-input tools-input-sm"
                  placeholder="name"
                  value={p.name}
                  onChange={(e) => updateParam(i, 'name', e.target.value)}
                />
                <select
                  className="tools-input tools-input-sm"
                  value={p.type}
                  onChange={(e) => updateParam(i, 'type', e.target.value)}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
                <input
                  className="tools-input tools-input-sm"
                  placeholder="description"
                  value={p.description}
                  onChange={(e) => updateParam(i, 'description', e.target.value)}
                />
                <label className="tools-checkbox">
                  <input type="checkbox" checked={p.required} onChange={(e) => updateParam(i, 'required', e.target.checked)} />
                  req
                </label>
                {toolParams.length > 1 && (
                  <button className="btn btn-sm" onClick={() => removeParam(i)}>×</button>
                )}
              </div>
            ))}
            <button className="btn btn-sm" onClick={addParam}>+ Param</button>
          </div>
          <div className="tools-form-actions">
            <button className="btn btn-primary btn-sm" onClick={registerCustomTool} disabled={!toolName.trim() || !toolDesc.trim()}>
              Register Tool
            </button>
            <button className="btn btn-sm" onClick={() => setShowToolForm(false)}>Cancel</button>
          </div>
          <p className="tools-form-hint">
            Custom tools use a mock executor that echoes back the arguments. Replace with real logic in code.
          </p>
        </div>
      )}

      {/* Execution trace */}
      <div className="tools-trace" ref={traceRef}>
        {trace.length === 0 && (
          <div className="empty-state">
            <h3>Tool Calling</h3>
            <p>{'Ask a question that requires tools — e.g. "What\'s the weather in Tokyo?" or "What is 42 * 17?"'}</p>
            <div className="tools-examples">
              <button className="btn btn-sm" onClick={() => setInput('What is the weather in San Francisco?')}>🌤️ Weather</button>
              <button className="btn btn-sm" onClick={() => setInput('What is 123 * 456 + 789?')}>🧮 Calculate</button>
              <button className="btn btn-sm" onClick={() => setInput('What time is it in Tokyo?')}>🕐 Time</button>
              <button className="btn btn-sm" onClick={() => setInput('Give me a random number between 1 and 1000')}>🎲 Random</button>
            </div>
          </div>
        )}
        {trace.map((step, i) => (
          <div key={i} className={`trace-step trace-${step.type}`}>
            <div className="trace-label">
              {step.type === 'user' && '👤 User'}
              {step.type === 'tool_call' && '🔧 Tool Call'}
              {step.type === 'tool_result' && '📦 Result'}
              {step.type === 'response' && '🤖 Response'}
            </div>
            <div className="trace-content">
              <pre>{step.content}</pre>
            </div>
          </div>
        ))}
        {generating && (
          <div className="trace-step trace-loading">
            <div className="trace-label">⏳ Generating...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          type="text"
          placeholder="Ask something that needs tools..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={generating}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || generating}>
          {generating ? 'Running...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
