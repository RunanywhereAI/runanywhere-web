import type { CoachResponse } from '../types/chat';

const allowedTypes = new Set(['answer', 'workout_plan', 'diet_plan', 'tips']);

export function safeParseCoachResponse(raw: string): CoachResponse | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return null;
    if (!allowedTypes.has(String(obj.type))) return null;
    if (typeof obj.title !== 'string' || typeof obj.summary !== 'string' || typeof obj.content_markdown !== 'string') return null;
    if (!Array.isArray(obj.warnings) || !obj.warnings.every((v) => typeof v === 'string')) return null;
    if (!Array.isArray(obj.follow_up_questions) || !obj.follow_up_questions.every((v) => typeof v === 'string')) return null;
    const plan = obj.plan;
    if (!(plan === null || typeof plan === 'object')) return null;
    return {
      type: obj.type as CoachResponse['type'],
      title: obj.title as string,
      summary: obj.summary as string,
      content_markdown: obj.content_markdown as string,
      plan: (obj.plan as Record<string, unknown> | null) ?? null,
      warnings: obj.warnings as string[],
      follow_up_questions: obj.follow_up_questions as string[],
    };
  } catch {
    return null;
  }
}

export function buildFallbackResponse(text: string): CoachResponse {
  return {
    type: 'answer',
    title: 'Coach guidance',
    summary: 'I responded in safe fallback mode because structured output validation failed.',
    content_markdown: text,
    plan: null,
    warnings: [
      'This guidance is educational only and not medical advice.',
      'For pain, injury, or medical conditions, consult a qualified professional.',
    ],
    follow_up_questions: ['Would you like a safer beginner version?', 'Should I create a weekly plan?'],
  };
}
