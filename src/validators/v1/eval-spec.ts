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

export const ScoringConfigSchema = z
  .object({
    aggregation_rule: ScoringAggregationRuleSchema,
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

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

/** Assertion expressions are typed `unknown` per spec STOP directive. */
export const AssertionExpressionSchema = z.unknown();

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
  })
  .strict();

export type EvalSpec = z.infer<typeof EvalSpecSchema>;
