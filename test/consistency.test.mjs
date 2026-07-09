import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/dispatcher.mjs';
import { createPolicy, AuditLog } from '../src/trust.mjs';

test('dispatcher: mailbox auto-populated with each step result', async () => {
  const res = await run([
    { id: 'a', run: () => ({ ok: true, value: 1 }) },
    { id: 'b', deps: ['a'], run: (ctx) => ({ ok: true, value: (ctx.mailbox.get('a')?.value ?? 0) + 1 }) },
  ]);
  assert.equal(res.ok, true);
  assert.equal(res.results.get('b').value, 2);
});

test('dispatcher: audit logs a source-tagged step entry per step', async () => {
  const audit = new AuditLog();
  await run([
    { id: 'a', run: () => ({ ok: true }) },
    { id: 'b', run: () => ({ ok: true }) },
  ], { audit });
  const steps = audit.entries.filter((e) => e.type === 'step');
  assert.equal(steps.length, 2);
  assert.ok(steps.every((e) => e.provenance?.source?.startsWith('step:')));
  assert.equal(audit.verify(), true);
});

test('dispatcher: scoped credentials — only listed steps see creds', async () => {
  const policy = createPolicy({ instructions: [], creds: { token: 'T' } });
  const seen = {};
  await run([
    { id: 'public', run: (ctx) => { seen.public = ctx.creds; return { ok: true }; } },
    { id: 'trusted', run: (ctx) => { seen.trusted = ctx.creds; return { ok: true }; } },
  ], { policy, credSteps: ['trusted'] });
  assert.equal(seen.public, undefined);
  assert.deepEqual(seen.trusted, { token: 'T' });
});
