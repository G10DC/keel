/** Run a plan with structured concurrency over steps that declare dependencies.
 *  Failure-as-value: a step's `run` returns { ok, value? } or { ok:false, error? }; throwing is caught.
 *  Mailbox: a shared Map steps read/write (message passing). ctx = { policy, audit, provider, mailbox }. */
export async function run(steps, { policy, audit, provider } = {}) {
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
      try {
        const r = await s.run(ctx, mailbox);
        results.set(id, r && typeof r === 'object' && 'ok' in r ? r : { ok: true, value: r });
      } catch (e) {
        results.set(id, { ok: false, error: e?.message ?? String(e) });
      }
      pending.delete(id);
    }));
  }

  const failed = [...results.entries()].filter(([, r]) => !r.ok).map(([id]) => id);
  return { results, ok: failed.length === 0, failed };
}
