import { createHash } from 'node:crypto';

/** Create a frozen per-task policy. Mutating any field throws — policy is immutable for a task's life. */
export function createPolicy({ instructions = [], tools = [], creds = {} } = {}) {
  return Object.freeze({
    instructions: Object.freeze([...instructions]),
    tools: Object.freeze([...tools]),
    creds: Object.freeze({ ...creds }),
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

/** Tag content with provenance (source + timestamp). Frozen. */
export function provenance({ source, content }, ts = Date.now()) {
  return Object.freeze({ source, content, ts });
}

const canonical = (obj) => {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
};
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const GENESIS = sha('keel-genesis');

/** Recursively freeze an entry. Cheap: entries are small, and this runs once per append. */
const deepFreeze = (v) => {
  if (v === null || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const k of Object.getOwnPropertyNames(v)) deepFreeze(v[k]);
  return v;
};

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
