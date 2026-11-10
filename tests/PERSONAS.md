# PERSONAS — `@intentsolutions/core`

> Library kernel — personas are **downstream consumers**, not human end-users.

## Persona inventory

### P1 — `audit-harness` (deterministic gate runner)

**Role**: depends on `@intentsolutions/core` for type definitions of the entities its gates emit predicate rows about, and for the `gate-result/v1` predicate body shape.

**Key flows**:

- Construct a `gate-result/v1` `GateResultV1` payload after running a gate
- Wrap it in an in-toto `GateResultV1Statement` with a `subject` array that satisfies `SUBJECT_NAME_REGEX`
- Sign as DSSE envelope; append row to an `EvidenceBundle`

**Observed kernel evidence**: `src/integration.test.ts` constructs typed
predicate, Statement, and bundle fixtures and checks selected references. It
does not sign a DSSE envelope or append to a persistent bundle. Signing and
persistence remain downstream execution concerns, unverified by this suite.

### P2 — `j-rig-skill-binary-eval` (behavioral evaluation)

**Role**: depends on the kernel for `JudgeDecision`, `EvalRun`, `SessionTrace`, `ToolInvocation` shapes. Implements the `@intentsolutions/rollout-gate` policy translator that maps `gate-result/v1.gate_decision` → `RolloutGate.decision`.

**Key flows**:

- Compose multiple `JudgeDecision` rows into a verdict per `EvalRun`
- Emit `RolloutGate` with `decision` mapped from policy + verdict aggregation
- Reference `MatcherMap` and `FailureTaxonomy` for verdict classification

**Observed kernel evidence**: `src/integration.test.ts` constructs a `ship`
RolloutGate and a `pass` predicate fixture, then checks those assigned values.
This demonstrates compatible contract shapes; it does not execute aggregation
or policy translation. The current published decision package is
`@intentsolutions/rollout-gate`; downstream behavior needs its own evidence.

### P3 — `intent-rollout-gate` (GitHub Action shell)

**Role**: thin Action that consumes a signed `EvidenceBundle` + a policy ref, and emits a ship/no-ship decision. Depends on `@intentsolutions/core` for the predicate body parsing only.

**Key flows**:

- Verify DSSE envelope signatures
- Parse `gate-result/v1` predicate body
- Apply consumer-side `tests/TESTING.md` policy (which is NOT in the kernel — § 7.6 architectural separation)
- Emit GH Action output: pass / fail / advisory

**Observed kernel evidence**: `src/predicates/gate-result-v1.test.ts` locks
predicate/Statement/DSSE field types and subject naming. Runtime parse-and-reject
evidence lives in `src/validators/v1/evidence-statement.test.ts`, including
subject-name and digest mismatches. Signature verification, policy application,
and Action output are downstream responsibilities; this audit does not verify
those consumer flows.

### P4 — `intent-eval-lab` methodology authors

**Role**: write specs and Decision Records that reference kernel entities. Don't import the package directly; reference type names and field semantics in prose.

**Key flows**:

- Cite entity field names in Blueprint amendments
- Propose new MM-classes via `FailureTaxonomy` lifecycle
- Authorize URI bumps for `gate-result/vN+1` via ISEDC DRs

**Evidence boundary**: not a runtime persona. Spec-consistency review is required; this audit does not establish that review as complete.

## Coverage floor

For a library kernel with 4 consumer personas, the coverage threshold is **per-persona key-flow coverage ≥ 100%** (each persona's key flows have at least one type-level integration test).

| Persona | Key flows | Covered |
| --- | --- | --- |
| P1 — audit-harness | Typed predicate/Statement/bundle composition demonstrated; signing and persistence not executed | Full key-flow coverage unverified |
| P2 — j-rig | Typed RolloutGate/predicate composition demonstrated; aggregation and policy translation not executed | Full key-flow coverage unverified |
| P3 — intent-rollout-gate | Kernel field types and runtime statement validation demonstrated; consumer execution not audited | Full key-flow coverage unverified |
| P4 — methodology authors | n/a (not a runtime consumer) | n/a |

The 100% floor above is unchanged. These observations do not establish that the
floor is met. This four-persona inventory predates Python consumers, authoring
contract consumers, and later entity surfaces; their flows still require
explicit mapping rather than an inferred coverage percentage.

## Personas NOT in scope at the kernel layer

- End users (humans using the platform)
- Provider operators (Anthropic, OpenAI staff)
- Platform engineers running the runtime

These live in downstream package PERSONAS.md files (audit-harness, j-rig, intent-rollout-gate, intent-eval-platform).
