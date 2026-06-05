import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOllamaModels } from './ollama';

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOllamaModels', () => {
  it('parses, de-dupes and sorts model names from /api/tags', async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          models: [
            { name: 'llama3.1:8b' },
            { name: 'qwen2.5:7b' },
            { name: 'llama3.1:8b' }, // dupe
            { notName: 'ignored' },
          ],
        }),
        { status: 200 },
      ),
    );
    const models = await fetchOllamaModels('http://ollama:11434');
    expect(models).toEqual(['llama3.1:8b', 'qwen2.5:7b']);
  });

  it('strips a trailing slash from the base URL', async () => {
    const f = vi.fn(() => new Response(JSON.stringify({ models: [] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    await fetchOllamaModels('http://ollama:11434/');
    expect(f).toHaveBeenCalledWith('http://ollama:11434/api/tags', expect.anything());
  });

  it('throws a clear error when the host is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(fetchOllamaModels('http://nope:11434')).rejects.toThrow(/Could not reach/);
  });

  it('throws when the server is not an Ollama endpoint (non-2xx)', async () => {
    mockFetch(() => new Response('not found', { status: 404 }));
    await expect(fetchOllamaModels('http://x:1')).rejects.toThrow(/404/);
  });

  it('throws when the response is not the expected shape', async () => {
    mockFetch(() => new Response(JSON.stringify({ nope: true }), { status: 200 }));
    await expect(fetchOllamaModels('http://x:1')).rejects.toThrow(/does not look like an Ollama server/);
  });
});
