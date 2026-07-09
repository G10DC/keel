import { getHandler } from './handlers.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` over `items` with an optional concurrency cap. */
async function withPool(items, limit, fn) {
  if (!limit || limit >= items.length) return Promise.all(items.map((item) => fn(item)));
  const executing = new Set();
  const all = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    all.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(all);
}

/** Run a plan with structured concurrency over steps that declare dependencies.
 *  Failure-as-value (steps return { ok, value? } / { ok:false, error? }, never throw); mailbox
 *  auto-populated with each step result; per-step audit (provenance); scoped credentials; optional
 *  maxParallel, per-step timeoutMs, per-step retry { count, baseMs }.
 *  NOTE: step timeout caps the WAIT, it does not cancel the underlying work (runShell self-cancels). */
export async function run(steps, { policy, audit, provider, credSteps, maxParallel, defaultTimeoutMs } = {}) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const results = new Map();
  const mailbox = new Map();
  const ctx = { policy, audit, provider, mailbox };

  const depsOk = (s) => (s.deps ?? []).every((d) => results.get(d)?.ok);
  const depFailed = (s) => (s.deps ?? []).some((d) => results.has(d) && !results.get(d).ok);

  const record = (id, result) => {
    results.set(id, result);
    mailbox.set(id, result);
    if (audit) audit.append({ type: 'step', payload: { id, ok: result.ok }, provenance: { source: `step:${id}` } });
  };

  async function runStep(id) {
    const s = byId.get(id);
    const exec = typeof s.run === 'function'
      ? s.run
      : (c, mb) => {
          const h = getHandler(s.kind);
          if (!h) throw new Error(`unknown step kind: ${s.kind}`);
          return h(s.config ?? {}, c, mb);
        };
    const stepCtx = credSteps ? { ...ctx, creds: credSteps.includes(id) ? policy?.creds : undefined } : ctx;
    const timeoutMs = s.timeoutMs ?? defaultTimeoutMs;
    const maxAttempt = s.retry?.count ?? 0;
    let result;
    for (let attempt = 0; attempt <= maxAttempt; attempt += 1) {
      try {
        const r = timeoutMs
          ? await Promise.race([
              exec(stepCtx, mailbox),
              new Promise((res) => setTimeout(() => res({ ok: false, error: 'step timeout' }), timeoutMs)),
            ])
          : await exec(stepCtx, mailbox);
        result = r && typeof r === 'object' && 'ok' in r ? r : { ok: true, value: r };
      } catch (e) {
        result = { ok: false, error: e?.message ?? String(e) };
      }
      if (result.ok || attempt === maxAttempt) break;
      if (s.retry?.baseMs) await sleep(s.retry.baseMs * 2 ** attempt);
    }
    record(id, result);
  }

  const pending = new Set(steps.map((s) => s.id));
  while (pending.size) {
    for (const id of [...pending].filter((id) => depFailed(byId.get(id)))) {
      record(id, { ok: false, error: 'dep failed' });
      pending.delete(id);
    }
    const ready = [...pending].filter((id) => depsOk(byId.get(id)));
    if (!ready.length) {
      for (const id of pending) record(id, { ok: false, error: 'deadlock' });
      break;
    }
    await withPool(ready, maxParallel, runStep);
    for (const id of ready) pending.delete(id);
  }

  const failed = [...results.entries()].filter(([, r]) => !r.ok).map(([id]) => id);
  return { results, ok: failed.length === 0, failed };
}
