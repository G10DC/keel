import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { Store } from '../src/store.mjs';

const tmp = () => join(tmpdir(), `keel-store-${Math.random().toString(36).slice(2)}.json`);

test('Store: in-memory get / set / delete / keys', () => {
  const s = new Store();
  s.set('a', 1);
  assert.equal(s.get('a'), 1);
  assert.deepEqual(s.keys(), ['a']);
  assert.equal(s.delete('a'), true);
  assert.equal(s.get('a'), undefined);
});

test('Store: file-backed persistence across instances', () => {
  const f = tmp();
  try {
    const s1 = new Store(f);
    s1.set('k', { x: 2 });
    const s2 = new Store(f);
    assert.deepEqual(s2.get('k'), { x: 2 });
  } finally {
    if (existsSync(f)) unlinkSync(f);
  }
});

test('Store: corrupt file degrades to empty (never throws on read)', () => {
  const f = tmp();
  writeFileSync(f, '{ not valid json');
  try {
    const s = new Store(f);
    assert.deepEqual(s.keys(), []);
  } finally {
    if (existsSync(f)) unlinkSync(f);
  }
});
