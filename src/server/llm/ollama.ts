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

/**
 * Probe an Ollama server and return its installed model names (from /api/tags).
 * Powers the admin "Check connection" flow so the model can be picked from a
 * dropdown instead of hand-typed. Throws a clear, user-facing error on failure.
 */
export async function fetchOllamaModels(baseUrl: string, timeoutMs = 2500): Promise<string[]> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/tags`, {}, timeoutMs);
  } catch {
    throw new Error('Could not reach that URL. Check the host/port and that Ollama is running.');
  }
  if (!res.ok) throw new Error(`Ollama responded ${res.status}. Is this an Ollama server?`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('That endpoint did not return JSON — it does not look like an Ollama server.');
  }
  const models = (data as { models?: unknown }).models;
  if (!Array.isArray(models)) {
    throw new Error('Unexpected response from /api/tags — this does not look like an Ollama server.');
  }
  const names = models
    .map((m) => (m && typeof m === 'object' ? (m as { name?: unknown }).name : undefined))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
