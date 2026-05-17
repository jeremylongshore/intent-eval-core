/**
 * CostRecord — single cost / resource-attribution row.
 *
 * Blueprint B § 2.12. Single terminal state `recorded`. Immutable at
 * creation. Rollups (cross-Run, cross-period) land as separate rows
 * with `attribution_class = 'system'`.
 *
 * **NOT replay-deterministic** — costs vary with cache state, pricing
 * changes, seed routing, and provider-side variability. Don't gate on
 * cost equality during replay.
 *
 * Predicate URI when emitted: `cost-attribution/v1` (Blueprint B § 2.12,
 * currently `sigstore_staging`).
 */

import type { MicroUsd, Rfc3339, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * Cost attribution class enum (Blueprint B § 2.12, closed 7-element set).
 *
 * Drives downstream rollup queries (e.g., "show me all `provider` costs
 * for tenant X this month").
 *
 * - `run`                  — attributable to a specific EvalRun
 * - `provider`             — provider-side API spend (cross-Run aggregation)
 * - `judge`                — LLM judge inference cost
 * - `replay`               — cost of re-executing a Run from a session trace
 * - `cache_decision`       — overhead of the prompt/semantic-cache lookup
 * - `optimizer_experiment` — cost incurred by an A/B optimizer trial
 * - `system`               — platform overhead / rollup row
 */
export type CostAttributionClass =
  | 'run'
  | 'provider'
  | 'judge'
  | 'replay'
  | 'cache_decision'
  | 'optimizer_experiment'
  | 'system';

/** Single terminal state per Blueprint B § 2.12. */
export type CostRecordState = 'recorded';

/** No transitions — `recorded` is terminal. */
export const costRecordTransitions: TransitionMap<CostRecordState> = {
  recorded: [],
} as const;

/**
 * CostRecord — single cost / resource-usage attribution row.
 *
 * Field semantics per Blueprint B § 2.12 prose table.
 *
 * Both `eval_run_id` and `tool_invocation_id` are nullable — system-level
 * rollups (attribution_class='system') often have neither; run-level
 * rollups have only `eval_run_id`; tool-level rows have both.
 */
export interface CostRecord {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id. Null for system-level rollups. */
  readonly eval_run_id: Uuidv7 | null;

  /** FK → ToolInvocation.id. Null for run-level / system rollups. */
  readonly tool_invocation_id: Uuidv7 | null;

  /** Cost classification. Drives rollup queries. */
  readonly attribution_class: CostAttributionClass;

  /**
   * Provider identifier (e.g., `anthropic`, `openai`). Null when the cost
   * is not provider-attributable (e.g., `system` rollups, internal
   * compute).
   */
  readonly provider_id: string | null;

  /** Total tokens consumed. Equals `prompt_tokens + completion_tokens`. */
  readonly tokens_consumed: number;

  readonly prompt_tokens: number;
  readonly completion_tokens: number;

  /**
   * Tokens served from cache (subset of prompt_tokens). Drives
   * cache-effectiveness analysis (Blueprint B § 4.2 names two caches:
   * provider-side `prompt cache` and platform-side `semantic cache`).
   */
  readonly cached_tokens: number;

  readonly wall_clock_ms: number;

  /**
   * External API cost in micro-USD for sub-cent precision. Per Blueprint
   * B § 2.12 — micro-USD is NORMATIVE, not engineer's choice. Convert to
   * USD at the display layer (`cost / 1_000_000`).
   */
  readonly external_api_cost_micro_usd: MicroUsd;

  readonly recorded_at: Rfc3339;

  /**
   * Version tag of the cost-basis lookup table used to compute
   * `external_api_cost_micro_usd`. The table itself is forward-deferred
   * to iel-E14b (economics-and-cost-governance doctrine bundle).
   */
  readonly cost_basis_version: string;
}
