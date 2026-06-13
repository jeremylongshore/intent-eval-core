/**
 * Tests for the concrete retry/rollback/promotion lifecycle maps
 * (epic iec-E05 / aft — E05b `h99` retry+backoff, E05c `f4x` rollback+promotion).
 *
 * The maps are declared OVER the shipped shared-semantics layer
 * (`semantics.ts`), so the tests prove each map (a) is structurally sound under
 * `validateTransitionMap`, (b) has exactly the terminal states Blueprint B § 3
 * enumerates, (c) reaches every non-entry state from its entry point, and
 * (d) composes with `assertTransition` / `toMermaid` — i.e. the E05b/E05c maps
 * are first-class consumers of the E05a/E05d semantics.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  assertTransition,
  IllegalTransitionError,
  isTerminal,
  reachableStates,
  terminalStates,
  toMermaid,
  unreachableStates,
  validateTransitionMap,
} from './semantics.js';
import type { TransitionMap } from './types.js';
import {
  DEAD_LETTER_REASONS,
  isDeadLetterReason,
  promotionTransitions,
  RETRY_BACKOFF_POLICY,
  retryTransitions,
  rollbackTransitions,
  type DeadLetterReason,
  type PromotionState,
  type RetryState,
  type RollbackState,
} from './lifecycle-maps.js';

describe('retry machine (iec-E05b / h99)', () => {
  it('is structurally sound', () => {
    expect(validateTransitionMap(retryTransitions)).toEqual([]);
  });

  it('has exactly the three terminal states Blueprint B § 3 enumerates', () => {
    expect([...terminalStates(retryTransitions)].sort()).toEqual(
      ['dead_lettered', 'exhausted', 'succeeded'].sort(),
    );
    expect(isTerminal(retryTransitions, 'succeeded')).toBe(true);
    expect(isTerminal(retryTransitions, 'pending_backoff')).toBe(false);
  });

  it('reaches every non-entry state from pending_backoff', () => {
    expect(unreachableStates(retryTransitions, 'pending_backoff')).toEqual([]);
    // pending_backoff is reachable from ITSELF via the retrying→pending_backoff
    // cycle, so the forward closure includes it (per reachableStates semantics).
    expect([...reachableStates(retryTransitions, 'pending_backoff')].sort()).toEqual(
      ['dead_lettered', 'exhausted', 'pending_backoff', 'retrying', 'succeeded'].sort(),
    );
  });

  it('permits the backoff→retry→backoff loop and forbids skipping the wait', () => {
    expect(() => assertTransition(retryTransitions, 'pending_backoff', 'retrying')).not.toThrow();
    expect(() => assertTransition(retryTransitions, 'retrying', 'pending_backoff')).not.toThrow();
    expect(() => assertTransition(retryTransitions, 'pending_backoff', 'succeeded')).toThrow(
      IllegalTransitionError,
    );
  });

  it('dead-letters only the structural reasons, never retries them', () => {
    expect(() => assertTransition(retryTransitions, 'pending_backoff', 'dead_lettered')).not.toThrow();
    // A terminal state has no exits.
    expect(() => assertTransition(retryTransitions, 'dead_lettered', 'retrying')).toThrow(
      IllegalTransitionError,
    );
  });

  it('renders a deterministic mermaid diagram', () => {
    const out = toMermaid(retryTransitions, { initial: 'pending_backoff', title: 'Retry' });
    expect(out).toContain('title: Retry');
    expect(out).toContain('[*] --> pending_backoff');
    expect(out).toContain('pending_backoff --> retrying');
    expect(out).toContain('succeeded --> [*]');
  });
});

describe('retry backoff policy (iec-E05b / h99)', () => {
  it('pins the Blueprint B § 3 line 353 constants', () => {
    expect(RETRY_BACKOFF_POLICY.initial_delay_ms).toBe(1000);
    expect(RETRY_BACKOFF_POLICY.backoff_factor).toBe(2.0);
    expect(RETRY_BACKOFF_POLICY.max_delay_ms).toBe(60_000);
    expect(RETRY_BACKOFF_POLICY.max_retries).toBe(5);
    expect(RETRY_BACKOFF_POLICY.max_retries_hard_cap).toBe(20);
  });

  it('enumerates the dead-letter reason set', () => {
    expect([...DEAD_LETTER_REASONS].sort()).toEqual(
      ['credential_leak_detected', 'queued_timeout_elapsed', 'run_timeout_elapsed'].sort(),
    );
  });

  it('isDeadLetterReason recognizes structural reasons and rejects transient ones', () => {
    expect(isDeadLetterReason('credential_leak_detected')).toBe(true);
    expect(isDeadLetterReason('run_timeout_elapsed')).toBe(true);
    expect(isDeadLetterReason('worker_crash_exhausted')).toBe(false);
    expect(isDeadLetterReason('judge_unavailable_exhausted')).toBe(false);
  });

  it('narrows the type on a positive guard result', () => {
    const reason = 'queued_timeout_elapsed' as string;
    if (isDeadLetterReason(reason)) {
      expectTypeOf(reason).toEqualTypeOf<DeadLetterReason>();
    }
  });
});

describe('rollback machine (iec-E05c / f4x)', () => {
  it('is structurally sound', () => {
    expect(validateTransitionMap(rollbackTransitions)).toEqual([]);
  });

  it('has exactly the two terminal states Blueprint B § 3 enumerates', () => {
    expect([...terminalStates(rollbackTransitions)].sort()).toEqual(['completed', 'failed'].sort());
    expect(isTerminal(rollbackTransitions, 'completed')).toBe(true);
    expect(isTerminal(rollbackTransitions, 'executing')).toBe(false);
  });

  it('reaches every non-entry state from pending', () => {
    expect(unreachableStates(rollbackTransitions, 'pending')).toEqual([]);
  });

  it('walks pending→executing→verifying→completed', () => {
    expect(() => assertTransition(rollbackTransitions, 'pending', 'executing')).not.toThrow();
    expect(() => assertTransition(rollbackTransitions, 'executing', 'verifying')).not.toThrow();
    expect(() => assertTransition(rollbackTransitions, 'verifying', 'completed')).not.toThrow();
  });

  it('can fail from any non-terminal state (failed verification is CRITICAL)', () => {
    expect(() => assertTransition(rollbackTransitions, 'pending', 'failed')).not.toThrow();
    expect(() => assertTransition(rollbackTransitions, 'executing', 'failed')).not.toThrow();
    expect(() => assertTransition(rollbackTransitions, 'verifying', 'failed')).not.toThrow();
  });

  it('forbids transitions out of a completed rollback', () => {
    expect(() => assertTransition(rollbackTransitions, 'completed', 'executing')).toThrow(
      IllegalTransitionError,
    );
  });
});

describe('promotion machine (iec-E05c / f4x)', () => {
  it('is structurally sound', () => {
    expect(validateTransitionMap(promotionTransitions)).toEqual([]);
  });

  it('has exactly the two terminal states Blueprint B § 3 enumerates', () => {
    expect([...terminalStates(promotionTransitions)].sort()).toEqual(
      ['promoted', 'suspended_for_review'].sort(),
    );
    expect(isTerminal(promotionTransitions, 'promoted')).toBe(true);
    expect(isTerminal(promotionTransitions, 'candidate')).toBe(false);
  });

  it('reaches every non-entry state from candidate', () => {
    expect(unreachableStates(promotionTransitions, 'candidate')).toEqual([]);
  });

  it('walks candidate→advisory→approved→promoted', () => {
    expect(() => assertTransition(promotionTransitions, 'candidate', 'advisory')).not.toThrow();
    expect(() => assertTransition(promotionTransitions, 'advisory', 'approved')).not.toThrow();
    expect(() => assertTransition(promotionTransitions, 'approved', 'promoted')).not.toThrow();
  });

  it('allows the candidate→approved fast path (ship verdict + approval)', () => {
    expect(() => assertTransition(promotionTransitions, 'candidate', 'approved')).not.toThrow();
  });

  it('suspends from every in-flight state via the isedc_suspension hook', () => {
    const inFlight: PromotionState[] = ['candidate', 'advisory', 'approved'];
    for (const from of inFlight) {
      expect(() =>
        assertTransition(promotionTransitions, from, 'suspended_for_review'),
      ).not.toThrow();
    }
  });

  it('forbids escaping the two terminal states', () => {
    expect(() => assertTransition(promotionTransitions, 'promoted', 'candidate')).toThrow(
      IllegalTransitionError,
    );
    expect(() =>
      assertTransition(promotionTransitions, 'suspended_for_review', 'candidate'),
    ).toThrow(IllegalTransitionError);
  });
});

describe('type-level surface', () => {
  it('every map is a TransitionMap over its state union', () => {
    expectTypeOf(retryTransitions).toMatchTypeOf<TransitionMap<RetryState>>();
    expectTypeOf(rollbackTransitions).toMatchTypeOf<TransitionMap<RollbackState>>();
    expectTypeOf(promotionTransitions).toMatchTypeOf<TransitionMap<PromotionState>>();
  });
});
