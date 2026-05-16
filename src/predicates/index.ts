/**
 * in-toto predicate body definitions.
 *
 * Per Blueprint B § 7. The kernel ships normative predicate body shapes
 * for predicate URIs blessed by the platform. v1 ships only `gate-result/v1`
 * with a full normative body — every other predicate URI is exposed only as
 * a string constant (URI), with its body normative spec deferred to a
 * per-predicate SPEC.md landing per DR-010 Q3 conditional approval.
 */

export * from './gate-result-v1.js';
