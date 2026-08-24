import { createHash } from 'node:crypto';

/**
 * Freeze a value and everything reachable from it.
 *
 * `Object.freeze` is shallow, and every use of it in this file was a claim of
 * immutability that a nested object quietly falsified. Cheap here: policies, provenance
 * tags and audit entries are all small, and each is frozen exactly once.
 */
const deepFreeze = (v) => {
  if (v === null || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const k of Object.getOwnPropertyNames(v)) deepFreeze(v[k]);
  return v;
};

/**
 * Create a frozen per-task policy. Mutating any field throws — the policy is immutable
 * for a task's life.
 *
 * Frozen DEEPLY, which is what that sentence has to mean to be worth anything. The
 * shallow version froze the three containers and left everything inside them writable:
 * a tool declared as `{ name: 'write', scope: { paths: ['lib/'] } }` could have `/etc`
 * pushed into its scope after the policy was sealed, and a credential could be swapped.
 * A policy that can be widened after it is frozen is not a policy.
 */
export function createPolicy({ instructions = [], tools = [], creds = {} } = {}) {
  return deepFreeze({
    instructions: [...instructions],
    tools: [...tools],
    creds: { ...creds },
  });
}

/** Split messages into instructions (system/instruction roles) vs data (everything else).
 *  The instruction/data partition IS the trust boundary. */
export function separateInstructionData(messages) {
  // A bare string is the one wrong input that would NOT throw here, because
  // strings are iterable: the loop would walk it character by character, find no
  // `role` on any of them, and file all of it under `data`. The result looks
  // perfectly well-formed -- `instructions: []`, which is also the safest-looking
  // outcome this function can produce -- while no separation has happened at all.
  //
  // It is also the likeliest mistake, since untrusted content usually arrives as
  // a string. Everything else already fails loudly (`not iterable`), so this is
  // the only hole that needed closing.
  if (typeof messages === 'string') {
    throw new TypeError(
      'separateInstructionData expects an array of {role, content} messages, not a string. ' +
      'A string would be iterated character by character and silently classified as data.'
    );
  }
  if (!Array.isArray(messages)) {
    throw new TypeError(`separateInstructionData expects an array of messages, received ${messages === null ? 'null' : typeof messages}.`);
  }

  const instructions = [];
  const data = [];
  for (const m of messages) {
    if (m && (m.role === 'system' || m.role === 'instruction')) instructions.push(m);
    else data.push(m);
  }
  return { instructions, data };
}

/**
 * Tag content with provenance (source + timestamp). Frozen deeply.
 *
 * `content` is untrusted by construction — that is the whole reason it carries a source.
 * Freezing only the wrapper left structured content editable after tagging, so the tag
 * could outlive the thing it was vouching for.
 */
export function provenance({ source, content }, ts = Date.now()) {
  return deepFreeze({ source, content, ts });
}

const canonical = (obj) => {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
};
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const GENESIS = sha('keel-genesis');

/** Append-only, hash-chained audit log → tamper-evident. */
export class AuditLog {
  constructor() { this._entries = []; this._prev = GENESIS; }

  // Entries are frozen, so handing out the stored objects is safe and allocation-free.
  //
  // This used to be `this._entries.map((e) => ({ ...e }))`, which reads as "callers get
  // copies" and is not: a spread is shallow, so `payload` and `provenance` came back as
  // the SAME objects the chain was hashed over. A caller merely reading the log could
  // corrupt it -- `log.entries[0].payload.x = 1` mutated the real entry -- and `verify()`
  // then reported tampering that nobody intended.
  //
  // That is the worst failure available to this class. Its one job is telling deliberate
  // tampering apart from an intact chain, and the accessor whose visible purpose is to
  // protect the log was the way through it.
  get entries() { return this._entries; }

  append({ type, payload, provenance }) {
    const body = { type, payload, ts: Date.now(), ...(provenance ? { provenance } : {}) };
    const entry = { ...body, prev: this._prev, hash: sha(this._prev + canonical(body)) };
    // Frozen before it is stored or returned: an append-only log's entries are immutable
    // by definition, and the return value is another reference into the chain.
    deepFreeze(entry);
    this._entries.push(entry);
    this._prev = entry.hash;
    return entry;
  }
  /** Recompute the chain; true iff no entry was mutated, removed, or reordered. */
  verify() {
    let prev = GENESIS;
    for (const e of this._entries) {
      if (e.prev !== prev) return false;
      const body = { type: e.type, payload: e.payload, ts: e.ts, ...(e.provenance ? { provenance: e.provenance } : {}) };
      if (e.hash !== sha(prev + canonical(body))) return false;
      prev = e.hash;
    }
    return true;
  }
}
