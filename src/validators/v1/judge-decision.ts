/**
 * JudgeDecision runtime validator (Blueprint B § 2.5).
 */

import { z } from 'zod';
import { Rfc3339Schema, SemVerSchema, Sha256Schema, Uuidv7Schema } from './_primitives.js';

/** UPPERCASE — deliberately DISTINCT from gate-result/v1.gate_decision (lowercase). */
export const JudgeVerdictSchema = z.enum(['PASS', 'FAIL', 'ADVISORY', 'NOT_APPLICABLE', 'ERROR']);

export const VerdictSourceSchema = z.enum([
  'deterministic',
  'llm_with_seed',
  'llm_no_seed',
  'hybrid',
]);

/** Blueprint B does not specify integer vs string — both accepted. */
export const JudgeSeedSchema = z.union([z.number().int(), z.string()]);

export const JudgeDecisionSchema = z
  .object({
    id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema,
    session_trace_id: Uuidv7Schema,
    matcher_map_id: Uuidv7Schema,
    judge_identity: z.string().min(1),
    judge_version: SemVerSchema,
    verdict: JudgeVerdictSchema,
    verdict_source: VerdictSourceSchema,
    confidence: z.number().gte(0).lte(1).nullable(),
    reasoning: z.string().nullable(),
    input_hash: Sha256Schema,
    seed: JudgeSeedSchema.nullable(),
    evaluated_at: Rfc3339Schema,
    latency_ms: z.number().int().nonnegative(),
    cost_record_ref: Uuidv7Schema,
  })
  .strict();

export type JudgeDecision = z.infer<typeof JudgeDecisionSchema>;
