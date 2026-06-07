/**
 * EvidenceStatement + EvidenceBundlePayload validator tests (iec-E12).
 *
 * Proves the § 7.3 cross-field invariants (I1 subject↔gate_id, I2
 * subject-digest↔input_hash), the `extensions` escape hatch, closed-world
 * strictness, the pinned in-toto `_type` + `predicateType`, and the JSON-array
 * payload wire format.
 */

import { describe, it, expect } from 'vitest';
import {
  EvidenceBundlePayloadSchema,
  EvidenceStatementSchema,
  IN_TOTO_STATEMENT_V1_TYPE,
} from './evidence-statement.js';
import { GATE_RESULT_V1_URI } from './gate-result-v1.js';

const HEX = 'b'.repeat(64);

/** A valid gate-result/v1 predicate body whose input_hash digest is HEX. */
function validPredicate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gate_id: 'iec:ci:coverage',
    gate_name: 'coverage',
    gate_version: '1.0.0',
    gate_decision: 'pass',
    gate_reasons: [],
    coverage: { dimensions_evaluated: ['lines'], dimensions_skipped: [] },
    policy_ref: `sha256:${'a'.repeat(64)}:tests/TESTING.md`,
    policy_hash: `sha256:${'a'.repeat(64)}`,
    input_hash: `sha256:${HEX}`,
    evaluated_at: '2026-06-07T00:00:00.000Z',
    runner: 'audit-harness@1.0.0',
    commit_sha: 'a'.repeat(40),
    ...overrides,
  };
}

/** A valid EvidenceStatement whose subject satisfies I1 + I2. */
function validStatement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _type: IN_TOTO_STATEMENT_V1_TYPE,
    subject: [{ name: 'iec:ci:coverage', digest: { sha256: HEX } }],
    predicateType: GATE_RESULT_V1_URI,
    predicate: validPredicate(),
    ...overrides,
  };
}

describe('EvidenceStatementSchema — happy path', () => {
  it('parses a statement whose subject satisfies both invariants', () => {
    expect(() => EvidenceStatementSchema.parse(validStatement())).not.toThrow();
  });

  it('accepts the non-normative extensions escape hatch', () => {
    const parsed = EvidenceStatementSchema.parse(
      validStatement({ extensions: { experimental_score: 0.91, note: 'beta' } }),
    );
    expect(parsed.extensions).toEqual({ experimental_score: 0.91, note: 'beta' });
  });
});

describe('EvidenceStatementSchema — cross-field invariants (Blueprint B § 7.3)', () => {
  it('I1: rejects when subject[0].name !== predicate.gate_id', () => {
    const bad = validStatement({
      subject: [{ name: 'iec:ci:different-gate', digest: { sha256: HEX } }],
    });
    const r = EvidenceStatementSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('invariant I1'))).toBe(true);
    }
  });

  it('I2: rejects when subject[0].digest.sha256 !== input_hash sans prefix', () => {
    const bad = validStatement({
      subject: [{ name: 'iec:ci:coverage', digest: { sha256: 'c'.repeat(64) } }],
    });
    const r = EvidenceStatementSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('invariant I2'))).toBe(true);
    }
  });

  it('accepts a subject whose digest matches input_hash after prefix strip', () => {
    // The predicate's input_hash is `sha256:<HEX>`; the subject digest is bare HEX.
    expect(() => EvidenceStatementSchema.parse(validStatement())).not.toThrow();
  });
});

describe('EvidenceStatementSchema — closed-world + pinned envelope', () => {
  it('rejects an unknown top-level key (strict)', () => {
    expect(EvidenceStatementSchema.safeParse(validStatement({ rogue: true })).success).toBe(false);
  });

  it('rejects a non-in-toto _type', () => {
    expect(
      EvidenceStatementSchema.safeParse(
        validStatement({ _type: 'https://example.com/Statement/v9' }),
      ).success,
    ).toBe(false);
  });

  it('rejects a predicateType that is not gate-result/v1', () => {
    expect(
      EvidenceStatementSchema.safeParse(
        validStatement({ predicateType: 'https://evals.intentsolutions.io/retraction/v1' }),
      ).success,
    ).toBe(false);
  });

  it('rejects an empty subject array (min 1)', () => {
    expect(EvidenceStatementSchema.safeParse(validStatement({ subject: [] })).success).toBe(false);
  });

  it('rejects a malformed predicate body (invalid gate_decision)', () => {
    expect(
      EvidenceStatementSchema.safeParse(
        validStatement({ predicate: validPredicate({ gate_decision: 'maybe' }) }),
      ).success,
    ).toBe(false);
  });
});

describe('EvidenceBundlePayloadSchema — JSON-array wire format', () => {
  it('parses an array of valid statements', () => {
    const payload = [validStatement(), validStatement()];
    expect(() => EvidenceBundlePayloadSchema.parse(payload)).not.toThrow();
    expect(EvidenceBundlePayloadSchema.parse(payload)).toHaveLength(2);
  });

  it('parses an empty payload', () => {
    expect(EvidenceBundlePayloadSchema.parse([])).toEqual([]);
  });

  it('rejects a payload containing one invariant-violating row', () => {
    const payload = [
      validStatement(),
      validStatement({ subject: [{ name: 'iec:ci:wrong', digest: { sha256: HEX } }] }),
    ];
    expect(EvidenceBundlePayloadSchema.safeParse(payload).success).toBe(false);
  });
});
