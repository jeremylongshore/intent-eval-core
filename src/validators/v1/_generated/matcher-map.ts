import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    mm_class: z.any(),
    name: z.any(),
    input_pattern: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [
          z
            .object({ kind: z.literal('regex'), pattern: z.string(), flags: z.string().optional() })
            .strict(),
          z
            .object({ kind: z.literal('json-schema'), schema: z.record(z.string(), z.any()) })
            .strict(),
          z
            .object({
              kind: z.literal('structural'),
              matcher: z
                .any()
                .describe(
                  'Wholly undefined in Blueprint B § 2.3. Lock when a downstream engagement specifies (bd_000-projects-ra9a).',
                ),
            })
            .catchall(z.any()),
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
      })
      .describe(
        'Typed input pattern — closed 3-variant discriminated union per Blueprint B § 2.3 line 159.',
      ),
    expected_behavior: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [
          z.object({
            kind: z.enum(['exact', 'semantic', 'contract-conformance', 'redaction-confirmed']),
            payload: z.any().optional(),
          }),
          z
            .object({ kind: z.string(), payload: z.any(), extension: z.literal(true) })
            .catchall(z.any()),
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
      })
      .describe(
        "Typed expected behavior. v1 named variants + open extension slot per spec's explicit 'etc.' trailer.",
      ),
    version: z.any(),
    content_hash: z.any(),
    description: z.string().min(1),
    created_at: z.any(),
    created_by: z.any(),
  })
  .strict()
  .describe(
    'State machine: draft → published → deprecated (one-way). Immutable once published; revisions = new row + incremented version.',
  );
