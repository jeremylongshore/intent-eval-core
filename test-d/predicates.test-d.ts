/**
 * tsd negative tests — gate-result/v1 predicate body invariants.
 */

import { expectAssignable, expectError } from 'tsd';
import type {
  AdvisorySeverity,
  GateDecision,
  GateResultV1,
  ReplayFidelityLevel,
  SubjectSide,
} from '../dist/index.js';

// ─── GateDecision (§ 7.4 line 800) ─────────────────────────────────────
expectAssignable<GateDecision>('pass');
expectAssignable<GateDecision>('error');
expectError<GateDecision>('ship'); // RolloutGate language, not gate-result
expectError<GateDecision>('PASS'); // uppercase belongs to JudgeVerdict

// ─── AdvisorySeverity (§ 7.4 line 820) ─────────────────────────────────
expectAssignable<AdvisorySeverity>('warn');
expectError<AdvisorySeverity>('critical');
expectError<AdvisorySeverity>('low');

// ─── ReplayFidelityLevel (§ 7.4 line 823) ──────────────────────────────
expectAssignable<ReplayFidelityLevel>('RF-0');
expectAssignable<ReplayFidelityLevel>('RF-4');
expectError<ReplayFidelityLevel>('RF-5'); // closed set per iel-E11
expectError<ReplayFidelityLevel>('rf-0');

// ─── SubjectSide (§ 7.3 line 779) ──────────────────────────────────────
expectAssignable<SubjectSide>('ci');
expectAssignable<SubjectSide>('local');
expectError<SubjectSide>('production'); // closed 5-element enum
expectError<SubjectSide>('CI');

// ─── GateResultV1 required-field discipline ────────────────────────────

// Minimal body — all required fields present
const minimal: GateResultV1 = {
  gate_id: 'audit-harness:ci:escape-scan',
  gate_name: 'escape-scan',
  gate_version: '0.3.0',
  gate_decision: 'pass',
  gate_reasons: [],
  coverage: { dimensions_evaluated: ['x'], dimensions_skipped: [] },
  policy_ref: 'sha256:abc:tests/TESTING.md',
  policy_hash: 'sha256:0'.repeat(8) as GateResultV1['policy_hash'],
  input_hash: 'sha256:0'.repeat(8) as GateResultV1['input_hash'],
  evaluated_at: '2026-05-16T20:00:00Z' as GateResultV1['evaluated_at'],
  runner: 'audit-harness@0.3.0',
  commit_sha: 'abc',
};
expectAssignable<GateResultV1>(minimal);

// Missing a required field → error
expectError<GateResultV1>({
  gate_name: 'escape-scan',
  gate_version: '0.3.0',
  gate_decision: 'pass',
  // gate_id missing — required field
});

// Wrong gate_decision value → error
expectError<GateResultV1>({
  ...minimal,
  gate_decision: 'ship', // wrong enum
});

// Coverage shape: both arrays required
expectError<GateResultV1>({
  ...minimal,
  coverage: { dimensions_evaluated: ['x'] }, // dimensions_skipped missing
});

// Optional fields acceptable
expectAssignable<GateResultV1>({
  ...minimal,
  advisory_severity: 'warn',
  replay_fidelity_level: 'RF-1',
  metadata: { tool_specific: { foo: 'bar' } },
});

// advisory_severity with wrong value → error
expectError<GateResultV1>({
  ...minimal,
  advisory_severity: 'critical',
});

// replay_fidelity_level with wrong value → error
expectError<GateResultV1>({
  ...minimal,
  replay_fidelity_level: 'RF-5',
});
