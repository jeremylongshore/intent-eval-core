/**
 * Branded Zod primitive schemas — runtime parsers for the brands declared
 * in `src/primitives.ts`.
 *
 * Each parser:
 *   - validates the raw string/number against Blueprint B § 2.x / § 7.4 patterns
 *   - applies the corresponding TS brand via `.brand<'BrandName'>()`
 *   - is reusable as a building block in every entity validator
 *
 * The brand string MUST match the brand identifier in `src/primitives.ts`
 * so the inferred zod output and the hand-authored TS interface are
 * structurally identical types.
 */

import { z } from 'zod';

// ─── String brands ────────────────────────────────────────────────────────

/** UUIDv7 — time-ordered 128-bit identifier (RFC 9562). */
export const Uuidv7Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    'Must be a UUIDv7 (RFC 9562) — version nibble = 7, variant = 10xx',
  )
  .brand<'Uuidv7'>();

/** Bare 64-hex-char SHA-256 digest. */
export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Must be 64 lowercase hex chars')
  .brand<'Sha256'>();

/** Prefixed SHA-256 digest `sha256:<64-lowercase-hex>` (Blueprint B § 7.4). */
export const Sha256PrefixedSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/, 'Must be sha256: + 64 lowercase hex chars per Blueprint B § 7.4')
  .brand<'Sha256Prefixed'>();

/** RFC 3339 / ISO 8601 timestamp string with timezone. */
export const Rfc3339Schema = z.string().datetime({ offset: true }).brand<'Rfc3339'>();

/** SemVer 2.0.0. */
export const SemVerSchema = z
  .string()
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?(\+[A-Za-z0-9.-]+)?$/, 'Must be SemVer 2.0.0')
  .brand<'SemVer'>();

/** Lowercase kebab-case slug. */
export const KebabSlugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Must be lowercase kebab-case')
  .brand<'KebabSlug'>();

/** Opaque actor identity (engineer email, service-account, worker id). */
export const ActorIdentitySchema = z.string().min(1).brand<'ActorIdentity'>();

/** Object-storage key (content-addressed). */
export const StorageKeySchema = z.string().min(1).brand<'StorageKey'>();

/** OpenTelemetry span identifier — 16 lowercase hex characters. */
export const OtelSpanIdSchema = z
  .string()
  .regex(/^[a-f0-9]{16}$/, 'Must be 16 lowercase hex chars (OTel span id)')
  .brand<'OtelSpanId'>();

/** Tool + SemVer identifier `<kebab-slug>@<semver>`. */
export const RunnerIdentifierSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?(\+[A-Za-z0-9.-]+)?$/,
    'Must be <kebab-slug>@<semver>',
  )
  .brand<'RunnerIdentifier'>();

/** Git commit SHA — full 40-hex or short 7-hex. */
export const CommitShaSchema = z
  .string()
  .regex(/^[a-f0-9]{7,40}$/, 'Must be 7..40 lowercase hex chars')
  .brand<'CommitSha'>();

/** in-toto subject name `<tool>:<side>:<gate-id>` per Blueprint B § 7.3. */
export const SubjectNameSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*:(client|server|ci|sandbox|local):[a-zA-Z0-9][a-zA-Z0-9.-]*$/,
    'Must satisfy <tool>:<side>:<gate-id> per Blueprint B § 7.3',
  )
  .brand<'SubjectName'>();

// ─── Number brands ────────────────────────────────────────────────────────

/** Cost in micro-USD for sub-cent precision (Blueprint B § 2.12, NORMATIVE). */
export const MicroUsdSchema = z.number().int().nonnegative().brand<'MicroUsd'>();

// ─── Closed enums (Blueprint B § 2.x + § 7.4) ──────────────────────────────

/** MatcherMap class — kernel-level closed enum (FailureTaxonomy is upstream). */
export const MmClassSchema = z.enum(['MM-1', 'MM-2', 'MM-3', 'MM-4', 'MM-5', 'MM-6']);

/** FailureTaxonomy natural key — accepts any MM-N (broader than MmClass). */
export const MmClassIdSchema = z.string().regex(/^MM-[0-9]+$/, 'Must match MM-<number>');

/** Coverage shape per Blueprint B § 7.4 line 807. */
export const CoverageSchema = z
  .object({
    dimensions_evaluated: z.array(z.string()),
    dimensions_skipped: z.array(z.string()),
  })
  .strict();
