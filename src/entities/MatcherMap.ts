/**
 * MatcherMap — reusable input→behavior pattern definition.
 *
 * Blueprint B § 2.3. Mapped to failure-mode class via `mm_class` field.
 * State machine: draft → published → deprecated.
 *
 * Immutable once published; revisions = new row + incremented version.
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
 * Typed input pattern. Blueprint B § 2.3 specifies "typed pattern (regex,
 * JSON Schema fragment, structural matcher)" without enumerating the type
 * union. Modeled as opaque object for v0.1; refinement deferred to a
 * follow-up bead that ships the pattern-class enum.
 */
export type MatcherInputPattern = Readonly<Record<string, unknown>>;

/**
 * Typed expected behavior. Same deferral rationale as MatcherInputPattern —
 * Blueprint B mentions "exact match, semantic match, contract-conformance,
 * redaction-confirmed" as examples but doesn't lock the enum.
 */
export type MatcherExpectedBehavior = Readonly<Record<string, unknown>>;

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
