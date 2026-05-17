import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_spec_id: z.any(),
    eval_spec_version: z
      .any()
      .describe('Frozen at queue time — defends against mid-flight spec mutation.'),
    eval_spec_content_hash: z.any().describe('Frozen at queue time.'),
    skill_snapshot_id: z.any(),
    state: z
      .enum([
        'queued',
        'running',
        'judged',
        'reported',
        'archived',
        'skipped_due_to_gate',
        'archived_failed',
      ])
      .describe(
        'EvalRun state enum (Blueprint B § 2.2 + § 3.1). Terminal states: archived, skipped_due_to_gate, archived_failed.',
      ),
    terminal_reason: z.any().superRefine((x, ctx) => {
      const schemas = [
        z
          .enum([
            'queued_timeout_elapsed',
            'run_timeout_elapsed',
            'worker_crash_exhausted',
            'credential_leak_detected',
            'judge_unavailable_exhausted',
            'token_ceiling_exceeded',
            'evidence_contract_violation',
            'upstream_feed_failed',
          ])
          .describe(
            'Why this Run terminated. Set per Blueprint B § 3.1 enumeration + § 1.3 (upstream_feed_failed).',
          ),
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
    queued_at: z.any(),
    started_at: z.any().superRefine((x, ctx) => {
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
    judged_at: z.any().superRefine((x, ctx) => {
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
    reported_at: z.any().superRefine((x, ctx) => {
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
    archived_at: z.any().superRefine((x, ctx) => {
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
    worker_id: z.any().superRefine((x, ctx) => {
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
    lease_expires_at: z.any().superRefine((x, ctx) => {
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
    session_trace_id: z.any().describe('FK → SessionTrace.id. Populated as Run executes.'),
    evidence_bundle_id: z
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
      .describe('FK → EvidenceBundle.id. Populated at judged → reported.'),
    cost_record_id: z.any().describe('FK → CostRecord.id. Populated continuously.'),
    parent_run_id: z
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
      .describe('Multi-step DAG child link.'),
    idempotency_key: z.any().describe('Defaults to `id` if not explicitly provided.'),
    submitted_by: z.any(),
  })
  .strict()
  .describe(
    'State machine spans 7 states with explicit transition table at Blueprint B § 3.1. Mutable in non-terminal states; frozen at terminal. Clock-skew tolerance ±10 ms across workers.',
  );
