# Changelog

## 0.3.0 — 2026-07-09
- **Autonomous agent loop** (`loop`): model-driven ReAct — tool-use executed through the trust boundary (instruction/data split, provenance, audit, scoped credentials), `maxIter`, failure-as-value throughout.
- **Dispatcher hardening**: `maxParallel` (concurrency cap), per-step `timeoutMs`, per-step `retry { count, baseMs }`.
- **Token streaming**: `onToken` contract + `stream()` driver with graceful fallback for non-streaming providers.
- **Persistence**: `Store` (in-memory + JSON file) for cross-run state — explicitly not a learning layer.
- **MCP stdio server** (`keel mcp`): exposes `keel_run` + `keel_separate`, **reusing the core** (no duplicated logic). Declarative subset only.
- **`runShell` allowlist**: execution-layer command restriction.
- **Provider e2e test** against a real local OpenAI-compatible HTTP server (no external keys).
- Lint passes locally (eslint). Tests: 54 passing, 100% line coverage on `src/`.

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
