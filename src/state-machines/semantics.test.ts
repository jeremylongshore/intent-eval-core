/**
 * Tests for the shared lifecycle-state-machine semantics (epic iec-E05 / aft).
 *
 * Exercises the generic helpers against (a) a hand-built fixture machine that
 * covers every branch and (b) the real `evalRunTransitions` map to prove the
 * semantics layer composes with the canonical entity machines.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  assertTransition,
  IllegalTransitionError,
  isTerminal,
  reachableStates,
  terminalStates,
  toMermaid,
  unreachableStates,
  validateTransitionMap,
  type MermaidOptions,
  type TransitionMapDefect,
} from './semantics.js';
import type { TransitionMap } from './types.js';
import { evalRunTransitions } from '../entities/EvalRun.js';

type S = 'a' | 'b' | 'c' | 'done';

/** Linear-with-branch fixture: a→b→c→done, a→done (skip), done terminal. */
const fixture: TransitionMap<S> = {
  a: ['b', 'done'],
  b: ['c'],
  c: ['done'],
  done: [],
} as const;

describe('assertTransition (iec-E05)', () => {
  it('returns void for a declared transition', () => {
    expect(assertTransition(fixture, 'a', 'b')).toBeUndefined();
    expect(assertTransition(fixture, 'c', 'done')).toBeUndefined();
  });

  it('throws IllegalTransitionError for an undeclared transition', () => {
    expect(() => assertTransition(fixture, 'a', 'c')).toThrow(IllegalTransitionError);
  });

  it('error carries from/to/allowed and a non-terminal message', () => {
    try {
      assertTransition(fixture, 'a', 'c');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalTransitionError);
      const e = err as IllegalTransitionError<S>;
      expect(e.from).toBe('a');
      expect(e.to).toBe('c');
      expect(e.allowed).toEqual(['b', 'done']);
      expect(e.name).toBe('IllegalTransitionError');
      expect(e.message).toContain('Allowed from a: b, done');
    }
  });

  it('error message names a terminal source explicitly', () => {
    try {
      assertTransition(fixture, 'done', 'a');
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as IllegalTransitionError<S>;
      expect(e.allowed).toEqual([]);
      expect(e.message).toContain('done is terminal');
    }
  });
});

describe('terminalStates / isTerminal (iec-E05)', () => {
  it('derives the single terminal of the fixture', () => {
    expect(terminalStates(fixture)).toEqual(['done']);
  });

  it('isTerminal is true only for empty out-arrays', () => {
    expect(isTerminal(fixture, 'done')).toBe(true);
    expect(isTerminal(fixture, 'a')).toBe(false);
  });

  it('derives all three EvalRun terminals from the real map', () => {
    expect([...terminalStates(evalRunTransitions)].sort()).toEqual(
      ['archived', 'archived_failed', 'skipped_due_to_gate'].sort(),
    );
  });
});

describe('reachableStates / unreachableStates (iec-E05)', () => {
  it('computes the forward closure in discovery order', () => {
    // From a: b, done discovered first (a's out-list), then c (via b).
    expect(reachableStates(fixture, 'a')).toEqual(['b', 'done', 'c']);
  });

  it('from a leaf there is nothing reachable', () => {
    expect(reachableStates(fixture, 'done')).toEqual([]);
  });

  it('skips already-seen states when an onward edge revisits them (queue branch)', () => {
    // a→b, a→c, b→c, c→b creates revisits that must not loop forever.
    const diamond: TransitionMap<'a' | 'b' | 'c'> = {
      a: ['b', 'c'],
      b: ['c'],
      c: ['b'],
    } as const;
    expect(reachableStates(diamond, 'a')).toEqual(['b', 'c']);
  });

  it('unreachableStates reports states no path reaches from the entry', () => {
    const orphaned: TransitionMap<'start' | 'mid' | 'island'> = {
      start: ['mid'],
      mid: [],
      island: ['start'],
    } as const;
    // From start: only mid is reachable; island is unreachable; start excluded.
    expect(unreachableStates(orphaned, 'start')).toEqual(['island']);
  });

  it('unreachableStates is empty when every non-entry state is reachable', () => {
    expect(unreachableStates(fixture, 'a')).toEqual([]);
  });
});

describe('validateTransitionMap (iec-E05d harness counterpart)', () => {
  it('returns no defects for a sound map', () => {
    expect(validateTransitionMap(fixture)).toEqual([]);
    expect(validateTransitionMap(evalRunTransitions)).toEqual([]);
  });

  it('flags an unknown target', () => {
    const bad = {
      a: ['ghost'],
      a2: [],
    } as unknown as TransitionMap<'a' | 'a2'>;
    const defects = validateTransitionMap(bad);
    expect(defects).toContainEqual<TransitionMapDefect<'a' | 'a2'>>({
      state: 'a',
      target: 'ghost' as 'a' | 'a2',
      kind: 'unknown-target',
    });
  });

  it('flags a self-loop', () => {
    const bad: TransitionMap<'x' | 'y'> = {
      x: ['x', 'y'],
      y: [],
    } as const;
    expect(validateTransitionMap(bad)).toContainEqual({
      state: 'x',
      target: 'x',
      kind: 'self-loop',
    });
  });

  it('flags a duplicate target', () => {
    const bad: TransitionMap<'x' | 'y'> = {
      x: ['y', 'y'],
      y: [],
    } as const;
    expect(validateTransitionMap(bad)).toContainEqual({
      state: 'x',
      target: 'y',
      kind: 'duplicate-target',
    });
  });
});

describe('toMermaid visualizer (iec-E05a)', () => {
  it('renders a minimal stateDiagram-v2 with edges and terminal markers', () => {
    const out = toMermaid(fixture);
    expect(out).toContain('stateDiagram-v2');
    expect(out).toContain('a --> b');
    expect(out).toContain('a --> done');
    expect(out).toContain('done --> [*]');
    // No title / initial in the minimal form.
    expect(out).not.toContain('title:');
    expect(out).not.toContain('[*] --> ');
  });

  it('emits title front-matter and an initial-state edge when requested', () => {
    const opts: MermaidOptions = { title: 'EvalRun lifecycle', initial: 'a' };
    const out = toMermaid(fixture, opts);
    expect(out).toContain('title: EvalRun lifecycle');
    expect(out.split('\n')[0]).toBe('---');
    expect(out).toContain('[*] --> a');
  });

  it('omits terminal markers when markTerminal is false', () => {
    const out = toMermaid(fixture, { markTerminal: false });
    expect(out).not.toContain('--> [*]');
    expect(out).toContain('a --> b');
  });

  it('produces deterministic output for the real EvalRun machine', () => {
    const first = toMermaid(evalRunTransitions, { initial: 'queued', title: 'EvalRun' });
    const second = toMermaid(evalRunTransitions, { initial: 'queued', title: 'EvalRun' });
    expect(first).toBe(second);
    expect(first).toContain('queued --> running');
    expect(first).toContain('archived --> [*]');
  });
});

describe('type-level surface', () => {
  it('IllegalTransitionError is generic and an Error subclass', () => {
    const e = new IllegalTransitionError<S>('a', 'c', ['b', 'done']);
    expectTypeOf(e).toMatchTypeOf<Error>();
    expectTypeOf(e.from).toEqualTypeOf<S>();
  });
});
