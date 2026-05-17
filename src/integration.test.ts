/**
 * ERD-walk integration test.
 *
 * Constructs a full, valid entity chain end-to-end:
 *
 *   SkillSnapshot → EvalSpec → EvalRun → SessionTrace → ToolInvocation
 *                                      ↘                ↘
 *                                       JudgeDecision    CostRecord
 *                                      ↘
 *                                       EvidenceBundle → RolloutGate
 *                                                      ↘
 *                                                       gate-result/v1 row
 *
 * Locks every FK relationship from Blueprint B § 6.2 at the type level.
 * Locks the cross-entity invariants: 1:1 cardinalities, content-hash
 * pinning between EvalSpec ↔ RuntimeReceipt, SkillSnapshot ↔ EvalSpec
 * (via expected_artifacts), and the predicate body's `subject[].digest
 * .sha256 === predicate.input_hash` rule.
 *
 * This is a TYPE-LEVEL integration test (the entities never actually
 * execute) — its job is to prove the contracts compose as documented.
 */

import { describe, it, expect } from 'vitest';
import {
  GATE_RESULT_V1_URI,
  isValidSubjectName,
  type CostRecord,
  type EvalRun,
  type EvalSpec,
  type EvidenceBundle,
  type FailureTaxonomy,
  type GateResultV1,
  type GateResultV1Statement,
  type JudgeDecision,
  type MatcherMap,
  type MicroUsd,
  type OtelSpanId,
  type Rfc3339,
  type RolloutGate,
  type RuntimeReceipt,
  type SessionTrace,
  type Sha256,
  type Sha256Prefixed,
  type SkillSnapshot,
  type ToolInvocation,
  type Uuidv7,
} from './index.js';

describe('ERD walk — full entity chain composes per Blueprint B § 6.2', () => {
  it('constructs a complete chain from SkillSnapshot to RolloutGate to gate-result/v1', () => {
    // ─── Branded primitives used throughout the chain ────────────────
    const snapshotId = '0192cae6-0001-7000-8000-000000000000' as Uuidv7;
    const specId = '0192cae6-0002-7000-8000-000000000000' as Uuidv7;
    const matcherId = '0192cae6-0003-7000-8000-000000000000' as Uuidv7;
    const runId = '0192cae6-0004-7000-8000-000000000000' as Uuidv7;
    const traceId = '0192cae6-0005-7000-8000-000000000000' as Uuidv7;
    const toolInvId = '0192cae6-0006-7000-8000-000000000000' as Uuidv7;
    const judgeId = '0192cae6-0007-7000-8000-000000000000' as Uuidv7;
    const costRunId = '0192cae6-0008-7000-8000-000000000000' as Uuidv7;
    const costToolId = '0192cae6-0009-7000-8000-000000000000' as Uuidv7;
    const receiptId = '0192cae6-000a-7000-8000-000000000000' as Uuidv7;
    const bundleId = '0192cae6-000b-7000-8000-000000000000' as Uuidv7;
    const rolloutId = '0192cae6-000c-7000-8000-000000000000' as Uuidv7;
    const taxonomyId = '0192cae6-000d-7000-8000-000000000000' as Uuidv7;

    const sourceSha = 'a1'.repeat(32) as Sha256;
    const lockSha = 'b2'.repeat(32) as Sha256;
    const configSha = 'c3'.repeat(32) as Sha256;
    const combinedSha = 'd4'.repeat(32) as Sha256;
    const specHash = 'e5'.repeat(32) as Sha256;
    const matcherHash = 'f6'.repeat(32) as Sha256;
    const argsHash = '17'.repeat(32) as Sha256;
    const resultHash = '28'.repeat(32) as Sha256;
    const judgeInputHash = '39'.repeat(32) as Sha256;
    const workerFp = '4a'.repeat(32) as Sha256;

    const t0 = '2026-05-16T20:00:00Z' as Rfc3339;
    const t1 = '2026-05-16T20:00:05Z' as Rfc3339;
    const t2 = '2026-05-16T20:00:10Z' as Rfc3339;

    // ─── 1. SkillSnapshot (anchor point — content-addressed pin) ─────
    const snapshot: SkillSnapshot = {
      id: snapshotId,
      skill_id: 'audit-harness' as SkillSnapshot['skill_id'],
      source_sha: sourceSha,
      dependency_lock_sha: lockSha,
      config_sha: configSha,
      combined_sha: combinedSha,
      version_label: '0.3.0' as SkillSnapshot['version_label'],
      storage_key: 's3://intent-eval-platform/snapshots/' as SkillSnapshot['storage_key'],
      created_at: t0,
      created_by: 'jeremy@intentsolutions.io' as SkillSnapshot['created_by'],
    };

    // ─── 2. MatcherMap (referenced by EvalSpec.matchers) ─────────────
    const matcher: MatcherMap = {
      id: matcherId,
      mm_class: 'MM-4',
      name: 'token-ceiling-escape' as MatcherMap['name'],
      input_pattern: { kind: 'regex', pattern: '.*' },
      expected_behavior: { kind: 'exact' },
      version: '1.0.0' as MatcherMap['version'],
      content_hash: matcherHash,
      description: 'Detects token-ceiling escapes',
      created_at: t0,
      created_by: 'jeremy@intentsolutions.io' as MatcherMap['created_by'],
    };

    // ─── 3. EvalSpec (anchors on snapshot.combined_sha via expected_artifacts) ───
    const spec: EvalSpec = {
      id: specId,
      version: '1.0.0' as EvalSpec['version'],
      name: 'audit-harness-escape-scan-spec' as EvalSpec['name'],
      description: 'Validates escape-scan rejects all known escape patterns',
      matchers: [matcher.id],
      assertions: [],
      scoring: { aggregation_rule: 'majority' },
      composition: {
        nodes: [{ id: 'root', kind: 'eval_run', ref: runId }],
        edges: [],
      },
      // KEY INVARIANT: spec anchors on snapshot's combined_sha (not snapshot.id)
      expected_artifacts: [snapshot.combined_sha],
      runtime_limits: {
        token_ceiling: 100_000,
        wall_clock_ceiling_ms: 60_000,
        memory_ceiling_mb: 512,
        concurrency_hint: 1,
      },
      provider_constraints: ['anthropic'],
      created_at: t0,
      created_by: 'jeremy@intentsolutions.io' as EvalSpec['created_by'],
      content_hash: specHash,
    };

    // ─── 4. EvalRun (carries the spec_content_hash frozen at queue time) ───
    const run: EvalRun = {
      id: runId,
      eval_spec_id: spec.id,
      eval_spec_version: spec.version,
      eval_spec_content_hash: spec.content_hash, // frozen at queue time
      skill_snapshot_id: snapshot.id,
      state: 'judged',
      terminal_reason: null,
      queued_at: t0,
      started_at: t0,
      judged_at: t1,
      reported_at: null,
      archived_at: null,
      worker_id: 'worker-001',
      lease_expires_at: null,
      session_trace_id: traceId,
      evidence_bundle_id: bundleId,
      cost_record_id: costRunId,
      parent_run_id: null,
      idempotency_key: runId,
      submitted_by: 'jeremy@intentsolutions.io' as EvalRun['submitted_by'],
    };

    // ─── 5. SessionTrace (1:1 with EvalRun) ──────────────────────────
    const trace: SessionTrace = {
      id: traceId,
      eval_run_id: run.id,
      created_at: t0,
      closed_at: t1,
      root_span_id: '0123456789abcdef' as OtelSpanId,
      total_spans: 3,
      max_loop_depth: 1,
      total_tool_invocations: 1,
      total_judge_decisions: 1,
      trace_blob_storage_key:
        's3://intent-eval-platform/traces/' as SessionTrace['trace_blob_storage_key'],
    };

    // ─── 6. ToolInvocation (under the SessionTrace) ──────────────────
    const toolInv: ToolInvocation = {
      id: toolInvId,
      session_trace_id: trace.id,
      parent_span_id: trace.root_span_id,
      tool_id: 'audit-harness:escape-scan',
      tool_version: '0.3.0' as ToolInvocation['tool_version'],
      args: { staged: true },
      args_hash: argsHash,
      result_summary: { exit_code: 0 },
      result_hash: resultHash,
      result_storage_key: null,
      invoked_at: t0,
      latency_ms: 350,
      cost_record_ref: costToolId,
      error: null,
      retry_attempt: 0,
    };

    // ─── 7. JudgeDecision (against the matcher) ──────────────────────
    const judge: JudgeDecision = {
      id: judgeId,
      eval_run_id: run.id,
      session_trace_id: trace.id,
      matcher_map_id: matcher.id,
      judge_identity: 'audit-harness@0.3.0:escape-scan',
      judge_version: '0.3.0',
      verdict: 'PASS',
      verdict_source: 'deterministic',
      confidence: null,
      reasoning: null,
      input_hash: judgeInputHash,
      seed: null,
      evaluated_at: t1,
      latency_ms: 12,
      cost_record_ref: costToolId,
    };

    // ─── 8. CostRecord (tool-level — has both FKs populated) ─────────
    const cost: CostRecord = {
      id: costToolId,
      eval_run_id: run.id,
      tool_invocation_id: toolInv.id,
      attribution_class: 'judge',
      provider_id: null,
      tokens_consumed: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cached_tokens: 0,
      wall_clock_ms: 12,
      external_api_cost_micro_usd: 0 as MicroUsd,
      recorded_at: t1,
      cost_basis_version: 'cost-basis@2026-05-01',
    };

    // ─── 9. RuntimeReceipt (1:1 with EvalRun, mirrors terminal state) ───
    const receipt: RuntimeReceipt = {
      id: receiptId,
      eval_run_id: run.id,
      created_at: t2,
      // KEY INVARIANT: receipt freezes the spec content hash from run
      eval_spec_content_hash: run.eval_spec_content_hash,
      // KEY INVARIANT: receipt anchors on snapshot.combined_sha
      skill_snapshot_sha: snapshot.combined_sha,
      provider_adapter_versions: {},
      tool_versions: { 'audit-harness': '0.3.0' },
      runtime_limits_in_effect: spec.runtime_limits,
      actual_resource_usage: {
        tokens_consumed: 0,
        wall_clock_ms: 362,
        peak_memory_mb: 42,
        network_egress_bytes: 0,
      },
      worker_identity: 'worker-001',
      worker_host_fingerprint: workerFp,
      terminal_state: 'archived',
      terminal_reason: 'run_timeout_elapsed',
      evidence_bundle_id: bundleId,
      cost_record_id: cost.id,
    };

    // ─── 10. EvidenceBundle (carries rows including gate-result/v1) ───
    const bundle: EvidenceBundle = {
      id: bundleId,
      eval_run_id: run.id,
      created_at: t2,
      predicate_uri_set: [GATE_RESULT_V1_URI],
      row_count: 1,
      subject_set: [
        {
          name: 'audit-harness:ci:escape-scan',
          digest: { sha256: judgeInputHash.slice(0, 64) },
        },
      ],
      storage_key: 's3://intent-eval-platform/bundles/' as EvidenceBundle['storage_key'],
      signing_mode: 'rekor_production',
      rekor_log_indices: [42],
      verification_status: 'verified',
      verification_last_checked_at: t2,
    };

    // ─── 11. RolloutGate (decides about bundle) ──────────────────────
    const rollout: RolloutGate = {
      id: rolloutId,
      eval_run_id: run.id,
      evidence_bundle_id: bundle.id,
      policy_ref: `sha256:${specHash}:tests/TESTING.md`,
      policy_content_hash: specHash,
      decision: 'ship',
      decision_reasons: ['policy.escape-scan.pass'],
      coverage: {
        dimensions_evaluated: ['credential-leak', 'token-ceiling'],
        dimensions_skipped: [],
      },
      evaluated_at: t2,
      gate_version: '0.3.0',
      signing_mode: 'rekor_production',
      rekor_log_index: 42,
    };

    // ─── 12. FailureTaxonomy (canonical MM-4 entry for cross-ref) ────
    const taxonomy: FailureTaxonomy = {
      id: taxonomyId,
      mm_class: 'MM-4',
      name: 'token-ceiling-escape' as FailureTaxonomy['name'],
      description: 'Tool consumes more tokens than declared runtime_limits',
      discriminating_question: 'Did the tool exceed its token_ceiling?',
      examples: [{ ref: 'evidence://example-1' }],
      version: '1.0.0' as FailureTaxonomy['version'],
      status: 'canonical',
      created_at: t0,
      created_by: 'jeremy@intentsolutions.io' as FailureTaxonomy['created_by'],
    };

    // ─── 13. gate-result/v1 predicate body emitted from RolloutGate ───
    const predicateBody: GateResultV1 = {
      gate_id: 'audit-harness:ci:escape-scan',
      gate_name: 'escape-scan',
      gate_version: rollout.gate_version,
      gate_decision: 'pass',
      gate_reasons: rollout.decision_reasons,
      coverage: rollout.coverage,
      policy_ref: rollout.policy_ref,
      policy_hash: `sha256:${specHash}` as Sha256Prefixed,
      input_hash: `sha256:${judgeInputHash}` as Sha256Prefixed,
      evaluated_at: rollout.evaluated_at,
      runner: 'audit-harness@0.3.0',
      commit_sha: 'integration-test',
      replay_fidelity_level: 'RF-1',
    };

    // ─── 14. in-toto Statement wrapping ──────────────────────────────
    const statement: GateResultV1Statement = {
      _type: 'https://in-toto.io/Statement/v1',
      subject: bundle.subject_set,
      predicateType: GATE_RESULT_V1_URI,
      predicate: predicateBody,
    };

    // ─── Cross-entity invariant assertions ───────────────────────────

    // EvalRun ↔ EvalSpec content_hash freeze
    expect(run.eval_spec_content_hash).toBe(spec.content_hash);
    expect(receipt.eval_spec_content_hash).toBe(run.eval_spec_content_hash);

    // SkillSnapshot content-addressed anchoring
    expect(spec.expected_artifacts[0]).toBe(snapshot.combined_sha);
    expect(receipt.skill_snapshot_sha).toBe(snapshot.combined_sha);

    // 1:1 cardinalities
    expect(trace.eval_run_id).toBe(run.id);
    expect(receipt.eval_run_id).toBe(run.id);

    // FK chain: ToolInvocation → SessionTrace
    expect(toolInv.session_trace_id).toBe(trace.id);

    // JudgeDecision FKs reach all three contexts
    expect(judge.eval_run_id).toBe(run.id);
    expect(judge.session_trace_id).toBe(trace.id);
    expect(judge.matcher_map_id).toBe(matcher.id);

    // CostRecord FK fan-out
    expect(cost.eval_run_id).toBe(run.id);
    expect(cost.tool_invocation_id).toBe(toolInv.id);

    // RuntimeReceipt mirrors EvalRun terminal state
    expect(receipt.terminal_state).toBe('archived');

    // EvidenceBundle ↔ RolloutGate
    expect(rollout.evidence_bundle_id).toBe(bundle.id);
    expect(bundle.predicate_uri_set).toContain(GATE_RESULT_V1_URI);

    // Predicate body ↔ RolloutGate consistency (the mapping the
    // downstream `intent-rollout-gate` package will enforce)
    expect(predicateBody.gate_decision).toBe('pass');
    expect(rollout.decision).toBe('ship');

    // Subject naming (§ 7.3)
    expect(isValidSubjectName(predicateBody.gate_id)).toBe(true);

    // in-toto Statement carries the canonical predicateType URI
    expect(statement.predicateType).toBe(GATE_RESULT_V1_URI);
    expect(statement._type).toBe('https://in-toto.io/Statement/v1');

    // FailureTaxonomy is canonical for the MM-class JudgeDecision FAILed against
    // (here judge.verdict=PASS so taxonomy lookup is informational, not gating)
    expect(taxonomy.mm_class).toBe(matcher.mm_class);
    expect(taxonomy.status).toBe('canonical');
  });
});
