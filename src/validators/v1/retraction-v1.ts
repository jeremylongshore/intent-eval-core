/**
 * retraction/v1 predicate body runtime validator (B4 binding, v0.2.0 additive).
 *
 * A retraction is an APPEND-ONLY signed record that the platform has chosen
 * not to surface a prior subject, and why. The `reason_class` enum is CLOSED
 * — open-text reasons are rejected (GC refusal binding). At least one
 * `retracted_subject` field MUST be present so the retraction is resolvable.
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  Rfc3339Schema,
  Sha256PrefixedSchema,
  StorageKeySchema,
  Uuidv7Schema,
} from './_primitives.js';

/** CLOSED-SET reason class (GC refusal binding — open text rejected). */
export const RetractionReasonClassSchema = z.enum([
  'partner-request',
  'methodology-error',
  'data-quality',
  'consent-withdrawn',
  'legal-hold',
  'pre-publication-recall',
]);

/**
 * Reference to the subject being retracted. `.strict()` + a `.refine()`
 * enforcing at-least-one-field so the retraction resolves to a concrete
 * artifact (mirrors the JSON Schema `minProperties: 1`).
 */
export const RetractedSubjectSchema = z
  .object({
    bundle_id: Uuidv7Schema.optional(),
    storage_key: StorageKeySchema.optional(),
    content_hash: Sha256PrefixedSchema.optional(),
  })
  .strict()
  .refine(
    (s) => s.bundle_id !== undefined || s.storage_key !== undefined || s.content_hash !== undefined,
    {
      message: 'retracted_subject MUST carry at least one of bundle_id, storage_key, content_hash',
    },
  );

/** The full retraction/v1 predicate body. */
export const RetractionV1Schema = z
  .object({
    retracted_subject: RetractedSubjectSchema,
    reason_class: RetractionReasonClassSchema,
    reason: z.string().optional(),
    retracted_at: Rfc3339Schema,
    retracted_by: ActorIdentitySchema.optional(),
  })
  .strict();

export type RetractionV1 = z.infer<typeof RetractionV1Schema>;

/** Canonical predicate URI per ISEDC CISO binding (evals.intentsolutions.io). */
export const RETRACTION_V1_URI = 'https://evals.intentsolutions.io/retraction/v1' as const;
