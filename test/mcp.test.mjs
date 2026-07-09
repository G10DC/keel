import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mcpMethods, serve } from '../src/mcp.mjs';

async function* lines(msgs) { for (const m of msgs) yield JSON.stringify(m); }
const sink = () => { const chunks = []; return { chunks, write(s) { this.chunks.push(s); } }; };

test('mcp: initialize returns server info', async () => {
  const m = mcpMethods();
  const r = await m.initialize();
  assert.equal(r.serverInfo.name, 'keel');
  assert.ok(r.capabilities.tools);
});

test('mcp: tools/list exposes keel_run and keel_separate', async () => {
  const m = mcpMethods();
  const r = await m['tools/list']();
  const names = r.tools.map((t) => t.name);
  assert.ok(names.includes('keel_run'));
  assert.ok(names.includes('keel_separate'));
});

test('mcp: keel_separate counts instructions vs data', async () => {
  const m = mcpMethods();
  const r = await m['tools/call']({ params: { name: 'keel_separate', arguments: { messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }] } } });
  const body = JSON.parse(r.content[0].text);
  assert.deepEqual(body, { instructions: 1, data: 1 });
});

test('mcp: keel_run runs a declarative plan, audit verifies', async () => {
  const m = mcpMethods();
  const r = await m['tools/call']({ params: { name: 'keel_run', arguments: { steps: [{ id: 'a', kind: 'literal', config: { value: 1 } }] } } });
  const body = JSON.parse(r.content[0].text);
  assert.equal(body.ok, true);
  assert.equal(body.auditOk, true);
});

test('mcp: unknown tool → error', async () => {
  const m = mcpMethods();
  await assert.rejects(() => m['tools/call']({ params: { name: 'nope' } }), /unknown tool/);
});

test('serve: dispatches JSON-RPC over injected transports', async () => {
  const out = sink();
  await serve({
    input: lines([
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ]),
    output: out,
  });
  const responses = out.chunks.map((c) => JSON.parse(c));
  assert.equal(responses[0].result.serverInfo.name, 'keel');
  assert.equal(responses[1].result.tools.length, 2);
});

test('serve: unknown method → JSON-RPC error; parse error → -32700', async () => {
  const out = sink();
  await serve({ input: lines([{ jsonrpc: '2.0', id: 9, method: 'nope' }]), output: out });
  // parse-error path: feed a bad line via a second serve call
  const out2 = sink();
  async function* bad() { yield '{ not json'; }
  await serve({ input: bad(), output: out2 });
  const r1 = JSON.parse(out.chunks[0]);
  assert.equal(r1.error.code, -32601);
  assert.equal(JSON.parse(out2.chunks[0]).error.code, -32700);
});
