# PERSONAS — `@intentsolutions/core`

> Library kernel — personas are **downstream consumers**, not human end-users.

## Persona inventory

### P1 — `audit-harness` (deterministic gate runner)

**Role**: depends on `@intentsolutions/core` for type definitions of the entities its gates emit predicate rows about, and for the `gate-result/v1` predicate body shape.

**Key flows**:
- Construct a `gate-result/v1` `GateResultV1` payload after running a gate
- Wrap it in an in-toto `GateResultV1Statement` with a `subject` array that satisfies `SUBJECT_NAME_REGEX`
- Sign as DSSE envelope; append row to an `EvidenceBundle`

**Test coverage**: `src/integration.test.ts` exercises this flow end-to-end.

### P2 — `j-rig-skill-binary-eval` (behavioral evaluation)

**Role**: depends on the kernel for `JudgeDecision`, `EvalRun`, `SessionTrace`, `ToolInvocation` shapes. Implements the `@j-rig/rollout-gate` policy translator that maps `gate-result/v1.gate_decision` → `RolloutGate.decision`.

**Key flows**:
- Compose multiple `JudgeDecision` rows into a verdict per `EvalRun`
- Emit `RolloutGate` with `decision` mapped from policy + verdict aggregation
- Reference `MatcherMap` and `FailureTaxonomy` for verdict classification

**Test coverage**: `src/integration.test.ts` exercises the RolloutGate ↔ gate-result/v1 mapping invariant.

### P3 — `intent-rollout-gate` (GitHub Action shell)

**Role**: thin Action that consumes a signed `EvidenceBundle` + a policy ref, and emits a ship/no-ship decision. Depends on `@intentsolutions/core` for the predicate body parsing only.

**Key flows**:
- Verify DSSE envelope signatures
- Parse `gate-result/v1` predicate body
- Apply consumer-side `tests/TESTING.md` policy (which is NOT in the kernel — § 7.6 architectural separation)
- Emit GH Action output: pass / fail / advisory

**Test coverage**: at the kernel level, `gate-result-v1.test.ts` proves the predicate body is parseable. End-to-end consumption tests live in the rollout-gate repo.

### P4 — `intent-eval-lab` methodology authors

**Role**: write specs and Decision Records that reference kernel entities. Don't import the package directly; reference type names and field semantics in prose.

**Key flows**:
- Cite entity field names in Blueprint amendments
- Propose new MM-classes via `FailureTaxonomy` lifecycle
- Authorize URI bumps for `gate-result/vN+1` via ISEDC DRs

**Test coverage**: not a runtime persona — covered by spec-consistency review.

## Coverage floor

For a library kernel with 4 consumer personas, the coverage threshold is **per-persona key-flow coverage ≥ 100%** (each persona's key flows have at least one type-level integration test).

| Persona | Key flows | Covered |
|---|---|---|
| P1 — audit-harness | 1/1 (predicate-body construction + DSSE wrap + bundle append) | ✓ |
| P2 — j-rig | 1/1 (RolloutGate ↔ gate-result/v1 mapping) | ✓ |
| P3 — intent-rollout-gate | 1/1 (predicate body parse-and-narrow) | ✓ |
| P4 — methodology authors | n/a (not a runtime consumer) | n/a |

## Personas NOT in scope at the kernel layer

- End users (humans using the platform)
- Provider operators (Anthropic, OpenAI staff)
- Platform engineers running the runtime

These live in downstream package PERSONAS.md files (audit-harness, j-rig, intent-rollout-gate, intent-eval-platform).
