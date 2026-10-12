/**
 * Declarative trajectory assertions (bd_000-projects-dn6j.15).
 * Execution, evidence completeness and fail-closed outcomes belong to consumers.
 * Class-2 proposal: 000-docs/014-AT-DECR-pair-trajectory-assertions-2026-10-12.md.
 */

export const TRAJECTORY_ASSERTION_CLASSES = [
  'tool-called',
  'tool-not-called',
  'order-before',
  'file-exists',
  'file-matches-sha-in',
] as const;

export type TrajectoryAssertionClass = (typeof TRAJECTORY_ASSERTION_CLASSES)[number];

/** Nonempty tool name and optional nonempty substring of its recorded input. */
export interface TrajectoryToolMatcher {
  readonly tool: string;
  readonly input_contains?: string;
}

export interface ToolCalledTarget extends TrajectoryToolMatcher {
  /** Positive safe integer; omission preserves the executor's existing semantics. */
  readonly min_count?: number;
}

export interface OrderBeforeTarget {
  readonly first: TrajectoryToolMatcher;
  readonly then: TrajectoryToolMatcher;
}

/** Exactly one nonempty literal path or ECMAScript pattern source (no flags). */
export type TrajectoryFileSelector =
  | { readonly path: string; readonly pattern?: never }
  | { readonly path?: never; readonly pattern: string };

export type FileExistsTarget = TrajectoryFileSelector & { readonly produced?: boolean };

export type FileMatchesShaInTarget = TrajectoryFileSelector & {
  /** Nonempty, not slash-absolute, no slash-delimited '..'; preserves `{path}`. */
  readonly in: string;
};

/** Missing or invalid evidence must remain a failure even when `negate` is true. */
export type TrajectoryAssertion = {
  readonly negate?: boolean;
  readonly extension?: never;
} & (
  | { readonly class: 'tool-called'; readonly target: ToolCalledTarget }
  | { readonly class: 'tool-not-called'; readonly target: TrajectoryToolMatcher }
  | { readonly class: 'order-before'; readonly target: OrderBeforeTarget }
  | { readonly class: 'file-exists'; readonly target: FileExistsTarget }
  | { readonly class: 'file-matches-sha-in'; readonly target: FileMatchesShaInTarget }
);

/**
 * Narrow an assertion already validated by AssertionExpressionSchema or EvalSpecSchema.
 * This checks the discriminator, not the target. Accepts public Zod parse output.
 * Opaque extensions remain extensions even if their class matches a named class.
 */
export function isTrajectoryAssertion(assertion: {
  readonly class: string;
  readonly target: unknown;
  readonly extension?: unknown;
}): assertion is TrajectoryAssertion {
  if ('extension' in assertion) return false;
  return TRAJECTORY_ASSERTION_CLASSES.some((name) => assertion.class === name);
}
