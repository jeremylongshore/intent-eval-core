/**
 * Concrete lifecycle TransitionMaps for the retry, rollback, and promotion
 * machines (epic iec-E05 / aft — children E05b `h99` retry+backoff and E05c
 * `f4x` rollback+promotion).
 *
 * Blueprint B § 3.1 (intent-eval-lab `000-docs/012-AT-ARCH-platform-runtime-
 * blueprint.md`) enumerates FOUR formal state machines the runtime enforces:
 * the EvalRun machine (already shipped as `evalRunTransitions` in
 * `entities/EvalRun.ts`) plus the retry, rollback, and promotion policy
 * machines described in § 3 lines 353-357. The shared-semantics layer
 * (`semantics.ts`, E05a/E05d) is generic over ANY `TransitionMap<S>`, so these
 * three machines are covered by `assertTransition`/`terminalStates`/
 * `reachableStates`/`validateTransitionMap`/`toMermaid` the moment they declare
 * a map. This module declares those maps.
 *
 * Boundary discipline (FORBIDDEN.md Axis 2 + `.dependency-cruiser.cjs`
 * `state-machines-pure`): part of the `state-machines/` LEAF layer. Imports
 * NOTHING inside `src/` except `./types.js`, and no npm package. The retry
 * BACKOFF POLICY is a pinned set of plain-data constants — the kernel SAYS what
 * the schedule is, it does NOT sleep, read a clock, or generate jitter (those
 * are runtime EXECUTION, forbidden here; they live in the runtime producer).
 *
 * These are CROSS-CUTTING policy machines, not entity rows — they have no
 * database table of their own, so they live in `state-machines/`, not
 * `entities/`. (The EvalRun machine is an entity machine and correctly lives
 * with its entity.)
 */

import type { TransitionMap } from './types.js';

// ───────────────────────────── Retry machine (E05b / h99) ──────────────────

/**
 * Retry-attempt lifecycle states (Blueprint B § 3 line 353).
 *
 * The retry machine governs a single retryable failure's attempt cycle. A
 * transient failure schedules a backoff wait (`pending_backoff`), the delay
 * elapses (`retrying`), and the attempt either succeeds (`succeeded`,
 * terminal), fails-but-has-budget (back to `pending_backoff`), or exhausts the
 * retry budget (`exhausted`, terminal — the EvalRun then moves to
 * `archived_failed`). A `dead_lettered` terminal captures the § 3 line 353
 * dead-letter classification: a non-transient `reason` (credential leak, run
 * timeout, queued timeout) is NEVER retried.
 */
export type RetryState =
  | 'pending_backoff'
  | 'retrying'
  | 'succeeded'
  | 'exhausted'
  | 'dead_lettered';

/**
 * Retry transition table (Blueprint B § 3 line 353).
 *
 *   pending_backoff → retrying        (backoff delay elapsed)
 *   pending_backoff → dead_lettered   (reason in dead-letter set; never retried)
 *   retrying        → succeeded       (attempt succeeded)
 *   retrying        → pending_backoff (attempt failed; retry_count < max_retries)
 *   retrying        → exhausted       (attempt failed; retry_count >= max_retries)
 *
 * Terminal: `succeeded`, `exhausted`, `dead_lettered`.
 */
export const retryTransitions: TransitionMap<RetryState> = {
  pending_backoff: ['retrying', 'dead_lettered'],
  retrying: ['succeeded', 'pending_backoff', 'exhausted'],
  succeeded: [],
  exhausted: [],
  dead_lettered: [],
} as const;

/**
 * Exponential-backoff-with-jitter POLICY constants (Blueprint B § 3 line 353).
 *
 * The kernel PINS the schedule so every runtime producer computes the same
 * delay for the same attempt — it does NOT sleep, read a clock, or draw the
 * jitter (runtime execution, forbidden here). The nth-attempt nominal delay is
 * `min(max_delay_ms, initial_delay_ms * backoff_factor ** attempt)`; the
 * producer adds jitter and waits.
 */
export const RETRY_BACKOFF_POLICY = {
  /** Delay before the first retry, in milliseconds. */
  initial_delay_ms: 1000,
  /** Multiplier applied per attempt for exponential growth. */
  backoff_factor: 2.0,
  /** Ceiling on a single backoff delay, in milliseconds. */
  max_delay_ms: 60_000,
  /** Default retry budget. */
  max_retries: 5,
  /** Hard cap on a per-EvalSpec `max_retries` override. */
  max_retries_hard_cap: 20,
} as const;

/**
 * The closed set of EvalRun terminal reasons that are STRUCTURAL, not transient
 * (Blueprint B § 3 line 353). A failure carrying one of these is dead-lettered,
 * never retried — the `pending_backoff → dead_lettered` edge.
 */
export const DEAD_LETTER_REASONS = [
  'credential_leak_detected',
  'run_timeout_elapsed',
  'queued_timeout_elapsed',
] as const;

export type DeadLetterReason = (typeof DEAD_LETTER_REASONS)[number];

/**
 * True if `reason` is a structural (never-retried) failure cause. Pure
 * membership check over the pinned {@link DEAD_LETTER_REASONS} set.
 */
export function isDeadLetterReason(reason: string): reason is DeadLetterReason {
  return (DEAD_LETTER_REASONS as readonly string[]).includes(reason);
}

// ─────────────────────────── Rollback machine (E05c / f4x) ──────────────────

/**
 * Rollback-status lifecycle states (Blueprint B § 3 line 355).
 *
 * A rollback is a Class-1 governance event. Once initiated against a
 * `rollback_target_version` (a SkillSnapshot SHA or RegressionPack ancestor),
 * the status walks `pending → executing → completed | failed`. A `completed`
 * rollback's `post_rollback_verification` EvalRun confirms the target version
 * produces expected outcomes; a failed verification surfaces as a CRITICAL OTel
 * event (modeled here as the `executing → failed` / `verifying → failed` edges
 * — the producer pages the on-call surface, which is runtime, not kernel).
 */
export type RollbackState = 'pending' | 'executing' | 'verifying' | 'completed' | 'failed';

/**
 * Rollback transition table (Blueprint B § 3 line 355).
 *
 *   pending   → executing            (rollback begins)
 *   pending   → failed               (rollback aborted before execution)
 *   executing → verifying            (production reference switched back; verify it)
 *   executing → failed               (rollback execution failed)
 *   verifying → completed            (post_rollback_verification passed)
 *   verifying → failed               (post_rollback_verification failed; CRITICAL)
 *
 * Terminal: `completed`, `failed`.
 */
export const rollbackTransitions: TransitionMap<RollbackState> = {
  pending: ['executing', 'failed'],
  executing: ['verifying', 'failed'],
  verifying: ['completed', 'failed'],
  completed: [],
  failed: [],
} as const;

// ────────────────────────── Promotion machine (E05c / f4x) ──────────────────

/**
 * Promotion-status lifecycle states (Blueprint B § 3 line 357).
 *
 * A new SkillSnapshot starts as a `candidate` (exists, no production reference).
 * The RolloutGate's verdict advances it: an `advisory` verdict moves it to
 * `advisory` (engineers reviewing); a `ship` verdict + a human approver moves it
 * to `approved`; the production reference update lands it at `promoted`
 * (terminal). A Class-1 ISEDC convening MAY suspend a promotion mid-flight via
 * `isedc_suspension`, transitioning ANY non-terminal state to
 * `suspended_for_review` (terminal — the suspended promotion is abandoned; a
 * fresh `candidate` starts the cycle anew if it later proceeds).
 */
export type PromotionState =
  | 'candidate'
  | 'advisory'
  | 'approved'
  | 'promoted'
  | 'suspended_for_review';

/**
 * Promotion transition table (Blueprint B § 3 line 357).
 *
 *   candidate → advisory               (RolloutGate emitted an `advisory` verdict)
 *   candidate → approved               (RolloutGate emitted `ship` + human approval)
 *   candidate → suspended_for_review   (isedc_suspension)
 *   advisory  → approved               (review cleared + `ship` verdict + approval)
 *   advisory  → suspended_for_review   (isedc_suspension)
 *   approved  → promoted               (production reference updated to new SHA)
 *   approved  → suspended_for_review   (isedc_suspension)
 *
 * Terminal: `promoted`, `suspended_for_review`.
 *
 * The `isedc_suspension` "any non-terminal state → suspended_for_review" hook
 * is encoded as the explicit `suspended_for_review` target on every non-terminal
 * source — there is no transition OUT of `promoted` (terminal) or
 * `suspended_for_review` (terminal), so the hook reaches exactly the
 * in-flight states.
 */
export const promotionTransitions: TransitionMap<PromotionState> = {
  candidate: ['advisory', 'approved', 'suspended_for_review'],
  advisory: ['approved', 'suspended_for_review'],
  approved: ['promoted', 'suspended_for_review'],
  promoted: [],
  suspended_for_review: [],
} as const;
