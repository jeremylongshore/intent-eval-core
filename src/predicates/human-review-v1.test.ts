/**
 * human-review/v1 — predicate body + parallel-statement + permanent-staging tests
 * (ISEDC DR-103 D1 + D3). Covers the URI (evals not labs), the PERMANENT
 * sigstore_staging lock, the trust-criterion surface, the body shape, the
 * verified-pin superRefine, and the parallel HumanReviewStatement subject-digest
 * invariant (which does NOT ride the gate-pinned EvidenceStatement).
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Rfc3339, Sha256Prefixed, Uuidv7 } from '../primitives.js';
import {
  HUMAN_REVIEW_V1_URI,
  HUMAN_REVIEW_V1_SIGNING_MODE,
  HUMAN_REVIEW_V1_TRUST_CRITERION,
  type HumanReviewV1,
  type HumanReviewV1Statement,
  type HumanReviewV1Uri,
} from './human-review-v1.js';
import { PREDICATE_URIS } from './gate-result-v1.js';
import {
  HumanReviewV1Schema,
  HumanReviewStatementSchema,
  HUMAN_REVIEW_IN_TOTO_STATEMENT_V1_TYPE,
} from '../validators/v1/human-review-v1.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

const INPUT_HASH_BARE = '3'.repeat(64);
const INPUT_HASH = ('sha256:' + INPUT_HASH_BARE) as Sha256Prefixed;

/** A minimal, valid human-review/v1 body (pinned via session_trace_id). */
function minimalBody(): HumanReviewV1 {
  return {
    human_review_id: '0192cae6-000c-7000-8000-000000000001' as Uuidv7,
    eval_run_id: '0192cae6-0004-7000-8000-000000000000' as Uuidv7,
    session_trace_id: '0192cae6-0005-7000-8000-000000000000' as Uuidv7,
    judge_decision_id: null,
    reviewer_identity: 'jeremy@intentsolutions.io',
    score_text: 'strong — clear and well-scoped',
    thumbs: true,
    annotation: null,
    input_hash: INPUT_HASH,
    reviewed_at: '2026-06-25T00:00:00Z' as Rfc3339,
  };
}

// ─── Predicate URI (DR-103 D3 B3.1 — evals not labs) ────────────────────────

describe('human-review/v1 — predicate URI (DR-103 D3 B3.1)', () => {
  it('routes through evals.intentsolutions.io, NEVER labs (CISO binding)', () => {
    expect(HUMAN_REVIEW_V1_URI).toBe('https://evals.intentsolutions.io/human-review/v1');
    expect(HUMAN_REVIEW_V1_URI).not.toContain('labs.intentsolutions.io');
  });

  it('is registered in PREDICATE_URIS', () => {
    expect(PREDICATE_URIS.HUMAN_REVIEW_V1).toBe(HUMAN_REVIEW_V1_URI);
  });

  it('is FLAT — exactly one path segment before the version', () => {
    const path = new URL(HUMAN_REVIEW_V1_URI).pathname;
    expect(path).toBe('/human-review/v1');
    expect(HUMAN_REVIEW_V1_URI).not.toContain('/authoring/');
  });
});

// ─── PERMANENT staging lock (DR-103 D3 B3.2) ────────────────────────────────

describe('human-review/v1 — PERMANENTLY sigstore_staging (DR-103 D3 B3.2)', () => {
  it('the signing-mode const is sigstore_staging and can NEVER be rekor_production', () => {
    expect(HUMAN_REVIEW_V1_SIGNING_MODE).toBe('sigstore_staging');
    // A human's open-ended TEXT assessment is non-reproducible; production is
    // impossible BY DESIGN, not a TODO. The const is typed as the literal so a
    // flip to production is a compile error, not a silent runtime change.
    expect(HUMAN_REVIEW_V1_SIGNING_MODE).not.toBe('rekor_production');
    expectTypeOf(HUMAN_REVIEW_V1_SIGNING_MODE).toEqualTypeOf<'sigstore_staging'>();
  });

  it('names a DIFFERENT real trust criterion (verified identity + pinned session)', () => {
    // DevRel binding: staging-forever-by-design must not read as abandoned —
    // the predicate carries a real trust criterion that is NOT a Rekor anchor.
    expect(HUMAN_REVIEW_V1_TRUST_CRITERION).toBe('verified-reviewer-identity+pinned-session');
  });
});

// ─── Body shape + verified-pin invariant (DR-103 D1 B1.2) ───────────────────

describe('human-review/v1 — predicate body shape + verified-pin', () => {
  it('accepts a minimal pinned body', () => {
    const body = minimalBody();
    expect(() => HumanReviewV1Schema.parse(body)).not.toThrow();
  });

  it('accepts a body pinned via judge_decision_id only (session null)', () => {
    const body: HumanReviewV1 = {
      ...minimalBody(),
      session_trace_id: null,
      judge_decision_id: '0192cae6-0007-7000-8000-000000000000' as Uuidv7,
    };
    expect(() => HumanReviewV1Schema.parse(body)).not.toThrow();
  });

  it('accepts the optional supersedes_id', () => {
    const body: HumanReviewV1 = {
      ...minimalBody(),
      supersedes_id: '0192cae6-000c-7000-8000-0000000000aa' as Uuidv7,
    };
    expect(() => HumanReviewV1Schema.parse(body)).not.toThrow();
  });

  it('REJECTS a body pinned to nothing (both session + judge null) — DR-103 D1 B1.2', () => {
    const result = HumanReviewV1Schema.safeParse({
      ...minimalBody(),
      session_trace_id: null,
      judge_decision_id: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('session_trace_id');
    }
  });

  it('REJECTS an explicit-null supersedes_id (optional-not-nullable)', () => {
    const body = { ...minimalBody(), supersedes_id: null };
    expect(HumanReviewV1Schema.safeParse(body).success).toBe(false);
  });

  it('REJECTS an unknown extra field (.strict)', () => {
    expect(HumanReviewV1Schema.safeParse({ ...minimalBody(), surprise: true }).success).toBe(false);
  });

  it('REJECTS a bare (unprefixed) input_hash on the predicate body (wire form is sha256:)', () => {
    expect(
      HumanReviewV1Schema.safeParse({ ...minimalBody(), input_hash: INPUT_HASH_BARE }).success,
    ).toBe(false);
  });
});

// ─── Parallel statement — subject-digest pin, NOT the gate EvidenceStatement ──

describe('human-review/v1 — parallel HumanReviewStatement (DR-103 D1 B1.3)', () => {
  function statement(): HumanReviewV1Statement {
    return {
      _type: HUMAN_REVIEW_IN_TOTO_STATEMENT_V1_TYPE,
      subject: [{ name: 'human-review:ci:my-skill', digest: { sha256: INPUT_HASH_BARE } }],
      predicateType: HUMAN_REVIEW_V1_URI,
      predicate: minimalBody(),
    };
  }

  it('Statement carries _type, predicateType, predicate', () => {
    expectTypeOf<HumanReviewV1Statement>()
      .toHaveProperty('_type')
      .toEqualTypeOf<'https://in-toto.io/Statement/v1'>();
    expectTypeOf<HumanReviewV1Statement>()
      .toHaveProperty('predicateType')
      .toEqualTypeOf<HumanReviewV1Uri>();
  });

  it('accepts a statement whose subject digest equals input_hash sans prefix', () => {
    expect(() => HumanReviewStatementSchema.parse(statement())).not.toThrow();
  });

  it('accepts an experimental extensions escape hatch', () => {
    const s = { ...statement(), extensions: { note: 'curated j-rig review' } };
    expect(() => HumanReviewStatementSchema.parse(s)).not.toThrow();
  });

  it('REJECTS a subject digest that does NOT equal input_hash (the forgery-cost pin)', () => {
    const s = statement();
    const bad = {
      ...s,
      subject: [{ name: 'human-review:ci:my-skill', digest: { sha256: 'a'.repeat(64) } }],
    };
    const result = HumanReviewStatementSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('subject.0.digest.sha256');
    }
  });

  it('REJECTS the gate-result predicateType (does NOT ride the gate-pinned statement)', () => {
    const bad = {
      ...statement(),
      predicateType: 'https://evals.intentsolutions.io/gate-result/v1',
    };
    expect(HumanReviewStatementSchema.safeParse(bad).success).toBe(false);
  });

  it('REJECTS an empty subject array (min 1)', () => {
    expect(HumanReviewStatementSchema.safeParse({ ...statement(), subject: [] }).success).toBe(
      false,
    );
  });

  it('REJECTS a body that is itself invalid (pinned to nothing)', () => {
    const s = statement();
    const bad = {
      ...s,
      predicate: { ...s.predicate, session_trace_id: null, judge_decision_id: null },
    };
    expect(HumanReviewStatementSchema.safeParse(bad).success).toBe(false);
  });
});
