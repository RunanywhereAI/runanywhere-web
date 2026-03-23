// ── App-wide types ──

export type AppMode = 'dev' | 'research';

export type LLMStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'generating';

export type DevAction = 'explain' | 'docstring' | 'debug' | 'refactor';

export type ResearchAction = 'qa' | 'outline' | 'citations';

export type CitationStyle = 'APA' | 'MLA' | 'IEEE';

// ── LLM ──

export interface LLMProgress {
  modelId: string;
  progress: number; // 0–1
}

export interface GenerationMetrics {
  tokensUsed: number;
  tokensPerSecond: number;
  latencyMs: number;
}

// ── Documents & PDF ──

export interface ParsedPDF {
  filename: string;
  pages: string[];
  totalPages: number;
  hash: string;
}

export interface DocumentChunk {
  id: string;
  filename: string;
  pageNumber: number;
  text: string;
  startIndex: number;
  endIndex: number;
}

// ── Chat / History ──

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode: AppMode;
  action?: DevAction | ResearchAction;
  metrics?: GenerationMetrics;
  sources?: SourceAttribution[];
}

export interface ChatSession {
  id: string;
  title: string;
  mode: AppMode;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SourceAttribution {
  filename: string;
  pageNumbers: number[];
}

// ── Structured output ──

export interface ChapterOutline {
  title: string;
  chapters: ChapterEntry[];
}

export interface ChapterEntry {
  number: number;
  title: string;
  summary: string;
  sources: string[];
}

export interface CitationEntry {
  title: string;
  authors: string[];
  year: number;
  venue: string;
  pages: string;
}

export interface CitationsResult {
  citations: CitationEntry[];
}

// ── IndexedDB ──

export interface StoredDocument {
  filename: string;
  hash: string;
  chunks: DocumentChunk[];
  totalPages: number;
  addedAt: number;
}
