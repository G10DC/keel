# keel — roadmap

> Status (2026-07-09): v0.3. A complete minimal+trustworthy core — agent loop, dispatcher hardening, streaming, persistence, thin MCP, execution-layer runner with allowlist. Deferred-by-design capabilities stay behind flags until they earn their complexity.

## Done in v0.1–v0.3
- [x] Dispatcher (structured concurrency, failure-as-value, mailbox, deps).
- [x] Provider boundary: mock + real `fetchProvider` (with local-server e2e test) + circuit-breaker + streaming.
- [x] Trust: frozen policy, instruction/data separation, provenance, tamper-evident audit, scoped credentials.
- [x] Declarative handlers (`literal`/`llm`/`transform`/`shell`).
- [x] Execution-layer `runShell` (isolation, timeout, allowlist).
- [x] Agent loop (ReAct, tool-use through trust boundary).
- [x] Dispatcher hardening (maxParallel, per-step timeout, per-step retry).
- [x] Persistence (`Store`).
- [x] MCP stdio surface (shared core, no duplicated logic).
- [x] Lint passing locally; 54 tests, 100% line coverage on `src/`.

## Deferred (opt-in, behind flags) — each must prove value before entering the core
- [ ] **Self-learning from trajectories** — zero precedent in reference harnesses + feedback-loop poisoning risk. Build last, with quarantined labels and clean ground truth.
- [ ] **Swarm coordination** — real coding tasks are interdependent; ship simple parallel (already available via deps) first; add swarm only if genuine parallelism beats merge-conflict cost.
- [ ] **Real provider adapters beyond OpenAI-compatible** (Anthropic-native, local) behind the boundary.

## Validation (the gating milestone)
- [ ] Real users getting measurable value from the core before any maximal build-out. (This remains a human step — the minimal core is now demonstrably complete enough to try.)

## Core hardening (v0.2)
- [x] Declarative routing (`literal`/`llm`/`transform`/`shell` handlers).
- [x] Execution-layer runner (`runShell` — subprocess isolation; honest: not a security sandbox).
- [x] Provenance propagation end-to-end (per-step, source-tagged, integrity-protected audit).
- [x] Real HTTP provider adapter (`fetchProvider`) behind the boundary.
- [x] Scoped credentials (only authorized steps see creds).

## Validation (the gating milestone)
- [ ] Real users getting measurable value from the minimal core before any maximal build-out.
