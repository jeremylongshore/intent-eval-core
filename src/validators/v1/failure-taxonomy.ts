/**
 * FailureTaxonomy runtime validator (Blueprint B § 2.13).
 *
 * mm_class uses MmClassIdSchema (template-literal-ish — accepts any MM-N),
 * which is BROADER than MmClassSchema in MatcherMap. The taxonomy is the
 * source of truth for what classes exist; MatcherMap's kernel enum lags.
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  MmClassIdSchema,
  Rfc3339Schema,
  SemVerSchema,
  Uuidv7Schema,
} from './_primitives.js';

export const FailureTaxonomyStatusSchema = z.enum(['proposed', 'canonical', 'deprecated']);

export const FailureTaxonomyExampleSchema = z
  .object({
    ref: z.string(),
    description: z.string().optional(),
  })
  .strict();

export const FailureTaxonomySchema = z
  .object({
    id: Uuidv7Schema,
    mm_class: MmClassIdSchema,
    name: KebabSlugSchema,
    description: z.string().min(1),
    discriminating_question: z.string().min(1),
    examples: z.array(FailureTaxonomyExampleSchema),
    version: SemVerSchema,
    status: FailureTaxonomyStatusSchema,
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
  })
  .strict();

export type FailureTaxonomy = z.infer<typeof FailureTaxonomySchema>;
