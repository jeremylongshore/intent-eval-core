import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Sha256Prefixed, StorageKey, Uuidv7 } from '../primitives.js';
import {
  RETRACTION_V1_URI,
  type RetractedSubject,
  type RetractionReasonClass,
  type RetractionV1,
  type RetractionV1Statement,
} from './retraction-v1.js';

describe('retraction/v1 — predicate URI (B4 binding)', () => {
  it('routes through evals.intentsolutions.io, NEVER labs (CISO binding)', () => {
    expect(RETRACTION_V1_URI).toBe('https://evals.intentsolutions.io/retraction/v1');
    expect(RETRACTION_V1_URI).not.toContain('labs.intentsolutions.io');
  });
});

describe('retraction/v1 — closed reason_class enum', () => {
  it('RetractionReasonClass is the closed 6-element set', () => {
    expectTypeOf<RetractionReasonClass>().toEqualTypeOf<
      | 'partner-request'
      | 'methodology-error'
      | 'data-quality'
      | 'consent-withdrawn'
      | 'legal-hold'
      | 'pre-publication-recall'
    >();
  });
});

describe('retraction/v1 — predicate body shape', () => {
  it('accepts a minimal required-only body', () => {
    const body: RetractionV1 = {
      retracted_subject: {
        bundle_id: '0192cae6-000b-7000-8000-000000000000' as Uuidv7,
      },
      reason_class: 'partner-request',
      retracted_at: '2026-06-01T12:00:00Z' as RetractionV1['retracted_at'],
    };
    expect(body.reason_class).toBe('partner-request');
  });

  it('accepts full optional fields (reason, retracted_by, multi-field subject)', () => {
    const subject: RetractedSubject = {
      bundle_id: '0192cae6-000b-7000-8000-000000000000' as Uuidv7,
      storage_key: 's3://bundles/x' as StorageKey,
      content_hash: ('sha256:' + '3'.repeat(64)) as Sha256Prefixed,
    };
    const body: RetractionV1 = {
      retracted_subject: subject,
      reason_class: 'methodology-error',
      reason: 'eval set had a labeling bug',
      retracted_at: '2026-06-01T12:00:00Z' as RetractionV1['retracted_at'],
      retracted_by: 'ops@intentsolutions.io',
    };
    expect(body.retracted_subject.storage_key).toBe('s3://bundles/x');
  });

  it('Statement carries _type, predicateType, predicate', () => {
    expectTypeOf<RetractionV1Statement>()
      .toHaveProperty('_type')
      .toEqualTypeOf<'https://in-toto.io/Statement/v1'>();
    expectTypeOf<RetractionV1Statement>()
      .toHaveProperty('predicateType')
      .toEqualTypeOf<typeof RETRACTION_V1_URI>();
  });
});
