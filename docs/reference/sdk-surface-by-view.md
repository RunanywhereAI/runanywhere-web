# SDK surface by view

Full per-surface map of view file to SDK calls. Referenced from `AGENTS.md`;
the availability-gating rule that follows from this table lives there, not
here. The app uses the namespaced facade throughout — nothing calls the flat
deprecated aliases.

| Surface | View file | SDK calls |
|---|---|---|
| Assistant | `views/chat.ts` | `llm.generateStream`, `llm.generate`, `llm.tools.register`, `runtime.modalities.llm.status` |
| Talk | `views/voice.ts` | `voice.createSession` |
| Advanced | `app.ts` (`initAdvancedHub`) | navigation hub only, no inference |
| Image & Live | `views/vision.ts` | `vlm.generateStream`, `ImageInput.rawRgb`, `VideoCapture` |
| Transcribe | `views/transcribe.ts` | `stt.transcribe`, `stt.transcribeStream`, `AudioInput.float32`, `AudioCapture`, `AudioFileLoader` |
| Read Aloud | `views/speak.ts` | `tts.speak`, then `SpeechHandle.interrupt()` to stop |
| Voice Activity | `views/vad.ts` | `vad.detectStream`, `AudioInput.float32`, `AudioCapture` |
| Segmentation | `views/segmentation.ts` | `segmentation.segment`, `ImageInput.rawRgba`. No browser engine publishes the capability, so the catalog is empty and the view renders the unavailable placeholder |
| Diarization | `views/diarization.ts` | `diarization.diarize`, `AudioInput.float32`. Same gate as Segmentation. There is no `diarizeStream` verb on Web |
| Documents | `views/documents.ts` | `rag.open`, then `RagSession.ingest`; `models.list`, `models.get`, `models.download` |
| Downloads | `views/storage.ts` | `storage.{clearCaches,chooseDirectory,directoryName,requestAccess,isReady,backend,isSupported}`, `models.{state,list,delete}` |
| Solutions | `views/solutions.ts` | `solutions.run`, `rag.open` |
| Benchmarks | `views/benchmarks.ts` | `llm.generateStream`. LLM only; iOS also covers STT, TTS, and VLM |
| Settings | `views/settings.ts` | `setHuggingFaceToken`, `version`, `isReady`, plus the reinitialization handler in `main.ts` |
