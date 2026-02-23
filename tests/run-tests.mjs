import assert from 'node:assert/strict';

function safeParseCoachResponse(raw) {
  try {
    const obj = JSON.parse(raw);
    const allowed = new Set(['answer', 'workout_plan', 'diet_plan', 'tips']);
    if (!allowed.has(String(obj.type))) return null;
    if (typeof obj.title !== 'string') return null;
    if (!Array.isArray(obj.warnings)) return null;
    return obj;
  } catch {
    return null;
  }
}

const parsed = safeParseCoachResponse('{"type":"tips","title":"x","summary":"y","content_markdown":"z","plan":null,"warnings":[],"follow_up_questions":[]}');
assert.equal(parsed.type, 'tips');

const session = { id: 'a', messages: [] };
const next = { ...session, messages: [...session.messages, { role: 'user' }] };
assert.equal(session.messages.length, 0);
assert.equal(next.messages.length, 1);

console.log('All checks passed');
