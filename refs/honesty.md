# Keel Trust Harness & Dispatcher Honesty Layer

The honesty layer is the operational expression of the **G10DC Trellis Standard**: **the LLM reasons over verified evidence with stated confidence, never hallucinates capabilities or impact.**

## Domain & Scope
**Domain**: Agent Structured Concurrency & Trust Boundary

## Core Epistemic Rules

1. **Instruction/Data Separation: Trusted instructions and untrusted data streams NEVER share the same channel.**
2. **Policy Freeze: Execution policy is immutable once created. Mid-run policy mutation is strictly forbidden.**
3. **Confidence Rating: High (hash-chained AuditLog verified), Medium (unverified provenance), Low (unscoped execution).**

## Three-Tier Confidence Model

- **High Confidence**: Full AST/schema validation passing, deterministic evidence available, verified state.
- **Medium Confidence**: Heuristic analysis or partial indexing; requires agent verification step.
- **Low Confidence**: Inferred or unindexed target; candidate output ONLY, never auto-committed.

## Epistemic Invariant

> Absence of evidence is not evidence of absence. Output is presented as a structured candidate set with confidence scores so caveats cannot be silently dropped downstream.
