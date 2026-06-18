import { z } from 'zod';

export default z
  .object({
    verdict: z
      .enum(['accept', 'reject'])
      .describe(
        'Decision verdict. CLOSED enum — a row is EMITTED on accept, so verdict is the accept-record discriminator (DR-082 Q2). Widening this enum is a /v2 trigger (CISO binding: a consumer that hard-codes the closed set must never silently encounter a new verdict on an immutable row).',
      ),
    reason: z
      .array(z.string())
      .min(1)
      .describe(
        'Structured reason entries — non-empty always, since this predicate is emitted on a real verdict. Reasons SHOULD be structured codes rather than free prose to avoid leaking skill content onto a public transparency log (CISO + GC binding).',
      ),
    refiner_strategy_id: z
      .string()
      .min(1)
      .describe(
        'Identifier of the RefinerStrategy that produced this verdict. REQUIRED in the signed body per the DR-028 CISO Session-7 binding (mechanism-swappable must not become mechanism-untraceable). Strategy ids are append-only-registered — a retired id is burned forever, never reused for a different mechanism (DR-082 Q5 CISO clarification).',
      ),
    skill_version_id: z
      .any()
      .describe(
        "UUIDv7 of the accepted SkillVersion (the 14th entity per DR-028 T1). Referenced by the kernel's EXISTING UUIDv7 primitive — this predicate does NOT define a SkillVersion entity (DR-028 one-way-door).",
      ),
    parent_version_id: z
      .any()
      .describe(
        'UUIDv7 of the parent SkillVersion the accepted version was refined from. Binds parent→child so a refiner cannot launder an unrelated skill through a forged lineage (CISO binding).',
      ),
    source_snapshot_hash: z
      .any()
      .describe(
        "sha256-prefixed content hash of the post-edit SkillVersion source snapshot. The in-toto subject[].digest.sha256 for the row MUST equal this value WITHOUT the sha256: prefix (the authoring-chamber analogue of gate-result/v1's input_hash === subject digest binding, DR-082 Q4). References the SkillSnapshot content by the kernel's EXISTING sha256-prefixed primitive.",
      ),
    eval_set_ref: z
      .object({
        hash: z.any().describe('sha256-prefixed digest of the frozen eval-set content.'),
        version: z.string().min(1).describe('Version identifier of the frozen eval-set.'),
        lineage_id: z
          .any()
          .describe('UUIDv7 of the eval-set lineage the frozen version belongs to.'),
      })
      .strict()
      .describe(
        'Reference to the FROZEN eval-set the verdict was derived against — the entire epistemic basis of the claim. The hash pins exact content; version + lineage_id pin which published eval-set and its provenance lineage.',
      ),
    edit_proposal_hash: z
      .any()
      .describe(
        'sha256-prefixed hash of the EditProposal (the bounded edit-ops) that earned the pass — binds WHAT changed.',
      ),
    behavioral_delta: z
      .number()
      .describe(
        'Observed delta on the behavioral dimension the accept gate requires significant Pareto-dominance on. A determinant of the accept decision (DR-082 Q2).',
      ),
    named_dimension_deltas: z
      .array(
        z
          .object({
            id: z.any().describe('Named-dimension identifier (kebab-slug).'),
            delta: z.number().describe('Observed delta on this named dimension.'),
            non_regressed: z
              .boolean()
              .describe(
                'Whether this dimension cleared the non-regression bar at the stated alpha. For an accept verdict every entry MUST be true.',
              ),
          })
          .strict(),
      )
      .describe(
        'Per-named-dimension observed deltas — the non-regression surface of the accept gate. Each entry is independently re-checkable: a verifier re-runs the one-sided z-test on these deltas at the stated alpha. MAY be empty when the skill declares no named dimensions beyond the behavioral one.',
      ),
    alpha: z
      .number()
      .gt(0)
      .lt(1)
      .describe(
        "The significance level (α) the one-sided z-test was evaluated at — the falsifiability anchor. A 'pass' with no published alpha is an unfalsifiable assertion (DR-082 Q2). Bound in (0, 1).",
      ),
    test_statistic_kind: z
      .literal('one-sided-z')
      .describe(
        'Statistical-test family identifier. CONST for v1 — the acceptance gate is a one-sided z-test (DR-028 + DR-082 Q2). Changing the test family is a SEMANTIC change that mints /v2 (the same deltas/alpha would no longer mean the same verdict).',
      ),
    cost_record_ref: z
      .any()
      .describe(
        'OPTIONAL FK → CostRecord.id for cost attribution of the refiner run. Descriptive — not a determinant of accept.',
      )
      .optional(),
    replay_fidelity_level: z
      .enum(['RF-0', 'RF-1', 'RF-2', 'RF-3', 'RF-4'])
      .describe(
        "OPTIONAL replay-fidelity claim for the refiner run (RF-0 bit-exact … RF-4 non-reproducible), mirroring gate-result/v1's iel-E11 levels.",
      )
      .optional(),
    signing_downgrade_reason: z
      .string()
      .min(1)
      .describe(
        'OPTIONAL structured reason recorded ONLY when the signing_mode was downgraded for this row (e.g. production→staging fallback). Absent on a normally-signed row.',
      )
      .optional(),
  })
  .strict()
  .describe(
    'Predicate body of an in-toto Statement v1 whose predicateType is https://evals.intentsolutions.io/skill-refiner-pass/v1. Attests that a real SkillVersion cleared the @j-rig/refiner-core acceptance gate. The signed body carries exactly the accept DETERMINANTS (DR-082 Q2). This schema validates ONLY the predicate body. ADDITIVE per § 7.2; runs in sigstore_staging (SigningMode ln) until ALL FOUR DR-082 Q3 production triggers hold.',
  );
