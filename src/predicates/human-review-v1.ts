/**
 * human-review/v1 — in-toto predicate body attesting a curated HUMAN-trust signal
 * on an EvalRun (the open-ended human counterpart to gate-result/v1).
 *
 * Source: ISEDC DR-103 D1 + D3 (intent-eval-lab `103-AT-DECR-isedc-skill-scoring-
 * kernel-contracts-2026-06-25.md`). Net-new predicate URI, ADDITIVE per
 * Blueprint B § 7.2 backward-compat — no v1 contract is changed.
 *
 * Predicate URI: `https://evals.intentsolutions.io/human-review/v1`
 *
 * ── PERMANENTLY sigstore_staging — BY DESIGN, BOUND IN DR-103 D3 B3.2 ──
 * A human's open-ended TEXT assessment is NON-REPRODUCIBLE — it can NEVER meet
 * `rekor_production`'s reproduce-the-hash bar. So this predicate is PERMANENTLY
 * `sigstore_staging`, and that permanence is BOUND IN THE DR, not a hand-edited,
 * silently-flippable constant. {@link HUMAN_REVIEW_V1_SIGNING_MODE} is typed as
 * the LITERAL `'sigstore_staging'` (not the open `SigningMode` union), so a
 * future agent that tries to assign `'rekor_production'` to it is a COMPILE
 * ERROR, not a silent flip. The permanence is also enforced by a test that
 * asserts the const can never equal `'rekor_production'`.
 *
 * The predicate's REAL trust criterion is NOT a production Rekor anchor — it is
 * VERIFIED REVIEWER IDENTITY + a PINNED SESSION (DR-103 D3 B3.2 DevRel binding).
 * "Staging" here means staging-forever-by-design, NOT half-finished or abandoned;
 * an OSS adopter must not read `unsigned == abandoned`. The doc-072 boundary holds:
 * a curated `j-rig review` thumb is NOT a trust root.
 *
 * ── Parallel statement, NOT the gate-pinned EvidenceStatement (DR-103 D1 B1.3) ──
 * A human-review/v1 row rides a PARALLEL additive `HumanReviewStatement` (see
 * src/validators/v1/human-review-v1.ts) binding ONLY `subject[0].digest.sha256
 * === input_hash` — there is NO `gate_id` invariant (a human review has no gate).
 * It does NOT ride the `GateResultV1`-pinned `EvidenceStatement` (`.strict()` +
 * `z.literal(GATE_RESULT_V1_URI)`). A human-trust row masquerading as a
 * gate-result statement is lineage-laundering and is refused.
 *
 * ── HumanReview-by-id-not-entity ──
 * The `human_review_id` / `eval_run_id` / `session_trace_id` / `judge_decision_id`
 * provenance set references the {@link HumanReview} entity (15th canonical, DR-103
 * D1) by the kernel's EXISTING `Uuidv7` + `Sha256Prefixed` primitives. `subject[]
 * .digest.sha256` MUST equal `input_hash` WITHOUT the `sha256:` prefix — the
 * forgery-cost pin (DR-103 D1 B1.3 + D3 B3.4).
 *
 * ── Immutability (DR-103 D3 B3.5, inheriting DR-064) ──
 * Adding OR loosening ANY field here requires a fresh Class-1 ISEDC convening; a
 * breaking change mints a NEW URI `human-review/v2` on its own lane — v1 is NEVER
 * edited in place. No URI is registered before its accept-rule (the
 * subject-digest pin) is machine-enforced.
 */

import type { Rfc3339, Sha256Prefixed, Uuidv7 } from '../primitives.js';

// ─── Predicate URI ─────────────────────────────────────────────────────────

/**
 * Canonical predicate URI for human-review/v1. Per ISEDC CISO binding
 * (DR-004 / DR-010 / DR-103 D3 B3.1): URIs live ONLY at
 * `evals.intentsolutions.io`. `labs.intentsolutions.io` is reserved-don't-touch
 * for blog/methodology and MUST NOT host a predicate URI.
 */
export const HUMAN_REVIEW_V1_URI = 'https://evals.intentsolutions.io/human-review/v1' as const;
export type HumanReviewV1Uri = typeof HUMAN_REVIEW_V1_URI;

// ─── PERMANENT signing-mode lock (DR-103 D3 B3.2) ──────────────────────────

/**
 * The signing mode for `human-review/v1`, PERMANENTLY `sigstore_staging` BY
 * DESIGN (DR-103 D3 B3.2). Typed as the LITERAL `'sigstore_staging'`, NOT the
 * open `SigningMode` union, so an attempt to reassign it to `'rekor_production'`
 * is a COMPILE-TIME error — the permanence cannot be silently flipped by a future
 * agent editing a constant. A human's open-ended TEXT assessment is
 * non-reproducible and can never meet `rekor_production`'s reproduce-the-hash bar;
 * "staging" here is staging-forever-by-design, not a TODO.
 */
export const HUMAN_REVIEW_V1_SIGNING_MODE = 'sigstore_staging' as const;

/**
 * The REAL trust criterion for `human-review/v1` (DR-103 D3 B3.2 DevRel binding):
 * verified reviewer identity + a pinned session, NOT a production Rekor anchor.
 * Surfaced as a doc string so the dev-facing meaning of "permanently staging" is
 * loud at the contract layer: staging-by-design, with a different real trust
 * criterion — NOT half-finished.
 */
export const HUMAN_REVIEW_V1_TRUST_CRITERION = 'verified-reviewer-identity+pinned-session' as const;

// ─── Predicate body ────────────────────────────────────────────────────────

/**
 * Required-field portion of the human-review/v1 predicate body. Mirrors the
 * {@link HumanReview} entity's verified-pin + signal channels. The three signal
 * channels stay ORTHOGONAL (DR-103 C3 B6.3) — `score_text` is NON-COMPARABLE
 * free text; consumers MUST NOT parse it into a scalar.
 */
export interface HumanReviewV1Required {
  /** UUIDv7 of the HumanReview entity row this predicate attests. */
  readonly human_review_id: Uuidv7;

  /** UUIDv7 of the EvalRun the human assessed. */
  readonly eval_run_id: Uuidv7;

  /**
   * UUIDv7 of the pinned SessionTrace, NULLABLE. The verified-source pin
   * (DR-103 D1 B1.2): this OR {@link HumanReviewV1Required.judge_decision_id}
   * MUST be non-null.
   */
  readonly session_trace_id: Uuidv7 | null;

  /**
   * UUIDv7 of the pinned JudgeDecision the human agrees-with / overrides,
   * NULLABLE. The verified-source pin (DR-103 D1 B1.2): this OR
   * {@link HumanReviewV1Required.session_trace_id} MUST be non-null.
   */
  readonly judge_decision_id: Uuidv7 | null;

  /** Opaque human reviewer identity (the trust anchor, DR-103 D3 B3.2). */
  readonly reviewer_identity: string;

  /**
   * Open-ended NON-COMPARABLE assessment text (DR-103 C3 B6.3). Nullable.
   * Consumers MUST NOT parse this into a scalar.
   */
  readonly score_text: string | null;

  /** Coarse up/down boolean; null = no thumb. */
  readonly thumbs: boolean | null;

  /** Free-text contextual annotation; null = none. */
  readonly annotation: string | null;

  /**
   * sha256-prefixed hash of the canonical input the human reviewed. The in-toto
   * `subject[].digest.sha256` for the row MUST equal this value WITHOUT the
   * `sha256:` prefix — the forgery-cost pin (DR-103 D1 B1.3 + D3 B3.4).
   */
  readonly input_hash: Sha256Prefixed;

  /** RFC 3339 UTC timestamp the review was recorded. */
  readonly reviewed_at: Rfc3339;
}

/**
 * Optional-field portion of the human-review/v1 predicate body. None is a
 * trust determinant — all descriptive.
 */
export interface HumanReviewV1Optional {
  /**
   * UUIDv7 of the prior HumanReview this row revises (append-only ledger). Absent
   * on a first review.
   */
  readonly supersedes_id?: Uuidv7;
}

/**
 * human-review/v1 predicate body — full shape.
 *
 * Wrapping is identical to gate-result/v1: this object becomes the `predicate`
 * field of an in-toto Statement v1, base64-encoded as the `payload` of a DSSE
 * envelope. Adding/loosening any field requires Class-1 ISEDC convening
 * (DR-103 D3 B3.5).
 */
export type HumanReviewV1 = HumanReviewV1Required & HumanReviewV1Optional;

// ─── in-toto Statement wrapping (parallel to gate-result, DR-103 D1 B1.3) ───

/**
 * in-toto Statement v1 wrapping a human-review/v1 predicate body.
 *
 * `_type` MUST be the Statement v1 URI and `predicateType` MUST be the canonical
 * human-review/v1 URI. The `subject` names the reviewed input; its `digest.sha256`
 * MUST equal the body's `input_hash` (sans the `sha256:` prefix) per DR-103 D1
 * B1.3 — the ONLY cross-field invariant (no `gate_id`, a human review has no
 * gate). This is the PARALLEL statement type; it does NOT reuse the gate-pinned
 * `EvidenceStatement`.
 */
export interface HumanReviewV1Statement {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly {
    readonly name: string;
    readonly digest: { readonly sha256: string };
  }[];
  readonly predicateType: HumanReviewV1Uri;
  readonly predicate: HumanReviewV1;
}
