/** Provider interface: `complete({ messages, policy }) → { text, meta }`. Swappable behind this boundary. */
import { spawn } from 'node:child_process';

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

/** Drives Agent environment itself via the `agent` CLI in print mode. Reuses the user's existing auth,
 *  model, gateway and settings — so keel's processing engine steps use the SAME backend as the interactive shell.
 *  The prompt is piped via stdin (never enters the command line); stdout text is the completion.
 *  Set KEEL_PROVIDER=mock to switch the whole app to the offline mock instead. */
export function claudeCliProvider({ cmd = 'agent', model, timeoutMs = 120000, extraArgs = [] } = {}) {
  return {
    async complete({ messages } = {}) {
      const prompt = messagesToPrompt(messages ?? []);
      const args = ['-p', '--output-format', 'text', ...(model ? ['--model', model] : []), ...extraArgs];
      const text = await runCmd(cmd, args, prompt, timeoutMs);
      return { text, meta: { model: model ?? 'agent-code', via: 'agent-cli' } };
    },
  };
}

function messagesToPrompt(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => {
      const role = String(m?.role ?? 'user').toUpperCase();
      const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
      return `${role}:\n${content}`;
    })
    .join('\n\n');
}

/** Spawn a CLI, feed stdin, return trimmed stdout. On Windows the npm shim is a .cmd (Node blocks
 *  spawning .cmd with shell:false for security), so we drive cmd.exe directly with shell:false.
 *  Args are trusted constants and the prompt is piped via stdin — no shell-injection surface. */
function runCmd(cmd, args, stdinText, timeoutMs) {
  const isWin = process.platform === 'win32';
  return new Promise((resolve, reject) => {
    const child = spawn(isWin ? 'cmd' : cmd, isWin ? ['/c', cmd, ...args] : args, { windowsHide: true, shell: false });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* noop */ } reject(new Error('agent cli timeout')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`agent cli exit ${code}: ${err.trim().slice(0, 400)}`));
    });
    child.stdin.on('error', () => { /* stdin may close early; ignore */ });
    child.stdin.end(stdinText);
  });
}

/** Choose the processing engine provider from env. Default: claudeCliProvider (Agent environment itself).
 *  KEEL_PROVIDER=mock → offline mock (tests / no-network demos). */
export function chooseProvider() {
  if ((process.env.KEEL_PROVIDER ?? '').toLowerCase() === 'mock') return mockProvider();
  return claudeCliProvider({
    model: process.env.KEEL_CLAUDE_MODEL || undefined,
    timeoutMs: Number(process.env.KEEL_CLAUDE_TIMEOUT_MS) || 120000,
  });
}


