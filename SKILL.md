---
name: keel
description: Minimal, trustworthy agent meta-harness providing a structured-concurrency step dispatcher, trust-model partition (instruction/data separation, tamper-evident audit log), provider boundary, and execution runner. Activate when setting up agent execution harnesses, audit logging, or instruction/data trust boundaries.
---

# Keel

A minimal, trustworthy spine around coding agents providing structured dispatching, provider boundaries, and trust-model partitioning.

## Features
- **Dispatcher (`run(steps)`)**: Structured concurrency over steps with declared dependencies and failure-as-value handling.
- **Trust Boundary**: `separateInstructionData`, provenance tracking, and hash-chained `AuditLog`.
- **Execution Runner**: Subprocess isolation, scoped environment, and allowlist execution.
- **MCP Server**: Stdio MCP interface exposing `keel_run` and `keel_separate`.

## Execution
Run from `C:\Users\GdC\.gemini\config\skills\keel`:
```bash
node src/cli.mjs run --plan examples/plan.mjs
```
