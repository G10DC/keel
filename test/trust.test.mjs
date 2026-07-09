import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPolicy, separateInstructionData, AuditLog, provenance } from '../src/trust.mjs';

test('createPolicy: frozen (mutation throws)', () => {
  const p = createPolicy({ instructions: ['be safe'], tools: ['read'] });
  assert.throws(() => { p.instructions.push('x'); });
  assert.throws(() => { p.creds.key = 'v'; });
});

test('separateInstructionData: instructions vs data by role', () => {
  const { instructions, data } = separateInstructionData([
    { role: 'system', content: 's' },
    { role: 'instruction', content: 'i' },
    { role: 'user', content: 'u' },
    { role: 'tool', content: 't' },
  ]);
  assert.equal(instructions.length, 2);
  assert.equal(data.length, 2);
});

test('provenance: tags content with source + ts (frozen)', () => {
  const p = provenance({ source: 'filesystem', content: 'x' }, 123);
  assert.equal(p.source, 'filesystem');
  assert.equal(p.ts, 123);
  assert.throws(() => { p.source = 'y'; });
});

test('AuditLog: hash chain verifies when clean', () => {
  const log = new AuditLog();
  log.append({ type: 'a', payload: { x: 1 } });
  log.append({ type: 'b', payload: { x: 2 } });
  assert.equal(log.verify(), true);
});

test('AuditLog: tamper-evident (mutating an entry breaks verify)', () => {
  const log = new AuditLog();
  log.append({ type: 'a', payload: { x: 1 } });
  log.append({ type: 'b', payload: { x: 2 } });
  log._entries[0].payload = { x: 999 };
  assert.equal(log.verify(), false);
});
