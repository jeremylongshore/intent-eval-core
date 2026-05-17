import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    version: z.any(),
    name: z.any(),
    description: z.string().min(1),
    matchers: z.array(z.any()).describe('MatcherMap FKs.'),
    assertions: z
      .array(z.any())
      .describe(
        "Typed assertion expressions. Blueprint B § 2.1 says only 'typed expression' — no class enum, no payload grammar. Element shape deferred per spec STOP directive (bd_000-projects-gzgj, Class-2 ISEDC required to enumerate).",
      ),
    scoring: z
      .object({
        aggregation_rule: z.enum(['majority', 'unanimous', 'weighted']),
        extensions: z
          .record(z.string(), z.any())
          .describe(
            'Tool-specific scoring metadata. MUST NOT drive ship/no-ship decisions (mirrors § 7.4 metadata rule).',
          )
          .optional(),
      })
      .describe(
        'Scoring configuration. aggregation_rule is the ONLY spec-bound field per Blueprint B § 2.1. § 7.6 architectural rule: thresholds belong in consumer-side tests/TESTING.md, NOT here. Additions require ISEDC review (bd_000-projects-21re).',
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
  })
  .strict()
  .describe(
    'Content-addressed via content_hash. State machine: draft → published → deprecated (deprecated reversible to published). Mutable in draft; immutable once published.',
  );
