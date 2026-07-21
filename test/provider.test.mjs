import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockProvider, withCircuitBreaker, fetchProvider } from '../src/provider.mjs';

test('mockProvider.complete returns canned text', async () => {
  const p = mockProvider({ hi: 'HELLO' });
  const r = await p.complete({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(r.text, 'HELLO');
});

test('circuit breaker: OPEN after threshold failures, fast-fail, HALF_OPEN then CLOSE on success', async () => {
  let fail = true;
  const flaky = { async complete() { if (fail) throw new Error('boom'); return { text: 'ok' }; } };
  const cb = withCircuitBreaker(flaky, { threshold: 3, resetMs: 30, retries: 0, baseBackoffMs: 1 });
  for (let i = 0; i < 3; i++) await assert.rejects(() => cb.complete({}));
  assert.equal(cb.state(), 'OPEN');
  await assert.rejects(() => cb.complete({}), /circuit open/);
  await new Promise((r) => setTimeout(r, 40));
  fail = false;
  const r = await cb.complete({});
  assert.equal(r.text, 'ok');
  assert.equal(cb.state(), 'CLOSED');
});

test('circuit breaker: eventual success after transient failures (retry + backoff)', async () => {
  let calls = 0;
  const transient = { async complete() { calls += 1; if (calls < 3) throw new Error('x'); return { text: 'win' }; } };
  const cb = withCircuitBreaker(transient, { threshold: 10, retries: 3, baseBackoffMs: 1 });
  const r = await cb.complete({});
  assert.equal(r.text, 'win');
});

test('fetchProvider: parses OpenAI-compatible response (injected fetch)', async () => {
  let sent;
  const fakeFetch = async (url, opts) => { sent = { url, opts }; return { ok: true, json: async () => ({ choices: [{ message: { content: 'hi there' } }], usage: { total_tokens: 5 } }) }; };
  const p = fetchProvider({ endpoint: 'https://x/v1/chat/completions', model: 'model-x', fetchImpl: fakeFetch });
  const r = await p.complete({ messages: [{ role: 'user', content: 'q' }] });
  assert.equal(r.text, 'hi there');
  assert.equal(r.meta.usage.total_tokens, 5);
  assert.equal(sent.opts.headers['content-type'], 'application/json');
});

test('fetchProvider: sends authorization only when apiKey provided', async () => {
  let hdr;
  const f = async (u, o) => { hdr = o.headers; return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) }; };
  await fetchProvider({ endpoint: 'u', model: 'm', fetchImpl: f }).complete({ messages: [] });
  assert.ok(!('authorization' in hdr));
  await fetchProvider({ endpoint: 'u', model: 'm', apiKey: 'test-key', fetchImpl: f }).complete({ messages: [] });
  assert.equal(hdr.authorization, 'Bearer test-key');
});

test('fetchProvider: throws on http error', async () => {
  const f = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(() => fetchProvider({ endpoint: 'u', model: 'm', fetchImpl: f }).complete({ messages: [] }), /http 500/);
});

test('fetchProvider: throws if no fetch available', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = undefined;
  try {
    await assert.rejects(() => fetchProvider({ endpoint: 'u', model: 'm' }).complete({ messages: [] }), /no fetch/);
  } finally {
    globalThis.fetch = saved;
  }
});
