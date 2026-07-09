# Changelog

## 0.1.0 — 2026-07-09
- Minimal core: **dispatcher** (structured concurrency, mailbox, failure-as-value), **provider boundary** (mock + circuit-breaker / retry / backoff), **trust model** (frozen policy, instruction/data separation, provenance, hash-chained tamper-evident audit), **CLI**.
- Zero runtime dependencies (Node built-ins, incl. `node:crypto`).
- Tests (TDD): 13 passing, 100% line coverage on `src/`; end-to-end validation probe.
- Example plan (`examples/plan.mjs`).
