import { z } from 'zod';

export default z
  .object({
    id: z.any().describe('UUIDv7 PK.'),
    meter: z
      .enum([
        'api_call',
        'eval_run',
        'skill_invocation',
        'judge_decision',
        'gate_evaluation',
        'report_render',
      ])
      .describe(
        'The metered PRODUCT-METER dimension. CLOSED pricing enum (DR-103 D1 B1.4, safest for billing). HETEROGENEOUS — distinct meters carry distinct `unit`s and MUST NOT be cross-summed (C3). FREEZES at the first production-Rekor signature; widening after is a /v2 trigger. `dashboard_render` is intentionally absent (a predicate body, not a lifecycle entity). `api_call` is the ONLY meter exempt from the verified-source binding (the leaf action has no gated parent session).',
      ),
    quantity: z
      .number()
      .int()
      .gte(0)
      .describe(
        'The metered count, expressed in `unit`. A non-negative COUNT of a verified action — NEVER an assigned utility/weight/score (DR-103 epic Rule 1). Any derived value is computed downstream from the ledger at read time, never stored on the row.',
      ),
    unit: z
      .enum(['count', 'tokens', 'seconds', 'bytes'])
      .describe(
        'The business unit `quantity` is expressed in. MIXED across meters — a `tokens` count and a `count` are NON-COMPARABLE, which is exactly why a cross-`(meter, unit)` SUM is out of contract (C3).',
      ),
    source_entity_type: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [
          z.enum([
            'eval_run',
            'session_trace',
            'judge_decision',
            'tool_invocation',
            'skill_version',
          ]),
          z.null(),
        ];
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
        "The gated entity TYPE this row meters. Non-null for every metered (non-`api_call`) row (anti-gaming, DR-103 D1 B1.2, enforced in the allOf/if-then below); `null` permitted ONLY for `meter === 'api_call'`.",
      ),
    source_entity_id: z
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
        'Reference (UUIDv7) to the gated source entity. Non-null for every metered (non-`api_call`) row (anti-gaming); `null` only for `api_call`. A content/identity reference, NOT an enforced relational FK — the kernel persists nothing.',
      ),
    source_verified: z
      .boolean()
      .describe(
        'The verified marker — `true` iff the runtime confirmed the source session cleared its quality gate. MUST be `true` for every metered (non-`api_call`) row (anti-gaming, DR-103 D1 B1.2): a metered row with an unverified source is REFUSED. The runtime sets this; a developer never hand-authors `true` (DR-103 D1 B1.6 honest-emit-path binding). For `api_call` it MAY be `false`.',
      ),
    cost_record_ref: z
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
        'NULLABLE back-reference to the CostRecord that priced the SAME action — the SEAM proving UsageEvent and CostRecord are SEPARATE tables (DR-103 D1). `null` in the common case (most metered actions are not provider-priced). A reference, NOT an enforced relational FK.',
      ),
    recorded_at: z.any(),
    tenant_id: z
      .any()
      .describe(
        "RESERVED multi-tenancy slot (DR-085 D5 / deferral-G, bd_000-projects-k0fj), byte-identical to EvalSpec/EvalRun/SkillSnapshot/SkillVersion. OPTIONAL + NOT NULLABLE — omitted from `required`; an explicit `null` is rejected (the schema $ref's uuidv7 with no null branch). A present tenant_id is an attested tenant claim; an absent one is single-tenant/global and MUST NOT be pooled into a cross-tenant aggregate (DR-103 D2 B2.2). Tenant-isolation semantics deferred to a future DR; v1 single-tenant rows omit it.",
      )
      .optional(),
  })
  .strict()
  .and(z.intersection(z.any(), z.intersection(z.any(), z.any())))
  .describe(
    'The 15th canonical entity. Append-only product-metering LEDGER, DISTINCT from CostRecord: CostRecord (§ 2.12) attributes PROVIDER SPEND (money in micro-USD + tokens); UsageEvent meters PRODUCT-METER COUNTS in BUSINESS UNITS (`meter` + `quantity` + `unit`). The nullable `cost_record_ref` back-reference is the SEAM proving they are SEPARATE tables — a metering row MAY cite the CostRecord that priced the same action, but the two are independently authored and never merged. Single terminal state `recorded`; the row is immutable at creation and corrections are NEW rows, never mutation (append-only). ANTI-GAMING (DR-103 D1 B1.2, machine-enforced): every metered (non-`api_call`) row MUST bind to a VERIFIED gated source — non-null `source_entity_type` + `source_entity_id` AND `source_verified === true` (the marker the runtime sets ONLY after the source session clears its quality gate) — so an arbitrary hand-supplied `quantity` with no verified provenance is refused; enforced here via `allOf`/`if-then`, in Zod via `.superRefine`, and in Pydantic via `model_validator` (one rule, three layers). The spec\'s original "ZERO hand-validators needed" claim is DELETED. C3 (DR-103 C3 B6.1): the `meter` enum is HETEROGENEOUS and the `unit` is mixed across meters; a consumer MUST NOT SUM/aggregate `quantity` across distinct `(meter, unit)` pairs into one scalar — rollups are per-`(meter, unit)` vectors only, enforced structurally (there is no rolled-total field on the row by construction). `quantity` is a COUNTED action, NEVER an assigned utility/weight/score (DR-103 epic Rule 1). FREEZE discipline (DR-103 binding constraint 1): the `meter` enum AND the entity name FREEZE at the first production-Rekor signature (NONE in this PR); until then both stay malleable. CMO dissent preserved (`usage_events` is a billing name) — the rename-before-production-sign debt is bound in DR-103. ADDITIVE / one-way-door: this shape ships in signed @intentsolutions/core entries, so widening or merging it post-publish is irreversible — additive only. `tenant_id` is OPTIONAL-NOT-NULLABLE (DR-103 D2 / deferral-G, bd_000-projects-k0fj), byte-identical to EvalSpec/EvalRun/SkillSnapshot/SkillVersion. A UsageEvent rides INSIDE the `extensions` field of an EvidenceStatement; it does NOT become a gate-result/v1 statement. NO production-Rekor signing is wired here.',
  );
