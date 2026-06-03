/**
 * retraction/v1 — in-toto predicate body for retracting a prior attestation.
 *
 * A retraction does NOT delete the original attestation — the original row
 * remains in the transparency log. A retraction is an APPEND-ONLY signed
 * record stating that the platform has chosen NOT to surface a prior subject,
 * and why. The lab-reports dashboard renders a tombstone at the deep link per
 * the retraction-protocol binding.
 *
 * Predicate URI: `https://evals.intentsolutions.io/retraction/v1`
 *
 * Wrapped in an in-toto Statement v1 envelope wrapped in DSSE
 * (`application/vnd.in-toto+json`), like every other predicate body. Each row
 * is independently verifiable; there is NO top-level bundle signature
 * (Blueprint B § 7 line 754).
 *
 * ADDITIVE in kernel v0.2.0 (B4 binding). Net-new predicate URI; no v0.1
 * contract is changed. Per § 7.2 backward-compat, adding a predicate URI is
 * allowed. The `reason_class` set is CLOSED — open-text reasons are rejected
 * by the validator (GC refusal binding).
 */

import type { Rfc3339, Sha256Prefixed, StorageKey, Uuidv7 } from '../primitives.js';

// ─── Predicate URI ─────────────────────────────────────────────────────────

/**
 * Canonical predicate URI for retraction/v1. Per ISEDC CISO binding (DR-004 /
 * DR-010): URIs live ONLY at `evals.intentsolutions.io`. `labs.intentsolutions
 * .io` is reserved-don't-touch for blog/methodology and MUST NOT host a
 * predicate URI.
 */
export const RETRACTION_V1_URI = 'https://evals.intentsolutions.io/retraction/v1' as const;
export type RetractionV1Uri = typeof RETRACTION_V1_URI;

// ─── Closed enum (adding a value requires Class-1 ISEDC) ────────────────────

/**
 * CLOSED-SET reason class for a retraction (GC refusal binding — open text is
 * not a valid reason class). Adding a value is a Class-1 ISEDC matter.
 *
 * - `partner-request`       — a partner asked us to stop surfacing the result
 * - `methodology-error`     — the eval methodology was found to be flawed
 * - `data-quality`          — the underlying data was bad / corrupted
 * - `consent-withdrawn`     — consent to publish was withdrawn
 * - `legal-hold`            — legal requires the result not be surfaced
 * - `pre-publication-recall`— recalled before it was ever published publicly
 */
export type RetractionReasonClass =
  | 'partner-request'
  | 'methodology-error'
  | 'data-quality'
  | 'consent-withdrawn'
  | 'legal-hold'
  | 'pre-publication-recall';

// ─── Retracted-subject reference ───────────────────────────────────────────

/**
 * Reference to the subject being retracted — the prior EvidenceBundle /
 * in-toto Statement. At least one field MUST be present so the retraction is
 * resolvable to a concrete artifact (enforced by the validator).
 */
export interface RetractedSubject {
  /** UUIDv7 of the EvidenceBundle being retracted (FK → EvidenceBundle.id). */
  readonly bundle_id?: Uuidv7;
  /** Content-addressed object-storage key of the retracted bundle payload. */
  readonly storage_key?: StorageKey;
  /** sha256-prefixed digest of the retracted artifact, pinning exact content. */
  readonly content_hash?: Sha256Prefixed;
}

// ─── Predicate body ────────────────────────────────────────────────────────

/**
 * retraction/v1 predicate body — full shape.
 *
 * Wrapping is identical to gate-result/v1: this object becomes the
 * `predicate` field of an in-toto Statement v1, base64-encoded as the
 * `payload` of a DSSE envelope.
 */
export interface RetractionV1 {
  /** Reference to the subject being retracted. */
  readonly retracted_subject: RetractedSubject;

  /** Closed-set reason class. */
  readonly reason_class: RetractionReasonClass;

  /**
   * OPTIONAL human-readable free-text elaboration. The machine-actionable
   * class is `reason_class`; this is operator context only and MUST NOT be
   * parsed for decisions.
   */
  readonly reason?: string;

  /** RFC 3339 UTC timestamp at which the retraction took effect. */
  readonly retracted_at: Rfc3339;

  /**
   * OPTIONAL actor identity that authored the retraction, for audit-trail
   * attribution.
   */
  readonly retracted_by?: string;
}

// ─── in-toto Statement wrapping ────────────────────────────────────────────

/**
 * in-toto Statement v1 wrapping a retraction/v1 predicate body.
 *
 * `_type` MUST be the Statement v1 URI and `predicateType` MUST be the
 * canonical retraction/v1 URI. The `subject` typically names the retracted
 * artifact; the predicate body carries the structured `retracted_subject`
 * reference for resolvers that do not parse in-toto subjects.
 */
export interface RetractionV1Statement {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly {
    readonly name: string;
    readonly digest: { readonly sha256: string };
  }[];
  readonly predicateType: RetractionV1Uri;
  readonly predicate: RetractionV1;
}
