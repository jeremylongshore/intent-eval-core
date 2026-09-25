<!-- BEGIN BD-SYNC:cross-ref:v1 -->

Beads: `bd_000-projects-pu35.2`
GitHub: `jeremylongshore/intent-eval-core#12, jeremylongshore/intent-eval-core#87`
Projection-SHA256: 65b52c01297ce39ae4d99c883c669c3dceea1acff6469a7d56cd9c0ba81a140c

<!-- END BD-SYNC:cross-ref:v1 -->

# AT-DECR 011 — SkillVersion signing state machine (the DR-028 T1 / DR-085 D1 deferred work)

| Field | Value |
|---|---|
| Doc | `011-AT-DECR-skillversion-signing-state-machine-2026-07-09.md` |
| Status | RATIFIED (acting-CTO authorization, CEO-mode delegation, 2026-07-09) — additive, staging-first, activates nothing irreversible |
| Scope | Lands the P0-RATIFY-2 + Kleppmann F-MK-2 SkillVersion signing lifecycle that DR-028 T1 / DR-085 D1 explicitly deferred: six OPTIONAL fields + a lifecycle `TransitionMap` + a both-directions cross-field invariant, at all three kernel layers |
| Bead | `aon3.4` (RC-IEC Skill-Refiner coordination epic child — the v0.4.0 Decision-Record work) |
| Beads | `bd_000-projects-pu35.2` (AC-12 documentation backfill) |
| GitHub | [`jeremylongshore/intent-eval-core#87`](https://github.com/jeremylongshore/intent-eval-core/issues/87) |
| Plane | `LAB-124` |
| Historical coordination | [`jeremylongshore/intent-eval-core#12`](https://github.com/jeremylongshore/intent-eval-core/issues/12) (closed Skill Refiner integration epic) |
| Implements | DR-028 T1 binding-minority deferral (lines 105/108, ISEDC Session 7) reconciled by DR-085 D1 ("Phase C ships entity + discriminator + parent_version_id only; the state-machine formalism is authored as a SECOND DR in v0.4.0 — not now") |
| Package version | `@intentsolutions/core` 0.9.0 → **0.10.0** (additive minor per SemVer — new OPTIONAL fields only; see § 6 for the "v0.4.0 DR" naming note) |
| Authority chain | Blueprint A (constitution) → DR-010 (governance lock) → Blueprint B § 2 (domain model) + § 3 (state machines) → DR-028 T1 / DR-085 D1..D5 (SkillVersion + its deferral) → this DR → `schemas/v1/skill-version.schema.json` + `src/entities/SkillVersion.ts` + `src/validators/v1/skill-version.ts` + `python/.../models.py` |

## 1. What this decision does

DR-028 T1 (ISEDC Session 7) shipped `SkillVersion` — the Skill Refiner's
refinement-lineage entity — WITHOUT its signing state machine. The binding
minority constraint deferred that formalism, and DR-085 D1 reconciled the
deferral text: **"Phase C ships entity + discriminator + `parent_version_id`
only. State-machine formalism deferred … authored as a SECOND DR in v0.4.0 —
not now."** The entity's SCOPE comment listed the exact six deferred fields:
`status`, `signing_mode`, `rekor_log_index`, `pending_production`,
`retry_after`, `signing_downgrade_reason`.

This DR is that second Decision Record. It lands the signing lifecycle
**additively** — six OPTIONAL fields, a lifecycle `TransitionMap`, a pinned
bounded-retry ceiling, and a both-directions cross-field invariant — across all
three kernel layers (JSON Schema `if/then`, Zod `.superRefine`, Pydantic
`model_validator`).

## 2. Authorization (in lieu of a full ISEDC session)

Ratified by the **acting CTO under CEO-mode delegation** (Jeremy Longshore,
"act as cto fix it all", 2026-07-09). A full 7-seat ISEDC session was NOT
convened because this change is, by construction, **not a one-way door**: every
field is OPTIONAL, nothing production-signs, and the shape is amendable in place
until the first production-Rekor signature of a SkillVersion carrying these
fields (no such signature exists — see § 4). The council-grade seat positions
that GOVERN the shape are already ratified upstream and are honored verbatim
here: P0-RATIFY-2 (staging-first, bounded retry, cross-field invariant),
Kleppmann F-MK-2 (creation never blocks on Rekor — the CISO hard-line), and
DR-085 D5 (closed-enum /v2 discipline). Should a production signature later
freeze this shape, any subsequent change becomes a Class-1 ISEDC + likely a
`/v2`, exactly as for `version_kind`.

## 3. The six additive fields (all OPTIONAL, none in `required`)

| Field | Type | Semantics |
|---|---|---|
| `status` | closed enum `sigstore_staging` \| `pending_production` \| `active` \| `signing_failed` | Signing-lifecycle position. Absent ≡ the staging-first `sigstore_staging` default. The bead named `pending_production` as BOTH a status value and a boolean flag; this DR resolves it cleanly as a STATUS VALUE (one source of truth for lifecycle position — see § 5). |
| `signing_mode` | the canonical `SigningMode` enum (`sigstore_staging` \| `rekor_production` \| `unsigned_experimental`) | Reused verbatim from `EvidenceBundle.signing_mode` / `RolloutGate.signing_mode`. The bead's `'production'` wording is reconciled to the kernel enum value **`rekor_production`**. |
| `rekor_log_index` | integer ≥ 0 or `null` | Rekor transparency-log index, populated ONLY on a production-signed active row. Governed by the cross-field invariant (§ 4). |
| `retry_after` | `Rfc3339` | Backoff floor the reconciler must not retry a `pending_production` row before (the reconciler computes it; the kernel only types it). |
| `retry_count` | integer ≥ 0 | Production-signing attempts so far; absent ≡ 0. Bounded by `SKILL_VERSION_MAX_SIGNING_RETRIES` (= 5). |
| `signing_downgrade_reason` | string | Recorded ONLY on a signing downgrade (requested `rekor_production` fell back to `sigstore_staging`, or retries exhausted). |

**Additive discipline (HARD).** `additionalProperties` stays `false`; the
existing `required` set is unchanged; no existing field meaning changes. Every
previously-signed SkillVersion row (which carries NONE of these fields) stays
valid — absence is the staging-first default. This is a strictly additive minor
bump.

**Optional-not-nullable parity.** `status` / `signing_mode` / `retry_after` /
`retry_count` / `signing_downgrade_reason` are OPTIONAL but NOT NULLABLE (no
`null` branch; Zod `.optional()` not `.nullable()`; the Pydantic wrapper
re-declares them with a None-excluding annotation) — an explicit `null` is
REFUSED. Only `rekor_log_index` is optional AND nullable (`oneOf[integer,null]`).

## 4. The cross-field invariant (both directions, all three layers)

> **`rekor_log_index` is non-null IFF (`signing_mode = 'rekor_production'`
> AND `status = 'active'`).**

- **Direction A** — an active + production row WITHOUT a `rekor_log_index` is an
  unverifiable production claim → REFUSED.
- **Direction B** — a `rekor_log_index` on a non-active / non-production row is
  forged provenance → REFUSED. (An absent or explicit-`null` `rekor_log_index`
  is unconstrained — every staging row.)

Enforced identically at all three layers: JSON-Schema `allOf`/`if-then` (two
branches, one per direction), Zod `.superRefine`, and the Pydantic
`model_validator`. Each direction carries a positive AND a negative golden
fixture wired as an expected-rejection (`skill-version.invalid-rekor-index-\
without-active-production.json`, `skill-version.invalid-active-production-\
without-rekor-index.json`).

## 5. The state machine — STAGING-FIRST, activates nothing

The lifecycle `TransitionMap` (`skillVersionSigningTransitions`) plus the pinned
`SKILL_VERSION_MAX_SIGNING_RETRIES = 5` const (CISO P0-RATIFY-2 bounded-retry
binding):

```text
sigstore_staging → { pending_production, active }
pending_production → { active, signing_failed }
active            → (terminal)
signing_failed    → (terminal)
```

- **Local creation NEVER blocks on Rekor** (P0-RATIFY-2 / Kleppmann F-MK-2 CISO
  hard-line). A SkillVersion is created at `signing_mode = 'sigstore_staging'`
  and SUCCEEDS regardless of Rekor reachability. If production signing is
  requested but Rekor is unreachable, the row goes `pending_production` with a
  `retry_after`.
- **Bounded retry.** A reconciler retries `pending_production` rows; a
  failed-but-has-budget retry is an in-place `retry_count` / `retry_after`
  bump, NOT a status transition (so the map is self-loop-free and passes the
  kernel's `validateTransitionMap` structural-soundness gate, mirroring the
  `retryTransitions` precedent). Once `retry_count` reaches
  `SKILL_VERSION_MAX_SIGNING_RETRIES`, the next failure drives
  `pending_production → signing_failed`, which surfaces to human review.
- **`active` and `signing_failed` are terminal.** A signed row is immutable; a
  re-sign or a recovery is a NEW SkillVersion (append-only, per the entity's
  event-log discipline).

**This DR activates NOTHING.** Adding these fields does not turn on production
signing. Production signing stays AND-gated on the DR-082 Q3 triggers, which
live in the **audit-harness reconciler runtime**, not this kernel. The kernel
owns only the SHAPE + the legal transition map + the cross-field invariant.

### The reconciler + Rekor OUTBOX (AC-2) is a SEPARATE follow-on — NOT this PR

The append-only Rekor **OUTBOX** and the bounded-retry **reconciler** that
actually DRIVE these transitions (read a `pending_production` row, call Rekor,
increment `retry_count`, push `retry_after`, land `active` or `signing_failed`)
are runtime EXECUTION — a clock read, a network call, a retry loop — which is
FORBIDDEN in this kernel (`FORBIDDEN.md`; Blueprint A anti-goals). That
machinery is AC-2 and lives in **audit-harness**. This kernel PR ships only the
contract the reconciler CONSUMES.

## 6. Version naming note ("v0.4.0 DR" vs package 0.10.0)

The deferral text (DR-028 T1 / DR-085 D1) names this the **"v0.4.0 Decision
Record"**. That "v0.4.0" is the NAME the deferral gave the work at authoring
time — it is NOT a target package version. The kernel had already advanced to
`@intentsolutions/core@0.9.0` (SkillVersion at 0.8.0, then UsageEvent +
HumanReview at 0.9.0) by the time this DR was authored. Shipping the package at
`0.4.0` would be a SemVer downgrade and would fail the version-lockstep gate.
The additive-minor bump from the live 0.9.0 is **0.10.0**, which this DR uses.
The "v0.4.0 DR" nomenclature is preserved in prose as the deferral's name.

## 7. Three-layer footprint (no `_generated/` hand-edits)

| Layer | File |
|---|---|
| TS interface + state machine + consts | `src/entities/SkillVersion.ts` (`SkillVersionSigningStatus` / `SkillVersionState`, `skillVersionSigningTransitions`, `SKILL_VERSION_MAX_SIGNING_RETRIES`, the six OPTIONAL fields) |
| JSON Schema | `schemas/v1/skill-version.schema.json` (six properties + two `allOf`/`if-then` branches for the invariant) |
| Zod validator | `src/validators/v1/skill-version.ts` (six fields + both-directions `.superRefine`) |
| Zod codegen reference | `src/validators/v1/_generated/skill-version.ts` (regenerated via `pnpm run codegen:validators`) |
| Pydantic mirror | `python/.../_generated/skill_version_schema.py` (regenerated) + `python/.../models.py` (the wrapper: optional-not-nullable overrides + the cross-field `model_validator` — the `GateResultV1` idiom, never editing `_generated/`) |
| Fixtures + parity tests | `tests/fixtures/v1/skill-version.signing-*.json` (4 valid + 2 invalid), plus AJV (`src/__tests__/schemas.test.ts`), Zod (`src/validators/v1/validators.test.ts`), the state-machine suite (`src/entities/skill-version-signing.test.ts`), and Python parity (`python/tests/test_parity.py`) |

## 8. Consequences

- The Skill Refiner (`@intentsolutions/refiner`) can now record a SkillVersion's
  signing posture in the canonical entity instead of an out-of-band shadow field.
- The audit-harness reconciler (AC-2) has a stable contract to drive.
- The shape is amendable in place until the first production-Rekor signature of a
  SkillVersion carrying these fields; after that, changes are Class-1 ISEDC + a
  likely `/v2`, exactly as for the `version_kind` enum (DR-085 D5).
