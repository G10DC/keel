# Keel

Minimal, trustworthy agent meta-harness. Provides a structured-concurrency step dispatcher, provider boundary with circuit breaker, and trust model with tamper-evident audit logs. Zero runtime dependencies.

## Untrusted data (absorbs the former `warden` skill)

When a pipeline feeds scraped pages, uploads or external feeds to an LLM, the data channel can become an instruction channel (prompt injection). Rules, using the primitives exported from `src/trust.mjs`:

1. **Separate instructions from data.** `separateInstructionData(messages)`: only `system`/`instruction` roles shape behaviour; everything else is data.
2. **Freeze the policy per task.** `createPolicy({ instructions })` is frozen; trusted instructions live in the plan, never in the data.
3. **Stamp provenance at the boundary.** `provenance({ source, content })` on every value entering the pipeline.
4. **Append, then verify.** Every meaningful step appends to an `AuditLog`; `audit.verify()` recomputes the hash chain at the end.
5. **Fail as value, audited.** A failed step is recorded and the run continues; the trail survives partial failure.
6. **Defence in depth.** The instruction/data split is necessary, not sufficient: add a rule-based pre-filter and a post-filter around the model.
7. **Persist the audit** to append-only storage; an in-memory log does not survive a crash.

Runnable reference with an embedded injection attempt that must be ignored:

```
keel run --plan examples/trusted.mjs                     # default provider
KEEL_PROVIDER=mock keel run --plan examples/trusted.mjs  # offline
```

Consumers outside this repo (e.g. `audit-canale`) locate the library through the `KEEL_HOME` environment variable.
