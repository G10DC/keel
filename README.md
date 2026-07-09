# keel

> The minimal, trustworthy spine around a coding agent. Every maximal capability — swarm, self-learning, MCP — is an opt-in extension that must earn its complexity.

`keel` is a small agent meta-harness: a **structured-concurrency dispatcher** + a **provider boundary** (with circuit-breaker failover) + a **trust-model partition** (instruction/data separation, provenance, frozen per-task policy, tamper-evident audit) + a **CLI**. Zero runtime dependencies (Node built-ins only).

## Why minimal
Maximalist harnesses ship a catalog of capabilities in the rhetoric of a trade-off. `keel` takes the opposite bet: a trustworthy minimal core, where the defensible position is **trustworthiness and replay-grade auditability**, not feature breadth. The capabilities most likely to poison a harness — trajectory-based self-learning (no proven precedent; feedback-loop poisoning), swarm coordination (regresses to sequential for interdependent coding), and learned "intelligent routing" — are **not in the core**; they stay behind flags until they earn their complexity.

## The core
- **Dispatcher** (`run(steps)`) — structured concurrency over steps that declare dependencies; a shared mailbox; **failure-as-value** (steps return `{ ok, value? }` / `{ ok:false, error? }`, never throw).
- **Provider boundary** — a swappable `complete({ messages, policy })` interface; `withCircuitBreaker` adds retry/backoff + open/half-open/close. Provider routing is plumbing, not "intelligence".
- **Trust** — `createPolicy` (frozen per task), `separateInstructionData` (the instruction/data trust boundary), `provenance`, and a hash-chained, tamper-evident `AuditLog`.
- **CLI** — `keel run --plan plan.mjs`.

## keel vs a maximalist harness
| Dimension | maximalist (e.g. ruflo) | keel |
|---|---|---|
| Posture | 100+ agents, swarm, self-learning, 35 plugins, MCP, web UI | minimal spine; maximal caps are opt-in flags |
| Self-learning | core (trajectory replay) | **deferred** (no precedent + poisoning risk) |
| Swarm | core | **deferred** (regresses to sequential for coding) |
| Routing | "intelligent" | declarative hooks + circuit-breaker plumbing |
| Security | orchestration-layer guardrails | trust partition (instruction/data + audit); sandboxing honestly at the execution layer |
| Surface | CLI + MCP + web (duplicated) | CLI first; MCP deferred (young platform) |
| Dependencies | large | **zero runtime** (Node built-ins) |

## Use
```bash
node src/cli.mjs run --plan examples/plan.mjs
```
```js
import { run, mockProvider, withCircuitBreaker, createPolicy, AuditLog } from './src/index.mjs';
```

## Status — minimal core, validated
The minimal core is built and tested (unit + end-to-end probe; 100% line coverage on `src/`). The maximal capabilities are intentionally absent — see `ROADMAP.md`. This is the "validate the category before maximizing" milestone.

## License
MIT — see `LICENSE`.
