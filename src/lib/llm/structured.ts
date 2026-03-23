/**
 * Structured JSON output helpers.
 * Wraps JSON.parse in try/catch and validates structure.
 */

import type { ChapterOutline, CitationsResult, CitationEntry, CitationStyle } from '../../types';

export function safeParseJSON<T>(text: string): T | null {
  try {
    // Try to extract JSON from the text (model might add prose around it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

export function parseOutline(raw: string): ChapterOutline | null {
  const parsed = safeParseJSON<ChapterOutline>(raw);
  if (!parsed || !parsed.chapters || !Array.isArray(parsed.chapters)) return null;
  return parsed;
}

export function parseCitations(raw: string): CitationsResult | null {
  const parsed = safeParseJSON<CitationsResult>(raw);
  if (!parsed || !parsed.citations || !Array.isArray(parsed.citations)) return null;
  return parsed;
}

// ── Citation formatting ──

export function formatCitation(entry: CitationEntry, style: CitationStyle): string {
  const { title, authors, year, venue, pages } = entry;
  const authorStr = authors.join(', ');

  switch (style) {
    case 'APA':
      return `${authorStr} (${year}). ${title}. *${venue}*${pages ? `, ${pages}` : ''}.`;
    case 'MLA':
      return `${authorStr}. "${title}." *${venue}*${year ? `, ${year}` : ''}${pages ? `, pp. ${pages}` : ''}.`;
    case 'IEEE':
      return `${authorStr}, "${title}," *${venue}*${year ? `, ${year}` : ''}${pages ? `, pp. ${pages}` : ''}.`;
    default:
      return `${authorStr}. ${title}. ${venue}, ${year}.`;
  }
}

export function formatAllCitations(entries: CitationEntry[], style: CitationStyle): string {
  return entries
    .map((e, i) => `[${i + 1}] ${formatCitation(e, style)}`)
    .join('\n\n');
}

export function toBibTeX(entries: CitationEntry[]): string {
  return entries.map((e, i) => {
    const key = e.authors[0]?.split(' ').pop()?.toLowerCase() ?? 'unknown';
    return `@article{${key}${e.year ?? i},
  title     = {${e.title}},
  author    = {${e.authors.join(' and ')}},
  year      = {${e.year}},
  journal   = {${e.venue}},
  pages     = {${e.pages || 'n/a'}}
}`;
  }).join('\n\n');
}
