import 'server-only';
import { getSettings } from '@/lib/settings';
import type { LLMProvider } from './provider';
import { NullProvider } from './provider';
import { OllamaProvider } from './ollama';

export type { LLMProvider } from './provider';

/** Resolve the configured LLM provider from instance settings (NullProvider if none). */
export async function getConfiguredProvider(): Promise<LLMProvider> {
  const s = await getSettings();
  if (s.llmProvider === 'OLLAMA' && s.llmBaseUrl && s.llmModel) {
    return new OllamaProvider(s.llmBaseUrl, s.llmModel, s.llmTimeoutMs);
  }
  // ANTHROPIC / OPENAI adapters drop in here later (keys via decryptSecret(s.llmApiKeyEnc)).
  return new NullProvider();
}
