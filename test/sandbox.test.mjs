import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runShell } from '../src/sandbox.mjs';
import { run } from '../src/dispatcher.mjs';

test('runShell: success captures stdout', async () => {
  const r = await runShell('echo keel');
  assert.equal(r.ok, true);
  assert.match(r.value, /keel/);
});

test('runShell: timeout → failure-as-value', async () => {
  const slow = process.platform === 'win32' ? 'ping -n 5 127.0.0.1' : 'sleep 2';
  const r = await runShell(slow, { timeoutMs: 300 });
  assert.equal(r.ok, false);
  assert.match(r.error, /timeout/);
});

test('runShell: non-zero exit → failure-as-value', async () => {
  const r = await runShell('keel_no_such_cmd_xyz_123');
  assert.equal(r.ok, false);
  assert.match(r.error, /exit/);
});

test('dispatcher: declarative shell step', async () => {
  const res = await run([{ id: 'a', kind: 'shell', config: { cmd: 'echo shellstep', timeoutMs: 2000 } }], {});
  assert.equal(res.ok, true);
  assert.match(res.results.get('a').value, /shellstep/);
});
