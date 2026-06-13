/**
 * Shared lifecycle-state-machine semantics (epic iec-E05 / aft).
 *
 * Every canonical entity that has a lifecycle (Blueprint B § 2 + § 3) already
 * exports a `TransitionMap<S>` (see `src/entities/*.ts`). Until iec-E05 these
 * maps were consumed only by the single `canTransition` predicate. This module
 * adds the SHARED SEMANTICS the epic calls for — the operations more than one
 * downstream consumer needs over ANY transition map (retry, rollback, and
 * promotion machines are just additional `TransitionMap<S>` instances, so they
 * are covered the moment they declare a map):
 *
 *   - `assertTransition` — validate-or-throw (the mutating counterpart to the
 *     boolean `canTransition`)
 *   - `terminalStates` / `isTerminal` — derive the frozen states
 *   - `reachableStates` / `unreachableStates` — forward reachability closure
 *   - `validateTransitionMap` — structural integrity of a hand-authored map
 *   - `toMermaid` — a pure `stateDiagram-v2` string ("visualizer" per E05a)
 *
 * Boundary discipline (FORBIDDEN.md Axis 2 + `.dependency-cruiser.cjs`
 * `state-machines-pure`): this file is part of the `state-machines/` LEAF
 * layer. It imports NOTHING inside `src/` except `./types.js`, and no npm
 * package. Every helper is generic over `TransitionMap<S>` so it works on all
 * 13 entity maps without importing any entity. No generation, no I/O, no clock
 * — pure functions over plain data, which is exactly the kernel's role.
 *
 * Reference: Blueprint B § 3 (lifecycle tables) + the canonical-glossary
 * "lifecycle state machine" entry.
 */

import type { TransitionMap } from './types.js';

/**
 * Thrown by {@link assertTransition} when a candidate `from → to` move is not
 * declared in the transition map. Carries the offending pair so callers can
 * surface a precise diagnostic without re-deriving it.
 */
export class IllegalTransitionError<S extends string> extends Error {
  readonly from: S;
  readonly to: S;
  readonly allowed: readonly S[];

  constructor(from: S, to: S, allowed: readonly S[]) {
    super(
      `Illegal state transition: ${from} → ${to}. ` +
        (allowed.length > 0
          ? `Allowed from ${from}: ${allowed.join(', ')}.`
          : `${from} is terminal — no transitions permitted.`),
    );
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
    this.allowed = allowed;
  }
}

/**
 * Returns true if `from → to` is a declared transition in the map.
 *
 * Re-exported convenience alias of the canonical {@link import('./types.js').canTransition}
 * is intentionally NOT provided here — keep the single source in `types.ts`.
 * This module's `assertTransition` is the throwing counterpart.
 */
export function assertTransition<S extends string>(map: TransitionMap<S>, from: S, to: S): void {
  const allowed = map[from] as readonly S[];
  if (!allowed.includes(to)) {
    throw new IllegalTransitionError(from, to, allowed);
  }
}

/**
 * The terminal states of a machine — those with an empty out-transition array.
 * Once an entity reaches a terminal state it is frozen (Blueprint B § 3.1).
 *
 * Returned in the map's own key-insertion order (stable, deterministic).
 */
export function terminalStates<S extends string>(map: TransitionMap<S>): readonly S[] {
  return (Object.keys(map) as S[]).filter((s) => (map[s] as readonly S[]).length === 0);
}

/** True if `state` is terminal (no declared out-transitions) in `map`. */
export function isTerminal<S extends string>(map: TransitionMap<S>, state: S): boolean {
  return (map[state] as readonly S[]).length === 0;
}

/**
 * Forward reachability closure: every state reachable from `from` by following
 * one or more declared transitions. `from` itself is NOT included unless the
 * machine can cycle back to it. Deterministic BFS; order is discovery order.
 */
export function reachableStates<S extends string>(map: TransitionMap<S>, from: S): readonly S[] {
  const seen = new Set<S>();
  const order: S[] = [];
  const queue: S[] = [...(map[from] as readonly S[])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    order.push(next);
    for (const onward of map[next] as readonly S[]) {
      if (!seen.has(onward)) queue.push(onward);
    }
  }
  return order;
}

/**
 * States in the machine that are NOT reachable from `from` (and are not `from`
 * itself). Useful for dead-state detection in a hand-authored map: a non-`from`
 * state that no path reaches from the canonical entry point is suspicious.
 */
export function unreachableStates<S extends string>(map: TransitionMap<S>, from: S): readonly S[] {
  const reachable = new Set<S>(reachableStates(map, from));
  return (Object.keys(map) as S[]).filter((s) => s !== from && !reachable.has(s));
}

/** A structural problem found by {@link validateTransitionMap}. */
export interface TransitionMapDefect<S extends string> {
  /** The state whose declaration is defective. */
  readonly state: S;
  /** The target that is the problem. */
  readonly target: S;
  /** Why it is a defect. */
  readonly kind: 'unknown-target' | 'self-loop' | 'duplicate-target';
}

/**
 * Structural integrity check for a hand-authored transition map. Catches the
 * three authoring mistakes a `TransitionMap` literal can carry that the type
 * system does NOT (the value type only constrains members to be of type `S`,
 * not that every target is also a declared key):
 *
 *   - `unknown-target` — a `to` value that is not itself a key of the map
 *   - `self-loop` — a state listing itself as a target (almost always a typo;
 *     a deliberate self-loop is rare in these lifecycle machines)
 *   - `duplicate-target` — the same target listed twice for one state
 *
 * Returns the (possibly empty) list of defects. Empty list ⇒ structurally
 * sound. This is the kernel-side counterpart to the E05d "state-transition
 * test harness": a consumer can assert `validateTransitionMap(m).length === 0`.
 */
export function validateTransitionMap<S extends string>(
  map: TransitionMap<S>,
): readonly TransitionMapDefect<S>[] {
  const keys = new Set<S>(Object.keys(map) as S[]);
  const defects: TransitionMapDefect<S>[] = [];
  for (const state of Object.keys(map) as S[]) {
    const seen = new Set<S>();
    for (const target of map[state] as readonly S[]) {
      if (!keys.has(target)) {
        defects.push({ state, target, kind: 'unknown-target' });
      } else if (target === state) {
        defects.push({ state, target, kind: 'self-loop' });
      } else if (seen.has(target)) {
        defects.push({ state, target, kind: 'duplicate-target' });
      }
      seen.add(target);
    }
  }
  return defects;
}

/** Options for {@link toMermaid}. */
export interface MermaidOptions {
  /**
   * Title rendered as a Mermaid `title:` front-matter line. Omitted when
   * absent. The string is used verbatim — callers own escaping.
   */
  readonly title?: string;
  /**
   * The canonical entry state. When provided, a `[*] --> <initial>` edge is
   * emitted so the diagram shows where the lifecycle begins.
   */
  readonly initial?: string;
  /**
   * When true (default), terminal states get a `<state> --> [*]` edge marking
   * them as accepting/final. Set false to omit the final markers.
   */
  readonly markTerminal?: boolean;
}

/**
 * Render a transition map as a Mermaid `stateDiagram-v2` source string — the
 * "visualizer" called for in E05a. Pure: returns a deterministic string and
 * touches no I/O. Consumers (docs builds, dashboards) own how it is displayed.
 *
 * The output is stable in the map's key-insertion order so a diagram diff is
 * meaningful in review.
 */
export function toMermaid<S extends string>(
  map: TransitionMap<S>,
  opts: MermaidOptions = {},
): string {
  const markTerminal = opts.markTerminal ?? true;
  const lines: string[] = [];
  if (opts.title !== undefined) {
    lines.push('---', `title: ${opts.title}`, '---');
  }
  lines.push('stateDiagram-v2');
  if (opts.initial !== undefined) {
    lines.push(`  [*] --> ${opts.initial}`);
  }
  for (const from of Object.keys(map) as S[]) {
    for (const to of map[from] as readonly S[]) {
      lines.push(`  ${from} --> ${to}`);
    }
  }
  if (markTerminal) {
    for (const t of terminalStates(map)) {
      lines.push(`  ${t} --> [*]`);
    }
  }
  return lines.join('\n');
}
