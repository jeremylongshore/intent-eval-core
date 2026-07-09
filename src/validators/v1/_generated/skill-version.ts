import { z } from 'zod';

export default z
  .object({
    id: z
      .any()
      .describe(
        'UUIDv7 PK. The `skill_version_id` the skill-refiner-pass/v1 predicate body references.',
      ),
    skill_id: z
      .any()
      .describe(
        'Logical skill identifier — stable across versions of the same skill (mirrors SkillSnapshot.skill_id).',
      ),
    version_kind: z
      .enum(['edit', 'revert', 'restore'])
      .describe(
        "Load-bearing signable discriminator (DR-028 T1 line 90, P0-RATIFY-2 line 233). CLOSED enum — widening it after a signed publish is a /v2 trigger (one-way door). `edit` = a refiner-proposed forward change; `revert` = undo to a prior version's content; `restore` = re-instate an archived version. Distinct from SkillSnapshot, which has no discriminator (single terminal `created`).",
      ),
    parent_version_id: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.any(), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe(
        'HUMAN-READABLE CONVENIENCE POINTER to the PRIOR SkillVersion in the refinement lineage (SkillVersion -> SkillVersion). Lineage is internal — this is NOT an FK to SkillSnapshot (DR-028 T1 line 91). `null` for a ROOT version (the first refinement in a lineage). No record is ever mutated; a rollback is a NEW SkillVersion citing the prior (append-only event log, AC-2 / F-MK-001). DR-085 D3: this UUID is reassignable, so it is a convenience pointer ONLY — the tamper-evident integrity anchor is `parent_content_hash` (a content hash a reviewer cannot silently re-point).',
      ),
    content_hash: z
      .any()
      .describe(
        "DR-085 D3: this version's OWN post-edit content hash — the integrity anchor a child SkillVersion cites as its `parent_content_hash`. BARE 64-hex `sha256`, the SAME alphabet as `SkillSnapshot.combined_sha` (one hash alphabet platform-wide). Append-only content-hash chain: child.parent_content_hash == parent.content_hash makes the lineage tamper-evident — re-pointing `parent_version_id` (a reassignable UUID) cannot forge an append-only claim a verifier can falsify (DR-085 D3 CSO/CISO binding).",
      ),
    parent_content_hash: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.any(), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe(
        "DR-085 D3: the parent SkillVersion's `content_hash` — the tamper-evident lineage integrity anchor (the real append-only proof, vs the reassignable `parent_version_id` convenience pointer). BARE 64-hex `sha256`, ALIGNED to `SkillSnapshot.combined_sha`. MUST be `null` EXACTLY when `parent_version_id` is null (a ROOT version): root emission is provably zero-forgery (null parent_version_id + null parent_content_hash) — an implementer never forges a fake parent on a root (DR-085 D3 DevRel/CISO binding). This iff is machine-enforced at all three layers (if/then below + Zod + Pydantic).",
      ),
    source_snapshot_hash: z
      .any()
      .describe(
        "READ-ONLY REFERENCE (content hash) to the PRE-EDIT SkillSnapshot at the moment of refinement — the INPUT to the refinement (DR-028 T1 line 92; DR-085 D4 pre-edit-input clarification, matching the skill-refiner-pass/v1 predicate's now-pre-edit `source_snapshot_hash`). EXPLICITLY NOT A RELATIONAL FOREIGN KEY — there is no enforced relational integrity; it is a content-hash reference (the SkillSnapshot it names need not exist in any table the kernel knows about). DR-085 D3: BARE 64-hex `sha256`, ALIGNED to `SkillSnapshot.combined_sha` + `content_hash` + `parent_content_hash` (one hash alphabet platform-wide — the prior sha256:-prefixed form was the very mismatch DR-085 D3 corrects).",
      ),
    refiner_strategy_id: z
      .string()
      .min(1)
      .describe(
        'Identity of the RefinerStrategy that produced this version (DR-028 P0-RATIFY-5 line 270, CISO signed-manifest binding: mechanism-swappable must NOT become mechanism-untraceable). Signed in the skill-refiner-pass/v1 predicate payload, where it is also `refiner_strategy_id`.',
      ),
    created_at: z.any(),
    created_by: z.any(),
    tenant_id: z
      .any()
      .describe(
        'RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj), mirroring SkillSnapshot. OPTIONAL + additive per Blueprint B § 7.2; tenant-isolation semantics deferred to a future DR. v1 single-tenant versions omit it.',
      )
      .optional(),
    status: z
      .enum(['sigstore_staging', 'pending_production', 'active', 'signing_failed'])
      .describe(
        "AT-DECR 011 (DR-028 T1 / DR-085 D1 DEFERRED signing state machine). OPTIONAL + ADDITIVE — an absent `status` is the staging-first `sigstore_staging` default, so every previously-signed row stays valid. CLOSED enum (widening after a signed publish is a /v2 trigger, mirroring version_kind). Signing lifecycle: `sigstore_staging` (staging-first default; local creation ALWAYS lands here, never blocks on Rekor per P0-RATIFY-2/Kleppmann F-MK-2 CISO hard-line) → `pending_production` (production signing requested but Rekor unreachable; reconciler retries with `retry_after`; the bead's `pending_production` is resolved HERE as a status value, not a redundant boolean flag) → `active` (production signature landed; `rekor_log_index` non-null) | `signing_failed` (bounded retry exhausted at max_retries=5, CISO binding; surfaces to human review). STAGING-FIRST — this activates nothing; production signing stays AND-gated on DR-082 Q3 triggers in the audit-harness reconciler, NOT this kernel.",
      )
      .optional(),
    signing_mode: z
      .enum(['sigstore_staging', 'rekor_production', 'unsigned_experimental'])
      .describe(
        "AT-DECR 011. OPTIONAL + ADDITIVE — absent ≡ the staging-first `sigstore_staging` default. SAME enum as EvidenceBundle.signing_mode / RolloutGate.signing_mode (the bead's `'production'` wording maps to the kernel enum value `rekor_production`). Cross-field invariant with `rekor_log_index` + `status` (allOf below).",
      )
      .optional(),
    rekor_log_index: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.number().int().gte(0), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe(
        "AT-DECR 011 § D3. OPTIONAL + ADDITIVE — absent/null for every staging row. Rekor transparency-log index, populated ONLY on a production-signed active row. CROSS-FIELD INVARIANT (both directions, machine-enforced at all three layers): `rekor_log_index` is non-null IFF (`signing_mode='rekor_production'` AND `status='active'`). A rekor index without active+production is forged provenance → REFUSED; an active+production row without a rekor index is an unverifiable production claim → REFUSED.",
      )
      .optional(),
    retry_after: z
      .any()
      .describe(
        "AT-DECR 011. OPTIONAL + ADDITIVE. RFC 3339 UTC timestamp the reconciler MUST NOT retry a `pending_production` row before (exponential-backoff floor — the reconciler computes it, the kernel only types it). Set only while `status='pending_production'`.",
      )
      .optional(),
    retry_count: z
      .number()
      .int()
      .gte(0)
      .describe(
        'AT-DECR 011. OPTIONAL + ADDITIVE — absent ≡ 0 (no attempt yet). Count of production-signing attempts; the reconciler increments it, and once it reaches SKILL_VERSION_MAX_SIGNING_RETRIES (=5, CISO bounded-retry binding) the next failure drives `pending_production → signing_failed`. The retry LOOP is runtime (audit-harness); the kernel owns only the BOUND.',
      )
      .optional(),
    signing_downgrade_reason: z
      .string()
      .describe(
        "AT-DECR 011. OPTIONAL + ADDITIVE. Structured reason recorded ONLY when this row's signing posture was DOWNGRADED (requested `rekor_production` fell back to `sigstore_staging`, or retries exhausted). Absent on a normally-signed or plain staging row. Mirrors the skill-refiner-pass/v1 predicate's `signing_downgrade_reason` intent.",
      )
      .optional(),
  })
  .strict()
  .and(
    z.intersection(
      z.intersection(z.any(), z.any()),
      z.intersection(z.any(), z.intersection(z.any(), z.any())),
    ),
  )
  .describe(
    "The 14th canonical entity. SEPARATE from SkillSnapshot (which content-addressed-pins a skill's source state); SkillVersion captures the REFINEMENT LINEAGE produced by the Skill Refiner. DR-028 T1 DISCRIMINATOR resolution: `version_kind` is a load-bearing signable discriminator; `parent_version_id` references the prior SkillVersion (lineage internal, SkillVersion -> SkillVersion, NOT an FK to SkillSnapshot); `source_snapshot_hash` is a READ-ONLY REFERENCE (content hash) to the PRE-EDIT SkillSnapshot at the moment of refinement — explicitly NOT a relational foreign key (no enforced relational integrity; it is a content-hash reference). DR-085 D3 lineage-integrity correction: this entity now carries a self `content_hash` (its own post-edit content) + a `parent_content_hash` (the parent's `content_hash`, the tamper-evident lineage anchor); all three hash fields use the BARE 64-hex `sha256` alphabet, ALIGNED to `SkillSnapshot.combined_sha` (one hash alphabet platform-wide — no sha256:-prefixed vs bare mismatch). `parent_content_hash` is null iff `parent_version_id` is null (a root version forges no parent). ADDITIVE / one-way-door: this shape ships in signed @intentsolutions/core entries, so widening or merging it post-publish is irreversible — additive only. SIGNING STATE MACHINE (AT-DECR 011, the DR-028 T1 / DR-085 D1 DEFERRED work, landed ADDITIVELY): the six OPTIONAL fields `status` / `signing_mode` / `rekor_log_index` / `retry_after` / `retry_count` / `signing_downgrade_reason` fold in the P0-RATIFY-2 signing lifecycle — NONE joins `required`, so every previously-signed row stays valid (absent `status` ≡ the staging-first `sigstore_staging` default). STAGING-FIRST: this ACTIVATES NOTHING — local creation never blocks on Rekor (Kleppmann F-MK-2 CISO hard-line), production signing stays AND-gated on DR-082 Q3 triggers in the audit-harness reconciler runtime (the append-only Rekor OUTBOX + bounded-retry reconciler that DRIVES these transitions, AC-2, is a SEPARATE follow-on in audit-harness, NOT this kernel). Cross-field invariant (both directions, all-three-layer enforced): `rekor_log_index` non-null IFF (`signing_mode='rekor_production'` AND `status='active'`). The bead's `pending_production` is resolved as a `status` enum value, not a redundant boolean flag. Predicate URI: skill-refiner-pass/v1 references this entity by id/hash (already shipped); SkillVersion does NOT define that predicate.",
  );
