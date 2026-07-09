import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockProvider, withCircuitBreaker } from '../src/provider.mjs';

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
