import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loop } from '../src/agent.mjs';
import { scriptProvider } from '../src/provider.mjs';
import { AuditLog } from '../src/trust.mjs';

const tools = {
  add: { run: async (a) => (a.a ?? 0) + (a.b ?? 0) },
  boom: { run: async () => { throw new Error('explode'); } },
};

test('agent loop: tool-call then final answer', async () => {
  const provider = scriptProvider([
    { text: '', tool_calls: [{ name: 'add', args: { a: 2, b: 3 } }] },
    { text: 'sum is 5' },
  ]);
  const res = await loop({ provider, tools, messages: [{ role: 'user', content: 'add' }] });
  assert.equal(res.ok, true);
  assert.equal(res.value, 'sum is 5');
  assert.equal(res.iters, 2);
});

test('agent loop: immediate final (no tools)', async () => {
  const provider = scriptProvider([{ text: 'hello' }]);
  const res = await loop({ provider, tools, messages: [] });
  assert.equal(res.ok, true);
  assert.equal(res.iters, 1);
});

test('agent loop: unknown tool → failure-as-value, continues', async () => {
  const audit = new AuditLog();
  const provider = scriptProvider([
    { text: '', tool_calls: [{ name: 'nope', args: {} }] },
    { text: 'done' },
  ]);
  const res = await loop({ provider, tools, messages: [], audit });
  assert.equal(res.ok, true);
  const calls = audit.entries.filter((e) => e.type === 'tool.call');
  assert.equal(calls[0].payload.ok, false);
});

test('agent loop: throwing tool → failure-as-value, continues', async () => {
  const provider = scriptProvider([
    { text: '', tool_calls: [{ name: 'boom', args: {} }] },
    { text: 'recovered' },
  ]);
  const res = await loop({ provider, tools, messages: [] });
  assert.equal(res.ok, true);
  assert.equal(res.value, 'recovered');
});

test('agent loop: max iterations → failure-as-value', async () => {
  const provider = scriptProvider([{ text: '', tool_calls: [{ name: 'add', args: { a: 1, b: 1 } }] }]);
  const res = await loop({ provider, tools, messages: [], maxIter: 3 });
  assert.equal(res.ok, false);
  assert.match(res.error, /max iterations/);
  assert.equal(res.iters, 3);
});
