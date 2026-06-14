/**
 * EvalSpec — declarative evaluation specification.
 *
 * Blueprint B § 2.1. State machine: draft → published → deprecated
 * (deprecated reversible to published).
 *
 * SpecRevision event ID derivation: sha256(spec_id || version || content_hash)[:16].
 * Mutable in `draft`; immutable once `published`.
 */

import type { ActorIdentity, KebabSlug, Rfc3339, Sha256, SemVer, Uuidv7 } from '../primitives.js';
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
 * Dimension over which `weighted` aggregation distributes weight
 * (deferral-C lockup; bd_000-projects-21re). The `weighted` rule needs to
 * know WHAT the weights are over; this names the v1 set:
 *   - `matcher` — weight per referenced MatcherMap decision
 *   - `mm-class` — weight per failure-mode class (MM-1..MM-6)
 *   - `judge` — weight per JudgeDecision input
 */
export type ScoringWeightDimension = 'matcher' | 'mm-class' | 'judge';

/**
 * A single weight entry under the `weighted` aggregation rule. `key`
 * identifies the weighted unit (a MatcherMap id, MM-class literal, or judge
 * identity, per `dimension`); `weight` is its relative contribution. Weights
 * are normalized by their sum at scoring time (the kernel SAYS the shape; it
 * does not run the normalization — that is runtime).
 */
export interface ScoringWeight {
  readonly key: string;
  /** Non-negative relative weight; normalized by the sum at scoring time. */
  readonly weight: number;
}

/**
 * Scoring configuration.
 *
 * `aggregation_rule` is the spec-bound field per Blueprint B § 2.1. The
 * `weights`/`tiebreaker` fields are the deferral-C lockup
 * (bd_000-projects-21re): the `weighted` variant's per-unit weights are now
 * NAMED (dimension + entries), and a deterministic `tiebreaker` resolves
 * equal-aggregate ties — both additive and OPTIONAL, so existing
 * `majority`/`unanimous` specs stay valid unchanged.
 *
 * **Thresholds/confidence-floors are NOT here, by binding.** Per § 7.6 the
 * ship/no-ship threshold semantics live in consumer-side `tests/TESTING.md`
 * policy, NEVER on the predicate/spec surface — the deferral-C AC reinforces
 * this separation rather than importing thresholds into the kernel.
 *
 * The `extensions` bag remains the typed escape hatch: consumers MAY carry
 * tool-specific scoring metadata, but it MUST NOT be used for ship/no-ship
 * decisions (mirrors the § 7.4 `metadata` field rule for gate-result/v1).
 */
export interface ScoringConfig {
  readonly aggregation_rule: ScoringAggregationRule;
  /**
   * Weight dimension for the `weighted` rule. REQUIRED when `weights` is
   * present; ignored by `majority`/`unanimous`.
   */
  readonly weight_dimension?: ScoringWeightDimension;
  /**
   * Per-unit weights for the `weighted` rule. Each `key` is interpreted per
   * `weight_dimension`. Omitted under `majority`/`unanimous`.
   */
  readonly weights?: readonly ScoringWeight[];
  /**
   * Deterministic tiebreaker when two aggregate outcomes tie:
   *   - `fail-closed` — a tie resolves to FAIL (conservative default sense)
   *   - `fail-open`   — a tie resolves to PASS
   *   - `first-listed`— the first listed matcher's decision wins
   * NOT a threshold — it resolves an exact-tie ambiguity, it does not set a
   * pass bar (that stays consumer-side per § 7.6).
   */
  readonly tiebreaker?: 'fail-closed' | 'fail-open' | 'first-listed';
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
 * Assertion-class discriminator (deferral-A lockup; bd_000-projects-gzgj).
 *
 * Blueprint B § 2.1 names assertions as "typed expressions" but stopped short
 * of enumerating the class union. This is the v1 canonical class set, locked
 * additively per the Class-2 ISEDC pair-DR routing the bead calls for:
 *
 *   - `output-equals`       — observed output equals an expected literal value
 *   - `output-contains`     — observed output contains an expected substring/element
 *   - `output-matches`      — observed output matches a regex pattern
 *   - `schema-conforms`     — observed output conforms to a JSON Schema fragment
 *   - `judge-verdict`       — a JudgeDecision verdict gates the assertion
 *   - `matcher-satisfied`   — a referenced MatcherMap's expected_behavior holds
 *
 * The trailing extension slot (`AssertionExpressionExtension`) keeps the union
 * OPEN per § 7.2 backward-compat: new named classes are added here (a code
 * change + Class-2 DR), while tool-specific classes ride the extension variant
 * WITHOUT a kernel change. Adding a NAMED class to this enum requires a
 * Class-2 ISEDC pair Decision Record (touches the canonical-domain schema
 * surface per DR-010 § 7 Q6).
 */
export type AssertionClass =
  | 'output-equals'
  | 'output-contains'
  | 'output-matches'
  | 'schema-conforms'
  | 'judge-verdict'
  | 'matcher-satisfied';

/** The v1 named assertion-class set as a runtime tuple (for iteration/enum). */
export const ASSERTION_CLASSES = [
  'output-equals',
  'output-contains',
  'output-matches',
  'schema-conforms',
  'judge-verdict',
  'matcher-satisfied',
] as const satisfies readonly AssertionClass[];

/**
 * Named assertion expression — discriminated on `class`.
 *
 * Per-class `target` payload shape is deliberately NOT codified by Blueprint B
 * (an `output-equals` target is probably a literal; a `schema-conforms` target
 * a JSON Schema fragment; a `judge-verdict` target a verdict literal — but the
 * spec does not say). It is carried as `unknown` so the per-engagement DRs that
 * codify each class can refine it at the validator layer (epic iec-E04) without
 * a kernel break. `negate` flips the assertion sense (default false).
 */
export interface NamedAssertionExpression {
  readonly class: AssertionClass;
  /** Class-specific target payload — refined per-class at the validator layer. */
  readonly target: unknown;
  /** When true, the assertion passes iff the underlying predicate is FALSE. */
  readonly negate?: boolean;
}

/**
 * Open extension assertion expression. The `class` string MUST NOT collide
 * with any `AssertionClass` literal — discriminating consumers check the named
 * set first, then fall through to extension handling (mirrors the
 * `MatcherExpectedBehavior` extension pattern).
 */
export interface AssertionExpressionExtension {
  readonly class: string;
  readonly target: unknown;
  readonly negate?: boolean;
  readonly extension: true;
}

/**
 * Typed assertion expression. Blueprint B § 2.1 says only "typed assertion
 * expression"; the v1 class union is now LOCKED additively (deferral-A,
 * bd_000-projects-gzgj) as a discriminated union of named classes plus an open
 * extension slot. Consumers brand the per-class `target` to a specific grammar
 * at the validator layer (epic iec-E04).
 */
export type AssertionExpression = NamedAssertionExpression | AssertionExpressionExtension;

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
  /**
   * RESERVED multi-tenancy slot (deferral-G; bd_000-projects-k0fj). OPTIONAL
   * and additive per Blueprint B § 7.2 — present so a future multi-tenant
   * deployment does NOT force a consumer-side migration. The kernel reserves
   * the SLOT only; tenant-isolation SEMANTICS (scoping, RLS, cross-tenant
   * visibility) remain out-of-scope for v1 and are deferred to a future DR.
   * v1 single-tenant specs simply omit it.
   */
  readonly tenant_id?: Uuidv7;
}
