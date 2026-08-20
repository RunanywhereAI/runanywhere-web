import { describe, expect, it } from 'vitest';
import { getCatalog } from './model-catalog';
import { modelOrg } from './model-display';
import type { CatalogEntry } from './model-catalog';
import { InferenceFramework, ModelCategory } from '@runanywhere/web';

function entry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    category: ModelCategory.MODEL_CATEGORY_LANGUAGE,
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
  } as CatalogEntry;
}

describe('modelOrg', () => {
  it('keeps Nemotron under NVIDIA, not Meta', () => {
    expect(modelOrg(entry('nemotron_nano_8b', 'Llama 3.1 Nemotron Nano 8B')).name).toBe('NVIDIA');
    expect(modelOrg(entry('llama-3.1-nemotron-nano-4b', 'NVIDIA Nemotron Nano 4B')).name).toBe('NVIDIA');
    expect(modelOrg(entry('llama-2-7b-chat', 'Llama 2 7B Chat')).name).toBe('Meta');
  });

  it('groups NVIDIA speech under NVIDIA', () => {
    expect(modelOrg(entry('parakeet_ctc_1_1b', 'Parakeet CTC 1.1B')).name).toBe('NVIDIA');
    expect(modelOrg(entry('sherpa-nemo-canary-180m', 'Canary 180M Flash')).name).toBe('NVIDIA');
    expect(modelOrg(entry('whisper-base', 'Whisper Base')).name).toBe('OpenAI');
  });

  it('keeps DeepSeek ahead of Qwen ancestry', () => {
    expect(modelOrg(entry('deepseek_r1_distill_qwen_1_5b', 'DeepSeek R1 Distill Qwen')).name).toBe('DeepSeek');
    expect(modelOrg(entry('qwen3-4b', 'Qwen3 4B')).name).toBe('Alibaba');
  });

  it('files the publishers the catalog rebuild introduced', () => {
    expect(modelOrg(entry('granite-4.1-3b-q4_k_m', 'IBM Granite 4.1 3B')).name).toBe('IBM');
    expect(modelOrg(entry('maple-preview-tq1_0', 'Maple Preview 20B-A1B')).name).toBe('Deepgrove');
    expect(modelOrg(entry('muse-glimmer-30b-q4_k_xl', 'Meta Muse Glimmer 30B')).name).toBe('Meta');
    expect(modelOrg(entry('fara1.5-4b-q4_k_m', 'Fara1.5 4B Computer-Use Agent')).name).toBe('Microsoft');
  });

  // The rules are hand-kept and the catalog is edited in its own PR, so the
  // thing worth locking is coverage rather than any single mapping: nothing
  // should reach the picker as an unnamed publisher.
  it('leaves nothing in the catalog without a named publisher', () => {
    const community = /piper|silero|minilm|supertonic|vits/;
    const unnamed = getCatalog()
      .filter((e) => !community.test(e.id))
      .filter((e) => modelOrg(e).key === 'open-source')
      .map((e) => e.id);
    expect(unnamed).toEqual([]);
  });
});
