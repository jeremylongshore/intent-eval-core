/**
 * ToolInvocation — single tool / provider call recorded under a SessionTrace.
 *
 * Blueprint B § 2.11. Single terminal state `invoked`. Immutable at
 * creation. Retries land as new rows (with `retry_attempt` incremented),
 * never mutations.
 *
 * **HARD RULE per § 2.11**: persisting a credential-shaped string in
 * `args` or `result_summary` MUST cause the runtime to reject the row
 * AND fail the parent EvalRun with `terminal_reason = 'credential_leak_
 * detected'`. The kernel does NOT enforce the credential check (that's
 * runtime sanitization in `audit-harness` — epic iel-E10 / iaj-E06a) —
 * it just types the shape that downstream sanitizers operate on.
 */

import type { OtelSpanId, Rfc3339, Sha256, SemVer, StorageKey, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/** Single terminal state per Blueprint B § 2.11. */
export type ToolInvocationState = 'invoked';

/** No transitions — `invoked` is terminal. Retries = new rows. */
export const toolInvocationTransitions: TransitionMap<ToolInvocationState> = {
  invoked: [],
} as const;

/**
 * Sanitized argument payload. Blueprint B § 2.11 says "JSONB (sanitized;
 * credentials redacted)". Inner shape varies per tool — modeled as
 * `Record<string, unknown>` because typing every tool's args at this
 * layer is out of scope (consumers may project narrower types).
 *
 * Sanitization is a RUNTIME concern (downstream of this kernel).
 */
export type ToolInvocationArgs = Readonly<Record<string, unknown>>;

/**
 * Sanitized result-summary payload. Same shape rationale as
 * `ToolInvocationArgs`. Large result bodies are stored separately in
 * object storage at `result_storage_key`; this field carries only the
 * summary that fits inline.
 */
export type ToolInvocationResultSummary = Readonly<Record<string, unknown>>;

/**
 * Tool-error record. Blueprint B § 2.11 specifies the SHAPE
 * (`{enum_class, message}`) but does NOT enumerate `enum_class` values —
 * that's tool-specific. Modeled as `string` here; downstream tools may
 * brand to a narrower literal union at their layer.
 */
export interface ToolInvocationError {
  /**
   * Tool-defined error class. NOT a closed enum at the kernel layer —
   * each tool defines its own set (e.g., `network.timeout`,
   * `provider.rate_limited`, `tool.crashed`).
   */
  readonly enum_class: string;
  readonly message: string;
}

/**
 * ToolInvocation — single tool / provider call.
 *
 * Field semantics per Blueprint B § 2.11 prose table.
 *
 * `tool_id` follows the colon-separated convention seen in spec examples
 * (`audit-harness:escape-scan`, `provider:anthropic:claude-sonnet-4-5`)
 * but the format is NOT spec-bound at this layer.
 */
export interface ToolInvocation {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → SessionTrace.id. */
  readonly session_trace_id: Uuidv7;

  /** OTel parent span identifier for trace stitching. */
  readonly parent_span_id: OtelSpanId;

  /**
   * Tool identifier. Convention (from § 2.11 prose examples):
   *   - In-platform tools: `<tool-name>:<subcommand>` (e.g.,
   *     `audit-harness:escape-scan`)
   *   - Provider calls: `provider:<vendor>:<model>` (e.g.,
   *     `provider:anthropic:claude-sonnet-4-5`)
   * Format NOT enforced at this layer — string passthrough.
   */
  readonly tool_id: string;

  readonly tool_version: SemVer;

  /** Sanitized args. */
  readonly args: ToolInvocationArgs;

  /** sha256 of canonical-form args (for replay-determinism). */
  readonly args_hash: Sha256;

  /** Sanitized result summary (inline-fit portion). */
  readonly result_summary: ToolInvocationResultSummary;

  /** sha256 of canonical-form result body. */
  readonly result_hash: Sha256;

  /**
   * Object-storage key for the full result body when too large to inline.
   * Null when the inline `result_summary` is the complete result.
   */
  readonly result_storage_key: StorageKey | null;

  readonly invoked_at: Rfc3339;

  /** Wall-clock latency in milliseconds. */
  readonly latency_ms: number;

  /** FK → CostRecord.id (1:0..1 per § 6.2 ERD). */
  readonly cost_record_ref: Uuidv7;

  /** Populated when the invocation errored; null on success. */
  readonly error: ToolInvocationError | null;

  /** Retry attempt number (0-indexed; first try = 0). */
  readonly retry_attempt: number;
}
