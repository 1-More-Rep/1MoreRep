import 'server-only';
import { getSettings } from '@/lib/settings';
import type { LLMProvider, LlmCompleteRequest } from './provider';
import { NullProvider } from './provider';
import { OllamaProvider } from './ollama';

export type { LLMProvider } from './provider';

/**
 * Placeholder for a provider that has a settings option but no adapter yet
 * (ANTHROPIC / OPENAI). It reports itself as unconfigured and fails loudly with
 * a clear message rather than silently no-op'ing, so callers fall back to the
 * deterministic path and any "test prompt" surfaces an actionable error.
 */
class UnimplementedProvider implements LLMProvider {
  constructor(public kind: string) {}
  isConfigured() {
    return false;
  }
  async health() {
    return false;
  }
  async complete(_req: LlmCompleteRequest): Promise<{ text: string }> {
    throw new Error(`${this.kind} provider is not yet implemented. Use Ollama or None.`);
  }
}

/** Resolve the configured LLM provider from instance settings (NullProvider if none). */
export async function getConfiguredProvider(): Promise<LLMProvider> {
  const s = await getSettings();
  if (s.llmProvider === 'OLLAMA' && s.llmBaseUrl && s.llmModel) {
    return new OllamaProvider(s.llmBaseUrl, s.llmModel, s.llmTimeoutMs);
  }
  // Providers with a settings entry but no adapter yet — explicit, not silent.
  if (s.llmProvider === 'ANTHROPIC' || s.llmProvider === 'OPENAI') {
    return new UnimplementedProvider(s.llmProvider);
  }
  return new NullProvider();
}
