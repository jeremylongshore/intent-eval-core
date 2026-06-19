/**
 * Generic state-machine encoding.
 *
 * Each entity that has a state machine (per Blueprint B § 2 + § 3) exports:
 *   - a state literal union type
 *   - a const `transitions` map of {from: readonly to[]} for runtime checks
 *
 * Transitions are deliberately encoded as readonly tuples so the type checker
 * can narrow on them. Runtime callers should use the exported helper to
 * validate a candidate transition rather than reaching into the map directly.
 */

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

/**
 * Returns true if `from → to` is a declared transition in the map.
 * Pure type-level check at compile time; runtime check at runtime.
 */
export function canTransition<S extends string>(map: TransitionMap<S>, from: S, to: S): boolean {
  return (map[from] as readonly S[]).includes(to);
}
