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
