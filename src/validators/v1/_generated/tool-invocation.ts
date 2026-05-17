import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    session_trace_id: z.any(),
    parent_span_id: z.any(),
    tool_id: z
      .string()
      .min(1)
      .describe(
        "Tool identifier. Convention examples: 'audit-harness:escape-scan', 'provider:anthropic:claude-sonnet-4-5'. Format NOT enforced at this layer.",
      ),
    tool_version: z.any(),
    args: z
      .record(z.string(), z.any())
      .describe('Sanitized args (credentials redacted by runtime sanitizer).'),
    args_hash: z.any(),
    result_summary: z
      .record(z.string(), z.any())
      .describe('Sanitized result summary (inline-fit portion).'),
    result_hash: z.any(),
    result_storage_key: z.any().superRefine((x, ctx) => {
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
    invoked_at: z.any(),
    latency_ms: z.number().int().gte(0),
    cost_record_ref: z.any(),
    error: z.any().superRefine((x, ctx) => {
      const schemas = [
        z
          .object({
            enum_class: z
              .string()
              .describe(
                'Tool-defined error class. NOT a closed enum at the kernel layer — each tool defines its own set (bd_000-projects-84li tracks the registry pattern).',
              ),
            message: z.string(),
          })
          .strict(),
        z.null(),
      ];
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
    retry_attempt: z.number().int().gte(0).describe('0-indexed retry attempt number.'),
  })
  .strict()
  .describe(
    'Single terminal state `invoked`. Immutable at creation. Retries = new rows. HARD RULE per § 2.11: credential-shaped string in args or result_summary MUST cause runtime to reject + fail parent EvalRun with terminal_reason=credential_leak_detected (runtime concern, not enforced at this schema layer).',
  );
