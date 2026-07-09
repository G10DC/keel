import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamProvider, stream, mockProvider } from '../src/provider.mjs';

test('streamProvider: emits chunks via onToken and joins the final text', async () => {
  const seen = [];
  const p = streamProvider(['Hel', 'lo', '!']);
  const r = await stream(p, { messages: [], onToken: (t) => seen.push(t) });
  assert.equal(r.text, 'Hello!');
  assert.deepEqual(seen, ['Hel', 'lo', '!']);
  assert.equal(r.tokens.length, 3);
});

test('stream: graceful fallback for a non-streaming provider', async () => {
  const seen = [];
  const p = mockProvider({ hi: 'HI' });
  const r = await stream(p, { messages: [{ role: 'user', content: 'hi' }], onToken: (t) => seen.push(t) });
  assert.equal(r.text, 'HI');
  assert.deepEqual(seen, []);
});
