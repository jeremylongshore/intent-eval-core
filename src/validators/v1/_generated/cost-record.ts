import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.any(), z.null()];
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
      .describe('Nullable for system-level rollups.'),
    tool_invocation_id: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.any(), z.null()];
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
      .describe('Nullable for run-level / system rollups.'),
    attribution_class: z
      .enum([
        'run',
        'provider',
        'judge',
        'replay',
        'cache_decision',
        'optimizer_experiment',
        'system',
      ])
      .describe('Cost attribution class enum (Blueprint B § 2.12, closed 7-element set).'),
    provider_id: z.any().superRefine((x, ctx) => {
      const schemas = [z.string().min(1), z.null()];
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
    }),
    tokens_consumed: z.number().int().gte(0),
    prompt_tokens: z.number().int().gte(0),
    completion_tokens: z.number().int().gte(0),
    cached_tokens: z.number().int().gte(0),
    wall_clock_ms: z.number().int().gte(0),
    external_api_cost_micro_usd: z.any(),
    recorded_at: z.any(),
    cost_basis_version: z
      .string()
      .min(1)
      .describe(
        'Version tag of the cost-basis lookup table. Table itself forward-deferred to iel-E14b.',
      ),
  })
  .strict()
  .describe(
    "Single terminal state `recorded`. Immutable. Rollups = separate rows with attribution_class='system'. NOT replay-deterministic (cost varies by cache state, pricing, seed routing). external_api_cost_micro_usd uses micro-USD per Blueprint B § 2.12 — NORMATIVE precision requirement. Predicate URI: cost-attribution/v1 (sigstore_staging).",
  );
