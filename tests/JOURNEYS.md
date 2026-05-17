# JOURNEYS — `@intent-eval/core`

> Library kernel — journeys are **type-level integration paths**, not runtime user journeys.

## Journey inventory

### J1 — Full ERD walk (the canonical journey)

**Trigger**: a downstream consumer (audit-harness or j-rig) constructs a complete chain of entities for a single EvalRun and emits a signed `gate-result/v1` predicate row.

**Steps**:

| # | Step | Layer | Linked REQ | Test |
|---|---|---|---|---|
| 1 | Pin a `SkillSnapshot` with `combined_sha = sha256(source_sha \|\| dependency_lock_sha \|\| config_sha)` | L3 | REQ-IEC-001 | `integration.test.ts` |
| 2 | Author a `MatcherMap` (e.g., MM-4 token-ceiling-escape) | L3 | REQ-IEC-001, REQ-IEC-007 | `integration.test.ts` |
| 3 | Author an `EvalSpec` anchoring on snapshot.combined_sha via `expected_artifacts` | L3 | REQ-IEC-001, REQ-IEC-006 | `integration.test.ts` |
| 4 | Submit an `EvalRun` with frozen `eval_spec_content_hash`; receive UUIDv7 PK | L3 | REQ-IEC-001, REQ-IEC-005, REQ-IEC-008 | `integration.test.ts` |
| 5 | Runtime opens a `SessionTrace` (1:1 with EvalRun); emits ToolInvocations | L3 | REQ-IEC-001, REQ-IEC-008 | `integration.test.ts` |
| 6 | Judges emit `JudgeDecision` rows referencing the MatcherMap | L3 | REQ-IEC-001, REQ-IEC-015 | `integration.test.ts` |
| 7 | Costs accrue via `CostRecord` rows (tool-level and run-level) | L3 | REQ-IEC-001, REQ-IEC-020 | `integration.test.ts` |
| 8 | Run transitions to `judged` → emits `RuntimeReceipt` (1:1 with EvalRun); freezes content hashes | L3 | REQ-IEC-001, REQ-IEC-005, REQ-IEC-008 | `integration.test.ts` |
| 9 | `EvidenceBundle` aggregates signed predicate rows; signing_mode = sigstore_staging or rekor_production | L3 | REQ-IEC-001, REQ-IEC-014 | `integration.test.ts` |
| 10 | `RolloutGate` decides ship/no_ship/advisory based on policy + bundle; immutable once recorded | L3 | REQ-IEC-001, REQ-IEC-016 | `integration.test.ts` |
| 11 | Construct `gate-result/v1` predicate body with all required fields | L3 | REQ-IEC-002 | `gate-result-v1.test.ts` + `integration.test.ts` |
| 12 | Wrap predicate body in in-toto `Statement v1` with `predicateType` = canonical URI | L3 | REQ-IEC-002, REQ-IEC-010 | `gate-result-v1.test.ts` + `integration.test.ts` |
| 13 | Subject name MUST satisfy `SUBJECT_NAME_REGEX` (§ 7.3) | L3 | REQ-IEC-003 | `gate-result-v1.test.ts` § "subject naming" |
| 14 | DSSE envelope wraps Statement; row is independently verifiable | L3 | REQ-IEC-002 | `gate-result-v1.test.ts` § "in-toto + DSSE wrapping" |

**Coverage**: ✅ all 14 steps tested.

### J2 — NEW MM-class lifecycle (taxonomy → kernel enum bump)

**Trigger**: a downstream consumer encounters a failure that doesn't fit MM-1..MM-6.

**Steps**:

| # | Step | Layer | Linked REQ | Test |
|---|---|---|---|---|
| 1 | Propose new `FailureTaxonomy` row with `mm_class: 'MM-7'`, `status: 'proposed'` | type-level | REQ-IEC-001, REQ-IEC-011 | `session-tool-cost-failure.test.ts` |
| 2 | ISEDC review + transition to `status: 'canonical'` | governance | REQ-IEC-011 | manual ISEDC DR; runtime path tested |
| 3 | Bump kernel's `MmClass` literal union to include 'MM-7'; new MatcherMap rows can now use it | code change | REQ-IEC-001, REQ-IEC-011 | regression on existing tests + new MM-7 test required at bump time |

**Coverage**: steps 1, 3 covered at the type level; step 2 is governance (out of code-test scope).

### J3 — `gate-result/v1` consumer parse

**Trigger**: `intent-rollout-gate` Action receives a DSSE envelope; needs to verify + parse the predicate body + apply policy.

**Steps**:

| # | Step | Layer | Linked REQ | Test |
|---|---|---|---|---|
| 1 | Verify DSSE envelope signatures (cosign-OIDC) | runtime — downstream | REQ-IEC-002 | downstream tests in `intent-rollout-gate` |
| 2 | Decode base64 payload → in-toto Statement v1 | runtime — downstream | REQ-IEC-002 | downstream tests in `intent-rollout-gate` |
| 3 | Validate `predicateType === GATE_RESULT_V1_URI` | type-level | REQ-IEC-002, REQ-IEC-010 | `gate-result-v1.test.ts` |
| 4 | Validate `subject[].digest.sha256 === predicate.input_hash` | runtime — downstream | REQ-IEC-002 | downstream tests in `intent-rollout-gate` (REQ documented in kernel JSDoc) |
| 5 | Narrow `predicate` to `GateResultV1` interface; access required + optional fields | type-level | REQ-IEC-002 | `gate-result-v1.test.ts` § "predicate body shape" |
| 6 | Apply consumer-side policy from `tests/TESTING.md` per § 7.6 architectural separation | runtime — downstream | n/a (consumer-owned) | downstream tests in `intent-rollout-gate` |

**Coverage**: steps 3, 5 covered at the kernel; steps 1, 2, 4, 6 are runtime concerns covered downstream.

## Untested steps

None at the kernel level. All steps that are kernel-owned have type-level tests; all steps that are runtime-owned are documented as downstream consumer concerns.
