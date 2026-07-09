# Changelog

## 0.2.0 — 2026-07-09
- **Real HTTP provider adapter** (`fetchProvider`, OpenAI-compatible, injectable `fetch`) behind the boundary.
- **Declarative step handlers** — `literal`, `llm`, `transform`, `shell`; the dispatcher resolves `{ kind, config }` steps (backward-compatible with function steps). Routing is declarative, not learned.
- **Execution-layer shell runner** (`runShell`) — subprocess isolation + timeout + scoped env + failure-as-value. Honest scope: isolation, not a security sandbox (a real jail needs container/VM at the execution layer).
- **Trust end-to-end** — the dispatcher auto-populates the mailbox with each step result, appends a source-tagged (provenance) audit entry per step, and scopes credentials to authorized steps only. `AuditLog` now carries an integrity-protected `provenance` field.
- Tests: 30 passing, 100% line coverage on `src/`. (MCP surface still deferred — young platform, unproven complexity.)

## 0.1.0 — 2026-07-09
- Minimal core: **dispatcher** (structured concurrency, mailbox, failure-as-value), **provider boundary** (mock + circuit-breaker / retry / backoff), **trust model** (frozen policy, instruction/data separation, provenance, hash-chained tamper-evident audit), **CLI**.
- Zero runtime dependencies (Node built-ins, incl. `node:crypto`).
- Tests (TDD): 13 passing, 100% line coverage on `src/`; end-to-end validation probe.
- Example plan (`examples/plan.mjs`).
