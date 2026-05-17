import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z.any(),
    created_at: z.any(),
    predicate_uri_set: z
      .array(z.string().url())
      .describe("Predicate URIs represented in this bundle's rows."),
    row_count: z.number().int().gte(0),
    subject_set: z
      .array(
        z
          .object({ name: z.any(), digest: z.object({ sha256: z.any() }).catchall(z.any()) })
          .strict(),
      )
      .describe('Deduplicated in-toto Subject entries across all rows.'),
    storage_key: z.any(),
    signing_mode: z
      .enum(['sigstore_staging', 'rekor_production', 'unsigned_experimental'])
      .describe(
        'Signing posture. sigstore_staging is DR-010 Q3 default for predicates without normative SPEC.md (everything except gate-result/v1 at v1).',
      ),
    rekor_log_indices: z
      .array(z.number().int().gte(0))
      .describe("Populated when signing_mode='rekor_production'; empty otherwise."),
    verification_status: z.enum(['verified', 'unverified', 'failed']),
    verification_last_checked_at: z.any(),
  })
  .strict()
  .describe(
    'State machine: building → signing → signed → archived_to_rekor. APPEND-ONLY. Corrections = new bundle with new UUIDv7 referencing prior content_hash.',
  );
