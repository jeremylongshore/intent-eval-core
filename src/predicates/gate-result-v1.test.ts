import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  GATE_RESULT_V1_URI,
  PREDICATE_URIS,
  SUBJECT_NAME_REGEX,
  isValidSubjectName,
  type AdvisorySeverity,
  type Coverage,
  type DsseEnvelope,
  type GateDecision,
  type GateResultV1,
  type GateResultV1Statement,
  type KnownPredicateUri,
  type ReplayFidelityLevel,
  type SubjectSide,
} from './gate-result-v1.js';

describe('gate-result/v1 — closed enums (Blueprint B § 7.4)', () => {
  it('GateDecision is the closed 4-element enum', () => {
    expectTypeOf<GateDecision>().toEqualTypeOf<'pass' | 'fail' | 'advisory' | 'error'>();
  });

  it('AdvisorySeverity is info|warn|error', () => {
    expectTypeOf<AdvisorySeverity>().toEqualTypeOf<'info' | 'warn' | 'error'>();
  });

  it('ReplayFidelityLevel is RF-0..RF-4', () => {
    expectTypeOf<ReplayFidelityLevel>().toEqualTypeOf<
      'RF-0' | 'RF-1' | 'RF-2' | 'RF-3' | 'RF-4'
    >();
  });

  it('SubjectSide is the closed 5-element § 7.3 enum', () => {
    expectTypeOf<SubjectSide>().toEqualTypeOf<
      'client' | 'server' | 'ci' | 'sandbox' | 'local'
    >();
  });
});

describe('gate-result/v1 — subject naming (Blueprint B § 7.3 line 779)', () => {
  it('accepts the 3-segment <tool>:<side>:<gate-id> pattern', () => {
    expect(isValidSubjectName('audit-harness:ci:escape-scan')).toBe(true);
    expect(isValidSubjectName('j-rig:server:rollout-gate')).toBe(true);
    expect(isValidSubjectName('intent-rollout-gate:client:Decision.v2')).toBe(true);
    expect(isValidSubjectName('a:local:b')).toBe(true);
  });

  it('rejects subjects missing segments or with invalid side enum', () => {
    expect(isValidSubjectName('audit-harness:escape-scan')).toBe(false); // only 2 segments
    expect(isValidSubjectName('audit-harness:invalid-side:gate')).toBe(false);
    expect(isValidSubjectName('audit-harness:ci:')).toBe(false); // empty gate-id
    expect(isValidSubjectName(':ci:gate')).toBe(false); // empty tool
    expect(isValidSubjectName('Audit-Harness:ci:gate')).toBe(false); // uppercase in tool
    expect(isValidSubjectName('-leading:ci:gate')).toBe(false); // leading hyphen in tool
  });

  it('SUBJECT_NAME_REGEX is exported and reusable', () => {
    expect(SUBJECT_NAME_REGEX.test('audit-harness:ci:escape-scan')).toBe(true);
  });
});

describe('gate-result/v1 — predicate URI constants', () => {
  it('GATE_RESULT_V1_URI is canonical and routes through evals.intentsolutions.io', () => {
    expect(GATE_RESULT_V1_URI).toBe('https://evals.intentsolutions.io/gate-result/v1');
    // ISEDC CISO binding: predicate URIs MUST NOT live on labs.intentsolutions.io
    expect(GATE_RESULT_V1_URI).not.toContain('labs.intentsolutions.io');
  });

  it('PREDICATE_URIS exposes all v1 predicate URIs as constants', () => {
    expect(PREDICATE_URIS.GATE_RESULT_V1).toBe(GATE_RESULT_V1_URI);
    for (const uri of Object.values(PREDICATE_URIS)) {
      expect(uri).toContain('evals.intentsolutions.io');
    }
  });

  it('KnownPredicateUri is the literal union of all known URIs', () => {
    const uri: KnownPredicateUri = PREDICATE_URIS.EVAL_VERDICT_V1;
    expect(typeof uri).toBe('string');
  });
});

describe('gate-result/v1 — predicate body shape (Blueprint B § 7.4)', () => {
  it('accepts a minimal valid required-only payload', () => {
    const body: GateResultV1 = {
      gate_id: 'audit-harness:ci:escape-scan',
      gate_name: 'escape-scan',
      gate_version: '0.3.0',
      gate_decision: 'pass',
      gate_reasons: [],
      coverage: { dimensions_evaluated: ['credential-leak'], dimensions_skipped: [] },
      policy_ref: 'sha256:abc:tests/TESTING.md',
      // Real callers will brand these via the validator layer; tests use casts.
      policy_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' as GateResultV1['policy_hash'],
      input_hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111' as GateResultV1['input_hash'],
      evaluated_at: '2026-05-16T17:00:00Z' as GateResultV1['evaluated_at'],
      runner: 'audit-harness@0.3.0',
      commit_sha: '6eebe2f',
    };
    expect(body.gate_decision).toBe('pass');
  });

  it('accepts full optional fields including advisory_severity + replay_fidelity_level', () => {
    const body: GateResultV1 = {
      gate_id: 'audit-harness:ci:bias-count',
      gate_name: 'bias-count',
      gate_version: '0.3.0',
      gate_decision: 'advisory',
      gate_reasons: ['bias.count.over.threshold'],
      coverage: { dimensions_evaluated: ['lexical-bias'], dimensions_skipped: ['semantic-bias'] },
      policy_ref: 'sha256:def:tests/TESTING.md',
      policy_hash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222' as GateResultV1['policy_hash'],
      input_hash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333' as GateResultV1['input_hash'],
      evaluated_at: '2026-05-16T17:01:00Z' as GateResultV1['evaluated_at'],
      runner: 'audit-harness@0.3.0',
      commit_sha: '6eebe2f',
      advisory_severity: 'warn',
      replay_fidelity_level: 'RF-1',
      metadata: { tool_specific_extension: { foo: 'bar' } },
    };
    expect(body.advisory_severity).toBe('warn');
    expect(body.replay_fidelity_level).toBe('RF-1');
  });

  it('Coverage carries both dimensions arrays as readonly string arrays', () => {
    expectTypeOf<Coverage>()
      .toHaveProperty('dimensions_evaluated')
      .toEqualTypeOf<readonly string[]>();
    expectTypeOf<Coverage>()
      .toHaveProperty('dimensions_skipped')
      .toEqualTypeOf<readonly string[]>();
  });

  it('NOT_APPLICABLE encoding is gate_decision=pass + populated dimensions_skipped', () => {
    // Per § 7.4 line 832: MUST NOT use gate_decision='fail' for N/A.
    const body: GateResultV1 = {
      gate_id: 'audit-harness:ci:applies-only-to-typescript',
      gate_name: 'applies-only-to-typescript',
      gate_version: '0.3.0',
      gate_decision: 'pass',
      gate_reasons: ['repo.language.not.typescript: skip'],
      coverage: {
        dimensions_evaluated: [],
        dimensions_skipped: ['typescript-only-gate'],
      },
      policy_ref: 'sha256:abc:tests/TESTING.md',
      policy_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' as GateResultV1['policy_hash'],
      input_hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111' as GateResultV1['input_hash'],
      evaluated_at: '2026-05-16T17:02:00Z' as GateResultV1['evaluated_at'],
      runner: 'audit-harness@0.3.0',
      commit_sha: '6eebe2f',
    };
    expect(body.gate_decision).toBe('pass');
    expect(body.coverage.dimensions_skipped).toContain('typescript-only-gate');
  });
});

describe('gate-result/v1 — in-toto + DSSE wrapping (Blueprint B § 7)', () => {
  it('Statement carries _type, subject, predicateType, predicate', () => {
    expectTypeOf<GateResultV1Statement>()
      .toHaveProperty('_type')
      .toEqualTypeOf<'https://in-toto.io/Statement/v1'>();
    expectTypeOf<GateResultV1Statement>()
      .toHaveProperty('predicateType')
      .toEqualTypeOf<typeof GATE_RESULT_V1_URI>();
  });

  it('DSSE envelope carries the in-toto payloadType', () => {
    expectTypeOf<DsseEnvelope>()
      .toHaveProperty('payloadType')
      .toEqualTypeOf<'application/vnd.in-toto+json'>();
  });
});
