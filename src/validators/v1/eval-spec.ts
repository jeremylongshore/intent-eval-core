/**
 * EvalSpec runtime validator (Blueprint B § 2.1).
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  Rfc3339Schema,
  SemVerSchema,
  Sha256Schema,
  Uuidv7Schema,
} from './_primitives.js';

export const ScoringAggregationRuleSchema = z.enum(['majority', 'unanimous', 'weighted']);

/** Weight dimension for the weighted rule (deferral-C, bd_000-projects-21re). */
export const ScoringWeightDimensionSchema = z.enum(['matcher', 'mm-class', 'judge']);

/** A single weight entry under the weighted rule (deferral-C). */
export const ScoringWeightSchema = z
  .object({
    key: z.string(),
    weight: z.number().nonnegative(),
  })
  .strict();

/** Deterministic exact-tie resolution (deferral-C) — NOT a pass threshold. */
export const ScoringTiebreakerSchema = z.enum(['fail-closed', 'fail-open', 'first-listed']);

/**
 * Open-world per the canonical JSON Schema: schemas/v1/eval-spec.schema.json
 * declares `scoring` WITHOUT `additionalProperties: false` (unlike the
 * top-level EvalSpec object and the `composition` sub-objects), so
 * tool-emitted scoring extension keys that pass JSON Schema validation MUST
 * NOT be rejected here. `.passthrough()` mirrors that: unknown keys are
 * accepted AND preserved. The "Additions require ISEDC review" annotation
 * governs the spec-bound field set in the JSON Schema, not runtime rejection
 * of extra data. [f-iec-validators-1]
 */
export const ScoringConfigSchema = z
  .object({
    aggregation_rule: ScoringAggregationRuleSchema,
    weight_dimension: ScoringWeightDimensionSchema.optional(),
    weights: z.array(ScoringWeightSchema).optional(),
    tiebreaker: ScoringTiebreakerSchema.optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const RuntimeLimitsSchema = z
  .object({
    token_ceiling: z.number().int().nonnegative(),
    wall_clock_ceiling_ms: z.number().int().nonnegative(),
    memory_ceiling_mb: z.number().int().nonnegative(),
    concurrency_hint: z.number().int().nonnegative(),
  })
  .strict();

export const CompositionNodeKindSchema = z.enum(['eval_run', 'tool_invocation']);

export const CompositionEdgeKindSchema = z.enum(['feeds', 'gates', 'enriches']);

export const CompositionNodeSchema = z
  .object({
    id: z.string(),
    kind: CompositionNodeKindSchema,
    ref: Uuidv7Schema,
  })
  .strict();

export const CompositionEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    kind: CompositionEdgeKindSchema,
  })
  .strict();

export const CompositionDagSchema = z
  .object({
    nodes: z.array(CompositionNodeSchema),
    edges: z.array(CompositionEdgeSchema),
  })
  .strict();

/** v1 named assertion-class set (deferral-A, bd_000-projects-gzgj). */
export const AssertionClassSchema = z.enum([
  'output-equals',
  'output-contains',
  'output-matches',
  'schema-conforms',
  'judge-verdict',
  'matcher-satisfied',
]);

/**
 * Assertion expression — named-class discriminated union plus an open
 * extension slot (deferral-A lockup, bd_000-projects-gzgj). Per-class `target`
 * payload stays `unknown` — refined per engagement at a higher layer.
 */
export const AssertionExpressionSchema = z.union([
  z
    .object({
      class: AssertionClassSchema,
      target: z.unknown(),
      negate: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      class: z.string(),
      target: z.unknown(),
      negate: z.boolean().optional(),
      extension: z.literal(true),
    })
    .strict(),
]);

export const EvalSpecSchema = z
  .object({
    id: Uuidv7Schema,
    version: SemVerSchema,
    name: KebabSlugSchema,
    description: z.string().min(1),
    matchers: z.array(Uuidv7Schema),
    assertions: z.array(AssertionExpressionSchema),
    scoring: ScoringConfigSchema,
    composition: CompositionDagSchema,
    expected_artifacts: z.array(Sha256Schema),
    runtime_limits: RuntimeLimitsSchema,
    provider_constraints: z.array(z.string()),
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
    content_hash: Sha256Schema,
    /** RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj). */
    tenant_id: Uuidv7Schema.optional(),
  })
  .strict();

export type EvalSpec = z.infer<typeof EvalSpecSchema>;
