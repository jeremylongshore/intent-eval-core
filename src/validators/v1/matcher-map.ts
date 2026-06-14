/**
 * MatcherMap runtime validator (Blueprint B § 2.3).
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  MmClassSchema,
  Rfc3339Schema,
  SemVerSchema,
  Sha256Schema,
  Uuidv7Schema,
} from './_primitives.js';

/** Structural-constraint comparison op (deferral-B, bd_000-projects-ra9a). */
export const StructuralOpSchema = z.enum([
  'exists',
  'absent',
  'equals',
  'type-is',
  'matches',
  'length-equals',
]);

/** A single path-anchored structural constraint (deferral-B). */
export const StructuralConstraintSchema = z
  .object({
    path: z.string().min(1),
    op: StructuralOpSchema,
    /**
     * Required for value-bearing ops; omitted for presence ops (exists/absent).
     * `.optional()` so the key may be absent — `z.unknown()` alone is treated
     * as non-optional by Zod 4 under `.strict()`.
     */
    value: z.unknown().optional(),
  })
  .strict();

/** Structural matcher payload — conjunction of constraints (deferral-B). */
export const StructuralMatcherSchema = z
  .object({
    mode: z.literal('all'),
    constraints: z.array(StructuralConstraintSchema),
  })
  .strict();

/** Closed 3-variant union per Blueprint B § 2.3 line 159. */
export const MatcherInputPatternSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('regex'),
      pattern: z.string(),
      flags: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('json-schema'),
      schema: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('structural'),
      /** Structural payload LOCKED per deferral-B (bd_000-projects-ra9a). */
      matcher: StructuralMatcherSchema,
    })
    .strict(),
]);

export const MatcherExpectedBehaviorKindV1Schema = z.enum([
  'exact',
  'semantic',
  'contract-conformance',
  'redaction-confirmed',
]);

/** v1 named variants + open extension slot per spec's explicit "etc." trailer. */
export const MatcherExpectedBehaviorSchema = z.union([
  z.object({
    kind: MatcherExpectedBehaviorKindV1Schema,
    payload: z.unknown().optional(),
  }),
  z.object({
    kind: z.string(),
    payload: z.unknown(),
    extension: z.literal(true),
  }),
]);

export const MatcherMapSchema = z
  .object({
    id: Uuidv7Schema,
    mm_class: MmClassSchema,
    name: KebabSlugSchema,
    input_pattern: MatcherInputPatternSchema,
    expected_behavior: MatcherExpectedBehaviorSchema,
    version: SemVerSchema,
    content_hash: Sha256Schema,
    description: z.string().min(1),
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
  })
  .strict();

export type MatcherMap = z.infer<typeof MatcherMapSchema>;
