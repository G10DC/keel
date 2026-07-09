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
  const instructions = [];
  const data = [];
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'instruction') instructions.push(m);
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

/** Append-only, hash-chained audit log → tamper-evident. */
export class AuditLog {
  constructor() { this._entries = []; this._prev = GENESIS; }
  get entries() { return this._entries.map((e) => ({ ...e })); }
  append({ type, payload, provenance }) {
    const body = { type, payload, ts: Date.now(), ...(provenance ? { provenance } : {}) };
    const entry = { ...body, prev: this._prev, hash: sha(this._prev + canonical(body)) };
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
