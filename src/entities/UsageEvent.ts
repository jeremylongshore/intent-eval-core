/**
 * UsageEvent — append-only product-metering LEDGER row (15th canonical entity).
 *
 * DR-103 D1 (ISEDC skill-scoring kernel contracts, intent-eval-lab
 * `103-AT-DECR-...`). The product-meter counterpart to {@link CostRecord}:
 *
 *   - {@link CostRecord} (§ 2.12) attributes PROVIDER SPEND — money (micro-USD)
 *     and tokens. It answers "what did this cost us?"
 *   - UsageEvent meters PRODUCT-METER COUNTS in BUSINESS UNITS (a `meter` +
 *     a `quantity` + a `unit`). It answers "how much of the product was used?"
 *
 * These are DISTINCT tables, not two views of one row. The nullable
 * {@link UsageEvent.cost_record_ref} back-reference is the SEAM that proves it:
 * a metering row MAY cite the CostRecord that priced the same action, but the
 * two are independently authored, independently queried, and never merged. A
 * `null` `cost_record_ref` is the common case (most metered actions are not
 * provider-priced).
 *
 * **Append-only.** Single terminal state `recorded`; the row is immutable at
 * creation. A correction is a NEW row, NEVER a mutation — mirroring CostRecord's
 * "rollups land as separate rows" discipline and SkillVersion's append-only
 * event-log discipline.
 *
 * **Anti-gaming (DR-103 D1 B1.2, machine-enforced — NOT prose).** A metered row
 * (any `meter` other than `api_call`) MUST bind to a VERIFIED gated source:
 * non-null `source_entity_type` + `source_entity_id`, AND `source_verified ===
 * true` — the marker the runtime sets ONLY after the source session clears its
 * quality gate. A hand-supplied `quantity` with no verified provenance is
 * refused. This is enforced at all three layers (Zod `.superRefine` +
 * JSON-Schema `if/then` + Pydantic `model_validator`). The spec's original
 * "ZERO hand-validators needed" claim is DELETED — it was only ever true because
 * the design omitted this rule.
 *
 * **C3 — no heterogeneous rollup (DR-103 C3 B6.1, structural).** The `meter`
 * enum is HETEROGENEOUS and the `unit` is mixed across meters. A consumer MUST
 * NOT `SUM`/aggregate `quantity` across distinct `(meter, unit)` pairs into one
 * scalar — the result would be a meaningless cross-dimension number (3 eval-runs
 * + 4,000 tokens is not "4,003 of anything"). Rollups are per-`(meter, unit)`
 * vectors only. This is a STRUCTURAL property — there is no rolled-total field on
 * the row by construction — backed by a consuming-surface test (see
 * `usage-event-c3.test.ts`) that asserts no cross-dimension scalar is
 * representable.
 *
 * **`quantity` is a COUNTED action, never an assigned utility (DR-103, epic
 * Rule 1).** No weight/utility/score is ever stored on the row. Any derived
 * value lives downstream and is computed from the ledger at read time.
 *
 * **Freeze discipline (DR-103 binding constraint 1).** The `meter` enum AND the
 * entity name FREEZE at the FIRST production-Rekor signature (there is NONE in
 * this PR). Until then both stay malleable. CMO dissent is preserved:
 * "`usage_events` is a billing name." The name `usage_events` is used for now;
 * the rename-before-production-sign debt is bound in DR-103 — the metering owner
 * and CMO jointly settle the name before the enum lock, and a billing-semantics
 * name MUST be renamed before any production signature.
 *
 * Predicate URI when emitted: a UsageEvent rides INSIDE the `extensions` field of
 * an EvidenceStatement; it does NOT become a gate-result/v1 statement (those are
 * pinned to `GateResultV1`). NO production-Rekor signing is wired in this PR.
 */

import type { Uuidv7, Rfc3339 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * meter — the metered PRODUCT-METER dimension (DR-103 D1 B1.4, CLOSED pricing
 * enum). HETEROGENEOUS: distinct meters carry distinct `unit`s and MUST NOT be
 * summed together (C3). CLOSED-vs-open is the metering owner's call; this ships
 * CLOSED (B1.4 "closed pricing enum is recommended, safest for billing"). The
 * enum FREEZES at the first production-Rekor signature — a post-signature rename
 * is a `/v2` burn on a never-signed shape.
 *
 * `dashboard_render` is intentionally ABSENT (DR-103 D1 B1.4 / spec §5 risk 1):
 * a dashboard render is a PREDICATE BODY (`dashboard-render/v1`), not a lifecycle
 * metering event — metering off a predicate-render conflates the layers.
 *
 * - `api_call`         — a raw provider API call. The ONLY meter exempt from the
 *                        verified-source binding (an API call is the leaf action;
 *                        it has no gated parent session to bind to).
 * - `eval_run`         — one EvalRun executed (the product unit, not the spend).
 * - `skill_invocation` — one skill invoked under a gated session.
 * - `judge_decision`   — one JudgeDecision rendered.
 * - `gate_evaluation`  — one gate evaluated (a gate-result/v1 row produced).
 * - `report_render`    — one report rendered through a gated pipeline.
 */
export type UsageMeter =
  | 'api_call'
  | 'eval_run'
  | 'skill_invocation'
  | 'judge_decision'
  | 'gate_evaluation'
  | 'report_render';

/** The metered dimensions whose rows MUST bind to a verified gated source. */
export const METERED_REQUIRES_VERIFIED_SOURCE: readonly Exclude<UsageMeter, 'api_call'>[] = [
  'eval_run',
  'skill_invocation',
  'judge_decision',
  'gate_evaluation',
  'report_render',
] as const;

/**
 * unit — the business unit `quantity` is expressed in (CLOSED enum). MIXED
 * across meters: a `tokens` meter and a `count` meter are NON-COMPARABLE, which
 * is exactly why a cross-`(meter, unit)` SUM is forbidden (C3).
 *
 * - `count`   — a dimensionless tally (1 eval-run, 1 invocation).
 * - `tokens`  — a token count (when the metered action's unit is tokens).
 * - `seconds` — wall-clock seconds of a metered action.
 * - `bytes`   — bytes processed/produced by a metered action.
 */
export type UsageUnit = 'count' | 'tokens' | 'seconds' | 'bytes';

/**
 * source_entity_type — the gated entity a metered row binds to (CLOSED enum).
 * Drives the anti-gaming invariant: a metered (non-`api_call`) row MUST name a
 * verified source of one of these types. `dashboard_render` is intentionally
 * ABSENT here too (a predicate body, not a lifecycle entity — DR-103 D1 B1.4).
 */
export type UsageSourceEntityType =
  | 'eval_run'
  | 'session_trace'
  | 'judge_decision'
  | 'tool_invocation'
  | 'skill_version';

/** Single terminal state per DR-103 D1 (append-only ledger). */
export type UsageEventState = 'recorded';

/** No transitions — `recorded` is terminal (append-only; corrections are new rows). */
export const usageEventTransitions: TransitionMap<UsageEventState> = {
  recorded: [],
} as const;

/**
 * UsageEvent — single append-only product-metering ledger row.
 *
 * Field semantics per DR-103 D1 + build-ready spec (102-AT-SPEC) Item 1.
 */
export interface UsageEvent {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /**
   * The metered PRODUCT-METER dimension. HETEROGENEOUS — distinct meters carry
   * distinct `unit`s and MUST NOT be cross-summed (C3). FREEZES at the first
   * production-Rekor signature.
   */
  readonly meter: UsageMeter;

  /**
   * The metered count, expressed in `unit`. A non-negative COUNT of a verified
   * action — NEVER an assigned utility/weight/score (DR-103 epic Rule 1). Any
   * derived value is computed downstream from the ledger, never stored here.
   */
  readonly quantity: number;

  /**
   * The business unit `quantity` is expressed in. MIXED across meters; a
   * cross-`(meter, unit)` SUM is out of contract (C3).
   */
  readonly unit: UsageUnit;

  /**
   * The gated entity TYPE this row meters. **Non-null for every metered
   * (non-`api_call`) row** (anti-gaming invariant, DR-103 D1 B1.2); `null` is
   * permitted ONLY for `meter === 'api_call'` (the leaf action with no gated
   * parent). Enforced at all three layers.
   */
  readonly source_entity_type: UsageSourceEntityType | null;

  /**
   * FK-by-reference to the gated source entity (UUIDv7). **Non-null for every
   * metered (non-`api_call`) row** (anti-gaming invariant); `null` only for
   * `api_call`. A content/identity reference, NOT an enforced relational FK —
   * the kernel persists nothing.
   */
  readonly source_entity_id: Uuidv7 | null;

  /**
   * The verified marker — `true` iff the runtime confirmed the source session
   * cleared its quality gate. **MUST be `true` for every metered (non-`api_call`)
   * row** (anti-gaming invariant, DR-103 D1 B1.2): a metered row with an
   * unverified source is REFUSED, so an arbitrary hand-supplied `quantity` with
   * no provenance cannot be recorded. The runtime sets this; a developer never
   * hand-authors `true` (DR-103 D1 B1.6 honest-emit-path binding). For
   * `api_call` it MAY be `false` (the leaf action is its own provenance).
   */
  readonly source_verified: boolean;

  /**
   * NULLABLE back-reference to the {@link CostRecord} that priced the SAME
   * action — the SEAM proving UsageEvent and CostRecord are SEPARATE tables
   * (DR-103 D1). `null` in the common case (most metered actions are not
   * provider-priced). A reference, NOT an enforced relational FK.
   */
  readonly cost_record_ref: Uuidv7 | null;

  readonly recorded_at: Rfc3339;

  /**
   * RESERVED multi-tenancy slot (DR-085 D5 / deferral-G; bd_000-projects-k0fj),
   * BYTE-IDENTICAL to EvalSpec/EvalRun/SkillSnapshot/SkillVersion: OPTIONAL +
   * NOT NULLABLE (omitted from `required`; an explicit `null` is rejected). A
   * present `tenant_id` is an attested tenant claim; an absent one is
   * single-tenant/global and MUST NOT be pooled into a cross-tenant aggregate
   * (DR-103 D2 B2.2). Tenant-isolation SEMANTICS stay out-of-scope for v1.
   */
  readonly tenant_id?: Uuidv7;
}
