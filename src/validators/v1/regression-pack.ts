/**
 * RegressionPack runtime validator (Blueprint B § 2.7).
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  Rfc3339Schema,
  Sha256Schema,
  Uuidv7Schema,
} from './_primitives.js';

export const RegressionPackStateSchema = z.enum(['draft', 'committed', 'superseded']);

/** pass + fail required per Blueprint B § 2.7; others optional, not invented. */
export const MatcherOutcomeRowSchema = z
  .object({
    pass: z.number().int().nonnegative(),
    fail: z.number().int().nonnegative(),
    advisory: z.number().int().nonnegative().optional(),
    not_applicable: z.number().int().nonnegative().optional(),
    error: z.number().int().nonnegative().optional(),
  })
  .strict();

/** Partial<Record<MmClass, MatcherOutcomeRow>> — not every pack tests every class. */
export const RegressionOutcomeSummarySchema = z
  .object({
    'MM-1': MatcherOutcomeRowSchema.optional(),
    'MM-2': MatcherOutcomeRowSchema.optional(),
    'MM-3': MatcherOutcomeRowSchema.optional(),
    'MM-4': MatcherOutcomeRowSchema.optional(),
    'MM-5': MatcherOutcomeRowSchema.optional(),
    'MM-6': MatcherOutcomeRowSchema.optional(),
  })
  .strict();

export const RegressionPackSchema = z
  .object({
    id: Uuidv7Schema,
    name: KebabSlugSchema,
    purpose: z.string().min(1),
    skill_snapshot_sha: Sha256Schema,
    eval_spec_ids: z.array(Uuidv7Schema),
    eval_run_ids: z.array(Uuidv7Schema),
    outcome_summary: RegressionOutcomeSummarySchema,
    ancestor_pack_id: Uuidv7Schema.nullable(),
    delta_declaration: z.string(),
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
    content_hash: Sha256Schema,
  })
  .strict();

export type RegressionPack = z.infer<typeof RegressionPackSchema>;
