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
