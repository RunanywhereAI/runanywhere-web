/**
 * Split PDF text into overlapping chunks for LLM context windows.
 */

import type { ParsedPDF, DocumentChunk } from '../../types';

const CHUNK_SIZE = 800; // ~800 tokens (approx chars)
const OVERLAP = 100;

export function chunkDocument(pdf: ParsedPDF): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkId = 0;

  for (let pageIdx = 0; pageIdx < pdf.pages.length; pageIdx++) {
    const pageText = pdf.pages[pageIdx];
    if (!pageText.trim()) continue;

    let start = 0;
    while (start < pageText.length) {
      const end = Math.min(start + CHUNK_SIZE, pageText.length);
      const text = pageText.slice(start, end).trim();

      if (text.length > 0) {
        chunks.push({
          id: `${pdf.hash}-${chunkId++}`,
          filename: pdf.filename,
          pageNumber: pageIdx + 1,
          text,
          startIndex: start,
          endIndex: end,
        });
      }

      if (end >= pageText.length) break;
      start = end - OVERLAP;
    }
  }

  return chunks;
}

/**
 * Simple keyword relevance scoring for chunk retrieval.
 * Returns chunks sorted by relevance (most relevant first).
 */
export function findRelevantChunks(
  chunks: DocumentChunk[],
  query: string,
  maxChunks = 5
): DocumentChunk[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = chunks.map(chunk => {
    const text = chunk.text.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      const regex = new RegExp(word, 'gi');
      const matches = text.match(regex);
      score += matches ? matches.length : 0;
    }
    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map(s => s.chunk);
}

/**
 * Build context string from chunks for LLM prompts.
 */
export function buildContextFromChunks(chunks: DocumentChunk[]): string {
  return chunks
    .map(c => `[${c.filename}, Page ${c.pageNumber}]\n${c.text}`)
    .join('\n\n---\n\n');
}

/**
 * Estimate total token count from chunks (rough: 1 token ≈ 4 chars).
 */
export function estimateTokenCount(chunks: DocumentChunk[]): number {
  const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
  return Math.ceil(totalChars / 4);
}
