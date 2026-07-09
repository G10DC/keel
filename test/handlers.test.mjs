import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/dispatcher.mjs';
import { getHandler, registerHandler, clearHandlers, registerBuiltins } from '../src/handlers.mjs';
import { mockProvider } from '../src/provider.mjs';

test('handlers: builtins registered on load', () => {
  assert.equal(typeof getHandler('literal'), 'function');
  assert.equal(typeof getHandler('llm'), 'function');
});

test('handlers: register / get / clear', async () => {
  registerHandler('custom', async () => ({ ok: true, value: 1 }));
  assert.equal((await getHandler('custom')({})).value, 1);
  clearHandlers();
  registerBuiltins();
  assert.equal(getHandler('custom'), undefined);
});

test('dispatcher: declarative literal step', async () => {
  const res = await run([{ id: 'a', kind: 'literal', config: { value: 42 } }], {});
  assert.equal(res.ok, true);
  assert.equal(res.results.get('a').value, 42);
});

test('dispatcher: declarative llm step uses provider', async () => {
  const provider = mockProvider({ q: 'A' });
  const res = await run([{ id: 'a', kind: 'llm', config: { messages: [{ role: 'user', content: 'q' }] } }], { provider });
  assert.equal(res.ok, true);
  assert.equal(res.results.get('a').value, 'A');
});

test('dispatcher: unknown kind → failure-as-value', async () => {
  const res = await run([{ id: 'a', kind: 'nope' }], {});
  assert.equal(res.ok, false);
  assert.match(res.results.get('a').error, /unknown step kind/);
});

test('dispatcher: function-step and declarative step coexist (deps respected)', async () => {
  const order = [];
  const res = await run([
    { id: 'a', kind: 'literal', config: { value: 1 } },
    { id: 'b', deps: ['a'], run: () => { order.push('b'); return { ok: true }; } },
  ], {});
  assert.equal(res.ok, true);
  assert.deepEqual(order, ['b']);
});
