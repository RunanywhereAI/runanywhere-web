export type ChatResponseType = 'answer' | 'workout_plan' | 'diet_plan' | 'tips';

export interface CoachResponse {
  type: ChatResponseType;
  title: string;
  summary: string;
  content_markdown: string;
  plan: Record<string, unknown> | null;
  warnings: string[];
  follow_up_questions: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  parsed?: CoachResponse;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
}
