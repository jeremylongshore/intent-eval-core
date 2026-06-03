/**
 * EvidenceBundle runtime validator (Blueprint B § 2.4).
 */

import { z } from 'zod';
import {
  Rfc3339Schema,
  Sha256PrefixedSchema,
  Sha256Schema,
  StorageKeySchema,
  SubjectNameSchema,
  Uuidv7Schema,
} from './_primitives.js';

export const SigningModeSchema = z.enum([
  'sigstore_staging',
  'rekor_production',
  'unsigned_experimental',
]);

export const VerificationStatusSchema = z.enum(['verified', 'unverified', 'failed']);

export const InTotoSubjectSchema = z
  .object({
    name: SubjectNameSchema,
    digest: z
      .object({
        sha256: Sha256Schema,
      })
      .passthrough(),
  })
  .strict();

export const EvidenceBundleSchema = z
  .object({
    id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema,
    created_at: Rfc3339Schema,
    predicate_uri_set: z.array(z.string().url()),
    row_count: z.number().int().nonnegative(),
    subject_set: z.array(InTotoSubjectSchema),
    storage_key: StorageKeySchema,
    signing_mode: SigningModeSchema,
    rekor_log_indices: z.array(z.number().int().nonnegative()),
    verification_status: VerificationStatusSchema,
    verification_last_checked_at: Rfc3339Schema,
    // Pre-registration commitment hash (D2 binding, v0.2.0 additive). Optional
    // + nullable so v0.1.0 bundles (which never set it) still parse; cross-field
    // invariants that govern when it MUST be non-null land in iec-E12.
    pre_registration_hash: Sha256PrefixedSchema.nullable().optional(),
  })
  .strict();

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
