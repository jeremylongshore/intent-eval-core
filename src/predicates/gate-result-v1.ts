/**
 * gate-result/v1 — NORMATIVE in-toto predicate body.
 *
 * Source: Blueprint B § 7.4 (lines 794–834). The ONLY predicate body fully
 * spec-bound at the Blueprint B merge — every other predicate URI runs in
 * `sigstore_staging` until its SPEC.md normative section lands (per DR-010 Q3
 * conditional approval).
 *
 * Predicate URI: `https://evals.intentsolutions.io/gate-result/v1`
 *
 * Wrapped in an in-toto Statement v1 envelope wrapped in DSSE
 * (`application/vnd.in-toto+json`). Each row is independently verifiable;
 * there is NO top-level bundle signature (Blueprint B § 7 line 754, line 756).
 *
 * **Adding a field or loosening a constraint here MUST go through Class-1
 * ISEDC convening** — this surface is one of the few signed, externally-
 * facing artifacts in the platform.
 */

import type { Rfc3339, Sha256Prefixed, Uuidv7 } from '../primitives.js';
import { DASHBOARD_RENDER_V1_URI } from './dashboard-render-v1.js';
import { HUMAN_REVIEW_V1_URI } from './human-review-v1.js';
import { RETRACTION_V1_URI } from './retraction-v1.js';
import { SKILL_REFINER_PASS_V1_URI } from './skill-refiner-pass-v1.js';

// ─── Predicate URI ─────────────────────────────────────────────────────────

/**
 * Canonical predicate URI for v1. Per ISEDC CISO binding (DR-004 / DR-010):
 * URIs live ONLY at `evals.intentsolutions.io`. `labs.intentsolutions.io` is
 * reserved-don't-touch for blog/methodology and MUST NOT host a predicate URI.
 */
export const GATE_RESULT_V1_URI = 'https://evals.intentsolutions.io/gate-result/v1' as const;
export type GateResultV1Uri = typeof GATE_RESULT_V1_URI;

// ─── Closed enums (Blueprint B § 7.4 — adding values requires Class-1 DR) ──

/** Gate decision verdict (§ 7.4 line 800, closed 4-element enum). */
export type GateDecision = 'pass' | 'fail' | 'advisory' | 'error';

/**
 * Severity classification when `gate_decision === 'advisory'`.
 * (§ 7.4 line 820, closed 3-element enum.)
 *
 * Consumer policies (`tests/TESTING.md`) MAY elevate any advisory to blocking
 * — the enum here is the producer-side severity hint, not the consumer-side
 * ship/no-ship decision.
 */
export type AdvisorySeverity = 'info' | 'warn' | 'error';

/**
 * Replay fidelity level per Blueprint B § 7.4 line 823.
 *
 * Levels per iel-E11 (RF-0 to RF-4); each level describes how faithfully a
 * gate decision can be reproduced from inputs alone:
 *   - `RF-0` — bit-exact reproducibility
 *   - `RF-1` — deterministic up to documented entropy sources
 *   - `RF-2` — deterministic up to seed
 *   - `RF-3` — best-effort reproducibility
 *   - `RF-4` — non-reproducible (recorded for forensics only)
 */
export type ReplayFidelityLevel = 'RF-0' | 'RF-1' | 'RF-2' | 'RF-3' | 'RF-4';

/**
 * Subject-naming side enum (§ 7.3 line 779).
 *
 * Closed 5-element set. Extending this enum is a Class-1 ISEDC matter —
 * it changes the in-toto subject discovery surface every consumer must
 * accept.
 */
export type SubjectSide = 'client' | 'server' | 'ci' | 'sandbox' | 'local';

// ─── Subject naming (§ 7.3 line 779) ───────────────────────────────────────

/**
 * Subject-name regex per Blueprint B § 7.3 line 779.
 *
 * Three segments separated by colons:
 *   1. `tool` — lowercase alphanumeric + hyphens, starting with [a-z0-9]
 *   2. `side` — closed `SubjectSide` enum
 *   3. `gate-id` — alphanumeric + dots + hyphens, starting with [a-zA-Z0-9]
 *
 * The regex is normative — consumers MUST validate subjects against it
 * before accepting a row.
 */
export const SUBJECT_NAME_REGEX =
  /^[a-z0-9][a-z0-9-]*:(client|server|ci|sandbox|local):[a-zA-Z0-9][a-zA-Z0-9.-]*$/;

/**
 * Runtime predicate for the subject-name regex.
 *
 * Pure boolean — does NOT mutate the input. Validators in epic iec-E04
 * wrap this with the parse-and-brand pattern that returns a refined type.
 */
export function isValidSubjectName(name: string): boolean {
  return SUBJECT_NAME_REGEX.test(name);
}

// ─── Coverage object (§ 7.4 line 807) ──────────────────────────────────────

/**
 * Coverage declaration. Both arrays are required by § 7.4. The ELEMENT type is
 * LOCKED as `string` (deferral-D resolution; bd_000-projects-9xyk) — a
 * kebab-slug dimension identifier — and stays `string` forever for
 * backward-compat: every v1 row already in the wild remains valid.
 *
 * The NOT_APPLICABLE encoding pattern (§ 7.4 line 832) writes `dimensions_
 * skipped` with a documented skip reason in `gate_reasons` — consumers MUST
 * NOT use `gate_decision: 'fail'` for N/A cases.
 */
export interface Coverage {
  readonly dimensions_evaluated: readonly string[];
  readonly dimensions_skipped: readonly string[];
}

/**
 * Per-dimension coverage status (deferral-D lockup; bd_000-projects-9xyk).
 *   - `evaluated` — the dimension was assessed
 *   - `skipped`   — the dimension was intentionally not assessed (N/A encoding)
 */
export type CoverageDimensionStatus = 'evaluated' | 'skipped';

/**
 * Richer per-dimension coverage element (deferral-D lockup; bd_000-projects-9xyk).
 *
 * § 7.4 line 807 fixed the `coverage` array element type as `string` and left
 * "richer per-dimension metadata" as a forward-compat extension. Per § 7.2
 * (adding an OPTIONAL field MUST NOT bump the URI) the richer shape lands as a
 * SEPARATE optional `coverage_detail` array — `coverage`'s `string` elements
 * are untouched, so this is purely additive and the predicate URI is unchanged.
 *
 * Each entry's `id` MUST appear in `coverage.dimensions_evaluated` (when
 * `status: 'evaluated'`) or `coverage.dimensions_skipped` (when
 * `status: 'skipped'`); the cross-field consistency is enforced at the
 * validator layer. `threshold`/`observed` are OPTIONAL descriptive numbers —
 * they describe what was measured, they do NOT drive ship/no-ship (that stays
 * consumer-side per § 7.6, same as `metadata`).
 */
export interface CoverageDimensionDetail {
  /** Dimension id — MUST match an entry in the matching `coverage` array. */
  readonly id: string;
  readonly status: CoverageDimensionStatus;
  /** Optional skip reason (RECOMMENDED when status is `skipped`). */
  readonly skip_reason?: string;
  /** Optional descriptive threshold the dimension was measured against. */
  readonly threshold?: number;
  /** Optional descriptive observed value for the dimension. */
  readonly observed?: number;
}

// ─── Predicate body (§ 7.4 line 800-823) ───────────────────────────────────

/**
 * Required-field portion of the gate-result/v1 predicate body.
 *
 * Field semantics verbatim from Blueprint B § 7.4 (lines 800-815).
 */
export interface GateResultV1Required {
  /**
   * Pipeline-hop-qualified gate identifier. MUST match the in-toto subject
   * `name` per § 7.3 — i.e., MUST satisfy `SUBJECT_NAME_REGEX`.
   */
  readonly gate_id: string;

  /** Short human-readable kebab-case gate name. */
  readonly gate_name: string;

  /** SemVer version of the gate logic that produced this row. */
  readonly gate_version: string;

  /** Decision verdict. */
  readonly gate_decision: GateDecision;

  /**
   * Structured reason strings. Empty array permitted ONLY for unconditional
   * `pass`. For `fail` / `advisory` / `error`, at least one entry MUST
   * appear; for `error`, `gate_reasons[0]` MUST capture the error class
   * (§ 7.4 line 829).
   */
  readonly gate_reasons: readonly string[];

  /** Coverage declaration per § 7.4 line 807. */
  readonly coverage: Coverage;

  /**
   * Format: `sha256:<hex>:<repo-relative-path>`. Defends against mid-flight
   * policy mutation (§ 7.4 line 810).
   */
  readonly policy_ref: string;

  /** sha256-prefixed hash of the policy file content. */
  readonly policy_hash: Sha256Prefixed;

  /**
   * sha256-prefixed hash of the input the gate evaluated. MUST equal the
   * in-toto `subject[].digest.sha256` for the row (§ 7.4 line 814, § 7.3
   * line 792 cross-reference).
   */
  readonly input_hash: Sha256Prefixed;

  /** RFC 3339 UTC timestamp of evaluation. */
  readonly evaluated_at: Rfc3339;

  /** Runner identity, e.g., `audit-harness@0.3.0`. */
  readonly runner: string;

  /** Git commit SHA — full 40-hex or short 7-hex (§ 7.4 line 815). */
  readonly commit_sha: string;
}

/**
 * Optional-field portion of the gate-result/v1 predicate body (§ 7.4 lines
 * 818-823).
 *
 * Consumers MUST NOT use `metadata` for ship/no-ship decisions (§ 7.4 line
 * 818) — it is free-form tool-specific. Ship decisions belong on the
 * required-field surface.
 */
export interface GateResultV1Optional {
  /**
   * Tool-specific free-form metadata. Consumers MUST NOT use this for
   * ship/no-ship decisions per § 7.4 line 818.
   */
  readonly metadata?: Readonly<Record<string, unknown>>;

  /**
   * Failure-mode classifier. MUST be populated when `gate_decision === 'fail'`
   * AND the originating tool defines failure modes (e.g., MM-class for
   * audit-harness gates). Format is engineer's choice — typically the MM-class
   * literal like `'MM-4'`.
   */
  readonly failure_mode?: string;

  /**
   * Severity hint when `gate_decision === 'advisory'`. Consumer policy
   * decides whether to elevate to blocking.
   */
  readonly advisory_severity?: AdvisorySeverity;

  /** FK → CostRecord.id for cost attribution. */
  readonly cost_record_ref?: Uuidv7;

  /** Replay fidelity level claim per iel-E11. */
  readonly replay_fidelity_level?: ReplayFidelityLevel;

  /**
   * Richer per-dimension coverage metadata (deferral-D lockup;
   * bd_000-projects-9xyk). OPTIONAL and additive — the required `coverage`
   * string arrays are unchanged. When present, every entry's `id` MUST be a
   * member of the matching `coverage` array (validator-enforced). Descriptive
   * only — MUST NOT drive ship/no-ship decisions (mirrors `metadata`).
   */
  readonly coverage_detail?: readonly CoverageDimensionDetail[];
}

/**
 * gate-result/v1 predicate body — full normative shape.
 *
 * NORMATIVE per Blueprint B § 7.4. Adding/loosening any field requires
 * Class-1 ISEDC convening.
 *
 * Usage at runtime: this object becomes the `predicate` field of an in-toto
 * Statement v1, which is then base64-encoded as the `payload` of a DSSE
 * envelope. The kernel exports `GateResultV1Statement` for the in-toto
 * Statement wrapping and `DsseEnvelope` for the outer envelope — both also
 * normative per § 7 lines 743-756.
 */
export type GateResultV1 = GateResultV1Required & GateResultV1Optional;

// ─── in-toto + DSSE wrapping (Blueprint B § 7.3 + § 7) ─────────────────────

/**
 * in-toto Subject entry (§ 7.3 line 779-792).
 *
 * `name` MUST satisfy `SUBJECT_NAME_REGEX`. `digest.sha256` MUST equal the
 * predicate body's `input_hash` for that row.
 */
export interface InTotoSubject {
  readonly name: string;
  readonly digest: { readonly sha256: string };
}

/**
 * in-toto Statement v1 wrapping a gate-result/v1 predicate body.
 *
 * Per the in-toto attestation framework, `_type` MUST be the Statement v1 URI
 * and `predicateType` MUST be the canonical gate-result/v1 URI.
 */
export interface GateResultV1Statement {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly InTotoSubject[];
  readonly predicateType: GateResultV1Uri;
  readonly predicate: GateResultV1;
}

/**
 * DSSE envelope (Blueprint B § 7 lines 743-750).
 *
 * `payload` carries the base64-encoded in-toto Statement v1 JSON. Each row
 * is independently verifiable — there is NO top-level bundle signature
 * (§ 7 line 754, line 756).
 */
export interface DsseEnvelope {
  readonly payloadType: 'application/vnd.in-toto+json';
  /** Base64-encoded in-toto Statement v1 JSON. */
  readonly payload: string;
  readonly signatures: readonly DsseSignature[];
}

/** DSSE signature entry. */
export interface DsseSignature {
  /** Cosign-OIDC fingerprint of the signing key. */
  readonly keyid: string;
  /** Base64-encoded signature bytes. */
  readonly sig: string;
}

// ─── Sibling predicate URI constants (bodies NOT spec'd here) ──────────────

/**
 * Predicate URIs blessed by Blueprint B § 3.3 / glossary § 6.
 *
 * Bodies for these are NOT in Blueprint B — they each await their own SPEC.md
 * normative section. Until then, they run in `sigstore_staging` per DR-010 Q3
 * conditional approval.
 *
 * Exposed as string-literal constants so consumers can reference the URI
 * stably even before the body is locked. Adding a new URI is allowed (per
 * § 7.2 backward-compat) but the body normative spec must land before
 * production-Rekor unlock.
 */
export const PREDICATE_URIS = {
  GATE_RESULT_V1: GATE_RESULT_V1_URI,
  // ADDITIVE in v0.2.0 — bodies ship in src/predicates/ (B4 + B3 bindings).
  RETRACTION_V1: RETRACTION_V1_URI,
  DASHBOARD_RENDER_V1: DASHBOARD_RENDER_V1_URI,
  // ADDITIVE — minted staging-first by Class-1 ADR DR-082; body ships in
  // src/predicates/skill-refiner-pass-v1.ts, runs in sigstore_staging (`ln`).
  SKILL_REFINER_PASS_V1: SKILL_REFINER_PASS_V1_URI,
  // ADDITIVE — net-new human-trust predicate URI minted by Class-2 ISEDC DR-103
  // (D1 + D3). Body ships in src/predicates/human-review-v1.ts. PERMANENTLY
  // sigstore_staging by design (DR-103 D3 B3.2 — a human's open-ended TEXT
  // assessment is non-reproducible, so it can never meet rekor_production's bar).
  HUMAN_REVIEW_V1: HUMAN_REVIEW_V1_URI,
  VALIDATION_RESULT_V1: 'https://evals.intentsolutions.io/validation-result/v1',
  EVAL_VERDICT_V1: 'https://evals.intentsolutions.io/eval-verdict/v1',
  COST_ATTRIBUTION_V1: 'https://evals.intentsolutions.io/cost-attribution/v1',
  RUNTIME_RECEIPT_V1: 'https://evals.intentsolutions.io/runtime-receipt/v1',
} as const;

export type KnownPredicateUri = (typeof PREDICATE_URIS)[keyof typeof PREDICATE_URIS];
