/** Provider interface: `complete({ messages, policy }) → { text, meta }`. Swappable behind this boundary. */

/** Deterministic mock provider for tests and offline runs. Returns canned text keyed by last message. */
export function mockProvider(responses = {}) {
  return {
    async complete({ messages }) {
      const last = messages[messages.length - 1];
      const key = last?.content ?? '';
      return { text: responses[key] ?? `mock:${key}`, meta: { model: 'mock' } };
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Circuit-breaker + retry/backoff wrapper (provider-routing = boring plumbing, not "intelligence").
 *  CLOSED → OPEN (after `threshold` failures) → HALF_OPEN (after `resetMs`) → CLOSED (on success). */
export function withCircuitBreaker(provider, { threshold = 3, resetMs = 1000, retries = 2, baseBackoffMs = 10 } = {}) {
  let failures = 0;
  let state = 'CLOSED';
  let openedAt = 0;
  const now = () => Date.now();

  async function call(args) {
    if (state === 'OPEN') {
      if (now() - openedAt >= resetMs) state = 'HALF_OPEN';
      else throw new Error('circuit open');
    }
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await provider.complete(args);
        failures = 0;
        if (state === 'HALF_OPEN') state = 'CLOSED';
        return r;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) await sleep(baseBackoffMs * 2 ** attempt);
      }
    }
    failures += 1;
    if (failures >= threshold) { state = 'OPEN'; openedAt = now(); }
    throw lastErr;
  }

  return { state: () => state, complete: (args) => call(args) };
}

/** HTTP provider for an OpenAI-compatible /chat/completions endpoint. Uses global fetch (Node ≥ 18);
 *  inject `fetchImpl` for deterministic tests. Authorization header is sent only when apiKey is set. */
export function fetchProvider({ endpoint, model, apiKey, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  return {
    async complete({ messages }) {
      if (typeof doFetch !== 'function') throw new Error('no fetch implementation available');
      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ model, messages }),
      });
      if (!res.ok) throw new Error(`provider http ${res.status}`);
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content ?? '';
      return { text, meta: { model, usage: json?.usage ?? null } };
    },
  };
}

/** Scripted provider: returns responses in sequence (the last one repeats on overflow). Tests/demos. */
export function scriptProvider(steps) {
  let i = 0;
  return {
    async complete() { const r = steps[i] ?? steps[steps.length - 1]; i += 1; return r; },
  };
}

/** Streaming scripted provider: emits `chunks` via an `onToken` callback, then returns the joined text.
 *  Streaming contract: `provider.complete({ onToken })` — a provider that supports streaming calls
 *  `onToken(text)` per chunk; one that doesn't simply ignores it. */
export function streamProvider(chunks) {
  return {
    async complete({ onToken } = {}) {
      let text = '';
      for (const c of chunks) {
        text += c;
        if (typeof onToken === 'function') { onToken(c); await Promise.resolve(); }
      }
      return { text, meta: { model: 'stream', chunks: chunks.length } };
    },
  };
}

/** Drive a provider with token streaming. Collects tokens and returns { text, meta, tokens }.
 *  Graceful fallback: if the provider ignores `onToken`, `tokens` is empty and the final text is returned. */
export async function stream(provider, { messages, policy, onToken } = {}) {
  const tokens = [];
  const r = await provider.complete({
    messages,
    policy,
    onToken: (t) => { tokens.push(t); if (typeof onToken === 'function') onToken(t); },
  });
  return { ...r, tokens };
}


