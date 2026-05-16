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
  deprecated: ['published'], // reversible per Blueprint B § 2.1
} as const;

/** Aggregation rule for matcher decisions within a spec (§ 2.1, closed enum). */
export type ScoringAggregationRule = 'majority' | 'unanimous' | 'weighted';

/**
 * Scoring configuration.
 *
 * `aggregation_rule` is the ONLY spec-bound field per Blueprint B § 2.1. The
 * `weighted` variant implies per-something weights, but the spec never names
 * a `weights` field, what they are over (matchers? judges? MM-classes?), or
 * how they normalize. Tiebreakers, thresholds, and confidence floors are
 * also intentionally unspecified — § 7.6 cordons threshold semantics OFF
 * the predicate URI surface and INTO consumer-side `tests/TESTING.md`
 * policy. **Adding fields here without ISEDC review is forbidden.**
 *
 * The `extensions` bag is the typed escape hatch: consumers MAY carry
 * tool-specific scoring metadata, but it MUST NOT be used for ship/no-ship
 * decisions (mirrors the § 7.4 `metadata` field rule for gate-result/v1).
 */
export interface ScoringConfig {
  readonly aggregation_rule: ScoringAggregationRule;
  /**
   * Tool-specific scoring metadata. Intentionally typed as `unknown` —
   * Blueprint B does not bless any inner shape, and codifying one here
   * would invent semantics the blueprint did not authorize.
   */
  readonly extensions?: Readonly<Record<string, unknown>>;
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
 * Typed assertion expression. Blueprint B § 2.1 says only "typed assertion
 * expression"; no class enum, no payload grammar, no discriminator field
 * is named. The spec extraction explicitly directs **STOP — do not invent
 * an assertion-class enum** (extension would be a Class-2 ISEDC pair DR).
 *
 * Modeled as `unknown` to surface the deferral. Consumers brand to a
 * specific assertion grammar at the validator layer (epic iec-E04).
 */
export type AssertionExpression = unknown;

/**
 * Composition DAG node — every node is either an EvalRun or a
 * ToolInvocation per Blueprint B § 1.3. Two-element closed enum.
 *
 * Wire format (adjacency vs edge list) is engineer's choice; this kernel
 * picks adjacency with `id` + `kind` + reference because it minimizes
 * cycle-detection cost and matches the textual examples in § 1.3.
 */
export interface CompositionNode {
  /** Local-to-DAG node identifier (unique within composition). */
  readonly id: string;
  /** Node type — drives runtime dispatch (Blueprint B § 1.3 line 92). */
  readonly kind: 'eval_run' | 'tool_invocation';
  /** Reference to the entity this node materializes. */
  readonly ref: Uuidv7;
}

/**
 * Composition DAG edge `kind` enum (Blueprint B § 1.3 lines 94–96, closed).
 *
 * Semantics:
 *   - `feeds`     — upstream output → downstream input
 *   - `gates`     — upstream PASS/FAIL is a precondition for downstream execution
 *   - `enriches`  — upstream output appended to downstream context; downstream runs regardless
 *
 * **Failure-propagation rules (§ 1.3 line 100, normative):**
 *   - `gates` upstream FAIL  → downstream → `skipped_due_to_gate` (terminal)
 *   - `feeds` upstream FAIL  → downstream → `archived_failed` with terminal_reason=`upstream_feed_failed`
 *   - `enriches` upstream FAIL → downstream proceeds; missing-enrichment recorded in RuntimeReceipt
 *
 * **Adding a fourth edge kind requires Class-1 ISEDC convening** per
 * DR-010 § 7 Q6 (touches canonical-domain schema surface).
 */
export type CompositionEdgeKind = 'feeds' | 'gates' | 'enriches';

/** Composition DAG edge — typed dependency declaration. */
export interface CompositionEdge {
  /** Source node id (CompositionNode.id). */
  readonly from: string;
  /** Target node id (CompositionNode.id). */
  readonly to: string;
  /** Edge type. Drives runtime failure-propagation per § 1.3 line 100. */
  readonly kind: CompositionEdgeKind;
}

/**
 * Composition DAG declaration per Blueprint B § 1.3.
 *
 * **Validation contract** (§ 1.3 line 98): runtime topologically sorts the
 * graph; cycles are detected at EvalSpec validation time (before any node
 * executes) and rejected at submission with `400 Bad Request`.
 *
 * The kernel does NOT enforce the acyclic constraint at the type level —
 * that's a validator concern (epic iec-E04) and a runtime concern. This
 * shape just makes the graph well-formed.
 */
export interface CompositionDag {
  readonly nodes: readonly CompositionNode[];
  readonly edges: readonly CompositionEdge[];
}

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
