import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z.any(),
    session_trace_id: z.any(),
    matcher_map_id: z.any(),
    judge_identity: z
      .string()
      .min(1)
      .describe('Stable judge identity, e.g., `audit-harness@0.3.0:escape-scan`.'),
    judge_version: z.any(),
    verdict: z
      .enum(['PASS', 'FAIL', 'ADVISORY', 'NOT_APPLICABLE', 'ERROR'])
      .describe(
        'Verdict enum per Blueprint B § 2.5 (closed 5-element set). UPPERCASE — deliberately DISTINCT from GateDecision (lowercase).',
      ),
    verdict_source: z
      .enum(['deterministic', 'llm_with_seed', 'llm_no_seed', 'hybrid'])
      .describe('How the verdict was reached.'),
    confidence: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.number().gte(0).lte(1), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe('Populated for LLM judges; null for deterministic judges.'),
    reasoning: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.string(), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe('Free-form judge reasoning output.'),
    input_hash: z.any(),
    seed: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.number().int(), z.string(), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe(
        "Populated for verdict_source='llm_with_seed'. Blueprint B does not specify integer vs string — both accepted.",
      ),
    evaluated_at: z.any(),
    latency_ms: z.number().int().gte(0),
    cost_record_ref: z.any(),
  })
  .strict()
  .describe(
    'Single terminal state `recorded`. Immutable at creation. Follow-up verdicts = new rows. When emitted as a signed predicate row, the URI is eval-verdict/v1 (currently sigstore_staging).',
  );
