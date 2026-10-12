import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    version: z.any(),
    name: z.any(),
    description: z.string().min(1),
    matchers: z.array(z.any()).describe('MatcherMap FKs.'),
    assertions: z
      .array(
        z.record(z.string(), z.any()).and(
          z.any().superRefine((x, ctx) => {
            const schemas = [
              z
                .object({
                  class: z
                    .enum([
                      'output-equals',
                      'output-contains',
                      'output-matches',
                      'schema-conforms',
                      'judge-verdict',
                      'matcher-satisfied',
                    ])
                    .optional(),
                  target: z.any().optional(),
                  negate: z.boolean().optional(),
                })
                .strict(),
              z
                .object({
                  class: z.string(),
                  target: z.any(),
                  negate: z.boolean().optional(),
                  extension: z.literal(true),
                })
                .strict(),
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
        ),
      )
      .describe(
        'Typed assertion expressions. Class union LOCKED additively per deferral-A (bd_000-projects-gzgj): a named-class discriminated union plus an open extension slot. Per-class `target` payload stays open (refined at the validator layer per engagement).',
      ),
    scoring: z
      .object({
        aggregation_rule: z.enum(['majority', 'unanimous', 'weighted']),
        weight_dimension: z
          .enum(['matcher', 'mm-class', 'judge'])
          .describe(
            'Dimension the weighted rule distributes over (deferral-C, bd_000-projects-21re). Required when `weights` present; ignored otherwise.',
          )
          .optional(),
        weights: z
          .array(z.object({ key: z.string(), weight: z.number().gte(0) }).strict())
          .describe(
            'Per-unit weights for the weighted rule (deferral-C). Normalized by their sum at scoring time.',
          )
          .optional(),
        tiebreaker: z
          .enum(['fail-closed', 'fail-open', 'first-listed'])
          .describe(
            'Deterministic resolution of an exact aggregate tie (deferral-C). NOT a threshold — it resolves a tie, it does not set a pass bar.',
          )
          .optional(),
        extensions: z
          .record(z.string(), z.any())
          .describe(
            'Tool-specific scoring metadata. MUST NOT drive ship/no-ship decisions (mirrors § 7.4 metadata rule).',
          )
          .optional(),
      })
      .describe(
        'Scoring configuration. aggregation_rule is the spec-bound field per Blueprint B § 2.1. weight_dimension/weights/tiebreaker are the deferral-C lockup (bd_000-projects-21re), additive + optional. § 7.6 architectural rule: ship/no-ship THRESHOLDS belong in consumer-side tests/TESTING.md, NOT here — only weights + exact-tie resolution are kernel-side.',
      ),
    composition: z
      .object({
        nodes: z.array(
          z
            .object({
              id: z.string().describe('Local-to-DAG node identifier (unique within composition).'),
              kind: z
                .enum(['eval_run', 'tool_invocation'])
                .describe('Node type per Blueprint B § 1.3 line 92.'),
              ref: z.any(),
            })
            .strict(),
        ),
        edges: z.array(
          z
            .object({
              from: z.string(),
              to: z.string(),
              kind: z
                .enum(['feeds', 'gates', 'enriches'])
                .describe(
                  'Edge type — drives runtime failure-propagation per Blueprint B § 1.3 line 100.',
                ),
            })
            .strict(),
        ),
      })
      .strict()
      .describe(
        "DAG declaration per Blueprint B § 1.3. Validation contract: runtime topologically sorts; cycles rejected at submission with 400. Wire format (adjacency list with typed edges) is engineer's choice per bd_000-projects-3sjx; semantics ARE spec-bound (node types + edge kinds + failure propagation per § 1.3 line 100).",
      ),
    expected_artifacts: z
      .array(z.any())
      .describe(
        'SkillSnapshot.combined_sha values this spec targets. Anchors on CONTENT (sha), not FK — rebuilt snapshots with the same combined_sha still satisfy.',
      ),
    runtime_limits: z
      .object({
        token_ceiling: z.number().int().gte(0),
        wall_clock_ceiling_ms: z.number().int().gte(0),
        memory_ceiling_mb: z.number().int().gte(0),
        concurrency_hint: z.number().int().gte(0),
      })
      .strict()
      .describe('Resource ceilings applied per EvalRun per Blueprint B § 2.1.'),
    provider_constraints: z.array(z.string()).describe('Allowlist of provider IDs.'),
    created_at: z.any(),
    created_by: z.any(),
    content_hash: z.any(),
    tenant_id: z
      .any()
      .describe(
        'RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj). OPTIONAL + additive per § 7.2; tenant-isolation semantics deferred to a future DR. v1 single-tenant specs omit it.',
      )
      .optional(),
  })
  .strict()
  .describe(
    'Content-addressed via content_hash. State machine: draft → published → deprecated (deprecated reversible to published). Mutable in draft; immutable once published.',
  );
