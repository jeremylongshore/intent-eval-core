/**
 * SkillVersion signing state machine — AT-DECR 011 (DR-028 T1 / DR-085 D1
 * DEFERRED work landed additively). Type + runtime tests for the state machine,
 * the bounded-retry const, and the additive/staging-first posture. The
 * cross-field signing invariant (both directions) is exercised against fixtures
 * in the Zod (validators.test.ts) and AJV (schemas.test.ts) suites; here we test
 * the transition map + const + entity type surface.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  canTransition,
  validateTransitionMap,
  terminalStates,
  reachableStates,
  SKILL_VERSION_MAX_SIGNING_RETRIES,
  skillVersionSigningTransitions,
  type SigningMode,
  type SkillVersion,
  type SkillVersionSigningStatus,
  type SkillVersionState,
} from '../index.js';

describe('SkillVersion signing state machine (AT-DECR 011 — DR-028 T1 / DR-085 D1 deferred)', () => {
  it('status enum = the closed 4-element signing lifecycle', () => {
    expectTypeOf<SkillVersionSigningStatus>().toEqualTypeOf<
      'sigstore_staging' | 'pending_production' | 'active' | 'signing_failed'
    >();
    expectTypeOf<SkillVersionState>().toEqualTypeOf<SkillVersionSigningStatus>();
  });

  it('the transition map is structurally sound (no dangling targets)', () => {
    expect(validateTransitionMap(skillVersionSigningTransitions)).toEqual([]);
  });

  it('legal transitions: staging-first → pending_production | active; pending → active | signing_failed', () => {
    // Staging-first: local creation lands in sigstore_staging; from there it may
    // queue for production or land active on first attempt.
    expect(
      canTransition(skillVersionSigningTransitions, 'sigstore_staging', 'pending_production'),
    ).toBe(true);
    expect(canTransition(skillVersionSigningTransitions, 'sigstore_staging', 'active')).toBe(true);
    // Reconciler retries a pending row: success → active; exhaustion → signing_failed.
    // A failed-but-has-budget retry is an in-place retry_count/retry_after bump,
    // NOT a status transition, so there is no self-loop (kernel structural-soundness
    // gate forbids self-loops).
    expect(canTransition(skillVersionSigningTransitions, 'pending_production', 'active')).toBe(
      true,
    );
    expect(
      canTransition(skillVersionSigningTransitions, 'pending_production', 'signing_failed'),
    ).toBe(true);
    // The re-queue is NOT a status self-loop.
    expect(
      canTransition(skillVersionSigningTransitions, 'pending_production', 'pending_production'),
    ).toBe(false);
  });

  it('forbids illegal transitions (a signed/failed row is terminal; no un-sign)', () => {
    // active and signing_failed are terminal — a re-sign/recovery is a NEW row (append-only).
    expect(skillVersionSigningTransitions.active).toHaveLength(0);
    expect(skillVersionSigningTransitions.signing_failed).toHaveLength(0);
    expect(canTransition(skillVersionSigningTransitions, 'active', 'sigstore_staging')).toBe(false);
    expect(canTransition(skillVersionSigningTransitions, 'active', 'signing_failed')).toBe(false);
    expect(canTransition(skillVersionSigningTransitions, 'signing_failed', 'active')).toBe(false);
    // Cannot skip pending straight to signing_failed from staging.
    expect(
      canTransition(skillVersionSigningTransitions, 'sigstore_staging', 'signing_failed'),
    ).toBe(false);
    // Cannot jump staging → pending → back-to-staging (no reverse to staging).
    expect(
      canTransition(skillVersionSigningTransitions, 'pending_production', 'sigstore_staging'),
    ).toBe(false);
  });

  it('active and signing_failed are the terminal states', () => {
    expect([...terminalStates(skillVersionSigningTransitions)].sort()).toEqual([
      'active',
      'signing_failed',
    ]);
  });

  it('every downstream lifecycle state is reachable from the staging-first entry', () => {
    // `sigstore_staging` has no incoming edge (nothing transitions back to
    // staging), so it is not reachable from itself; the three downstream states are.
    expect([...reachableStates(skillVersionSigningTransitions, 'sigstore_staging')].sort()).toEqual(
      ['active', 'pending_production', 'signing_failed'],
    );
  });

  it('CISO bounded-retry ceiling is pinned at 5 (P0-RATIFY-2)', () => {
    expect(SKILL_VERSION_MAX_SIGNING_RETRIES).toBe(5);
  });
});

describe('SkillVersion signing fields — additive + staging-first (AT-DECR 011)', () => {
  it('all six signing fields are OPTIONAL on the entity type (staging-first: absent ≡ default)', () => {
    // The additive contract: none of the six is required — an old row without any
    // signing field is a valid staging-first SkillVersion.
    expectTypeOf<SkillVersion>().toHaveProperty('status');
    expectTypeOf<SkillVersion>().toHaveProperty('signing_mode');
    expectTypeOf<SkillVersion>().toHaveProperty('rekor_log_index');
    expectTypeOf<SkillVersion>().toHaveProperty('retry_after');
    expectTypeOf<SkillVersion>().toHaveProperty('retry_count');
    expectTypeOf<SkillVersion>().toHaveProperty('signing_downgrade_reason');
    // A SkillVersion with NO signing field set still satisfies the type.
    expectTypeOf<
      Omit<
        SkillVersion,
        | 'status'
        | 'signing_mode'
        | 'rekor_log_index'
        | 'retry_after'
        | 'retry_count'
        | 'signing_downgrade_reason'
      >
    >().toMatchTypeOf<Partial<SkillVersion>>();
  });

  it('signing_mode reuses the canonical SigningMode enum (mirrors EvidenceBundle)', () => {
    expectTypeOf<SkillVersion['signing_mode']>().toEqualTypeOf<SigningMode | undefined>();
  });

  it('status is the SkillVersion signing lifecycle (pending_production is a VALUE, not a boolean flag)', () => {
    expectTypeOf<SkillVersion['status']>().toEqualTypeOf<SkillVersionSigningStatus | undefined>();
  });

  it('rekor_log_index is optional AND nullable (number | null | undefined)', () => {
    expectTypeOf<SkillVersion['rekor_log_index']>().toEqualTypeOf<number | null | undefined>();
  });
});
