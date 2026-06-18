import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Sha256Prefixed, Uuidv7 } from '../primitives.js';
import {
  SKILL_REFINER_PASS_V1_URI,
  type EvalSetRef,
  type NamedDimensionDelta,
  type SkillRefinerPassV1,
  type SkillRefinerPassV1Statement,
  type SkillRefinerReplayFidelityLevel,
  type SkillRefinerTestStatisticKind,
  type SkillRefinerVerdict,
} from './skill-refiner-pass-v1.js';
import { SkillRefinerPassV1Schema } from '../validators/v1/skill-refiner-pass-v1.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

const SUBJECT_HASH = '7'.repeat(64);
const SOURCE_SNAPSHOT_HASH = ('sha256:' + SUBJECT_HASH) as Sha256Prefixed;

/** A minimal, valid accept body (required determinants only, DR-082 Q2). */
function minimalBody(): SkillRefinerPassV1 {
  return {
    verdict: 'accept',
    reason: ['behavioral-pareto-dominant', 'all-named-dims-non-regressed'],
    refiner_strategy_id: 'naive-in-context@1',
    skill_version_id: '0192cae6-000b-7000-8000-000000000001' as Uuidv7,
    parent_version_id: '0192cae6-000b-7000-8000-000000000000' as Uuidv7,
    source_snapshot_hash: SOURCE_SNAPSHOT_HASH,
    eval_set_ref: {
      hash: ('sha256:' + 'a'.repeat(64)) as Sha256Prefixed,
      version: '2026.06.01',
      lineage_id: '0192cae6-000b-7000-8000-0000000000ee' as Uuidv7,
    },
    edit_proposal_hash: ('sha256:' + 'b'.repeat(64)) as Sha256Prefixed,
    behavioral_delta: 0.12,
    named_dimension_deltas: [{ id: 'safety', delta: 0.01, non_regressed: true }],
    alpha: 0.05,
    test_statistic_kind: 'one-sided-z',
  };
}

// ─── Predicate URI (DR-082 Q1 — FLAT, evals not labs, no /authoring/) ───────

describe('skill-refiner-pass/v1 — predicate URI (DR-082 Q1)', () => {
  it('routes through evals.intentsolutions.io, NEVER labs (CISO binding)', () => {
    expect(SKILL_REFINER_PASS_V1_URI).toBe(
      'https://evals.intentsolutions.io/skill-refiner-pass/v1',
    );
    expect(SKILL_REFINER_PASS_V1_URI).not.toContain('labs.intentsolutions.io');
  });

  it('is FLAT — a sibling of gate-result/v1, with NO /authoring/ segment', () => {
    expect(SKILL_REFINER_PASS_V1_URI).not.toContain('/authoring/');
    // grammar: evals.io/<type>/v<n> — exactly one path segment before the version
    const path = new URL(SKILL_REFINER_PASS_V1_URI).pathname;
    expect(path).toBe('/skill-refiner-pass/v1');
  });
});

// ─── Closed enums (widening any = /v2 trigger, DR-082 Q5) ───────────────────

describe('skill-refiner-pass/v1 — closed enums', () => {
  it('SkillRefinerVerdict is the closed accept|reject set', () => {
    expectTypeOf<SkillRefinerVerdict>().toEqualTypeOf<'accept' | 'reject'>();
  });

  it('test_statistic_kind is the one-sided-z const (DR-082 Q2)', () => {
    expectTypeOf<SkillRefinerTestStatisticKind>().toEqualTypeOf<'one-sided-z'>();
  });

  it('replay_fidelity_level mirrors gate-result RF-0..RF-4', () => {
    expectTypeOf<SkillRefinerReplayFidelityLevel>().toEqualTypeOf<
      'RF-0' | 'RF-1' | 'RF-2' | 'RF-3' | 'RF-4'
    >();
  });
});

// ─── Body shape (the determinant set + optionals) ───────────────────────────

describe('skill-refiner-pass/v1 — predicate body shape', () => {
  it('accepts a minimal required-only determinant body', () => {
    const body = minimalBody();
    expect(() => SkillRefinerPassV1Schema.parse(body)).not.toThrow();
    expect(body.verdict).toBe('accept');
    expect(body.test_statistic_kind).toBe('one-sided-z');
  });

  it('accepts full optional fields (cost_record_ref, replay_fidelity_level, signing_downgrade_reason)', () => {
    const body: SkillRefinerPassV1 = {
      ...minimalBody(),
      cost_record_ref: '0192cae6-000b-7000-8000-0000000000cc' as Uuidv7,
      replay_fidelity_level: 'RF-1',
      signing_downgrade_reason: 'production-root-not-yet-provisioned',
    };
    expect(() => SkillRefinerPassV1Schema.parse(body)).not.toThrow();
    expect(body.replay_fidelity_level).toBe('RF-1');
  });

  it('accepts an empty named_dimension_deltas array (skill with only the behavioral dim)', () => {
    const body: SkillRefinerPassV1 = { ...minimalBody(), named_dimension_deltas: [] };
    expect(() => SkillRefinerPassV1Schema.parse(body)).not.toThrow();
  });

  it('EvalSetRef carries the frozen hash + version + lineage_id (DR-082 Q2)', () => {
    const ref: EvalSetRef = minimalBody().eval_set_ref;
    expect(ref.hash.startsWith('sha256:')).toBe(true);
    expect(ref.version).toBeTruthy();
  });

  it('each NamedDimensionDelta carries id + delta + non_regressed', () => {
    const d: NamedDimensionDelta = { id: 'safety', delta: 0.01, non_regressed: true };
    expect(d.non_regressed).toBe(true);
  });
});

// ─── Determinant rejections (strip a determinant ⇒ unfalsifiable PASS) ───────

describe('skill-refiner-pass/v1 — required determinants rejected when missing', () => {
  const REQUIRED_DETERMINANTS = [
    'verdict',
    'reason',
    'refiner_strategy_id',
    'skill_version_id',
    'parent_version_id',
    'source_snapshot_hash',
    'eval_set_ref',
    'edit_proposal_hash',
    'behavioral_delta',
    'named_dimension_deltas',
    'alpha',
    'test_statistic_kind',
  ] as const;

  it.each(REQUIRED_DETERMINANTS)('rejects a body missing %s', (field) => {
    const body = { ...minimalBody() } as Record<string, unknown>;
    delete body[field];
    expect(SkillRefinerPassV1Schema.safeParse(body).success).toBe(false);
  });

  it('rejects refiner_strategy_id as empty string (mechanism must stay traceable, DR-028)', () => {
    expect(
      SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), refiner_strategy_id: '' }).success,
    ).toBe(false);
  });

  it('rejects an empty reason array (emitted on a real verdict, never silent)', () => {
    expect(SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), reason: [] }).success).toBe(
      false,
    );
  });

  it('rejects an out-of-range alpha (falsifiability anchor must be in (0,1))', () => {
    expect(SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), alpha: 0 }).success).toBe(false);
    expect(SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), alpha: 1 }).success).toBe(false);
    expect(SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), alpha: 1.5 }).success).toBe(
      false,
    );
  });

  it('rejects a test_statistic_kind other than one-sided-z (const for v1, /v2 to change)', () => {
    expect(
      SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), test_statistic_kind: 'two-sided-t' })
        .success,
    ).toBe(false);
  });

  it('rejects an out-of-set verdict (closed enum; widening is /v2)', () => {
    expect(
      SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), verdict: 'incomparable' }).success,
    ).toBe(false);
  });

  it('rejects unknown extra fields (additionalProperties: false / .strict)', () => {
    expect(SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), surprise: true }).success).toBe(
      false,
    );
  });

  it('rejects a malformed source_snapshot_hash (must be sha256-prefixed)', () => {
    expect(
      SkillRefinerPassV1Schema.safeParse({ ...minimalBody(), source_snapshot_hash: 'deadbeef' })
        .success,
    ).toBe(false);
  });

  it('rejects an eval_set_ref missing lineage_id', () => {
    const body = minimalBody();
    const ref = { hash: body.eval_set_ref.hash, version: body.eval_set_ref.version };
    expect(SkillRefinerPassV1Schema.safeParse({ ...body, eval_set_ref: ref }).success).toBe(false);
  });
});

// ─── in-toto wire discipline (DR-082 Q4 — mirror gate-result exactly) ───────

describe('skill-refiner-pass/v1 — in-toto Statement (DR-082 Q4)', () => {
  it('Statement carries _type, predicateType, predicate', () => {
    expectTypeOf<SkillRefinerPassV1Statement>()
      .toHaveProperty('_type')
      .toEqualTypeOf<'https://in-toto.io/Statement/v1'>();
    expectTypeOf<SkillRefinerPassV1Statement>()
      .toHaveProperty('predicateType')
      .toEqualTypeOf<typeof SKILL_REFINER_PASS_V1_URI>();
  });

  it('subject[].digest.sha256 equals source_snapshot_hash without the sha256: prefix', () => {
    const body = minimalBody();
    const statement: SkillRefinerPassV1Statement = {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [
        {
          name: 'skill-refiner:ci:my-skill',
          digest: { sha256: SUBJECT_HASH },
        },
      ],
      predicateType: SKILL_REFINER_PASS_V1_URI,
      predicate: body,
    };
    // The load-bearing tamper-evidence link (gate-result's input_hash analogue):
    // the bare subject digest must equal the prefixed body hash minus `sha256:`.
    const subjectDigest = statement.subject[0]?.digest.sha256;
    expect(subjectDigest).toBe(statement.predicate.source_snapshot_hash.slice('sha256:'.length));
  });
});
