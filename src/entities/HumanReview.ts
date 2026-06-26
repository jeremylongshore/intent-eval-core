/**
 * HumanReview — open-ended human-trust signal on an EvalRun (net-new canonical entity, ISEDC DR-103 D1).
 *
 * ISEDC DR-103 D1 (intent-eval-lab `103-AT-DECR-isedc-skill-scoring-kernel-
 * contracts-2026-06-25.md`). The human counterpart to {@link JudgeDecision}: a
 * single human's open-ended assessment of an EvalRun. Where JudgeDecision is the
 * MACHINE verdict (signed predicate `eval-verdict/v1` — NOT `judge-decision/v1`),
 * HumanReview is the curated HUMAN-trust signal (signed predicate
 * `human-review/v1`).
 *
 * ── Append-only, single terminal state ──
 * Single terminal state `recorded`, immutable at creation. A revision is a NEW
 * row citing {@link HumanReview.supersedes_id}, never a mutation (append-only
 * ledger, mirroring CostRecord/JudgeDecision).
 *
 * ── Three ORTHOGONAL channels (DR-103 C3 B6.3) ──
 * Langfuse-style "scores" fold into three NULLABLE, never-aggregated channels:
 *   - {@link HumanReview.score_text} — open-ended NON-COMPARABLE free TEXT,
 *     intentionally NOT an enum or number. Consumers MUST NOT parse it into a
 *     scalar; a numeric channel that needs comparison is a SEPARATE structured
 *     field, never this string.
 *   - {@link HumanReview.thumbs} — coarse up/down boolean.
 *   - {@link HumanReview.annotation} — free-text contextual comment.
 * They stay orthogonal: a high-thumbs/low-score row and the inverse must read
 * differently, never crushed into one "usefulness %".
 *
 * ── ANTI-GAMING, machine-enforced (DR-103 D1 B1.2) ──
 * NOT prose — enforced at all three layers (the JSON-Schema `anyOf`/`const`, the
 * Zod `.superRefine` in src/validators/v1/human-review.ts, the Pydantic
 * `model_validator` in python/.../models.py):
 *   1. The row MUST pin to a VERIFIED source: `session_trace_id` non-null OR
 *      `judge_decision_id` non-null. A thumb pinned to nothing is forgery-cost-
 *      zero and is refused.
 *   2. A SERVICE-ACCOUNT-authored row is refused — `reviewer_is_service_account`
 *      MUST be `false`. The `human_reviews` ledger is a HUMAN-only signal; a
 *      service-account assessment cannot be laundered into the human-signal
 *      counts.
 *   3. AT LEAST ONE of the three signal channels MUST be present — an empty
 *      review carries no human signal and is refused.
 *
 * ── tenant_id (DR-103 D2 / DR-085 D5 / deferral-G) ──
 * OPTIONAL-NOT-NULLABLE, BYTE-IDENTICAL to EvalSpec/EvalRun/SkillSnapshot/
 * SkillVersion: `readonly tenant_id?: Uuidv7`, omitted from `required`. An absent
 * tenant is a FIRST-CLASS single-tenant/global state, never pooled into a
 * cross-tenant aggregate (DR-103 D2 B2.2). The four existing reservations are the
 * precedent this FOLLOWS.
 *
 * ── Non-reproducible → permanently-staging predicate ──
 * A human's open-ended TEXT assessment is NON-REPRODUCIBLE; it can NEVER meet
 * `rekor_production`'s reproduce-the-hash bar. So the `human-review/v1` predicate
 * is PERMANENTLY `sigstore_staging` BY DESIGN (DR-103 D3 B3.2 — the permanence is
 * bound in the DR, not a silently-flippable constant). The predicate's REAL trust
 * criterion is verified reviewer identity + a pinned session, NOT a production
 * Rekor anchor. See src/predicates/human-review-v1.ts.
 *
 * ── Parallel statement, NOT the gate-pinned EvidenceStatement (DR-103 D1 B1.3) ──
 * A HumanReview rides a PARALLEL additive `HumanReviewStatement` binding only
 * `subject[0].digest.sha256 === input_hash` (no `gate_id` invariant). It does NOT
 * ride the `GateResultV1`-pinned `EvidenceStatement` (which is `.strict()` +
 * `z.literal(GATE_RESULT_V1_URI)`). See src/validators/v1/human-review-v1.ts.
 */

import type { ActorIdentity, Rfc3339, Sha256, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/** Single terminal state per ISEDC DR-103 D1 (append-only ledger). */
export type HumanReviewState = 'recorded';

/** No transitions — `recorded` is terminal. Revisions are NEW rows. */
export const humanReviewTransitions: TransitionMap<HumanReviewState> = {
  recorded: [],
} as const;

/**
 * HumanReview — one human's open-ended assessment of an EvalRun.
 *
 * Field semantics per ISEDC DR-103 D1 + the build-ready spec Item 2.
 */
export interface HumanReview {
  /** UUIDv7 PK. The `human_review_id` the human-review/v1 predicate references. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id (required). The EvalRun this human is assessing. */
  readonly eval_run_id: Uuidv7;

  /**
   * FK → SessionTrace.id, NULLABLE. ANTI-GAMING (DR-103 D1 B1.2): a review MUST
   * pin to a verified source — this OR {@link HumanReview.judge_decision_id} MUST
   * be non-null (machine-enforced). A review pinned to nothing is forgery-cost-
   * zero and is refused.
   */
  readonly session_trace_id: Uuidv7 | null;

  /**
   * FK → JudgeDecision.id, NULLABLE. The machine verdict the human is
   * agreeing-with / overriding (JudgeDecision's signed predicate is
   * `eval-verdict/v1`). ANTI-GAMING (DR-103 D1 B1.2): this OR
   * {@link HumanReview.session_trace_id} MUST be non-null.
   */
  readonly judge_decision_id: Uuidv7 | null;

  /**
   * Convenience pointer to the prior HumanReview this row revises (HumanReview →
   * HumanReview). `null` for the first review. No record is ever mutated — a
   * revision is a NEW row citing the prior (append-only ledger).
   */
  readonly supersedes_id: Uuidv7 | null;

  /**
   * Identity of the HUMAN reviewer (engineer email, account name). DR-103 D3 B3.2
   * names verified reviewer identity + the pinned session as `human-review/v1`'s
   * REAL trust criterion (its permanent-staging status is by design, not
   * half-finished).
   */
  readonly reviewer_identity: ActorIdentity;

  /**
   * ANTI-GAMING (DR-103 D1 B1.2): the `human_reviews` ledger is a HUMAN-only
   * signal, so a service-account-authored row is EXCLUDED structurally — this
   * MUST be `false` (machine-enforced; the type is the literal `false`). Carried
   * as an explicit, audited claim on every row rather than an implicit
   * assumption.
   */
  readonly reviewer_is_service_account: false;

  /**
   * Open-ended human assessment as NON-COMPARABLE free TEXT — intentionally NOT
   * an enum or number (DR-103 C3 B6.3). Consumers MUST NOT parse this into a
   * scalar or aggregate it. Nullable: a review may carry only a thumb and/or an
   * annotation.
   */
  readonly score_text: string | null;

  /**
   * Coarse up/down signal: `true` = up, `false` = down, `null` = no thumb. One of
   * the three ORTHOGONAL channels (DR-103 C3 B6.3) — never averaged with the
   * others.
   */
  readonly thumbs: boolean | null;

  /**
   * Free-text annotation / comment from the reviewer — contextual prose, distinct
   * from the open-ended SCORE channel {@link HumanReview.score_text}. Nullable.
   * One of the three ORTHOGONAL channels (DR-103 C3 B6.3).
   */
  readonly annotation: string | null;

  /**
   * BARE 64-hex sha256 of the canonical input the human reviewed. The parallel
   * `HumanReviewStatement` binds `subject[0].digest.sha256 === input_hash`
   * (DR-103 D1 B1.3) — that pin IS the forgery cost. BARE alphabet (aligned to
   * the entity-hash convention, e.g. `SkillSnapshot.combined_sha`); the in-toto
   * wire layer adds/strips the `sha256:` prefix at the boundary.
   */
  readonly input_hash: Sha256;

  /** RFC 3339 UTC timestamp the review was recorded. */
  readonly created_at: Rfc3339;

  /**
   * RESERVED multi-tenancy slot (deferral-G; bd_000-projects-k0fj; DR-085 D5),
   * OPTIONAL-NOT-NULLABLE and BYTE-IDENTICAL to EvalSpec/EvalRun/SkillSnapshot/
   * SkillVersion. An absent tenant is a first-class single-tenant/global state,
   * NEVER pooled into a cross-tenant aggregate (DR-103 D2 B2.2). v1 single-tenant
   * reviews omit it; tenant-isolation SEMANTICS remain out-of-scope for v1.
   */
  readonly tenant_id?: Uuidv7;
}
