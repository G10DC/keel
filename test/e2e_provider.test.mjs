import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchProvider } from '../src/provider.mjs';

// Closes the gap: fetchProvider tested against a REAL (local) OpenAI-compatible HTTP server,
// not just an injected fetch — proves the boundary works end-to-end without external keys.
test('fetchProvider: end-to-end against a local OpenAI-compatible server', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'real-e2e' } }], usage: { total_tokens: 3 } }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const p = fetchProvider({ endpoint: `http://127.0.0.1:${port}/v1/chat/completions`, model: 'local' });
    const r = await p.complete({ messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(r.text, 'real-e2e');
    assert.equal(r.meta.usage.total_tokens, 3);
  } finally {
    server.close();
  }
});
