/**
 * SkillVersion — refinement-lineage record of a skill (14th canonical entity).
 *
 * DR-028 T1 DISCRIMINATOR resolution (ISEDC Session 7, intent-eval-lab
 * `028-AT-DECR-...`). SEPARATE entity from SkillSnapshot:
 *
 *   - SkillSnapshot (§ 2.9) content-addressed-PINS a skill's source state at a
 *     moment in time. Single terminal state `created`. No discriminator.
 *   - SkillVersion captures the REFINEMENT LINEAGE the Skill Refiner produces.
 *     `version_kind` is the load-bearing signable discriminator; each accepted
 *     edit produces a NEW immutable SkillVersion (append-only event log, AC-2).
 *
 * The relationship between the two is deliberately NOT a relational foreign key
 * (DR-028 T1): `source_snapshot_hash` is a READ-ONLY content-hash REFERENCE to
 * the PRE-EDIT SkillSnapshot at refinement time (DR-085 D4 pre-edit-input
 * clarification) — there is no enforced relational integrity. The CTO's
 * "orthogonal-no-FK" fallback is folded into the discriminator path exactly here
 * (DR-028 rationale): schema-integrity orthogonality without losing the
 * discriminator signal.
 *
 * DR-085 D3 lineage-integrity correction: the entity now carries a self
 * `content_hash` (its own post-edit content) and a `parent_content_hash` (the
 * parent's `content_hash`) — the tamper-evident append-only chain. All three
 * hash fields (`content_hash`, `parent_content_hash`, `source_snapshot_hash`)
 * use the BARE `Sha256` alphabet, ALIGNED to `SkillSnapshot.combined_sha` (one
 * hash alphabet platform-wide). `parent_content_hash` is null iff
 * `parent_version_id` is null (a root forges no parent). DR-085 D5 adds the
 * cross-field invariant `version_kind ∈ {revert,restore} ⇒ parent_version_id ≠
 * null`, machine-enforced at all three layers.
 *
 * SIGNING STATE MACHINE — the DR-028 T1 / DR-085 D1 DEFERRED work, landed here
 * (AT-DECR 011, acting-CTO authorization 2026-07-09). The P0-RATIFY-2 + Kleppmann
 * F-MK-2 signing lifecycle the entity originally shipped WITHOUT is now folded in
 * ADDITIVELY: the six new fields (`status`, `signing_mode`, `rekor_log_index`,
 * `retry_after`, `retry_count`, `signing_downgrade_reason`) are ALL OPTIONAL —
 * NONE joins the `required` set, so every previously-signed SkillVersion row stays
 * valid (absent ≡ the staging-first default). The bead's `pending_production` is
 * resolved as a STATUS ENUM VALUE (not a redundant boolean flag) per the acting-CTO
 * disambiguation, so there is one source of truth for lifecycle position.
 *
 * STAGING-FIRST — this ACTIVATES NOTHING. Local SkillVersion creation NEVER blocks
 * on Rekor (P0-RATIFY-2 / F-MK-2 CISO hard-line): a row is created at
 * `signing_mode='sigstore_staging'` and succeeds regardless of Rekor reachability.
 * Adding these fields does NOT turn on production signing — that stays AND-gated on
 * the DR-082 Q3 triggers elsewhere (in the audit-harness reconciler runtime, NOT
 * this kernel). This is the SAFE SHAPE the reconciler CONSUMES, not the activation.
 *
 * The bounded-retry reconciler + the append-only Rekor OUTBOX (AC-2) that DRIVES
 * these transitions is a SEPARATE follow-on that lives in audit-harness (a runtime;
 * FORBIDDEN here). The kernel owns only the SHAPE + the legal transitions + the
 * cross-field invariant — never the clock read, the Rekor call, or the retry loop.
 *
 * The signed skill-refiner-pass/v1 predicate body (src/predicates/) references
 * this entity by id/hash (`skill_version_id` / `parent_version_id` as Uuidv7,
 * `source_snapshot_hash` as the PRE-EDIT input). DR-085 D4 redefines the
 * predicate's `source_snapshot_hash` to mean pre-edit input (matching this
 * entity) and adds a separate `result_snapshot_hash` for the post-edit output.
 */

import type { ActorIdentity, KebabSlug, Rfc3339, Sha256, Uuidv7 } from '../primitives.js';
import type { SigningMode } from './EvidenceBundle.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * version_kind — the load-bearing signable discriminator (DR-028 T1 line 90).
 * CLOSED set. Widening it after a signed publish is a /v2 trigger.
 */
export type SkillVersionKind = 'edit' | 'revert' | 'restore';

/**
 * SkillVersion SIGNING lifecycle state — the DR-028 T1 / DR-085 D1 deferred
 * state machine (AT-DECR 011). CLOSED enum. Widening it after a signed publish is
 * a /v2 trigger (one-way door), mirroring `version_kind`.
 *
 *   - `sigstore_staging`   — STAGING-FIRST default. Local creation ALWAYS lands
 *     here (never blocks on Rekor per P0-RATIFY-2 / Kleppmann F-MK-2 CISO
 *     hard-line). Absent `status` ≡ this value (the additive-default posture).
 *   - `pending_production` — production signing was REQUESTED but Rekor was
 *     unreachable; the reconciler will retry (`retry_after` set). The bead's
 *     `pending_production` field is resolved HERE as a status value, not a
 *     redundant boolean flag (acting-CTO disambiguation, AT-DECR 011 § D2).
 *   - `active`            — production signature landed on the Rekor transparency
 *     log; `rekor_log_index` is now non-null (the cross-field invariant below).
 *   - `signing_failed`    — bounded retry exhausted (`retry_count` reached
 *     `SKILL_VERSION_MAX_SIGNING_RETRIES`, CISO binding); surfaces to HUMAN review.
 *
 * These are SIGNING states, orthogonal to `version_kind` (which is lineage). A row
 * with no `status` is a valid staging-first row — the whole enum is additive.
 */
export type SkillVersionSigningStatus =
  | 'sigstore_staging'
  | 'pending_production'
  | 'active'
  | 'signing_failed';

/**
 * Alias for state-machine callers (mirrors the `FailureTaxonomyState` idiom).
 */
export type SkillVersionState = SkillVersionSigningStatus;

/**
 * Legal signing-lifecycle transitions (AT-DECR 011, P0-RATIFY-2 flow).
 *
 *   sigstore_staging → pending_production   (production signing requested; Rekor unreachable → queued)
 *   sigstore_staging → active               (production signature landed on first attempt)
 *   pending_production → active             (reconciler retry succeeded)
 *   pending_production → signing_failed      (bounded retry exhausted, max_retries=5)
 *   active → (terminal)                      (a signed row is immutable; a re-sign is a NEW SkillVersion)
 *   signing_failed → (terminal)              (surfaces to human review; recovery is a NEW row, append-only)
 *
 * A `pending_production` retry that FAILS-but-has-budget is NOT a status
 * transition — the row STAYS in `pending_production` while the reconciler
 * increments `retry_count` and pushes out `retry_after` (an in-place field update,
 * not a state change). Only exhaustion (`retry_count` reaches
 * {@link SKILL_VERSION_MAX_SIGNING_RETRIES}) drives `pending_production →
 * signing_failed`. This keeps the map self-loop-free, matching the kernel's
 * structural-soundness gate (self-loops are a `validateTransitionMap` defect) and
 * the `retryTransitions` precedent (a re-queue walks through a distinct state).
 *
 * `sigstore_staging` MAY also be a terminal resting state OPERATIONALLY (a row
 * that never requests production signing simply stays staging) — but it is NOT
 * in the formal terminal set: `terminalStates()` reports only
 * `{ active, signing_failed }` because `sigstore_staging` retains outgoing
 * edges. Enforced at runtime by the reconciler via {@link canTransition}; the
 * kernel exports only the legal map.
 */
export const skillVersionSigningTransitions: TransitionMap<SkillVersionState> = {
  sigstore_staging: ['pending_production', 'active'],
  pending_production: ['active', 'signing_failed'],
  active: [],
  signing_failed: [],
} as const;

/**
 * CISO P0-RATIFY-2 bounded-retry ceiling: a `pending_production` row is retried
 * AT MOST this many times before the reconciler drives it to `signing_failed` and
 * surfaces it to human review. Pinned in the kernel so producer + reconciler agree
 * by construction (the kernel owns the BOUND; the retry LOOP is runtime,
 * audit-harness). CISO binding — never unbounded (a stuck row must eventually
 * escalate to a human, not spin forever).
 */
export const SKILL_VERSION_MAX_SIGNING_RETRIES = 5 as const;

/**
 * SkillVersion — one node in a skill's refinement lineage.
 *
 * Field semantics per DR-028 T1 + Skill Refiner plan 027 § 4 Phase C.
 */
export interface SkillVersion {
  /** UUIDv7 PK. The `skill_version_id` the skill-refiner-pass/v1 predicate references. */
  readonly id: Uuidv7;

  /**
   * Logical skill identifier — kebab-case slug, stable across versions of the
   * same skill (mirrors SkillSnapshot.skill_id).
   */
  readonly skill_id: KebabSlug;

  /**
   * Load-bearing signable discriminator (DR-028 T1). `edit` = a refiner-proposed
   * forward change; `revert` = undo to a prior version's content; `restore` =
   * re-instate an archived version.
   */
  readonly version_kind: SkillVersionKind;

  /**
   * **HUMAN-READABLE CONVENIENCE POINTER** to the PRIOR SkillVersion in the
   * refinement lineage (SkillVersion -> SkillVersion). Lineage is internal —
   * this is **NOT** an FK to SkillSnapshot (DR-028 T1 line 91). `null` for a
   * ROOT version (the first refinement in a lineage). No record is ever mutated;
   * a rollback is a NEW SkillVersion citing the prior (append-only event log;
   * F-MK-001 remediation). DR-085 D3: this UUID is reassignable, so it is a
   * convenience pointer ONLY — the tamper-evident integrity anchor is
   * {@link SkillVersion.parent_content_hash}.
   */
  readonly parent_version_id: Uuidv7 | null;

  /**
   * **DR-085 D3** — this version's OWN post-edit content hash; the integrity
   * anchor a child SkillVersion cites as its `parent_content_hash`. **Bare**
   * `Sha256` (`<64-hex>`, NO `sha256:` prefix), the SAME alphabet as
   * `SkillSnapshot.combined_sha` (one hash alphabet platform-wide). The
   * append-only content-hash chain `child.parent_content_hash ===
   * parent.content_hash` makes the lineage tamper-evident — re-pointing the
   * reassignable `parent_version_id` cannot forge an append-only claim a verifier
   * can falsify (DR-085 D3 CSO/CISO binding).
   */
  readonly content_hash: Sha256;

  /**
   * **DR-085 D3** — the parent SkillVersion's `content_hash`; the tamper-evident
   * lineage integrity anchor (vs the reassignable `parent_version_id` convenience
   * pointer). **Bare** `Sha256`, aligned to `SkillSnapshot.combined_sha`. MUST be
   * `null` **exactly** when `parent_version_id` is null (a ROOT version): root
   * emission is provably zero-forgery — an implementer never forges a fake parent
   * (DR-085 D3 DevRel/CISO binding). The iff is machine-enforced (Zod
   * `.superRefine` + the JSON-Schema if/then + the Pydantic `model_validator`).
   */
  readonly parent_content_hash: Sha256 | null;

  /**
   * **READ-ONLY content-hash REFERENCE** to the PRE-EDIT SkillSnapshot at the
   * moment of refinement — the INPUT to the refinement (DR-028 T1 line 92;
   * **DR-085 D4** pre-edit-input clarification, matching the predicate body's
   * now-pre-edit `source_snapshot_hash`). **NOT a relational foreign key** —
   * there is no enforced relational integrity; it is a content-hash reference.
   * **DR-085 D3**: typed **bare** `Sha256` (`<64-hex>`), aligned to
   * `SkillSnapshot.combined_sha` + `content_hash` + `parent_content_hash` (the
   * prior `Sha256Prefixed` form was the very alphabet mismatch DR-085 D3
   * corrects).
   */
  readonly source_snapshot_hash: Sha256;

  /**
   * Identity of the RefinerStrategy that produced this version (DR-028
   * P0-RATIFY-5, CISO signed-manifest binding — mechanism-swappable must not
   * become mechanism-untraceable). Signed in the skill-refiner-pass/v1 predicate
   * payload.
   */
  readonly refiner_strategy_id: string;

  readonly created_at: Rfc3339;
  readonly created_by: ActorIdentity;

  /**
   * RESERVED multi-tenancy slot (deferral-G; bd_000-projects-k0fj), mirroring
   * SkillSnapshot. OPTIONAL + additive per Blueprint B § 7.2 — reserved so a
   * future multi-tenant deployment does NOT force a consumer-side migration.
   * Tenant-isolation SEMANTICS remain out-of-scope for v1; v1 single-tenant
   * versions omit it.
   */
  readonly tenant_id?: Uuidv7;

  // ─── Signing state machine (AT-DECR 011 — DR-028 T1 / DR-085 D1 deferred) ───
  //
  // ALL SIX FIELDS BELOW ARE OPTIONAL + ADDITIVE. None joins the `required` set,
  // so every previously-signed SkillVersion row stays valid (absent `status` ≡
  // the staging-first `sigstore_staging` default). STAGING-FIRST — adding these
  // ACTIVATES NOTHING; production signing stays AND-gated on the DR-082 Q3
  // triggers in the audit-harness reconciler, never here.

  /**
   * Signing-lifecycle position (AT-DECR 011 § D2). OPTIONAL — an absent `status`
   * is the staging-first `sigstore_staging` default. The bead's
   * `pending_production` is resolved as a value of THIS enum (not a separate
   * boolean flag) so there is one source of truth for lifecycle position. Legal
   * transitions are in {@link skillVersionSigningTransitions}.
   */
  readonly status?: SkillVersionSigningStatus;

  /**
   * Signing posture — the SAME `SigningMode` enum as `EvidenceBundle.signing_mode`
   * / `RolloutGate.signing_mode` (`sigstore_staging` | `rekor_production` |
   * `unsigned_experimental`). OPTIONAL — an absent value is the staging-first
   * `sigstore_staging` default. Reconciled to the kernel enum value
   * `rekor_production` (the bead's `'production'` wording maps to this literal).
   * Cross-field invariant with `rekor_log_index` + `status` below.
   */
  readonly signing_mode?: SigningMode;

  /**
   * Rekor transparency-log index, populated ONLY when the row is signed to the
   * production log. **Cross-field invariant (AT-DECR 011 § D3, enforced at all
   * three layers):** `rekor_log_index` is non-null IFF
   * (`signing_mode === 'rekor_production'` AND `status === 'active'`). A row with
   * a rekor index but not active+production is a forged-provenance claim and is
   * REFUSED; an active+production row WITHOUT a rekor index is an unverifiable
   * production claim and is REFUSED. OPTIONAL/absent for every staging row.
   */
  readonly rekor_log_index?: number | null;

  /**
   * RFC 3339 UTC timestamp the reconciler MUST NOT retry a `pending_production`
   * row before (exponential-backoff floor; the reconciler computes the value, the
   * kernel only types it). OPTIONAL — set only while `status === 'pending_production'`.
   */
  readonly retry_after?: Rfc3339;

  /**
   * Number of production-signing attempts made so far for this row. The reconciler
   * increments it; once it reaches {@link SKILL_VERSION_MAX_SIGNING_RETRIES} the
   * next failure drives `pending_production → signing_failed` (CISO bounded-retry
   * binding). OPTIONAL — absent ≡ 0 (no attempt yet). Integer ≥ 0.
   */
  readonly retry_count?: number;

  /**
   * Structured reason recorded ONLY when this row's signing posture was
   * DOWNGRADED (e.g. a requested `rekor_production` fell back to
   * `sigstore_staging`, or retries were exhausted). Absent on a normally-signed or
   * plain staging row. Mirrors the `skill-refiner-pass/v1` predicate's
   * `signing_downgrade_reason` intent. OPTIONAL free text.
   */
  readonly signing_downgrade_reason?: string;
}
