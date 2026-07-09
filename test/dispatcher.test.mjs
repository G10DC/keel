import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/dispatcher.mjs';

const step = (id, deps, runFn) => ({ id, deps, run: runFn });

test('dispatcher: sequential deps respected, results recorded', async () => {
  const order = [];
  const res = await run([
    step('a', [], () => { order.push('a'); return { ok: true, value: 1 }; }),
    step('b', ['a'], () => { order.push('b'); return { ok: true, value: 2 }; }),
  ]);
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(res.ok, true);
  assert.equal(res.results.get('a').value, 1);
});

test('dispatcher: independent steps run concurrently', async () => {
  const t0 = Date.now();
  const slow = () => new Promise((r) => setTimeout(() => r({ ok: true, value: 's' }), 40));
  const res = await run([step('a', [], () => slow()), step('b', [], () => slow()), step('c', [], () => slow())]);
  assert.equal(res.ok, true);
  assert.ok(Date.now() - t0 < 100, 'expected parallel (<100ms)');
});

test('dispatcher: failure-as-value (throwing step does not crash)', async () => {
  const res = await run([step('a', [], () => { throw new Error('boom'); })]);
  assert.equal(res.ok, false);
  assert.equal(res.results.get('a').ok, false);
  assert.match(res.results.get('a').error, /boom/);
});

test('dispatcher: failed dep skips dependent', async () => {
  const res = await run([
    step('a', [], () => { throw new Error('x'); }),
    step('b', ['a'], () => ({ ok: true, value: 'b' })),
  ]);
  assert.equal(res.ok, false);
  assert.equal(res.results.get('a').ok, false);
  assert.equal(res.results.get('b').ok, false);
  assert.match(res.results.get('b').error, /dep failed/);
});
