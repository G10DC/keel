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

test('AuditLog: tamper-evident (replacing an entry breaks verify)', () => {
  const log = new AuditLog();
  log.append({ type: 'a', payload: { x: 1 } });
  log.append({ type: 'b', payload: { x: 2 } });
  // Entries are frozen, so tampering now has to replace one outright rather than edit it
  // in place. That is the point: an accident cannot do this, and the chain still catches it.
  log._entries[0] = { ...log._entries[0], payload: { x: 999 } };
  assert.equal(log.verify(), false);
});

test('AuditLog: tamper-evident (removing or reordering entries breaks verify)', () => {
  const log = new AuditLog();
  log.append({ type: 'a', payload: { x: 1 } });
  log.append({ type: 'b', payload: { x: 2 } });
  log.append({ type: 'c', payload: { x: 3 } });

  const removed = new AuditLog();
  removed._entries = [log._entries[0], log._entries[2]];
  assert.equal(removed.verify(), false);

  const reordered = new AuditLog();
  reordered._entries = [log._entries[1], log._entries[0], log._entries[2]];
  assert.equal(reordered.verify(), false);
});

// The accessor whose visible purpose is to protect the log was the way through it.
// `this._entries.map((e) => ({ ...e }))` reads as "callers get copies", and a spread is
// shallow: `payload` and `provenance` came back as the same objects the chain was hashed
// over, so merely reading the log could corrupt it.
test('AuditLog: reading the log cannot corrupt it', () => {
  const log = new AuditLog();
  log.append({ type: 'ingest', payload: { source: 'agy', bytes: 100 } });
  log.append({ type: 'ingest', payload: { source: 'agy', bytes: 200 }, provenance: { source: 'agy', ts: 1 } });
  assert.equal(log.verify(), true);

  for (const entry of log.entries) {
    assert.throws(() => { entry.payload.bytes = 999; }, TypeError);
    assert.throws(() => { entry.hash = 'forged'; }, TypeError);
    if (entry.provenance) assert.throws(() => { entry.provenance.source = 'elsewhere'; }, TypeError);
  }

  assert.equal(log.entries[0].payload.bytes, 100);
  assert.equal(log.verify(), true, 'reading the log made it report itself corrupt');
});

// append() returns another reference into the chain, not a copy of one.
test('AuditLog: the value append returns cannot corrupt the chain either', () => {
  const log = new AuditLog();
  const entry = log.append({ type: 'x', payload: { n: 1 } });
  assert.throws(() => { entry.payload.n = 2; }, TypeError);
  assert.equal(log.verify(), true);
});

// `Object.freeze` is shallow. The policy froze its three containers and left everything
// inside them writable, so a tool scope could be widened after the policy was sealed.
test('createPolicy: the policy is immutable, including inside it', () => {
  const policy = createPolicy({
    instructions: ['do the card'],
    tools: [{ name: 'write', scope: { paths: ['lib/'] } }],
    creds: { api: { key: 'secret' } },
  });

  assert.throws(() => { policy.tools.push('bash'); }, TypeError);
  assert.throws(() => { policy.creds.api.key = 'swapped'; }, TypeError);
  assert.throws(() => { policy.tools[0].scope.paths.push('/etc'); }, TypeError);
  assert.throws(() => { policy.instructions[0] = 'do something else'; }, TypeError);

  assert.equal(policy.creds.api.key, 'secret');
  assert.deepEqual(policy.tools[0].scope.paths, ['lib/']);
});

// content is untrusted by construction — that is why it carries a source at all.
test('provenance: structured content cannot be edited after it is tagged', () => {
  const tagged = provenance({ source: 'agy', content: { text: 'what the agent said' } });
  assert.throws(() => { tagged.content.text = 'something else'; }, TypeError);
  assert.equal(tagged.content.text, 'what the agent said');
});
