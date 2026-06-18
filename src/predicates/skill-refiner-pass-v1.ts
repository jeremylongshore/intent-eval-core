/**
 * skill-refiner-pass/v1 — in-toto predicate body attesting a SkillVersion
 * cleared the Skill Refiner acceptance gate.
 *
 * Attests that a real SkillVersion cleared the `@j-rig/refiner-core` acceptance
 * gate: significant Pareto-dominance on the behavioral dimension AND
 * non-regression on every named dimension, by a one-sided z-test at the stated
 * `alpha`. The signed body carries exactly the accept DETERMINANTS — the fields
 * a verifier needs to independently re-derive the accept decision from immutable
 * inputs (DR-082 Q2). Strip any one and the PASS becomes an unfalsifiable
 * "trust me, it passed". Provenance bulk (raw per-eval-item transcripts,
 * human-readable diff prose, dashboard-render metadata) is OUT of the signed
 * body, referenced by hash via the EvidenceBundle side-channel.
 *
 * Predicate URI: `https://evals.intentsolutions.io/skill-refiner-pass/v1`
 *
 * Wrapped in an in-toto Statement v1 envelope wrapped in DSSE
 * (`application/vnd.in-toto+json`), like every other predicate body (DR-082 Q4
 * — MIRROR gate-result/v1 exactly, no bespoke envelope). Each row is
 * independently verifiable; there is NO top-level bundle signature (Blueprint B
 * § 7 line 754). The in-toto `subject[].digest.sha256` MUST equal
 * `source_snapshot_hash` (without the `sha256:` prefix) — the authoring-chamber
 * analogue of gate-result/v1's `input_hash` === subject digest binding.
 *
 * ── Staging-first (SigningMode `ln`) ──
 * Minted staging-first by Class-1 ADR DR-082 (intent-eval-lab
 * `082-AT-DECR-isedc-skill-refiner-pass-v1-predicate-uri-2026-06-17.md`). This
 * predicate runs in `sigstore_staging` (the `ln` SigningMode) until ALL FOUR
 * DR-082 Q3 production triggers hold, AND-gated:
 *   1. the skill-refiner-pass/v1 SPEC.md normative section lands
 *      (RESERVED→ACTIVE in PREDICATE-TYPES.md);
 *   2. the DNSSEC + CAA pre-flight is green on `evals.intentsolutions.io`
 *      (iah-E06-class — already green for gate-result, so verify-still-green);
 *   3. the authoring chamber's SEPARATE signing trust root is provisioned-and-
 *      live (DR-081 no-shared-root — the NEW gating step gate-result never had);
 *   4. ≥1 REAL SkillVersion clears the behavioral gate on a FROZEN, signed
 *      eval-set (a green row, not a synthetic fixture).
 * Until all four hold: `signing_mode = "staging"`, `rekor_log_index = null` per
 * the DR-028 cross-field invariant. Do NOT wire production-Rekor signing here.
 *
 * ── SkillVersion-by-id-not-entity ──
 * The `skill_version_id` / `parent_version_id` / `source_snapshot_hash`
 * provenance triple references the SkillVersion by the kernel's EXISTING id/hash
 * primitives ({@link Uuidv7} + {@link Sha256Prefixed}). It does NOT define a
 * SkillVersion kernel entity — DR-028 T1 is a one-way door (SkillVersion stays a
 * separate entity, minted elsewhere).
 *
 * ── Immutability (DR-082 Q5, inheriting DR-064) ──
 * Net-new predicate URI, ADDITIVE per § 7.2 backward-compat — no v1 contract is
 * changed. Adding OR loosening ANY field here (including enum widening, or
 * relaxing `refiner_strategy_id`) requires a fresh Class-1 ISEDC convening; a
 * breaking change mints a NEW URI `skill-refiner-pass/v2` on its own lane —
 * v1 is NEVER edited in place.
 */

import type { Sha256Prefixed, Uuidv7 } from '../primitives.js';

// ─── Predicate URI ─────────────────────────────────────────────────────────

/**
 * Canonical predicate URI for skill-refiner-pass/v1. FLAT — a sibling of
 * gate-result/v1, distinguished only by the type name (DR-082 Q1: the
 * `/authoring/` sub-namespace is REJECTED; chamber isolation lives in the
 * separate signing trust root + `$schemaVersion` lane + file tree, never a URL
 * segment). Per ISEDC CISO binding (DR-004 / DR-010): URIs live ONLY at
 * `evals.intentsolutions.io`. `labs.intentsolutions.io` is reserved-don't-touch
 * for blog/methodology and MUST NOT host a predicate URI.
 */
export const SKILL_REFINER_PASS_V1_URI =
  'https://evals.intentsolutions.io/skill-refiner-pass/v1' as const;
export type SkillRefinerPassV1Uri = typeof SKILL_REFINER_PASS_V1_URI;

// ─── Closed enums (adding a value requires Class-1 ISEDC — /v2 per Q5) ──────

/**
 * Verdict — CLOSED enum. A row is EMITTED on `accept`, so the verdict is the
 * accept-record discriminator (DR-082 Q2). Widening this enum is a /v2 trigger:
 * a consumer that hard-codes the closed set must never silently encounter a new
 * verdict on an immutable row (CISO binding).
 */
export type SkillRefinerVerdict = 'accept' | 'reject';

/**
 * Statistical-test family. CONST for v1 — the acceptance gate is a one-sided
 * z-test (DR-028 + DR-082 Q2). Changing the test family is a SEMANTIC change
 * that mints /v2 (the same deltas/alpha would no longer mean the same verdict).
 */
export type SkillRefinerTestStatisticKind = 'one-sided-z';

/**
 * Replay fidelity level, mirroring gate-result/v1's iel-E11 RF-0..RF-4 ladder.
 */
export type SkillRefinerReplayFidelityLevel = 'RF-0' | 'RF-1' | 'RF-2' | 'RF-3' | 'RF-4';

// ─── Eval-set reference ────────────────────────────────────────────────────

/**
 * Reference to the FROZEN eval-set the verdict was derived against — the entire
 * epistemic basis of the claim. The `hash` pins exact content; `version` +
 * `lineage_id` pin which published eval-set and its provenance lineage.
 */
export interface EvalSetRef {
  /** sha256-prefixed digest of the frozen eval-set content. */
  readonly hash: Sha256Prefixed;
  /** Version identifier of the frozen eval-set. */
  readonly version: string;
  /** UUIDv7 of the eval-set lineage the frozen version belongs to. */
  readonly lineage_id: Uuidv7;
}

// ─── Named-dimension delta ─────────────────────────────────────────────────

/**
 * Observed delta on one named (non-behavioral) dimension — the non-regression
 * surface of the accept gate. Each entry is independently re-checkable: a
 * verifier re-runs the one-sided z-test on these deltas at the stated `alpha`.
 */
export interface NamedDimensionDelta {
  /** Named-dimension identifier (kebab-slug). */
  readonly id: string;
  /** Observed delta on this named dimension. */
  readonly delta: number;
  /**
   * Whether this dimension cleared the non-regression bar at the stated alpha.
   * For an `accept` verdict every entry MUST be true.
   */
  readonly non_regressed: boolean;
}

// ─── Predicate body ────────────────────────────────────────────────────────

/**
 * Required-field portion of the skill-refiner-pass/v1 predicate body — the
 * accept DETERMINANTS (DR-082 Q2).
 */
export interface SkillRefinerPassV1Required {
  /** Decision verdict — closed enum; the row is emitted on `accept`. */
  readonly verdict: SkillRefinerVerdict;

  /**
   * Structured reason entries — non-empty always, since this predicate is
   * emitted on a real verdict. Reasons SHOULD be structured codes, not free
   * prose, to avoid leaking skill content onto a public transparency log.
   */
  readonly reason: readonly string[];

  /**
   * Identifier of the RefinerStrategy that produced this verdict. REQUIRED in
   * the signed body per the DR-028 CISO Session-7 binding (mechanism-swappable
   * must not become mechanism-untraceable).
   */
  readonly refiner_strategy_id: string;

  /**
   * UUIDv7 of the accepted SkillVersion (the 14th entity per DR-028 T1).
   * Referenced by the kernel's EXISTING UUIDv7 primitive — this predicate does
   * NOT define a SkillVersion entity (DR-028 one-way-door).
   */
  readonly skill_version_id: Uuidv7;

  /**
   * UUIDv7 of the parent SkillVersion the accepted version was refined from.
   * Binds parent→child so a refiner cannot launder an unrelated skill through a
   * forged lineage.
   */
  readonly parent_version_id: Uuidv7;

  /**
   * sha256-prefixed content hash of the post-edit SkillVersion source snapshot.
   * The in-toto `subject[].digest.sha256` for the row MUST equal this value
   * WITHOUT the `sha256:` prefix (DR-082 Q4 wire discipline, the
   * authoring-chamber analogue of gate-result/v1's `input_hash` binding).
   */
  readonly source_snapshot_hash: Sha256Prefixed;

  /** Reference to the FROZEN eval-set the verdict was derived against. */
  readonly eval_set_ref: EvalSetRef;

  /**
   * sha256-prefixed hash of the EditProposal (bounded edit-ops) that earned the
   * pass — binds WHAT changed.
   */
  readonly edit_proposal_hash: Sha256Prefixed;

  /**
   * Observed delta on the behavioral dimension the accept gate requires
   * significant Pareto-dominance on.
   */
  readonly behavioral_delta: number;

  /**
   * Per-named-dimension observed deltas — the non-regression surface. MAY be
   * empty when the skill declares no named dimensions beyond the behavioral one.
   */
  readonly named_dimension_deltas: readonly NamedDimensionDelta[];

  /**
   * The significance level (α) the one-sided z-test was evaluated at — the
   * falsifiability anchor. Bound in (0, 1).
   */
  readonly alpha: number;

  /** Statistical-test family identifier — `one-sided-z` const for v1. */
  readonly test_statistic_kind: SkillRefinerTestStatisticKind;
}

/**
 * Optional-field portion of the skill-refiner-pass/v1 predicate body.
 *
 * These are descriptive or conditional — none is a determinant of the accept
 * decision (DR-082 Q2 places them OUT of the required determinant set).
 */
export interface SkillRefinerPassV1Optional {
  /** FK → CostRecord.id for cost attribution of the refiner run. */
  readonly cost_record_ref?: Uuidv7;

  /** Replay-fidelity claim for the refiner run (mirrors gate-result/v1). */
  readonly replay_fidelity_level?: SkillRefinerReplayFidelityLevel;

  /**
   * Structured reason recorded ONLY when the `signing_mode` was downgraded for
   * this row. Absent on a normally-signed row.
   */
  readonly signing_downgrade_reason?: string;
}

/**
 * skill-refiner-pass/v1 predicate body — full shape.
 *
 * Wrapping is identical to gate-result/v1: this object becomes the `predicate`
 * field of an in-toto Statement v1, base64-encoded as the `payload` of a DSSE
 * envelope. Adding/loosening any field requires Class-1 ISEDC convening
 * (DR-082 Q5).
 */
export type SkillRefinerPassV1 = SkillRefinerPassV1Required & SkillRefinerPassV1Optional;

// ─── in-toto Statement wrapping ────────────────────────────────────────────

/**
 * in-toto Statement v1 wrapping a skill-refiner-pass/v1 predicate body.
 *
 * `_type` MUST be the Statement v1 URI and `predicateType` MUST be the canonical
 * skill-refiner-pass/v1 URI. The `subject` names the accepted SkillVersion; its
 * `digest.sha256` MUST equal the body's `source_snapshot_hash` (sans the
 * `sha256:` prefix) per DR-082 Q4. The body itself carries no timestamp — the
 * determinant set is time-independent; envelope-time fields live on the
 * surrounding Statement / DSSE envelope, not the signed determinant body.
 */
export interface SkillRefinerPassV1Statement {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly {
    readonly name: string;
    readonly digest: { readonly sha256: string };
  }[];
  readonly predicateType: SkillRefinerPassV1Uri;
  readonly predicate: SkillRefinerPassV1;
}
