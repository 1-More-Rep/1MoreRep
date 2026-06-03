import 'server-only';
import type { LLMProvider, LlmCompleteRequest, LlmContext } from './provider';

/** Ollama adapter (local, private). Uses /api/chat with streaming off. */
export class OllamaProvider implements LLMProvider {
  kind = 'OLLAMA';
  constructor(
    private baseUrl: string,
    private model: string,
    private defaultTimeoutMs = 20000,
  ) {}

  isConfigured() {
    return !!this.baseUrl && !!this.model;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl.replace(/\/$/, '')}/api/tags`, {}, 2500);
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(req: LlmCompleteRequest, ctx?: LlmContext): Promise<{ text: string }> {
    const res = await fetchWithTimeout(
      `${this.baseUrl.replace(/\/$/, '')}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          ...(req.json ? { format: 'json' } : {}),
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          options: { num_predict: req.maxTokens ?? 400 },
        }),
      },
      ctx?.timeoutMs ?? this.defaultTimeoutMs,
    );
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return { text: data.message?.content ?? '' };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
