/**
 * EvidenceBundlePayload + EvidenceStatement — the wire format an EvidenceBundle
 * content-addresses (iec-E12).
 *
 * Blueprint B § 7.3 + § 2.4. The {@link EvidenceBundle} entity is the manifest
 * (id, subject_set, storage_key, rekor_log_indices …); the PAYLOAD is the actual
 * content its `storage_key` resolves to — an ordered array of in-toto Statement
 * rows. iec-E12 introduces that payload shape plus the row type that carries the
 * § 7.3 cross-field invariants (enforced at runtime by the Zod validators in
 * `@intentsolutions/core/validators/v1`).
 *
 * ADDITIVE in kernel v0.3.0: new exports only — no existing entity changes.
 */

import type { GateResultV1Statement } from '../predicates/gate-result-v1.js';

/**
 * EvidenceStatement — one row of an EvidenceBundlePayload.
 *
 * The in-toto Statement v1 carrying a `gate-result/v1` predicate
 * ({@link GateResultV1Statement}), extended with an optional, non-normative
 * `extensions` escape hatch for experimental fields. The escape hatch lives on
 * the statement envelope, NOT inside the normative `gate-result/v1` predicate
 * body — so the predicate surface stays closed-world while tools can still carry
 * experimental metadata alongside a row.
 *
 * Two cross-field invariants bind the row (Blueprint B § 7.3 line 792), enforced
 * by `EvidenceStatementSchema` at runtime:
 *   - I1: `subject[0].name === predicate.gate_id`
 *   - I2: `subject[0].digest.sha256 === predicate.input_hash` (sans `sha256:`)
 */
export interface EvidenceStatement extends GateResultV1Statement {
  /**
   * Non-normative experimental fields. Consumers MUST NOT use `extensions` for
   * ship/no-ship decisions — those belong on the normative predicate surface.
   */
  readonly extensions?: Readonly<Record<string, unknown>>;
}

/**
 * EvidenceBundlePayload — the JSON-array wire format.
 *
 * The ordered list of {@link EvidenceStatement} rows that an
 * {@link EvidenceBundle}'s `storage_key` content-addresses. A bundle's
 * `row_count` equals this array's length and its `subject_set` is the dedup of
 * these rows' subjects (those bundle↔payload relationships are consumer-side,
 * since the two are content-addressed separately).
 */
export type EvidenceBundlePayload = readonly EvidenceStatement[];
