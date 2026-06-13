/**
 * OpenTelemetry semantic-convention attribute-name constants for the Intent
 * Eval Platform runtime events — v1.
 *
 * Source of truth: `schemas/v1/otel-attributes.yaml`. These constants are the
 * TypeScript projection of that pin; the drift guard in
 * `src/otel/v1/__tests__/attributes.test.ts` parses the YAML and asserts every
 * key here matches a key there (and vice versa). Editing one without the other
 * fails CI.
 *
 * WHY this exists (Gregg finding #2 — most-costly-to-recover-from): Blueprint B
 * (intent-eval-lab `000-docs/012-AT-ARCH-platform-runtime-blueprint.md`) § 4.3
 * specifies the runtime OTel events (`runtime.dedup`, `replay.verdict`,
 * `replay.input.drift`, `bundle.emission.refused`) but leaves their ATTRIBUTE
 * NAMES unpinned. Five emitters — j-rig, audit-harness, intent-rollout-gate,
 * the lab tests, and this kernel — will otherwise drift on key spelling
 * (`eval_run_id` vs `evalRunId` vs `run.id`). Pinning the names HERE, before
 * the kernel's next release ships, makes every emitter import one canonical
 * spelling instead of re-typing it.
 *
 * Naming authority: ONE form per attribute, chosen as OTel-idiomatic dotted
 * lowercase (`eval.run_id`, `bundle.predicate_uri`, `gate.decision`). Blueprint
 * B § 7.2 binds the paired normative 'must emit' list on the lab side, citing
 * this module's source YAML for spelling; § 7.2 also forbids an OTel attribute
 * namespace under `labs.intentsolutions.io` — these keys carry no domain.
 *
 * This module imports nothing from the rest of `src/` (pure string + literal
 * unions), keeping it outside the kernel's npm-import layering rules.
 */

// ─── Shared attributes (carried across multiple events) ─────────────────────

/**
 * Attribute names shared across multiple runtime events. Pinned once so every
 * event spells the key identically. `as const` preserves the literal types so
 * downstream code gets compile-time key checking.
 */
export const OTEL_SHARED_ATTRIBUTES = {
  /** UUIDv7 of the EvalRun the event belongs to — the idempotency key. */
  evalRunId: 'eval.run_id',
  /** UUIDv7 of the SessionTrace span the event hangs under. */
  evalSessionTraceId: 'eval.session_trace_id',
  /** W3C Trace Context trace-id propagated from API ingress. */
  traceId: 'trace.id',
} as const;

// ─── Per-event attribute sets (§ 4.3 enumerated runtime events) ─────────────

/**
 * `runtime.dedup` — worker skipped a duplicate EvalRun whose idempotency key is
 * already terminal-or-later (Blueprint B § 3.1).
 */
export const OTEL_RUNTIME_DEDUP_ATTRIBUTES = {
  evalRunId: OTEL_SHARED_ATTRIBUTES.evalRunId,
  cacheHit: 'runtime.dedup.cache_hit',
  terminalState: 'runtime.dedup.terminal_state',
} as const;

/**
 * `replay.verdict` — replay verification re-executed an EvalRun and diffed
 * outputs (Blueprint B § 3.2). `verdict` is a closed enum.
 */
export const OTEL_REPLAY_VERDICT_ATTRIBUTES = {
  evalRunId: OTEL_SHARED_ATTRIBUTES.evalRunId,
  verdict: 'replay.verdict',
  isReplay: 'replay.is_replay',
  originalTraceId: 'replay.original_trace_id',
  fidelityLevel: 'replay.fidelity_level',
} as const;

/** Closed verdict enum for `replay.verdict` (Blueprint B § 3.2 line 367). */
export const OTEL_REPLAY_VERDICT_VALUES = ['match', 'semantic_match', 'drift', 'failed'] as const;
export type OtelReplayVerdict = (typeof OTEL_REPLAY_VERDICT_VALUES)[number];

/**
 * `replay.input.drift` — a replay's frozen inputs no longer match the original
 * (Blueprint B § 3.2 line 365). Drift is a first-class signal.
 */
export const OTEL_REPLAY_INPUT_DRIFT_ATTRIBUTES = {
  evalRunId: OTEL_SHARED_ATTRIBUTES.evalRunId,
  originalTraceId: 'replay.original_trace_id',
  driftedField: 'replay.input.drifted_field',
} as const;

/** Closed enum of the five frozen-input dimensions (§ 3.2 line 365). */
export const OTEL_REPLAY_DRIFTED_FIELD_VALUES = [
  'skill_snapshot_sha',
  'eval_spec_content_hash',
  'tokenized_inputs',
  'tool_versions',
  'environment_block',
] as const;
export type OtelReplayDriftedField = (typeof OTEL_REPLAY_DRIFTED_FIELD_VALUES)[number];

/**
 * `bundle.emission.refused` — a tool tried to emit an Evidence Bundle row that
 * failed one of the four evidence contracts (Blueprint B § 3.3 line 392).
 */
export const OTEL_BUNDLE_EMISSION_REFUSED_ATTRIBUTES = {
  evalRunId: OTEL_SHARED_ATTRIBUTES.evalRunId,
  predicateUri: 'bundle.predicate_uri',
  refusedContract: 'bundle.emission.refused_contract',
  refusedReason: 'bundle.emission.refused_reason',
} as const;

/** Closed enum of the four evidence contracts (§ 3.3). */
export const OTEL_BUNDLE_REFUSED_CONTRACT_VALUES = [
  'subject',
  'predicate_type',
  'predicate_body',
  'signature',
] as const;
export type OtelBundleRefusedContract = (typeof OTEL_BUNDLE_REFUSED_CONTRACT_VALUES)[number];

// ─── Event-name registry ────────────────────────────────────────────────────

/**
 * The discrete OTel event NAMES Blueprint B § 4.3 + § 3.x enumerate. Keys are
 * the canonical dotted event names; the drift guard asserts this set equals the
 * `events:` keys in `otel-attributes.yaml`.
 */
export const OTEL_RUNTIME_EVENTS = {
  runtimeDedup: 'runtime.dedup',
  replayVerdict: 'replay.verdict',
  replayInputDrift: 'replay.input.drift',
  bundleEmissionRefused: 'bundle.emission.refused',
} as const;
export type OtelRuntimeEventName = (typeof OTEL_RUNTIME_EVENTS)[keyof typeof OTEL_RUNTIME_EVENTS];

/**
 * Map from each canonical event name to its full attribute-name set. Lets an
 * emitter look up "what attributes does `replay.verdict` carry?" by name, and
 * lets the drift guard walk every (event → attribute) pair against the YAML.
 */
export const OTEL_EVENT_ATTRIBUTE_SETS = {
  [OTEL_RUNTIME_EVENTS.runtimeDedup]: OTEL_RUNTIME_DEDUP_ATTRIBUTES,
  [OTEL_RUNTIME_EVENTS.replayVerdict]: OTEL_REPLAY_VERDICT_ATTRIBUTES,
  [OTEL_RUNTIME_EVENTS.replayInputDrift]: OTEL_REPLAY_INPUT_DRIFT_ATTRIBUTES,
  [OTEL_RUNTIME_EVENTS.bundleEmissionRefused]: OTEL_BUNDLE_EMISSION_REFUSED_ATTRIBUTES,
} as const;
