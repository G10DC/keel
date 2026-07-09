import { getHandler } from './handlers.mjs';

/** Run a plan with structured concurrency over steps that declare dependencies.
 *  Failure-as-value: a step's `run` returns { ok, value? } or { ok:false, error? }; throwing is caught.
 *  Mailbox: a shared Map steps read/write (message passing). ctx = { policy, audit, provider, mailbox }. */
export async function run(steps, { policy, audit, provider, credSteps } = {}) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const results = new Map();
  const mailbox = new Map();
  const ctx = { policy, audit, provider, mailbox };

  const depsOk = (s) => (s.deps ?? []).every((d) => results.get(d)?.ok);
  const depFailed = (s) => (s.deps ?? []).some((d) => results.has(d) && !results.get(d).ok);

  const pending = new Set(steps.map((s) => s.id));
  while (pending.size) {
    for (const id of [...pending].filter((id) => depFailed(byId.get(id)))) {
      results.set(id, { ok: false, error: 'dep failed' });
      pending.delete(id);
    }
    const ready = [...pending].filter((id) => depsOk(byId.get(id)));
    if (!ready.length) {
      for (const id of pending) results.set(id, { ok: false, error: 'deadlock' });
      break;
    }
    await Promise.all(ready.map(async (id) => {
      const s = byId.get(id);
      const exec = typeof s.run === 'function'
        ? s.run
        : (c, mb) => {
            const h = getHandler(s.kind);
            if (!h) throw new Error(`unknown step kind: ${s.kind}`);
            return h(s.config ?? {}, c, mb);
          };
      const stepCtx = credSteps ? { ...ctx, creds: credSteps.includes(id) ? policy?.creds : undefined } : ctx;
      let result;
      try {
        const r = await exec(stepCtx, mailbox);
        result = r && typeof r === 'object' && 'ok' in r ? r : { ok: true, value: r };
      } catch (e) {
        result = { ok: false, error: e?.message ?? String(e) };
      }
      results.set(id, result);
      mailbox.set(id, result);
      if (audit) audit.append({ type: 'step', payload: { id, ok: result.ok }, provenance: { source: `step:${id}` } });
      pending.delete(id);
    }));
  }

  const failed = [...results.entries()].filter(([, r]) => !r.ok).map(([id]) => id);
  return { results, ok: failed.length === 0, failed };
}
