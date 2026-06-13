/**
 * Branded primitive types for canonical contracts.
 *
 * These compile-time-only brands prevent accidental mixing of stringly-typed
 * identifiers and content hashes. Brands carry no runtime weight — at runtime
 * the values are plain strings/numbers — but they make `Uuidv7` and
 * `Sha256Prefixed` distinguishable to the type checker.
 *
 * Construction is intentionally not provided here. Validators in a sibling
 * module (epic iec-E04) will own the parse-and-brand pattern. Until then,
 * callers brand explicitly via `as Uuidv7` when they know the source is
 * trusted (e.g., values already validated upstream). Per DR-010 unification
 * thesis: every validator that emits an Evidence Bundle also emits the
 * branded type — never an unbranded string.
 *
 * Reference: Blueprint B § 6.2 (universal conventions) and § 7.4 (hash format).
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * UUIDv7 — time-ordered 128-bit identifier (RFC 9562).
 *
 * Every entity PK and FK in the 13-entity domain model is UUIDv7. Time-ordered
 * prefix means natural sort order matches insertion order, which Blueprint B
 * § 3.1 relies on for lease ordering.
 */
export type Uuidv7 = Brand<string, 'Uuidv7'>;

/**
 * Bare 64-hex-char SHA-256 digest. Used by entity content_hash fields
 * (Blueprint B § 2.1, § 2.3, § 2.7, etc.) where the prose specifies "sha256"
 * without prefix discipline.
 */
export type Sha256 = Brand<string, 'Sha256'>;

/**
 * Prefixed SHA-256 digest in the form `sha256:<64-lowercase-hex>`.
 *
 * REQUIRED format for every `*_hash` field in the `gate-result/v1` predicate
 * body per Blueprint B § 7.4. Unknown algorithm prefixes cause row
 * verification failure (not bundle failure).
 */
export type Sha256Prefixed = Brand<string, 'Sha256Prefixed'>;

/**
 * RFC 3339 / ISO 8601 timestamp string with timezone designator.
 *
 * Blueprint B requires UTC ("Z" suffix) with millisecond precision for
 * fields involved in worker-lease ordering (clock-skew tolerance ±10 ms).
 */
export type Rfc3339 = Brand<string, 'Rfc3339'>;

/**
 * SemVer 2.0.0 version string (e.g., "1.2.3", "0.1.0-draft+sha.abc").
 */
export type SemVer = Brand<string, 'SemVer'>;

/**
 * Lowercase kebab-case slug. Used by entity `name` fields (EvalSpec,
 * MatcherMap, RegressionPack, SkillSnapshot.skill_id, FailureTaxonomy).
 */
export type KebabSlug = Brand<string, 'KebabSlug'>;

/**
 * Micro-USD integer. Used by CostRecord.external_api_cost_micro_usd
 * for precision (Blueprint B § 2.12).
 */
export type MicroUsd = Brand<number, 'MicroUsd'>;

/**
 * Object-storage key (content-addressed). Format intentionally opaque at this
 * layer — storage backends own the resolution. Always content-addressed
 * (sha256 of payload) per Blueprint B's tamper-evidence requirement.
 */
export type StorageKey = Brand<string, 'StorageKey'>;

/**
 * OpenTelemetry-compatible span identifier (16 hex chars per OTel spec).
 */
export type OtelSpanId = Brand<string, 'OtelSpanId'>;

/**
 * Actor identity string — engineer email, service-account name, or worker
 * identifier. Blueprint B leaves the exact format unspecified; treated as
 * opaque here. Refinement deferred to a future bead.
 */
export type ActorIdentity = Brand<string, 'ActorIdentity'>;

// ─── ID + event-ID standards (epic iec-E06 / r1u) ──────────────────────────
//
// The kernel owns the STANDARD — what a valid id / event-id LOOKS LIKE and how
// lineage chains compose — not the GENERATION of one. Producing a UUIDv7
// (a clock read + random bytes) and deriving an event-id (SHA-256 over canonical
// inputs) are runtime EXECUTION, forbidden by FORBIDDEN.md (no clock, no
// hashing) + the `.dependency-cruiser.cjs` `kernel-no-runtime-deps` rule + the
// Blueprint A § 3 anti-goals. The generators are rescoped to a runtime package
// (the producer that already reads the clock and hashes payloads). What stays
// here is pure, dependency-free, and constant: format recognition, safe
// branding of already-validated values, the documented event-id contract, and
// lineage-chain validation over a caller-supplied parent map.
//
// These helpers intentionally live in `primitives.ts` (a LEAF that imports
// nothing) rather than a new `src/id-standards/` subtree — adding a new src
// subpath would require editing the byte-checked FORBIDDEN.md / ALLOWLIST.md /
// dependency-cruiser allow-list, a heavier boundary change than the standard
// warrants. The format-recognition predicates belong with the branded types
// they recognize.

/**
 * Canonical UUIDv7 recognition pattern (RFC 9562): version nibble `7`,
 * variant `10xx`, lowercase hex. The single source of truth for the shape;
 * the Zod parser in `src/validators/v1/_primitives.ts` MUST stay in lockstep
 * with this literal (an asserted invariant in the id-standards test).
 */
export const UUIDV7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Bare 64-lowercase-hex SHA-256 recognition pattern. */
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Prefixed `sha256:<64-lowercase-hex>` recognition pattern (Blueprint B § 7.4). */
export const SHA256_PREFIXED_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Type guard: is `value` a syntactically valid UUIDv7 string? */
export function isUuidv7(value: string): value is Uuidv7 {
  return UUIDV7_PATTERN.test(value);
}

/** Type guard: is `value` a bare 64-hex SHA-256 digest? */
export function isSha256(value: string): value is Sha256 {
  return SHA256_PATTERN.test(value);
}

/** Type guard: is `value` a prefixed `sha256:<hex>` digest? */
export function isSha256Prefixed(value: string): value is Sha256Prefixed {
  return SHA256_PREFIXED_PATTERN.test(value);
}

/**
 * Safe brand: return `value` branded as {@link Uuidv7} iff it matches the
 * RFC 9562 pattern, else `null`. This is the recognize-and-brand half of the
 * standard — the kernel can SAY "this string is a valid id" without ever
 * GENERATING one. (Contrast the unchecked `value as Uuidv7` callers used
 * before, which trusted the source blindly.)
 */
export function asUuidv7(value: string): Uuidv7 | null {
  return isUuidv7(value) ? value : null;
}

/** Safe brand for a bare SHA-256 digest, or `null` if malformed. */
export function asSha256(value: string): Sha256 | null {
  return isSha256(value) ? value : null;
}

/** Safe brand for a prefixed `sha256:<hex>` digest, or `null` if malformed. */
export function asSha256Prefixed(value: string): Sha256Prefixed | null {
  return isSha256Prefixed(value) ? value : null;
}

/**
 * The deterministic event-id derivation CONTRACT (epic iec-E06 event-ID
 * derivation). The kernel pins the recipe so every runtime producer derives
 * the SAME id for the same logical event — the precondition for replay
 * determinism — without the kernel itself performing the hash.
 *
 * Contract: `event_id = "evt-" + sha256_hex( canonical_form )` where
 * `canonical_form` is the producer's stable-stringified, key-sorted tuple of
 * the event's defining inputs. The `evt-` namespace prefix distinguishes a
 * derived event-id from a UUIDv7 entity id at a glance and reserves room for
 * future `<prefix>-<digest>` id kinds.
 *
 * Generation (the actual SHA-256) is runtime; it lives in the producer. The
 * kernel exports this contract object as the SINGLE place the prefix and the
 * recognition pattern are defined so producer and verifier agree by construction.
 */
export const EVENT_ID_CONTRACT = {
  /** Namespace prefix every derived event-id carries. */
  prefix: 'evt-',
  /** Hash algorithm the digest is computed with. */
  algorithm: 'sha256',
  /** Recognition pattern for a fully-formed event-id. */
  pattern: /^evt-[0-9a-f]{64}$/,
} as const;

/** Branded derived-event identifier `evt-<64-lowercase-hex>`. */
export type EventId = Brand<string, 'EventId'>;

/** Type guard: is `value` a syntactically valid derived event-id? */
export function isEventId(value: string): value is EventId {
  return EVENT_ID_CONTRACT.pattern.test(value);
}

/** Safe brand for a derived event-id, or `null` if malformed. */
export function asEventId(value: string): EventId | null {
  return isEventId(value) ? value : null;
}

/**
 * A single parent → child lineage edge over entity ids (epic iec-E06 lineage
 * chain helper). The runtime producer stamps `parent_id` when it spawns a
 * child entity (e.g., `EvalRun.parent_run_id`); the kernel validates that the
 * resulting graph is a well-formed chain/forest.
 */
export interface LineageEdge {
  /** The child id. */
  readonly id: Uuidv7;
  /** The parent id, or `null` for a root. */
  readonly parentId: Uuidv7 | null;
}

/** A structural problem found by {@link validateLineage}. */
export interface LineageDefect {
  /** The id whose lineage is defective. */
  readonly id: Uuidv7;
  /** Why it is a defect. */
  readonly kind: 'missing-parent' | 'self-parent' | 'cycle';
}

/**
 * Resolve the ancestor chain of `id` (root-last): the ordered list of ancestor
 * ids walking `parentId` links upward, NOT including `id` itself. Returns
 * `null` if a cycle is detected or a referenced parent is absent from `edges`
 * — a malformed lineage has no well-defined chain.
 *
 * Pure parent → child UUID resolution over a caller-supplied edge set; no
 * generation, no I/O.
 */
export function ancestorChain(edges: readonly LineageEdge[], id: Uuidv7): readonly Uuidv7[] | null {
  const parentOf = new Map<Uuidv7, Uuidv7 | null>();
  for (const e of edges) parentOf.set(e.id, e.parentId);
  if (!parentOf.has(id)) return null;
  const chain: Uuidv7[] = [];
  const seen = new Set<Uuidv7>([id]);
  let current = parentOf.get(id) ?? null;
  while (current !== null) {
    if (seen.has(current)) return null; // cycle
    if (!parentOf.has(current)) return null; // dangling parent reference
    seen.add(current);
    chain.push(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
}

/**
 * Validate a lineage edge set as a well-formed chain/forest. Returns the
 * (possibly empty) list of defects — empty ⇒ every id roots cleanly with no
 * self-parenting and no cycles:
 *
 *   - `missing-parent` — `parentId` references an id not present in the set
 *   - `self-parent` — an id is its own parent
 *   - `cycle` — following `parentId` from this id loops
 *
 * The kernel-side counterpart to "lineage chain helper": a consumer asserts
 * `validateLineage(edges).length === 0` before trusting replay ordering.
 */
export function validateLineage(edges: readonly LineageEdge[]): readonly LineageDefect[] {
  const ids = new Set<Uuidv7>(edges.map((e) => e.id));
  const defects: LineageDefect[] = [];
  for (const e of edges) {
    if (e.parentId === null) continue;
    if (e.parentId === e.id) {
      defects.push({ id: e.id, kind: 'self-parent' });
      continue;
    }
    if (!ids.has(e.parentId)) {
      defects.push({ id: e.id, kind: 'missing-parent' });
      continue;
    }
    if (ancestorChain(edges, e.id) === null) {
      defects.push({ id: e.id, kind: 'cycle' });
    }
  }
  return defects;
}
