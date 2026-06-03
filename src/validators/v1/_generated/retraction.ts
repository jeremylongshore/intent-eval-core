import { z } from 'zod';

export default z
  .object({
    retracted_subject: z
      .object({
        bundle_id: z
          .any()
          .describe('UUIDv7 of the EvidenceBundle being retracted (FK → EvidenceBundle.id).')
          .optional(),
        storage_key: z
          .any()
          .describe(
            'Content-addressed object-storage key of the retracted bundle payload (EvidenceBundle.storage_key).',
          )
          .optional(),
        content_hash: z
          .any()
          .describe(
            'sha256-prefixed digest of the retracted artifact, pinning exactly which content is retracted even if a storage backend re-keys.',
          )
          .optional(),
      })
      .strict()
      .describe(
        'Reference to the subject being retracted — the prior EvidenceBundle / in-toto Statement. At least one of bundle_id or storage_key MUST be present so the retraction is resolvable to a concrete artifact.',
      ),
    reason_class: z
      .enum([
        'partner-request',
        'methodology-error',
        'data-quality',
        'consent-withdrawn',
        'legal-hold',
        'pre-publication-recall',
      ])
      .describe(
        'CLOSED-SET reason class for the retraction (GC refusal binding — open text is rejected). Adding a value is a Class-1 ISEDC matter.',
      ),
    reason: z
      .string()
      .describe(
        'OPTIONAL human-readable free-text elaboration. The machine-actionable retraction class is carried by reason_class; this is operator context only and MUST NOT be parsed for decisions.',
      )
      .optional(),
    retracted_at: z.any().describe('RFC 3339 UTC timestamp at which the retraction took effect.'),
    retracted_by: z
      .any()
      .describe(
        'OPTIONAL actor identity (operator email / service account) that authored the retraction, for audit-trail attribution.',
      )
      .optional(),
  })
  .strict()
  .describe(
    'Predicate body of an in-toto Statement v1 whose predicateType is https://evals.intentsolutions.io/retraction/v1. A retraction does NOT delete the original attestation (it remains in the transparency log); it is an APPEND-ONLY signed record stating that the platform has chosen not to surface a prior subject and why. The dashboard renders a tombstone at the deep link per the retraction-protocol binding. The `reason_class` enum is CLOSED — open-text reasons are rejected by the schema (GC refusal binding). This schema validates ONLY the predicate body — the enclosing in-toto Statement envelope (_type, subject, predicateType) is validated separately. Each row independently verifiable; NO top-level bundle signature per Blueprint B § 7 line 754.\n\nADDITIVE in kernel v0.2.0: net-new predicate URI; no v0.1 contract changes. Per § 7.2 backward-compat, adding a predicate URI is allowed; the body normative spec lands here. Runs in sigstore_staging until production-Rekor unlock per DR-010 Q3.',
  );
