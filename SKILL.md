---
name: keel
description: >-
  Minimal, trustworthy agent meta-harness providing a structured-concurrency step
  dispatcher, trust-model partition (instruction/data separation, tamper-evident
  audit log), provider boundary, and execution runner. Activate when setting up
  agent execution harnesses, audit logging, or instruction/data trust boundaries.
  Never feed untrusted content into the instruction channel; never run without a
  frozen policy.
---

# Keel

A minimal, trustworthy spine around coding agents providing structured dispatching, provider boundaries, and trust-model partitioning.

## One rule above all

**Never mix instruction and data in the same channel.** If you do, every downstream consumer inherits the injection surface of every upstream producer.

## Golden rules

1. **Separate instruction from data** — use `separateInstructionData` before any content touches the processing engine. Why: prompt injection is the #1 attack vector on agent pipelines.
2. **Freeze the policy before execution** — `createPolicy` returns an immutable object. Why: a mutable policy can be weakened mid-run by the very code it governs.
3. **Log everything, trust nothing** — `AuditLog` is append-only and hash-chained. Why: tamper-evident trails are the only post-hoc defense when an agent misbehaves.
4. **Tag provenance on every datum** — `provenance` marks source, trust tier, and timestamp. Why: without provenance, you cannot distinguish trusted instructions from scraped data.

## Features

- **Dispatcher (`run(steps)`)**: Structured concurrency over steps with declared dependencies and failure-as-value handling.
- **Trust Boundary**: `separateInstructionData`, provenance tracking, and hash-chained `AuditLog`.
- **Execution Runner**: Subprocess isolation, scoped environment, and allowlist execution.
- **MCP Server**: Stdio MCP interface exposing `keel_run` and `keel_separate`.

## Execution

```bash
node src/cli.mjs run --plan examples/plan.mjs
```

## When to use

- Setting up an agent execution harness that needs instruction/data separation.
- Building an audit trail for agent actions that must be tamper-evident.
- Creating a trust boundary between untrusted scraped content and trusted instructions.
- Running multi-step agent pipelines that need structured concurrency with failure isolation.

## When NOT to use

- For runtime egress filtering — use `sentinel` instead.
- For compressing agent conversation context — use `chisel` instead.
- For input sanitization without a full trust harness — use `warden` (which delegates to `keel` internally).
- For persisting semantic checkpoints across sessions — use `chronicle` instead.
