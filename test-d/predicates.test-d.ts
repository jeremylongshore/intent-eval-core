/**
 * tsd negative tests — gate-result/v1 predicate body invariants.
 */

import { expectAssignable, expectError } from 'tsd';
import type {
  AdvisorySeverity,
  DashboardRenderV1,
  GateDecision,
  GateResultV1,
  ReplayFidelityLevel,
  RetractionReasonClass,
  RetractionV1,
  Sha256Prefixed,
  SubjectSide,
  Uuidv7,
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

// ─── retraction/v1 (v0.2.0 additive, B4 binding) ───────────────────────

// reason_class is the closed 6-element set
expectAssignable<RetractionReasonClass>('partner-request');
expectAssignable<RetractionReasonClass>('pre-publication-recall');
expectError<RetractionReasonClass>('we-changed-our-mind'); // open text not allowed
expectError<RetractionReasonClass>('Partner-Request'); // case-sensitive

const retraction: RetractionV1 = {
  retracted_subject: { bundle_id: 'x' as Uuidv7 },
  reason_class: 'partner-request',
  retracted_at: '2026-06-01T12:00:00Z' as RetractionV1['retracted_at'],
};
expectAssignable<RetractionV1>(retraction);

// missing reason_class → error
expectError<RetractionV1>({
  retracted_subject: {},
  retracted_at: '2026-06-01T12:00:00Z',
});

// out-of-set reason_class → error
expectError<RetractionV1>({
  ...retraction,
  reason_class: 'whatever',
});

// ─── dashboard-render/v1 (v0.2.0 additive, B3 binding) ─────────────────

const render: DashboardRenderV1 = {
  rendered_artifact: {
    content_hash: 'sha256:0'.repeat(8) as Sha256Prefixed,
  },
  input_bundles: [{ bundle_id: 'x' as Uuidv7 }],
  rendered_at: '2026-06-01T12:05:00Z' as DashboardRenderV1['rendered_at'],
  renderer: 'intent-eval-dashboard@0.2.0',
};
expectAssignable<DashboardRenderV1>(render);

// missing rendered_artifact → error
expectError<DashboardRenderV1>({
  input_bundles: [],
  rendered_at: '2026-06-01T12:05:00Z',
  renderer: 'intent-eval-dashboard@0.2.0',
});
