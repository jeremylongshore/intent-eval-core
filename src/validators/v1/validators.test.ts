/**
 * Zod validator tests — positive + negative fixtures.
 *
 * Validates the same golden fixtures used by the ajv-based schema tests
 * (src/__tests__/schemas.test.ts) to prove:
 *   - Hand-authored Zod validators agree with JSON Schema validators on
 *     EVERY positive fixture
 *   - Zod rejects the same negative fixtures the schemas reject
 *   - Branded primitives are applied (Sha256, Uuidv7, etc. parsing)
 *   - The conditional `advisory_severity` rule fires
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CostRecordSchema,
  EvalRunSchema,
  EvalSpecSchema,
  EvidenceBundleSchema,
  FailureTaxonomySchema,
  GateResultV1Schema,
  JudgeDecisionSchema,
  MatcherMapSchema,
  RegressionPackSchema,
  RolloutGateSchema,
  RuntimeReceiptSchema,
  SessionTraceSchema,
  SkillSnapshotSchema,
  ToolInvocationSchema,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures/v1');

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8')) as unknown;
}

describe('Zod validators — positive fixtures parse cleanly', () => {
  it('EvalSpec', () => {
    expect(() => EvalSpecSchema.parse(loadJson('eval-spec.valid.json'))).not.toThrow();
  });
  it('EvalRun', () => {
    expect(() => EvalRunSchema.parse(loadJson('eval-run.valid.json'))).not.toThrow();
  });
  it('MatcherMap', () => {
    expect(() => MatcherMapSchema.parse(loadJson('matcher-map.valid.json'))).not.toThrow();
  });
  it('EvidenceBundle', () => {
    expect(() => EvidenceBundleSchema.parse(loadJson('evidence-bundle.valid.json'))).not.toThrow();
  });
  it('JudgeDecision', () => {
    expect(() => JudgeDecisionSchema.parse(loadJson('judge-decision.valid.json'))).not.toThrow();
  });
  it('RuntimeReceipt', () => {
    expect(() => RuntimeReceiptSchema.parse(loadJson('runtime-receipt.valid.json'))).not.toThrow();
  });
  it('RegressionPack', () => {
    expect(() => RegressionPackSchema.parse(loadJson('regression-pack.valid.json'))).not.toThrow();
  });
  it('RolloutGate', () => {
    expect(() => RolloutGateSchema.parse(loadJson('rollout-gate.valid.json'))).not.toThrow();
  });
  it('SkillSnapshot', () => {
    expect(() => SkillSnapshotSchema.parse(loadJson('skill-snapshot.valid.json'))).not.toThrow();
  });
  it('SessionTrace', () => {
    expect(() => SessionTraceSchema.parse(loadJson('session-trace.valid.json'))).not.toThrow();
  });
  it('ToolInvocation', () => {
    expect(() => ToolInvocationSchema.parse(loadJson('tool-invocation.valid.json'))).not.toThrow();
  });
  it('CostRecord', () => {
    expect(() => CostRecordSchema.parse(loadJson('cost-record.valid.json'))).not.toThrow();
  });
  it('FailureTaxonomy', () => {
    expect(() =>
      FailureTaxonomySchema.parse(loadJson('failure-taxonomy.valid.json')),
    ).not.toThrow();
  });
  it('gate-result/v1 (minimal required-only)', () => {
    expect(() => GateResultV1Schema.parse(loadJson('gate-result.valid.json'))).not.toThrow();
  });
  it('gate-result/v1 (advisory + full optional fields)', () => {
    expect(() =>
      GateResultV1Schema.parse(loadJson('gate-result.advisory.valid.json')),
    ).not.toThrow();
  });
});

describe('Zod validators — negative fixtures REJECT', () => {
  it('gate-result missing gate_name → REJECT', () => {
    const result = GateResultV1Schema.safeParse(
      loadJson('gate-result.invalid-missing-gate_name.json'),
    );
    expect(result.success).toBe(false);
  });

  it('gate-result with gate_decision=ship → REJECT (ship is RolloutGate, not gate-result)', () => {
    const result = GateResultV1Schema.safeParse(loadJson('gate-result.invalid-bad-decision.json'));
    expect(result.success).toBe(false);
  });

  it('gate-result with md5 hash prefix → REJECT (only sha256: accepted)', () => {
    const result = GateResultV1Schema.safeParse(
      loadJson('gate-result.invalid-bad-hash-format.json'),
    );
    expect(result.success).toBe(false);
  });

  it('eval-spec with aggregation_rule=plurality → REJECT (not in closed enum)', () => {
    const result = EvalSpecSchema.safeParse(loadJson('eval-spec.invalid-bad-aggregation.json'));
    expect(result.success).toBe(false);
  });
});

describe('Zod validators — branded primitive parsing', () => {
  it('Uuidv7 brand applied to parsed EvalSpec.id', () => {
    const parsed = EvalSpecSchema.parse(loadJson('eval-spec.valid.json'));
    // The brand is compile-time-only — at runtime it's a plain string.
    // Just confirm the value passed through unchanged.
    expect(typeof parsed.id).toBe('string');
    expect(parsed.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}/);
  });

  it('Sha256Prefixed brand applied to parsed gate-result.policy_hash', () => {
    const parsed = GateResultV1Schema.parse(loadJson('gate-result.valid.json'));
    expect(parsed.policy_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('SubjectName brand applied to parsed gate-result.gate_id', () => {
    const parsed = GateResultV1Schema.parse(loadJson('gate-result.valid.json'));
    expect(parsed.gate_id).toMatch(/:(client|server|ci|sandbox|local):/);
  });

  it('MicroUsd brand applied to parsed CostRecord.external_api_cost_micro_usd', () => {
    const parsed = CostRecordSchema.parse(loadJson('cost-record.valid.json'));
    expect(typeof parsed.external_api_cost_micro_usd).toBe('number');
    expect(parsed.external_api_cost_micro_usd).toBeGreaterThanOrEqual(0);
  });
});

describe('Zod validators — conditional advisory_severity rule (Blueprint B § 7.4)', () => {
  const baseValid = {
    gate_id: 'audit-harness:ci:bias-count',
    gate_name: 'bias-count',
    gate_version: '0.3.0',
    gate_decision: 'advisory',
    gate_reasons: ['bias.detected'],
    coverage: { dimensions_evaluated: ['lexical'], dimensions_skipped: [] },
    policy_ref: 'sha256:' + 'a'.repeat(64) + ':tests/TESTING.md',
    policy_hash: 'sha256:' + 'a'.repeat(64),
    input_hash: 'sha256:' + 'b'.repeat(64),
    evaluated_at: '2026-05-17T00:00:00Z',
    runner: 'audit-harness@0.3.0',
    commit_sha: 'abc1234',
  };

  it('gate_decision=advisory + advisory_severity present → ACCEPT', () => {
    const result = GateResultV1Schema.safeParse({ ...baseValid, advisory_severity: 'warn' });
    expect(result.success).toBe(true);
  });

  it('gate_decision=advisory WITHOUT advisory_severity → REJECT (Blueprint B § 7.4 if/then)', () => {
    const result = GateResultV1Schema.safeParse(baseValid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorPaths = result.error.issues.map((i) => i.path.join('.'));
      expect(errorPaths).toContain('advisory_severity');
    }
  });

  it('gate_decision=pass WITHOUT advisory_severity → ACCEPT (rule fires only on advisory)', () => {
    const result = GateResultV1Schema.safeParse({
      ...baseValid,
      gate_decision: 'pass',
      gate_reasons: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('Zod validators — UPPERCASE/lowercase verdict-enum distinctness', () => {
  it('JudgeDecision REJECTS lowercase pass (UPPERCASE only)', () => {
    const judge = loadJson('judge-decision.valid.json') as Record<string, unknown>;
    const result = JudgeDecisionSchema.safeParse({ ...judge, verdict: 'pass' });
    expect(result.success).toBe(false);
  });

  it('gate-result REJECTS UPPERCASE PASS (lowercase only)', () => {
    const gate = loadJson('gate-result.valid.json') as Record<string, unknown>;
    const result = GateResultV1Schema.safeParse({ ...gate, gate_decision: 'PASS' });
    expect(result.success).toBe(false);
  });

  it('RolloutGate REJECTS pass (uses ship/no_ship)', () => {
    const rollout = loadJson('rollout-gate.valid.json') as Record<string, unknown>;
    const result = RolloutGateSchema.safeParse({ ...rollout, decision: 'pass' });
    expect(result.success).toBe(false);
  });

  it('FailureTaxonomy accepts MM-7 (broader than MatcherMap.mm_class enum)', () => {
    const fix = loadJson('failure-taxonomy.valid.json') as Record<string, unknown>;
    const result = FailureTaxonomySchema.safeParse({
      ...fix,
      mm_class: 'MM-7',
      status: 'proposed',
    });
    expect(result.success).toBe(true);
  });

  it('MatcherMap REJECTS MM-7 (kernel enum lags FailureTaxonomy)', () => {
    const fix = loadJson('matcher-map.valid.json') as Record<string, unknown>;
    const result = MatcherMapSchema.safeParse({ ...fix, mm_class: 'MM-7' });
    expect(result.success).toBe(false);
  });
});
