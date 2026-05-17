import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z.any(),
    created_at: z.any(),
    eval_spec_content_hash: z.any(),
    skill_snapshot_sha: z.any(),
    provider_adapter_versions: z
      .record(z.string(), z.string())
      .describe('Per-provider adapter version mapping. Key: provider id, Value: SemVer.'),
    tool_versions: z
      .record(z.string(), z.string())
      .describe('Per-tool version mapping. Key: tool id, Value: SemVer.'),
    runtime_limits_in_effect: z
      .object({
        token_ceiling: z.number().int().gte(0),
        wall_clock_ceiling_ms: z.number().int().gte(0),
        memory_ceiling_mb: z.number().int().gte(0),
        concurrency_hint: z.number().int().gte(0),
      })
      .strict()
      .describe('Copy of EvalSpec.runtime_limits frozen at queue time.'),
    actual_resource_usage: z
      .object({
        tokens_consumed: z.number().int().gte(0),
        wall_clock_ms: z.number().int().gte(0),
        peak_memory_mb: z.number().int().gte(0),
        network_egress_bytes: z.number().int().gte(0),
      })
      .strict()
      .describe(
        'Measured resource consumption per Blueprint B § 2.6 — fully spec-bound 4-field shape.',
      ),
    worker_identity: z.string().min(1),
    worker_host_fingerprint: z.any(),
    terminal_state: z
      .enum(['archived', 'skipped_due_to_gate', 'archived_failed'])
      .describe("Mirrors EvalRun.state's terminal value."),
    terminal_reason: z.enum([
      'queued_timeout_elapsed',
      'run_timeout_elapsed',
      'worker_crash_exhausted',
      'credential_leak_detected',
      'judge_unavailable_exhausted',
      'token_ceiling_exceeded',
      'evidence_contract_violation',
      'upstream_feed_failed',
    ]),
    evidence_bundle_id: z.any(),
    cost_record_id: z.any(),
  })
  .strict()
  .describe(
    'Single terminal state `issued`. Immutable at creation (signed before persistence). 1:1 cardinality with EvalRun. Predicate URI when emitted: runtime-receipt/v1 (currently sigstore_staging).',
  );
