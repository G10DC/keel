# keel — roadmap

> Status (2026-07-09): v0.1. The minimal trustworthy core is built and validated. Maximal capabilities are intentionally deferred behind flags until they earn their complexity.

## Deferred (opt-in, behind flags) — each must prove value before entering the core
- [ ] **Self-learning from trajectories** — zero precedent in reference harnesses + feedback-loop poisoning risk. Build last, with quarantined labels and clean ground truth.
- [ ] **Swarm coordination** — real coding tasks are interdependent; ship simple parallel (already available via deps) first; add swarm only if genuine parallelism beats merge-conflict cost.
- [ ] **MCP surface** — young platform; keep CLI primary, add MCP as a secondary transport with its own cancellation/streaming semantics (not a duplicated skin).
- [ ] **Real provider adapters** (OpenAI / Anthropic / local) behind the boundary — currently a mock.

## Core hardening
- [ ] Declarative hook routing (config-driven task dispatch).
- [ ] Execution-layer sandboxing guidance/integration (the honest place for code-exec isolation).
- [ ] Provenance propagation end-to-end through the dispatcher.

## Validation (the gating milestone)
- [ ] Real users getting measurable value from the minimal core before any maximal build-out.
