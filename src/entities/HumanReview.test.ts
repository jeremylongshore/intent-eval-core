/**
 * HumanReview entity — Zod validator + state-machine + fixture-parity tests
 * (net-new canonical entity, ISEDC DR-103 D1). Exercises every anti-gaming branch
 * (verified-pin, human-only, at-least-one-signal), the optional-not-nullable
 * tenant, the required-key-but-nullable pins, and the single terminal state.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HumanReviewSchema } from '../validators/v1/human-review.js';
import { humanReviewTransitions, type HumanReviewState } from './HumanReview.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../tests/fixtures/v1');
function loadJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8')) as Record<string, unknown>;
}

describe('HumanReview — state machine', () => {
  it('has the single terminal state `recorded` with no transitions (append-only)', () => {
    expect(humanReviewTransitions).toEqual({ recorded: [] });
    expect(humanReviewTransitions.recorded).toHaveLength(0);
    expectTypeOf<HumanReviewState>().toEqualTypeOf<'recorded'>();
  });
});

describe('HumanReview — positive fixtures parse cleanly', () => {
  it('full review (all three channels, pinned via session_trace_id)', () => {
    expect(() => HumanReviewSchema.parse(loadJson('human-review.valid.json'))).not.toThrow();
  });

  it('minimal review (thumb-only, pinned via judge_decision_id only)', () => {
    expect(() => HumanReviewSchema.parse(loadJson('human-review.root.valid.json'))).not.toThrow();
  });

  it('the inferred type carries the literal-false service-account field', () => {
    const parsed = HumanReviewSchema.parse(loadJson('human-review.valid.json'));
    expect(parsed.reviewer_is_service_account).toBe(false);
  });
});

describe('HumanReview — anti-gaming invariants REJECT (DR-103 D1 B1.2, machine-enforced)', () => {
  it('a review pinned to nothing (both session + judge null) → REJECT', () => {
    const result = HumanReviewSchema.safeParse(loadJson('human-review.invalid-no-pin.json'));
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('session_trace_id');
    }
  });

  it('a service-account-authored review (reviewer_is_service_account=true) → REJECT', () => {
    const result = HumanReviewSchema.safeParse(
      loadJson('human-review.invalid-service-account.json'),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('reviewer_is_service_account');
    }
  });

  it('an empty review (all three signal channels null) → REJECT', () => {
    const result = HumanReviewSchema.safeParse(loadJson('human-review.invalid-empty-signals.json'));
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('score_text');
    }
  });

  it('a review pinned via session_trace_id alone (judge null) → ACCEPT', () => {
    const base = loadJson('human-review.valid.json');
    const result = HumanReviewSchema.safeParse({ ...base, judge_decision_id: null });
    expect(result.success).toBe(true);
  });

  it('a single-signal review (only annotation, no score_text/thumbs) → ACCEPT', () => {
    const base = loadJson('human-review.valid.json');
    const result = HumanReviewSchema.safeParse({
      ...base,
      score_text: null,
      thumbs: null,
      annotation: 'just a note',
    });
    expect(result.success).toBe(true);
  });
});

describe('HumanReview — closed-world + nullability discipline', () => {
  it('an unknown extra field → REJECT (.strict)', () => {
    const base = loadJson('human-review.valid.json');
    expect(HumanReviewSchema.safeParse({ ...base, surprise: true }).success).toBe(false);
  });

  it('tenant_id is optional-NOT-nullable (explicit null → REJECT, DR-103 D2)', () => {
    const base = loadJson('human-review.valid.json');
    expect(HumanReviewSchema.safeParse({ ...base, tenant_id: null }).success).toBe(false);
  });

  it('tenant_id present as a UUIDv7 → ACCEPT (attested tenant claim)', () => {
    const base = loadJson('human-review.valid.json');
    const result = HumanReviewSchema.safeParse({
      ...base,
      tenant_id: '0192cae6-9999-7000-8000-000000000000',
    });
    expect(result.success).toBe(true);
  });

  it('a missing required-but-nullable pin KEY (session_trace_id omitted) → REJECT', () => {
    const base = loadJson('human-review.valid.json');
    const { session_trace_id, ...without } = base;
    void session_trace_id;
    expect(HumanReviewSchema.safeParse(without).success).toBe(false);
  });

  it('a prefixed (sha256:) input_hash → REJECT (entity hash is BARE)', () => {
    const base = loadJson('human-review.valid.json');
    expect(
      HumanReviewSchema.safeParse({ ...base, input_hash: 'sha256:' + '3'.repeat(64) }).success,
    ).toBe(false);
  });
});
