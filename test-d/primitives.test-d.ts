/**
 * tsd negative tests — branded primitives.
 *
 * Runs as a separate process from vitest via `pnpm run test:types`. Uses
 * the published API surface (dist/index.d.ts) — proves consumers get the
 * right type errors. Companion to the in-process expectTypeOf tests.
 */

import { expectType, expectError, expectAssignable, expectNotAssignable } from 'tsd';
import type {
  ActorIdentity,
  KebabSlug,
  MicroUsd,
  OtelSpanId,
  Rfc3339,
  SemVer,
  Sha256,
  Sha256Prefixed,
  StorageKey,
  Uuidv7,
} from '../dist/index.js';

// ─── Brand discrimination: primitives are NOT interchangeable ─────────

declare const someString: string;
declare const someNumber: number;
declare const uuidv7: Uuidv7;
declare const sha256: Sha256;
declare const sha256Prefixed: Sha256Prefixed;

// Plain strings cannot be assigned where brands are expected
expectError<Uuidv7>(someString);
expectError<Sha256>(someString);
expectError<Sha256Prefixed>(someString);
expectError<Rfc3339>(someString);
expectError<SemVer>(someString);
expectError<KebabSlug>(someString);
expectError<StorageKey>(someString);
expectError<OtelSpanId>(someString);
expectError<ActorIdentity>(someString);

// Plain numbers cannot be assigned where MicroUsd is expected
expectError<MicroUsd>(someNumber);

// Brands cannot be assigned to each other
expectError<Uuidv7>(sha256);
expectError<Sha256>(uuidv7);
expectError<Sha256Prefixed>(sha256); // bare vs prefixed are distinct
expectError<Sha256>(sha256Prefixed);

// Branded values widen back to their underlying primitive (one-way)
expectAssignable<string>(uuidv7);
expectAssignable<string>(sha256);
expectAssignable<number>(0 as MicroUsd);

// ─── Casting in (the only currently-supported construction path) ─────

const cast: Uuidv7 = '0192cae6-0000-7000-8000-000000000000' as Uuidv7;
expectType<Uuidv7>(cast);

// Direct (single-cast) non-string → branded-string is rejected
expectError<Uuidv7>(0 as unknown as string);
expectError<Uuidv7>(true as unknown as string);

// Branded values do NOT silently flow to other brands without re-cast
expectNotAssignable<Sha256>(cast);
