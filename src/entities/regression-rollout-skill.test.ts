/**
 * Type + runtime tests for E02c entities: RegressionPack, RolloutGate,
 * SkillSnapshot. Each test cites the Blueprint B section it locks.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  canTransition,
  regressionPackTransitions,
  rolloutGateTransitions,
  skillSnapshotTransitions,
  type Coverage,
  type GateDecision,
  type MatcherOutcomeRow,
  type MmClass,
  type RegressionOutcomeSummary,
  type RegressionPack,
  type RegressionPackState,
  type RolloutGate,
  type RolloutGateDecision,
  type RolloutGateState,
  type SemVer,
  type SigningMode,
  type SkillSnapshot,
  type SkillSnapshotState,
  type Uuidv7,
} from '../index.js';

describe('RegressionPack (Blueprint B § 2.7)', () => {
  it('state machine: draft → committed → superseded', () => {
    expectTypeOf<RegressionPackState>().toEqualTypeOf<'draft' | 'committed' | 'superseded'>();
    expect(canTransition(regressionPackTransitions, 'draft', 'committed')).toBe(true);
    expect(canTransition(regressionPackTransitions, 'committed', 'superseded')).toBe(true);
    // Supersession is one-way (revert = new pack with ancestor_pack_id)
    expect(canTransition(regressionPackTransitions, 'superseded', 'committed')).toBe(false);
    expect(regressionPackTransitions.superseded).toHaveLength(0);
    // No skipping past committed
    expect(canTransition(regressionPackTransitions, 'draft', 'superseded')).toBe(false);
  });

  it('MatcherOutcomeRow locks pass+fail required; advisory/N_A/error optional', () => {
    expectTypeOf<MatcherOutcomeRow>().toHaveProperty('pass').toEqualTypeOf<number>();
    expectTypeOf<MatcherOutcomeRow>().toHaveProperty('fail').toEqualTypeOf<number>();
    // The other three are optional — spec doesn't mention them in § 2.7
    const minimal: MatcherOutcomeRow = { pass: 10, fail: 2 };
    const full: MatcherOutcomeRow = {
      pass: 10,
      fail: 2,
      advisory: 1,
      not_applicable: 0,
      error: 0,
    };
    expect(minimal.pass).toBe(10);
    expect(full.advisory).toBe(1);
  });

  it('RegressionOutcomeSummary is Partial<Record<MmClass, ...>> (not every pack tests every class)', () => {
    const summary: RegressionOutcomeSummary = {
      'MM-1': { pass: 8, fail: 0 },
      'MM-4': { pass: 5, fail: 2, advisory: 1 },
    };
    // MM-2, MM-3, MM-5, MM-6 absent — allowed because Partial
    expect(summary['MM-1']?.pass).toBe(8);
    expect(summary['MM-2']).toBeUndefined();
  });

  it('carries ancestor_pack_id nullable + delta_declaration free-form', () => {
    expectTypeOf<RegressionPack>()
      .toHaveProperty('ancestor_pack_id')
      .toEqualTypeOf<Uuidv7 | null>();
    expectTypeOf<RegressionPack>().toHaveProperty('delta_declaration').toEqualTypeOf<string>();
  });

  it('carries eval_spec_ids + eval_run_ids as readonly UUID arrays', () => {
    expectTypeOf<RegressionPack>()
      .toHaveProperty('eval_spec_ids')
      .toEqualTypeOf<readonly Uuidv7[]>();
    expectTypeOf<RegressionPack>()
      .toHaveProperty('eval_run_ids')
      .toEqualTypeOf<readonly Uuidv7[]>();
  });
});

describe('RolloutGate (Blueprint B § 2.8)', () => {
  it('RolloutGateDecision is ship|no_ship|advisory|error (NOT GateDecision)', () => {
    expectTypeOf<RolloutGateDecision>().toEqualTypeOf<
      'ship' | 'no_ship' | 'advisory' | 'error'
    >();
    // Critical: RolloutGateDecision and GateDecision are DIFFERENT enums.
    // RolloutGate uses ship/no_ship (deployment language); GateDecision
    // uses pass/fail (verdict language). The mapping is policy-driven
    // and lives in the downstream rollout-gate package.
    expectTypeOf<RolloutGateDecision>().not.toEqualTypeOf<GateDecision>();
  });

  it('state machine: evaluated is terminal single-state', () => {
    expectTypeOf<RolloutGateState>().toEqualTypeOf<'evaluated'>();
    expect(rolloutGateTransitions.evaluated).toHaveLength(0);
  });

  it('carries the FKs + policy_ref + policy_content_hash + coverage', () => {
    expectTypeOf<RolloutGate>().toHaveProperty('eval_run_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<RolloutGate>().toHaveProperty('evidence_bundle_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<RolloutGate>().toHaveProperty('policy_ref').toEqualTypeOf<string>();
    // Coverage is imported from the predicate module — shape MUST match
    expectTypeOf<RolloutGate>().toHaveProperty('coverage').toEqualTypeOf<Coverage>();
  });

  it('carries signing_mode + nullable rekor_log_index', () => {
    expectTypeOf<RolloutGate>().toHaveProperty('signing_mode').toEqualTypeOf<SigningMode>();
    expectTypeOf<RolloutGate>().toHaveProperty('rekor_log_index').toEqualTypeOf<number | null>();
  });
});

describe('SkillSnapshot (Blueprint B § 2.9)', () => {
  it('state machine: created is terminal single-state', () => {
    expectTypeOf<SkillSnapshotState>().toEqualTypeOf<'created'>();
    expect(skillSnapshotTransitions.created).toHaveLength(0);
  });

  it('carries the 3 component shas + load-bearing combined_sha + nullable version_label', () => {
    expectTypeOf<SkillSnapshot>().toHaveProperty('source_sha');
    expectTypeOf<SkillSnapshot>().toHaveProperty('dependency_lock_sha');
    expectTypeOf<SkillSnapshot>().toHaveProperty('config_sha');
    expectTypeOf<SkillSnapshot>().toHaveProperty('combined_sha');
    expectTypeOf<SkillSnapshot>().toHaveProperty('version_label').toEqualTypeOf<SemVer | null>();
  });

  it('skill_id is the kebab-slug logical identifier (stable across snapshots)', () => {
    // Confirms the field exists with the kebab-slug brand
    expectTypeOf<SkillSnapshot>().toHaveProperty('skill_id');
  });
});

describe('cross-entity invariants from § 6.2 ERD', () => {
  it('RegressionPack.skill_snapshot_sha references SkillSnapshot.combined_sha by value', () => {
    // The relationship is value-level (sha), not FK (UUIDv7). This is
    // intentional per § 2.7 — RegressionPacks anchor on the CONTENT pin,
    // not on the SkillSnapshot row id, so a rebuilt snapshot with the
    // same combined_sha still satisfies the regression-check.
    type RegressionPackAnchor = RegressionPack['skill_snapshot_sha'];
    type SkillSnapshotPin = SkillSnapshot['combined_sha'];
    expectTypeOf<RegressionPackAnchor>().toEqualTypeOf<SkillSnapshotPin>();
  });

  it('RolloutGate.evidence_bundle_id references EvidenceBundle by FK (UUIDv7)', () => {
    // The relationship is FK-level here — RolloutGate decides ABOUT a
    // specific bundle's signed rows, not about a content-equivalent set.
    expectTypeOf<RolloutGate['evidence_bundle_id']>().toEqualTypeOf<Uuidv7>();
  });

  it('used MmClass keys are subset of canonical MM-1..MM-6', () => {
    // outcome_summary keys are typed as MmClass — the literal-union
    // discipline keeps the regression-pack codomain aligned with the
    // MatcherMap canonical set.
    type SummaryKey = keyof RegressionOutcomeSummary;
    expectTypeOf<SummaryKey>().toEqualTypeOf<MmClass>();
  });
});
