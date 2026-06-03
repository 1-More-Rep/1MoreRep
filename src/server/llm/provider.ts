import 'server-only';

export interface LlmCompleteRequest {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
}

export interface LlmContext {
  timeoutMs?: number;
}

export interface LLMProvider {
  kind: string;
  isConfigured(): boolean;
  health(): Promise<boolean>;
  complete(req: LlmCompleteRequest, ctx?: LlmContext): Promise<{ text: string }>;
}

/** Provider used when no LLM is configured — every feature falls back to it. */
export class NullProvider implements LLMProvider {
  kind = 'NONE';
  isConfigured() {
    return false;
  }
  async health() {
    return false;
  }
  async complete(): Promise<{ text: string }> {
    throw new Error('No LLM configured');
  }
}
