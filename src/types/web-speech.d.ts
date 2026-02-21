interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { isFinal: boolean; length: number; [index: number]: SpeechRecognitionAlternative }
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionErrorEvent extends Event { error: string }
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList }
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
