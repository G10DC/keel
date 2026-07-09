import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/** Minimal key-value store for state that must survive across runs.
 *  Explicitly NOT a learning layer — just persistence. `file` makes it JSON-file-backed; otherwise
 *  in-memory. Corrupt/missing files degrade to an empty store (never throw on read). */
export class Store {
  constructor(file) {
    this.file = file;
    let data = {};
    if (file && existsSync(file)) {
      try { data = JSON.parse(readFileSync(file, 'utf8')) ?? {}; } catch { data = {}; }
    }
    this._data = data;
  }
  get(key) { return this._data[key]; }
  set(key, value) { this._data[key] = value; this._persist(); return value; }
  delete(key) { const had = key in this._data; delete this._data[key]; this._persist(); return had; }
  keys() { return Object.keys(this._data); }
  toObject() { return { ...this._data }; }
  _persist() { if (this.file) writeFileSync(this.file, JSON.stringify(this._data)); }
}
