/**
 * CostRecord runtime validator (Blueprint B § 2.12).
 */

import { z } from 'zod';
import { MicroUsdSchema, Rfc3339Schema, Uuidv7Schema } from './_primitives.js';

export const CostAttributionClassSchema = z.enum([
  'run',
  'provider',
  'judge',
  'replay',
  'cache_decision',
  'optimizer_experiment',
  'system',
]);

export const CostRecordSchema = z
  .object({
    id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema.nullable(),
    tool_invocation_id: Uuidv7Schema.nullable(),
    attribution_class: CostAttributionClassSchema,
    provider_id: z.string().min(1).nullable(),
    tokens_consumed: z.number().int().nonnegative(),
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    cached_tokens: z.number().int().nonnegative(),
    wall_clock_ms: z.number().int().nonnegative(),
    external_api_cost_micro_usd: MicroUsdSchema,
    recorded_at: Rfc3339Schema,
    cost_basis_version: z.string().min(1),
  })
  .strict();

export type CostRecord = z.infer<typeof CostRecordSchema>;
