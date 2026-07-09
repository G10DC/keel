import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/dispatcher.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('dispatcher: maxParallel limits concurrency', async () => {
  let active = 0;
  let maxActive = 0;
  const mk = (id) => ({
    id,
    run: async () => { active += 1; maxActive = Math.max(maxActive, active); await sleep(30); active -= 1; return { ok: true }; },
  });
  await run([mk('a'), mk('b'), mk('c'), mk('d')], { maxParallel: 2 });
  assert.ok(maxActive <= 2, `expected max 2 concurrent, got ${maxActive}`);
});

test('dispatcher: step timeout → failure-as-value', async () => {
  const res = await run([{ id: 'a', timeoutMs: 50, run: async () => { await sleep(200); return { ok: true }; } }]);
  assert.equal(res.ok, false);
  assert.match(res.results.get('a').error, /timeout/);
});

test('dispatcher: step retry recovers after transient failures', async () => {
  let calls = 0;
  const res = await run([{
    id: 'a',
    retry: { count: 3, baseMs: 1 },
    run: () => { calls += 1; if (calls < 3) return { ok: false, error: 'x' }; return { ok: true, value: calls }; },
  }]);
  assert.equal(res.ok, true);
  assert.equal(res.results.get('a').value, 3);
});

test('dispatcher: step retry exhausted → failure', async () => {
  const res = await run([{ id: 'a', retry: { count: 2, baseMs: 1 }, run: () => ({ ok: false, error: 'always' }) }]);
  assert.equal(res.ok, false);
  assert.match(res.results.get('a').error, /always/);
});
