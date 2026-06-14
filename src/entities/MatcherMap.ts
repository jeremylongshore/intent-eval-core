/**
 * MatcherMap — reusable input→behavior pattern definition.
 *
 * Blueprint B § 2.3. Mapped to failure-mode class via `mm_class` field.
 * State machine: draft → published → deprecated.
 *
 * Immutable once published; revisions = new row + incremented version.
 */

import type { ActorIdentity, KebabSlug, Rfc3339, Sha256, SemVer, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * Matcher Map class enum.
 *
 * MM-1 through MM-6 are the v1 canonical set per Blueprint B § 2.3.
 * Extension path: `CONTRIBUTING-failure-shape.md` (deferred bead) ratifies
 * MM-7+ additions via ISEDC review.
 *
 * Encoded as a string literal union — extending requires a code change here
 * AND a corresponding FailureTaxonomy entry. This intentional rigidity is
 * what keeps the kernel canonical.
 */
export type MmClass = 'MM-1' | 'MM-2' | 'MM-3' | 'MM-4' | 'MM-5' | 'MM-6';

/** State machine states for MatcherMap. */
export type MatcherMapState = 'draft' | 'published' | 'deprecated';

/** Allowed transitions. Published → deprecated is one-way for MatcherMap. */
export const matcherMapTransitions: TransitionMap<MatcherMapState> = {
  draft: ['published'],
  published: ['deprecated'],
  deprecated: [],
} as const;

/**
 * Typed input pattern — closed three-variant discriminated union per
 * Blueprint B § 2.3 (line 159: "regex, JSON Schema fragment, or structural
 * matcher").
 *
 * Adding a fourth variant requires Class-1 ISEDC convening (touches
 * canonical-domain schema surface).
 *
 * Per-variant payload notes:
 *   - `regex` — regex flavor (RE2/PCRE/ECMA) NOT spec-named. Validators at
 *     the runtime layer pick a flavor; replay-determinism is enforced via
 *     MatcherMap.content_hash (§ 2.3 line 163), not via flavor lock-in here.
 *   - `json-schema` — JSON Schema draft NOT spec-named. Recommendation:
 *     draft 2020-12 (current open standard). Schema body modeled as
 *     `Record<string, unknown>` because typing JSON Schema in TS is
 *     itself a non-trivial type-system problem (out of scope for v1).
 *   - `structural` — payload is genuinely undefined in Blueprint B.
 *     Modeled as `unknown` to surface the deferral. Lock when an
 *     engagement defines it.
 */
export type MatcherInputPattern =
  | {
      readonly kind: 'regex';
      readonly pattern: string;
      readonly flags?: string;
    }
  | {
      readonly kind: 'json-schema';
      readonly schema: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'structural';
      /**
       * Structural-matcher payload (deferral-B lockup; bd_000-projects-ra9a).
       * Blueprint B § 2.3 left this undefined; it is now LOCKED as a
       * conjunction of path-anchored structural constraints over the candidate
       * input's parsed tree. See {@link StructuralMatcher}.
       */
      readonly matcher: StructuralMatcher;
    };

/**
 * Comparison operator for a single structural constraint (deferral-B lockup;
 * bd_000-projects-ra9a). Closed v1 set:
 *   - `exists`       — the path resolves to a value (the value is irrelevant)
 *   - `absent`       — the path does NOT resolve
 *   - `equals`       — resolved value deep-equals `value`
 *   - `type-is`      — resolved value's JSON type equals `value` (a type tag)
 *   - `matches`      — resolved STRING value matches the regex in `value`
 *   - `length-equals`— resolved array/string length equals `value`
 */
export type StructuralOp = 'exists' | 'absent' | 'equals' | 'type-is' | 'matches' | 'length-equals';

/** The v1 structural-op set as a runtime tuple. */
export const STRUCTURAL_OPS = [
  'exists',
  'absent',
  'equals',
  'type-is',
  'matches',
  'length-equals',
] as const satisfies readonly StructuralOp[];

/**
 * A single structural constraint: anchor a `path` into the candidate's parsed
 * tree, apply `op`, optionally compare against `value`.
 *
 * `path` is a dotted/bracketed accessor (e.g. `result.items[0].status`); the
 * exact accessor grammar is the runtime's concern (the kernel SAYS the shape,
 * it does not walk the tree). `value` is required for the value-bearing ops
 * (`equals`/`type-is`/`matches`/`length-equals`) and omitted for the
 * presence ops (`exists`/`absent`) — enforced at the validator layer.
 */
export interface StructuralConstraint {
  readonly path: string;
  readonly op: StructuralOp;
  readonly value?: unknown;
}

/**
 * Structural matcher — a conjunction (AND) of path-anchored constraints. All
 * constraints must hold for the structural match to succeed. `mode` is fixed
 * to `all` in v1 (every constraint must hold); the field is present so a
 * future `any` (OR) mode lands additively without a shape break.
 */
export interface StructuralMatcher {
  readonly mode: 'all';
  readonly constraints: readonly StructuralConstraint[];
}

/**
 * Expected-behavior variant identifiers blessed by Blueprint B § 2.3
 * (line 159: "exact match, semantic match, contract-conformance,
 * redaction-confirmed, etc.").
 *
 * The trailing `etc.` is load-bearing — the spec explicitly leaves the
 * enum OPEN to additions that follow § 7.2 backward-compat policy
 * (adding new optional enum values MUST NOT require a URI bump).
 *
 * The kernel exports the v1 named set as `MatcherExpectedBehaviorKindV1`
 * for type-narrowing on the known cases. Open extension is encoded via
 * the union below.
 */
export type MatcherExpectedBehaviorKindV1 =
  | 'exact'
  | 'semantic'
  | 'contract-conformance'
  | 'redaction-confirmed';

/**
 * Typed expected behavior. Discriminated union of the v1 named variants
 * plus an open extension slot.
 *
 * Per-variant payload shapes are deliberately NOT specified by Blueprint B
 * (`exact` is probably parameter-free; `semantic` probably needs a
 * similarity threshold or judge identity; `contract-conformance` probably
 * references a schema; `redaction-confirmed` probably references a
 * redaction rule — but the spec does not say). Modeled as `unknown` to
 * preserve room for the per-engagement DRs that will codify them.
 *
 * The extension variant (`kind` typed as `string & {extension: true}`) is
 * an intentional escape valve that does NOT collide at the type level with
 * the v1 literal union — discriminating against `MatcherExpectedBehaviorKindV1`
 * narrows correctly.
 */
export type MatcherExpectedBehavior =
  | {
      readonly kind: MatcherExpectedBehaviorKindV1;
      readonly payload?: unknown;
    }
  | {
      /**
       * Extension variants. The string MUST NOT collide with any v1 literal
       * in `MatcherExpectedBehaviorKindV1` — discriminating consumers should
       * check the v1 set first, then fall through to extension handling.
       */
      readonly kind: string;
      readonly payload: unknown;
      readonly extension: true;
    };

/**
 * MatcherMap — reusable input→behavior definition referenced by EvalSpec.
 *
 * Field semantics per Blueprint B § 2.3 prose table.
 */
export interface MatcherMap {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;
  /** Failure-mode class anchor. */
  readonly mm_class: MmClass;
  /** Kebab-case slug for human reference. */
  readonly name: KebabSlug;
  /** Typed input pattern. */
  readonly input_pattern: MatcherInputPattern;
  /** Typed expected behavior. */
  readonly expected_behavior: MatcherExpectedBehavior;
  /** SemVer. */
  readonly version: SemVer;
  /** sha256 of canonical-form serialization. */
  readonly content_hash: Sha256;
  /** Human description. */
  readonly description: string;
  readonly created_at: Rfc3339;
  readonly created_by: ActorIdentity;
}
