/**
 * UsageEvent — entity-level structural + anti-gaming + C3 tests (DR-103 D1 / C3).
 *
 * These assert the entity's load-bearing INVARIANTS at the kernel surface:
 *   - append-only state machine (single terminal `recorded`, no transitions)
 *   - DR-103 D1 B1.2 anti-gaming (every superRefine branch, per-field path)
 *   - DR-103 C3 B6.1 structural no-rolled-score (a cross-`(meter,unit)` scalar is
 *     not representable by construction — there is NO rolled-total field)
 *   - the cost_record_ref seam proving UsageEvent and CostRecord are SEPARATE
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  METERED_REQUIRES_VERIFIED_SOURCE,
  usageEventTransitions,
  type CostRecord,
  type UsageEvent,
  type UsageEventState,
  type UsageMeter,
} from '../index.js';
import { UsageEventSchema } from '../validators/v1/usage-event.js';

const BASE = UsageEventSchema.parse({
  id: '0192cae6-0010-7000-8000-0000000000aa',
  meter: 'eval_run',
  quantity: 1,
  unit: 'count',
  source_entity_type: 'eval_run',
  source_entity_id: '0192cae6-0004-7000-8000-000000000000',
  source_verified: true,
  cost_record_ref: '0192cae6-0009-7000-8000-000000000000',
  recorded_at: '2026-06-25T00:00:05Z',
});

describe('UsageEvent — append-only state machine (DR-103 D1)', () => {
  it('has a single terminal state `recorded` with no outgoing transitions', () => {
    expectTypeOf<UsageEventState>().toEqualTypeOf<'recorded'>();
    expect(Object.keys(usageEventTransitions)).toEqual(['recorded']);
    expect(usageEventTransitions.recorded).toEqual([]);
  });
});

describe('UsageEvent — DR-103 D1 B1.2 anti-gaming (machine-enforced, every metered meter)', () => {
  it('the five non-api_call meters each require a verified gated source', () => {
    expect([...METERED_REQUIRES_VERIFIED_SOURCE].sort()).toEqual(
      ['eval_run', 'gate_evaluation', 'judge_decision', 'report_render', 'skill_invocation'].sort(),
    );
    // api_call is intentionally absent — the leaf action has no gated parent.
    expect((METERED_REQUIRES_VERIFIED_SOURCE as readonly string[]).includes('api_call')).toBe(
      false,
    );
  });

  it.each(METERED_REQUIRES_VERIFIED_SOURCE)(
    'a metered "%s" row with source_verified=false is REJECTED on the source_verified path',
    (meter) => {
      const r = UsageEventSchema.safeParse({ ...BASE, meter, source_verified: false });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.map((issue) => issue.path.join('.'))).toContain('source_verified');
      }
    },
  );

  it.each(METERED_REQUIRES_VERIFIED_SOURCE)(
    'a metered "%s" row with a null source is REJECTED on both source paths',
    (meter) => {
      const r = UsageEventSchema.safeParse({
        ...BASE,
        meter,
        source_entity_type: null,
        source_entity_id: null,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        const paths = r.error.issues.map((issue) => issue.path.join('.'));
        expect(paths).toContain('source_entity_type');
        expect(paths).toContain('source_entity_id');
      }
    },
  );

  it('api_call is the lone exempt meter — a null/unverified source is ACCEPTED', () => {
    const r = UsageEventSchema.safeParse({
      ...BASE,
      meter: 'api_call',
      quantity: 1280,
      unit: 'tokens',
      source_entity_type: null,
      source_entity_id: null,
      source_verified: false,
      cost_record_ref: null,
    });
    expect(r.success).toBe(true);
  });

  it('a MISSING meter fails on base validation alone — the .superRefine does NOT cascade anti-gaming errors', () => {
    // Regression for the Gemini PR-#73 "meter && meter !== api_call" guard
    // suggestion: a missing `meter` cannot reach the .superRefine (a required
    // enum field gates the callback), so there is no spurious anti-gaming cascade
    // on source_entity_type / source_entity_id / source_verified. The single base
    // error sits on `meter`.
    const { meter: _omit, ...withoutMeter } = BASE;
    const r = UsageEventSchema.safeParse(withoutMeter);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('meter');
      // No anti-gaming cascade — the .superRefine never executed.
      expect(paths).not.toContain('source_entity_type');
      expect(paths).not.toContain('source_entity_id');
      expect(paths).not.toContain('source_verified');
    }
  });

  it('a MISSING source_verified fails on base validation with no duplicate custom issue', () => {
    // Regression for the Gemini PR-#73 "source_verified === false" suggestion: a
    // missing `source_verified` (required boolean) is caught by base validation
    // and the .superRefine never runs, so there is exactly ONE issue on the field
    // (the base invalid_type) — never a redundant custom anti-gaming issue. This
    // is why `!== true` (faithful to "MUST be true") needs no `=== false` rewrite.
    const { source_verified: _omit, ...withoutVerified } = BASE;
    const r = UsageEventSchema.safeParse({ ...withoutVerified, meter: 'eval_run' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const verifiedIssues = r.error.issues.filter(
        (issue) => issue.path.join('.') === 'source_verified',
      );
      expect(verifiedIssues).toHaveLength(1);
      expect(verifiedIssues[0]?.code).toBe('invalid_type');
    }
  });
});

describe('UsageEvent — DR-103 C3 B6.1 structural no-rolled-score', () => {
  it('the row carries NO cross-dimension rolled scalar by construction', () => {
    // C3: a "usefulness %" / rolled total across heterogeneous (meter,unit) is the
    // ossification trap. The defense is STRUCTURAL ABSENCE — the type has only
    // per-dimension fields (meter + quantity + unit), never a rolled scalar.
    const keys = Object.keys(BASE).sort();
    expect(keys).toEqual(
      [
        'cost_record_ref',
        'id',
        'meter',
        'quantity',
        'recorded_at',
        'source_entity_id',
        'source_entity_type',
        'source_verified',
        'unit',
      ].sort(),
    );
    // No field hints a cross-dimension aggregate.
    for (const forbidden of ['rolled_score', 'rolledScore', 'total', 'usefulness', 'score']) {
      expect(Object.prototype.hasOwnProperty.call(BASE, forbidden)).toBe(false);
    }
  });

  it('a strict() extra "rolled_total" field is rejected — the aggregate cannot be smuggled in', () => {
    const r = UsageEventSchema.safeParse({ ...BASE, rolled_total: 4003 });
    expect(r.success).toBe(false);
  });

  it('heterogeneous (meter,unit) rows are NON-COMPARABLE — a SUM across them is meaningless', () => {
    // Two valid rows on DIFFERENT (meter,unit) dimensions. The contract forbids
    // SUM(quantity) across them; this test documents that the only honest rollup
    // is a per-(meter,unit) vector, asserted by computing the keyed grouping and
    // proving there is no single scalar the entity sanctions.
    const evalRow = BASE; // (eval_run, count)
    const tokenRow = UsageEventSchema.parse({
      ...BASE,
      id: '0192cae6-0010-7000-8000-0000000000bb',
      meter: 'api_call',
      quantity: 4000,
      unit: 'tokens',
      source_entity_type: null,
      source_entity_id: null,
      source_verified: false,
      cost_record_ref: null,
    });
    // NB: typed as `typeof BASE` (the Zod-parse inferred type), NOT the exported
    // `UsageEvent` type. Under this repo's strict `exactOptionalPropertyTypes` +
    // branded primitives, the parse-inferred row type and the exported entity type
    // are NOT mutually assignable (optional `tenant_id` gains `| undefined` and the
    // branded `Uuidv7` differs nominally), so `(u: UsageEvent)` fails typecheck.
    // The local inferred type is the correct, minimal annotation here.
    const key = (u: typeof BASE): string => `${u.meter}:${u.unit}`;
    const byDimension = new Map<string, number>();
    for (const row of [evalRow, tokenRow]) {
      byDimension.set(key(row), (byDimension.get(key(row)) ?? 0) + row.quantity);
    }
    // Two distinct dimensions → two distinct buckets; never one scalar.
    expect(byDimension.size).toBe(2);
    expect(byDimension.get('eval_run:count')).toBe(1);
    expect(byDimension.get('api_call:tokens')).toBe(4000);
  });
});

describe('UsageEvent — DISTINCT from CostRecord (the cost_record_ref seam)', () => {
  it('cost_record_ref is a nullable back-reference, null in the unpriced common case', () => {
    const unpriced = UsageEventSchema.parse({ ...BASE, cost_record_ref: null });
    expect(unpriced.cost_record_ref).toBeNull();
  });

  it('UsageEvent and CostRecord are structurally separate types (no money/token fields here)', () => {
    // UsageEvent meters COUNTS; CostRecord attributes SPEND. The kernel keeps them
    // as separate interfaces — UsageEvent has no external_api_cost_micro_usd /
    // tokens_consumed / prompt_tokens, proving they are not two views of one row.
    expectTypeOf<UsageEvent>().not.toHaveProperty('external_api_cost_micro_usd');
    expectTypeOf<UsageEvent>().not.toHaveProperty('tokens_consumed');
    expectTypeOf<CostRecord>().not.toHaveProperty('meter');
    expectTypeOf<CostRecord>().not.toHaveProperty('quantity');
  });
});

describe('UsageEvent — quantity is a counted action, not a utility (DR-103 epic Rule 1)', () => {
  it('rejects a fractional quantity (a count, never a 0..1 score/weight)', () => {
    expect(UsageEventSchema.safeParse({ ...BASE, quantity: 0.95 }).success).toBe(false);
  });
  it('rejects a negative quantity', () => {
    expect(UsageEventSchema.safeParse({ ...BASE, quantity: -1 }).success).toBe(false);
  });
  it('accepts a zero quantity (an honest zero is a valid metered count)', () => {
    expect(UsageEventSchema.safeParse({ ...BASE, quantity: 0 }).success).toBe(true);
  });
});

describe('UsageEvent — meter enum is CLOSED + freezes at first production signature', () => {
  it('the closed meter set excludes dashboard_render (a predicate body, not a meter)', () => {
    expectTypeOf<UsageMeter>().toEqualTypeOf<
      | 'api_call'
      | 'eval_run'
      | 'skill_invocation'
      | 'judge_decision'
      | 'gate_evaluation'
      | 'report_render'
    >();
    expect(UsageEventSchema.safeParse({ ...BASE, meter: 'dashboard_render' }).success).toBe(false);
  });
});
