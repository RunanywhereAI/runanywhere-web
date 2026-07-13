import { useState, useEffect } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { ChatTab } from './components/ChatTab';
import { VisionTab } from './components/VisionTab';
import { VoiceTab } from './components/VoiceTab';
import { ToolsTab } from './components/ToolsTab';
import { TranscribeTab } from './components/TranscribeTab';
import { SpeakTab } from './components/SpeakTab';
import { VadTab } from './components/VadTab';
import { DocumentsTab } from './components/DocumentsTab';
import { EmbeddingsTab } from './components/EmbeddingsTab';
import { StructuredOutputTab } from './components/StructuredOutputTab';

type Tab =
  | 'chat'
  | 'vision'
  | 'voice'
  | 'tools'
  | 'stt'
  | 'tts'
  | 'vad'
  | 'docs'
  | 'embed'
  | 'structured';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: '💬 Chat' },
  { id: 'vision', label: '📷 Vision' },
  { id: 'voice', label: '🎙️ Voice' },
  { id: 'tools', label: '🔧 Tools' },
  { id: 'stt', label: '📝 Transcribe' },
  { id: 'tts', label: '🔊 Speak' },
  { id: 'vad', label: '📊 VAD' },
  { id: 'docs', label: '📚 Docs' },
  { id: 'embed', label: '🧮 Embeddings' },
  { id: 'structured', label: '🧩 JSON' },
];

export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  useEffect(() => {
    initSDK()
      .then(() => setSdkReady(true))
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (sdkError) {
    return (
      <div className="app-loading">
        <h2>SDK Error</h2>
        <p className="error-text">{sdkError}</p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>Loading RunAnywhere SDK...</h2>
        <p>Initializing on-device AI engine</p>
      </div>
    );
  }

  const accel = getAccelerationMode();

  return (
    <div className="app">
      <header className="app-header">
        <h1>RunAnywhere AI</h1>
        {accel && <span className="badge">{accel === 'webgpu' ? 'WebGPU' : 'CPU'}</span>}
      </header>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'vision' && <VisionTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'stt' && <TranscribeTab />}
        {activeTab === 'tts' && <SpeakTab />}
        {activeTab === 'vad' && <VadTab />}
        {activeTab === 'docs' && <DocumentsTab />}
        {activeTab === 'embed' && <EmbeddingsTab />}
        {activeTab === 'structured' && <StructuredOutputTab />}
      </main>
    </div>
  );
}
