/**
 * EvalSpec — declarative evaluation specification.
 *
 * Blueprint B § 2.1. State machine: draft → published → deprecated
 * (deprecated reversible to published).
 *
 * SpecRevision event ID derivation: sha256(spec_id || version || content_hash)[:16].
 * Mutable in `draft`; immutable once `published`.
 */

import type {
  ActorIdentity,
  KebabSlug,
  Rfc3339,
  Sha256,
  SemVer,
  Uuidv7,
} from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/** State machine states for EvalSpec (Blueprint B § 2.1). */
export type EvalSpecState = 'draft' | 'published' | 'deprecated';

/** Allowed transitions for EvalSpec state machine. */
export const evalSpecTransitions: TransitionMap<EvalSpecState> = {
  draft: ['published'],
  published: ['deprecated'],
  deprecated: ['published'], // reversible per Blueprint B
} as const;

/** Aggregation rule for matcher decisions within a spec. */
export type ScoringAggregationRule = 'majority' | 'unanimous' | 'weighted';

/**
 * Scoring configuration. Inner shape beyond `aggregation_rule` is deferred to
 * a follow-up bead; modeled here as a discriminated container so additional
 * fields can be added without breaking consumers.
 */
export interface ScoringConfig {
  readonly aggregation_rule: ScoringAggregationRule;
  /** Tool-specific scoring parameters (e.g., weights, thresholds). */
  readonly [key: string]: unknown;
}

/**
 * Runtime ceiling declarations applied per Run. Shape per Blueprint B § 2.1
 * ("token_ceiling, wall_clock_ceiling, memory_ceiling, concurrency_hint").
 */
export interface RuntimeLimits {
  readonly token_ceiling: number;
  readonly wall_clock_ceiling_ms: number;
  readonly memory_ceiling_mb: number;
  readonly concurrency_hint: number;
}

/**
 * Composition DAG declaration. Inner shape (nodes, edges, ordering) deferred
 * to a follow-up bead; modeled as opaque object for v0.1. Blueprint B § 1.3
 * references the DAG model.
 */
export type CompositionDag = Readonly<Record<string, unknown>>;

/**
 * Typed assertion expression. Per Blueprint B § 2.1, assertions are "typed"
 * but the type system itself is deferred. Modeled as opaque object for v0.1.
 */
export type AssertionExpression = Readonly<Record<string, unknown>>;

/**
 * EvalSpec — single declarative spec, identified by (id, version).
 *
 * Content-addressed via `content_hash` of the canonical-form serialization.
 * Field semantics per Blueprint B § 2.1 prose table.
 */
export interface EvalSpec {
  /** UUIDv7 PK. Stable across version bumps of the same logical spec. */
  readonly id: Uuidv7;
  /** SemVer disambiguator. Together with id forms the natural unique key. */
  readonly version: SemVer;
  /** Kebab-case slug. */
  readonly name: KebabSlug;
  /** One-paragraph description. */
  readonly description: string;
  /** MatcherMap FKs. */
  readonly matchers: readonly Uuidv7[];
  /** Typed assertion expressions evaluated against tool output. */
  readonly assertions: readonly AssertionExpression[];
  /** Scoring aggregation across matcher decisions. */
  readonly scoring: ScoringConfig;
  /** DAG declaration per Blueprint B § 1.3. */
  readonly composition: CompositionDag;
  /** SkillSnapshot.combined_sha values this spec targets. */
  readonly expected_artifacts: readonly Sha256[];
  /** Resource ceilings applied per EvalRun. */
  readonly runtime_limits: RuntimeLimits;
  /** Allowlist of provider IDs. */
  readonly provider_constraints: readonly string[];
  /** RFC 3339 UTC timestamp. */
  readonly created_at: Rfc3339;
  /** Author of the spec revision. */
  readonly created_by: ActorIdentity;
  /** sha256 of canonical-form serialization. */
  readonly content_hash: Sha256;
}
