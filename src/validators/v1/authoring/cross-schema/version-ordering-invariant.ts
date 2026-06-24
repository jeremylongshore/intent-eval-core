/**
 * version-ordering-invariant — the kernel-side predicate helper for the V ≤ C ≤ K
 * authoring-family version-ordering invariant (intent-eval-lab doc 045-RR-LAND,
 * the single-source-of-truth + continuous-spec-compliance declaration; lineage
 * dr-044@d-sak-1).
 *
 * The Spec Authority Kernel layers every authoring contract as a base + overlay +
 * composition (DR-044 D7). That layering induces a three-version lineage per
 * authoring FAMILY (schemas/authoring/<family>/):
 *
 *   V — VENDOR   = the upstream-base layer version (the vendored projection of the
 *                  open standard the base mirrors — agentskills.io / the Claude
 *                  surfaces / the MCP spec).
 *   C — CONSUMER = the is-overlay layer version (the IS-authored delta the consumer
 *                  adopts on top of the base).
 *   K — KERNEL   = the published composition version (the allOf the kernel ships;
 *                  schemas/authoring/<family>/index.json#version).
 *
 * The invariant V ≤ C ≤ K asserts the kernel never lags the consumer and the
 * consumer never lags the vendor. It holds BY CONSTRUCTION, not by coincidence:
 * the overlay is monotonic-additive over the base (DR-044 D7 — the overlay only
 * ADDs required fields and NARROWs constraints, so the consumer layer is never
 * behind the vendor layer it composes ⇒ V ≤ C), and the composition publishes the
 * overlay verbatim (the kernel layer is never behind the consumer layer it wraps
 * ⇒ C ≤ K).
 *
 * What lives HERE (kernel scope): a pure SemVer-precedence comparator and the
 * `versionOrderingViolations` predicate over a {V, C, K} triple — no runtime deps,
 * no zod, no I/O. The catalog of record is
 * schemas/authoring/version-ordering-invariant.v1.json; the test
 * (src/__tests__/version-ordering-invariant.test.ts) exercises the 4 corpus cases
 * (valid ordering / C>K / V>C / V=C=K) and asserts every live authoring family
 * declared in the catalog satisfies the invariant AND agrees with its live
 * index.json#version.
 *
 * Why a SIBLING of cross-schema-invariants and not part of any per-contract Zod
 * validator: this invariant is over LAYER VERSIONS of a family, not over the
 * fields of a single artifact, so it is not a parse-time field check. It is a
 * structural-integrity predicate the corpus asserts, in the same spirit as the
 * cross-schema-invariants catalog.
 */

/** The catalog id for this invariant (matches version-ordering-invariant.v1.json). */
export const INV_VERSION_ORDERING = 'INV-VERSION-ORDERING' as const;

/**
 * A parsed SemVer 2.0.0 version: the numeric release core plus the ordered
 * prerelease identifiers (empty for a release version). Build metadata is
 * IGNORED for precedence (SemVer §10), so it is not retained.
 */
interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** Prerelease identifiers in order; empty ⇒ a release version (higher precedence). */
  readonly prerelease: readonly string[];
}

/**
 * A {vendor, consumer, kernel} version triple for one authoring family — the
 * shape the catalog declares and the predicate evaluates.
 */
export interface VersionTriple {
  /** V — the upstream-base (vendor) layer version. */
  readonly vendor: string;
  /** C — the is-overlay (consumer) layer version. */
  readonly consumer: string;
  /** K — the published composition (kernel) layer version. */
  readonly kernel: string;
}

/** A V ≤ C ≤ K ordering violation (error class — a published lineage must order). */
export interface VersionOrderingViolation {
  readonly invariant: typeof INV_VERSION_ORDERING;
  readonly severity: 'error';
  /** Which edge failed: `V<=C` (consumer behind vendor) or `C<=K` (kernel behind consumer). */
  readonly edge: 'V<=C' | 'C<=K';
  readonly message: string;
}

/**
 * Parse a SemVer 2.0.0 version string into its precedence-bearing parts. Throws on
 * a non-SemVer string rather than guessing — a layer version that is not SemVer is
 * a data error the catalog/test must surface, not silently mis-order.
 */
export function parseSemver(version: string): ParsedSemver {
  // SemVer 2.0.0 BNF: <major>.<minor>.<patch>(-<prerelease>)?(+<build>)?
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.exec(
      version,
    );
  if (match === null) {
    throw new Error(`not a SemVer 2.0.0 version: "${version}"`);
  }
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease === undefined ? [] : prerelease.split('.'),
  };
}

/** True iff an identifier is a non-negative integer (the SemVer numeric-identifier rule). */
function isNumericIdentifier(id: string): boolean {
  return /^(0|[1-9]\d*)$/.test(id);
}

/**
 * Compare two prerelease identifier lists per SemVer §11.4. Returns <0 / 0 / >0.
 * A version WITH prerelease has LOWER precedence than the same core WITHOUT
 * (handled by the caller); here both lists are non-empty.
 */
function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai === bi) continue;
    const aNum = isNumericIdentifier(ai);
    const bNum = isNumericIdentifier(bi);
    // 11.4.3: numeric identifiers always have lower precedence than alphanumeric.
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    // 11.4.1: numeric compared numerically.
    if (aNum && bNum) return Number(ai) - Number(bi);
    // 11.4.2: alphanumeric compared lexically in ASCII order.
    return ai < bi ? -1 : 1;
  }
  // 11.4.4: a larger set of identifiers (when all preceding are equal) wins.
  return a.length - b.length;
}

/**
 * Compare two SemVer version strings by precedence (SemVer §11). Returns a
 * negative number if `a < b`, zero if they have EQUAL precedence, a positive
 * number if `a > b`. Build metadata is ignored.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  // 11.3: a version with a prerelease has LOWER precedence than one without.
  const aPre = pa.prerelease.length > 0;
  const bPre = pb.prerelease.length > 0;
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (!aPre && !bPre) return 0;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

/** True iff `a` ≤ `b` by SemVer precedence. */
export function semverLte(a: string, b: string): boolean {
  return compareSemver(a, b) <= 0;
}

/**
 * Evaluate the V ≤ C ≤ K version-ordering invariant for one family's triple.
 * Returns one violation per failing edge (so a triple that breaks BOTH edges
 * yields two), empty when V ≤ C ≤ K holds (including the V = C = K equality case).
 *
 * A version string that is not SemVer 2.0.0 throws from `parseSemver` — that is a
 * data error the catalog must not carry, surfaced loudly rather than mis-ordered.
 */
export function versionOrderingViolations(triple: VersionTriple): VersionOrderingViolation[] {
  const violations: VersionOrderingViolation[] = [];
  const { vendor, consumer, kernel } = triple;

  // V ≤ C — the consumer (overlay) must not lag the vendor (base) it composes.
  if (!semverLte(vendor, consumer)) {
    violations.push({
      invariant: INV_VERSION_ORDERING,
      severity: 'error',
      edge: 'V<=C',
      message: `vendor (upstream-base) version ${vendor} is newer than consumer (is-overlay) version ${consumer} — the consumer must not lag the vendor (V ≤ C)`,
    });
  }
  // C ≤ K — the kernel (composition) must not lag the consumer (overlay) it publishes.
  if (!semverLte(consumer, kernel)) {
    violations.push({
      invariant: INV_VERSION_ORDERING,
      severity: 'error',
      edge: 'C<=K',
      message: `consumer (is-overlay) version ${consumer} is newer than kernel (composition) version ${kernel} — the kernel must not lag the consumer (C ≤ K)`,
    });
  }
  return violations;
}

/** True iff the triple satisfies V ≤ C ≤ K (a convenience over `versionOrderingViolations`). */
export function satisfiesVersionOrdering(triple: VersionTriple): boolean {
  return versionOrderingViolations(triple).length === 0;
}
