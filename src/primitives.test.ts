/**
 * Tests for the ID + event-ID standards (epic iec-E06 / r1u) added to
 * `primitives.ts`: format recognition, safe branding, the event-id contract,
 * and lineage-chain validation. Generation is out of scope (runtime, forbidden
 * by the kernel boundary) — only recognition and validation live here.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  ancestorChain,
  asEventId,
  asSha256,
  asSha256Prefixed,
  asUuidv7,
  EVENT_ID_CONTRACT,
  isEventId,
  isSha256,
  isSha256Prefixed,
  isUuidv7,
  SHA256_PATTERN,
  SHA256_PREFIXED_PATTERN,
  UUIDV7_PATTERN,
  validateLineage,
  type EventId,
  type LineageDefect,
  type LineageEdge,
  type Sha256,
  type Sha256Prefixed,
  type Uuidv7,
} from './primitives.js';
import { Uuidv7Schema } from './validators/v1/_primitives.js';

// A canonical RFC 9562 UUIDv7 (version nibble 7, variant 8/9/a/b).
const V7 = '0190b3e1-7c2a-7def-89ab-0123456789ab';
const V7_B = '0190b3e1-7c2a-7def-89ab-0123456789ac';
const V4 = '0190b3e1-7c2a-4def-89ab-0123456789ab'; // version nibble 4 → not v7
const HEX64 = 'a'.repeat(64);

describe('UUIDv7 recognition (iec-E06)', () => {
  it('isUuidv7 accepts a valid v7 and rejects a v4 / garbage', () => {
    expect(isUuidv7(V7)).toBe(true);
    expect(isUuidv7(V4)).toBe(false);
    expect(isUuidv7('not-a-uuid')).toBe(false);
  });

  it('asUuidv7 brands a valid id and returns null otherwise', () => {
    const ok = asUuidv7(V7);
    expect(ok).toBe(V7);
    expectTypeOf(ok).toEqualTypeOf<Uuidv7 | null>();
    expect(asUuidv7(V4)).toBeNull();
  });

  it('the exported pattern matches the Zod validator pattern byte-for-byte', () => {
    // Lockstep invariant: the recognition pattern here and the parse pattern in
    // the validators layer MUST agree, else a value can pass one and fail the
    // other. Compare source so a future drift in either fails this test.
    const zodSource = Uuidv7Schema.safeParse(V7).success;
    expect(zodSource).toBe(true);
    expect(UUIDV7_PATTERN.test(V7)).toBe(true);
    // A v4 fails both.
    expect(Uuidv7Schema.safeParse(V4).success).toBe(false);
    expect(UUIDV7_PATTERN.test(V4)).toBe(false);
  });
});

describe('SHA-256 recognition (iec-E06)', () => {
  it('isSha256 accepts 64 lowercase hex, rejects prefixed / short / upper', () => {
    expect(isSha256(HEX64)).toBe(true);
    expect(isSha256(`sha256:${HEX64}`)).toBe(false);
    expect(isSha256('a'.repeat(63))).toBe(false);
    expect(isSha256('A'.repeat(64))).toBe(false);
  });

  it('isSha256Prefixed accepts sha256:<hex>, rejects bare', () => {
    expect(isSha256Prefixed(`sha256:${HEX64}`)).toBe(true);
    expect(isSha256Prefixed(HEX64)).toBe(false);
    expect(isSha256Prefixed(`md5:${HEX64}`)).toBe(false);
  });

  it('asSha256 / asSha256Prefixed brand-or-null', () => {
    expect(asSha256(HEX64)).toBe(HEX64);
    expect(asSha256('nope')).toBeNull();
    expect(asSha256Prefixed(`sha256:${HEX64}`)).toBe(`sha256:${HEX64}`);
    expect(asSha256Prefixed(HEX64)).toBeNull();
    expectTypeOf(asSha256(HEX64)).toEqualTypeOf<Sha256 | null>();
    expectTypeOf(asSha256Prefixed(`sha256:${HEX64}`)).toEqualTypeOf<Sha256Prefixed | null>();
  });

  it('patterns are exported and self-consistent', () => {
    expect(SHA256_PATTERN.test(HEX64)).toBe(true);
    expect(SHA256_PREFIXED_PATTERN.test(`sha256:${HEX64}`)).toBe(true);
  });
});

describe('event-id derivation contract (iec-E06)', () => {
  it('pins prefix=evt-, algorithm=sha256, and a recognition pattern', () => {
    expect(EVENT_ID_CONTRACT.prefix).toBe('evt-');
    expect(EVENT_ID_CONTRACT.algorithm).toBe('sha256');
    expect(EVENT_ID_CONTRACT.pattern.test(`evt-${HEX64}`)).toBe(true);
  });

  it('isEventId / asEventId recognize a well-formed derived id', () => {
    const id = `evt-${HEX64}`;
    expect(isEventId(id)).toBe(true);
    expect(isEventId(HEX64)).toBe(false); // missing prefix
    expect(isEventId(`evt-${'a'.repeat(63)}`)).toBe(false); // short digest
    const branded = asEventId(id);
    expect(branded).toBe(id);
    expect(asEventId('evt-bad')).toBeNull();
    expectTypeOf(branded).toEqualTypeOf<EventId | null>();
  });
});

describe('lineage chain helper (iec-E06)', () => {
  const a = asUuidv7(V7)!;
  const b = asUuidv7(V7_B)!;
  const c = asUuidv7('0190b3e1-7c2a-7def-89ab-0123456789ad')!;
  const ghost = asUuidv7('0190b3e1-7c2a-7def-89ab-0123456789ff')!;

  it('ancestorChain walks parent links root-last and excludes self', () => {
    // c → b → a (a is root)
    const edges: LineageEdge[] = [
      { id: a, parentId: null },
      { id: b, parentId: a },
      { id: c, parentId: b },
    ];
    expect(ancestorChain(edges, c)).toEqual([b, a]);
    expect(ancestorChain(edges, a)).toEqual([]); // root has no ancestors
  });

  it('ancestorChain returns null for an unknown id', () => {
    expect(ancestorChain([{ id: a, parentId: null }], ghost)).toBeNull();
  });

  it('ancestorChain returns null on a dangling parent reference', () => {
    // b claims parent a, but a is not in the edge set.
    expect(ancestorChain([{ id: b, parentId: a }], b)).toBeNull();
  });

  it('ancestorChain returns null on a cycle', () => {
    // a → b → a
    const cyclic: LineageEdge[] = [
      { id: a, parentId: b },
      { id: b, parentId: a },
    ];
    expect(ancestorChain(cyclic, a)).toBeNull();
  });

  it('validateLineage passes a well-formed forest', () => {
    const edges: LineageEdge[] = [
      { id: a, parentId: null },
      { id: b, parentId: a },
      { id: c, parentId: a },
    ];
    expect(validateLineage(edges)).toEqual([]);
  });

  it('validateLineage flags self-parent', () => {
    expect(validateLineage([{ id: a, parentId: a }])).toContainEqual<LineageDefect>({
      id: a,
      kind: 'self-parent',
    });
  });

  it('validateLineage flags a missing parent', () => {
    expect(validateLineage([{ id: b, parentId: a }])).toContainEqual<LineageDefect>({
      id: b,
      kind: 'missing-parent',
    });
  });

  it('validateLineage flags a cycle', () => {
    const cyclic: LineageEdge[] = [
      { id: a, parentId: b },
      { id: b, parentId: a },
    ];
    const defects = validateLineage(cyclic);
    expect(defects.some((d) => d.kind === 'cycle')).toBe(true);
  });

  it('validateLineage skips roots (parentId null) without defects', () => {
    expect(validateLineage([{ id: a, parentId: null }])).toEqual([]);
  });
});
