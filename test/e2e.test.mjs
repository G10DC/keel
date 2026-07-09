import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/dispatcher.mjs';
import { mockProvider } from '../src/provider.mjs';
import { createPolicy, separateInstructionData, AuditLog } from '../src/trust.mjs';

// Validation probe (R1): the minimal core works end-to-end — dispatcher + provider + trust + audit.
test('e2e: 3-step plan through dispatcher + provider + trust; audit verifies', async () => {
  const audit = new AuditLog();
  const policy = createPolicy({ instructions: ['answer safely'], tools: ['read'] });
  const provider = mockProvider({ 'what is 2+2?': '4' });
  const messages = [{ role: 'system', content: 'answer safely' }, { role: 'user', content: 'what is 2+2?' }];
  const { instructions, data } = separateInstructionData(messages);
  assert.equal(instructions.length, 1);
  assert.equal(data.length, 1);

  const res = await run([
    { id: 'instruct', run: (ctx) => { ctx.mailbox.set('instr', ctx.policy.instructions[0]); audit.append({ type: 'instruct', payload: {} }); return { ok: true }; } },
    { id: 'provider-call', deps: ['instruct'], run: async (ctx) => { const r = await ctx.provider.complete({ messages }); audit.append({ type: 'provider', payload: { text: r.text } }); ctx.mailbox.set('answer', r.text); return { ok: true, value: r.text }; } },
    { id: 'finalize', deps: ['provider-call'], run: (ctx) => { audit.append({ type: 'finalize', payload: { answer: ctx.mailbox.get('answer') } }); return { ok: true, value: ctx.mailbox.get('answer') }; } },
  ], { policy, audit, provider });

  assert.equal(res.ok, true);
  assert.equal(res.results.get('finalize').value, '4');
  assert.equal(audit.verify(), true);
});
