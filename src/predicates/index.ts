/**
 * in-toto predicate body definitions.
 *
 * Per Blueprint B § 7. The kernel ships predicate body shapes for predicate
 * URIs blessed by the platform.
 *
 * - `gate-result/v1` — the ONLY NORMATIVE body (Blueprint B § 7.4); runs in
 *   `rekor_production`.
 * - `retraction/v1` + `dashboard-render/v1` — ADDITIVE in v0.2.0 (B4 + B3
 *   bindings). Body shapes ship here; they run in `sigstore_staging` until
 *   production-Rekor unlock per DR-010 Q3.
 *
 * Every other predicate URI is exposed only as a string constant (URI) in
 * `PREDICATE_URIS`, with its body normative spec deferred to a per-predicate
 * SPEC.md landing.
 */

export * from './gate-result-v1.js';
export * from './retraction-v1.js';
export * from './dashboard-render-v1.js';
