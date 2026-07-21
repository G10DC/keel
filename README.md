# keel

> The minimal, trustworthy spine around a coding agent. Every maximal capability — swarm, self-learning, MCP — is an opt-in extension that must earn its complexity.

`keel` is a small agent meta-harness: a **structured-concurrency dispatcher** + a **provider boundary** (with circuit-breaker failover) + a **trust-model partition** (instruction/data separation, provenance, frozen per-task policy, tamper-evident audit) + a **CLI**. Zero runtime dependencies (Node built-ins only).

## Why minimal
Maximalist harnesses ship a catalog of capabilities in the rhetoric of a trade-off. `keel` takes the opposite bet: a trustworthy minimal core, where the defensible position is **trustworthiness and replay-grade auditability**, not feature breadth. The capabilities most likely to poison a harness — trajectory-based self-learning (no proven precedent; feedback-loop poisoning), swarm coordination (regresses to sequential for interdependent coding), and learned "intelligent routing" — are **not in the core**; they stay behind flags until they earn their complexity.

## The core
- **Dispatcher** (`run(steps)`) — structured concurrency over steps that declare dependencies; a shared mailbox auto-populated with each step result; **failure-as-value**; optional `maxParallel`, per-step `timeoutMs`, per-step `retry`.
- **Agent loop** (`loop`) — model-driven ReAct: the model may call tools (executed through the trust boundary), `maxIter`, failure-as-value. This is what makes keel an agent harness, not just a workflow runner.
- **Provider boundary** — a swappable `complete({ messages, policy, onToken })` interface: `mockProvider`, a real **`fetchProvider`** (OpenAI-compatible), `withCircuitBreaker`, plus `stream()` (token streaming with graceful fallback).
- **Declarative handlers** — steps can be `{ kind, config }` instead of functions; built-ins `literal`, `model`, `transform`, `shell`.
- **Trust** — `createPolicy` (frozen per task), `separateInstructionData` (the instruction/data trust boundary), `provenance`, a hash-chained tamper-evident `AuditLog` (per-step, source-tagged), and **scoped credentials**.
- **Execution-layer runner** — `runShell` (subprocess isolation, timeout, scoped env, allowlist, failure-as-value). Honestly scoped: isolation, not a security sandbox.
- **Persistence** — `Store` (in-memory + JSON file) for state that crosses runs (not a learning layer).
- **MCP** — `keel mcp`: a thin stdio server exposing `keel_run` + `keel_separate`, **reusing the core** (no duplicated logic).
- **CLI** — `keel run --plan plan.mjs` | `keel mcp`.

## keel vs a maximalist harness
| Dimension | maximalist (e.g. ruflo) | keel |
|---|---|---|
| Posture | 100+ agents, swarm, self-learning, 35 plugins, MCP, web UI | minimal spine; maximal caps are opt-in flags |
| Self-learning | core (trajectory replay) | **deferred** (no precedent + poisoning risk) |
| Swarm | core | **deferred** (regresses to sequential for coding) |
| Routing | "intelligent" | declarative hooks + circuit-breaker plumbing |
| Security | orchestration-layer guardrails | trust partition (instruction/data + audit); sandboxing honestly at the execution layer |
| Surface | CLI + MCP + web (duplicated) | CLI + thin MCP-stdio (**shared core**, no duplicated logic) |
| Dependencies | large | **zero runtime** (Node built-ins) |

## Use
```bash
node src/cli.mjs run --plan examples/plan.mjs
```
```js
import { run, mockProvider, withCircuitBreaker, createPolicy, AuditLog } from './src/index.mjs';
```

## Status — minimal core, validated
The core is built and tested — 54 tests, 100% line coverage on `src/`, an autonomous agent loop, a real HTTP provider adapter (with a local-server e2e test), token streaming, declarative handlers, an execution-layer shell runner with allowlist, persistence, a thin MCP-stdio surface, and trust wired end-to-end. What stays **deferred** (by design, behind flags until earned): self-learning, swarm, federation, web UI — see `ROADMAP.md`.

## License
MIT — see `LICENSE`.
