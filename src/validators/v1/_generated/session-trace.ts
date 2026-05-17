import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z.any(),
    created_at: z.any(),
    closed_at: z.any().superRefine((x, ctx) => {
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
    }),
    root_span_id: z.any(),
    total_spans: z.number().int().gte(0),
    max_loop_depth: z.number().int().gte(0),
    total_tool_invocations: z.number().int().gte(0),
    total_judge_decisions: z.number().int().gte(0),
    trace_blob_storage_key: z.any(),
  })
  .strict()
  .describe(
    'State machine: open → closed (closed terminal). 1:1 cardinality with EvalRun. Trace blob content-addressed (tamper-evident) in object storage.',
  );
