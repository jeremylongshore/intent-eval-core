# JOURNEYS — `@intentsolutions/core`

> Library kernel — journeys are **type-level integration paths**, not runtime user journeys.

## Journey inventory

### J1 — Full ERD walk (the canonical journey)

**Trigger**: a downstream consumer (audit-harness or j-rig) constructs a complete chain of entities for a single EvalRun and emits a signed `gate-result/v1` predicate row.

**Steps**:

| # | Step | Layer | Linked REQ | Test |
| --- | --- | --- | --- | --- |
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

**Observed evidence**: the cited integration test explicitly describes itself
as type-level composition. It constructs fixtures and checks selected foreign
keys and values; it does not derive the combined hash, execute or transition a
run, collect costs, sign or independently verify a DSSE envelope, persist an
append-only bundle, or apply rollout policy. The predicate suite locks envelope
field types. The 14-step journey contract is retained, but complete execution
coverage is not established by these tests.

### J2 — NEW MM-class lifecycle (taxonomy → kernel enum bump)

**Trigger**: a downstream consumer encounters a failure that doesn't fit MM-1..MM-6.

**Steps**:

| # | Step | Layer | Linked REQ | Test |
| --- | --- | --- | --- | --- |
| 1 | Propose new `FailureTaxonomy` row with `mm_class: 'MM-7'`, `status: 'proposed'` | type-level | REQ-IEC-001, REQ-IEC-011 | `session-tool-cost-failure.test.ts` |
| 2 | ISEDC review + transition to `status: 'canonical'` | governance | REQ-IEC-011 | manual ISEDC DR; runtime path tested |
| 3 | Bump kernel's `MmClass` literal union to include 'MM-7'; new MatcherMap rows can now use it | code change | REQ-IEC-001, REQ-IEC-011 | regression on existing tests + new MM-7 test required at bump time |

**Observed evidence**: `session-tool-cost-failure.test.ts` demonstrates an open
`MmClassId` accepting MM-7, the current closed MatcherMap enum, and legal/illegal
taxonomy transitions. It does not perform the future enum bump in step 3 or the
ISEDC decision in step 2. Those steps remain conditional change/governance
obligations, not completed tests.

### J3 — `gate-result/v1` consumer parse

**Trigger**: `intent-rollout-gate` Action receives a DSSE envelope; needs to verify + parse the predicate body + apply policy.

**Steps**:

| # | Step | Layer | Linked REQ | Test |
| --- | --- | --- | --- | --- |
| 1 | Verify DSSE envelope signatures (cosign-OIDC) | runtime — downstream | REQ-IEC-002 | downstream tests in `intent-rollout-gate` |
| 2 | Decode base64 payload → in-toto Statement v1 | runtime — downstream | REQ-IEC-002 | downstream tests in `intent-rollout-gate` |
| 3 | Validate `predicateType === GATE_RESULT_V1_URI` | type-level | REQ-IEC-002, REQ-IEC-010 | `gate-result-v1.test.ts` |
| 4 | Validate `subject[].digest.sha256 === predicate.input_hash` | runtime — downstream | REQ-IEC-002 | downstream tests in `intent-rollout-gate` (REQ documented in kernel JSDoc) |
| 5 | Narrow `predicate` to `GateResultV1` interface; access required + optional fields | type-level | REQ-IEC-002 | `gate-result-v1.test.ts` § "predicate body shape" |
| 6 | Apply consumer-side policy from `tests/TESTING.md` per § 7.6 architectural separation | runtime — downstream | n/a (consumer-owned) | downstream tests in `intent-rollout-gate` |

**Observed evidence**: the predicate suite covers field types and URI constants.
`src/validators/v1/evidence-statement.test.ts` additionally parses valid
statements and rejects mismatched subject names/digests and invalid envelope
constants, providing runtime kernel validation evidence for steps 3–5. It does
not verify signatures or apply consumer policy. The downstream assertions in
the table identify responsibility; they are not verified consumer test results
from this audit.

### J4 — Python runtime contract and regeneration

| # | Kernel-owned step | Linked REQ | Test evidence |
| --- | --- | --- | --- |
| 1 | Import published models and accept shared valid payloads | REQ-IEC-025 | `python/tests/test_parity.py`: package surface and valid-fixture suites |
| 2 | Reject shared invalid payloads and cross-field contradictions | REQ-IEC-025 | Same file's negative/cross-field suites; compare schema/Zod suites via the shared fixture corpus |
| 3 | Detect stale generated output and refuse unsafe or failed regeneration without replacing existing files | REQ-IEC-026 | `test_codegen_idempotent.py`, `test_codegen_security.py`, `test_codegen_preservation.py` |
| 4 | Check npm/Python version agreement | REQ-IEC-027 | `test_version_lockstep.py` |

**Boundary**: this is runtime model validation and generator behavior, not
service execution. The published omitted-nullable compatibility exceptions
remain in `wcze.11`; positive shared-fixture tests do not resolve them.

### J5 — Authoring contract selection and governance

| # | Kernel-owned step | Linked REQ | Test evidence |
| --- | --- | --- | --- |
| 1 | Select one of the six composed v1 authoring schemas | REQ-IEC-028 | Six v1 `*-schema.test.ts` suites plus `authoring-schemas.test.ts` |
| 2 | Validate positive/negative metadata using schema and generated Zod validators | REQ-IEC-028 | `authoring-fixtures.test.ts` and per-family parity cases |
| 3 | Select stricter v2 without v1 references or frozen-v1 mutation | REQ-IEC-029 | Six `*-v2-schema.test.ts` suites; `authoring-v1-frozen.test.ts` requires the historical tag for byte comparisons |
| 4 | Reject fused chambers, predicate namespaces and weakened policy floors | REQ-IEC-030–031 | `chamber-isolation.test.ts`, `predicate-namespace-isolation.test.ts`, `rubric-floor-guard.test.ts` corruption cases |
| 5 | Resolve coverage/citation/rationale and cross-schema references | REQ-IEC-031–032 | `coverage-map-gates.test.ts`, `prose-anchor-validity.test.ts`, `changelog-observance.test.ts`, `cross-schema-invariants.test.ts`, `version-ordering-invariant.test.ts` |

**Boundary**: these checks do not publish, install or execute an artifact,
certify an upstream vendor, or grant canonical-v2/advisory-to-blocking promotion.

### J6 — Later entity validation and statement boundaries

| # | Kernel-owned step | Linked REQ | Test evidence |
| --- | --- | --- | --- |
| 1 | Validate SkillVersion root/parent/hash/discriminator consistency | REQ-IEC-033 | `src/validators/v1/validators.test.ts` root, revert/restore and contradictory-parent cases; schema/Python counterparts |
| 2 | Validate legal signing transitions and conditional Rekor metadata | REQ-IEC-034 | `src/entities/skill-version-signing.test.ts`; validator rejection of forged/missing index combinations |
| 3 | Validate UsageEvent source markers, quantities and structural no-rollup rule | REQ-IEC-035 | `src/entities/usage-event.test.ts` positive and refusal paths |
| 4 | Validate HumanReview pin, human-only marker, nonempty signal and tenant nullability | REQ-IEC-036 | `src/entities/HumanReview.test.ts` positive and refusal paths |
| 5 | Validate human-review/v1 statement identity/digest and permanent staging declaration | REQ-IEC-037 | `src/predicates/human-review-v1.test.ts` |

**Boundary**: the kernel checks supplied data and transition maps. Runtime
identity verification, source authentication, append-only storage, signing,
Rekor reconciliation and policy decisions are not performed by these tests.

## Untested steps

The historical statement that no steps were untested is not a current
completion verdict. The distinctions above separate demonstrated contract
composition/validation from execution and governance obligations. No new
kernel execution implementation is implied: execution remains downstream.
J4–J6 now map Python, authoring and later-entity contract paths to the additive
RTM requirements. They do not turn downstream steps in J1–J3 into kernel-owned
work or establish whole-platform journey coverage.
