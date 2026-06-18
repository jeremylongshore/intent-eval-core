/**
 * skill-refiner-pass/v1 predicate body runtime validator (Class-1 ADR DR-082,
 * ADDITIVE, staging-first).
 *
 * Attests a real SkillVersion cleared the `@j-rig/refiner-core` acceptance gate:
 * significant Pareto-dominance on the behavioral dimension AND non-regression on
 * every named dimension, by a one-sided z-test at the stated `alpha`. The signed
 * body carries exactly the accept DETERMINANTS (DR-082 Q2) — strip any one and
 * the PASS is unfalsifiable.
 *
 * Mirrors the wire discipline of gate-result/v1 (DR-082 Q4): this body becomes
 * the `predicate` of an in-toto Statement v1 over DSSE; the in-toto
 * `subject[].digest.sha256` MUST equal `source_snapshot_hash` (sans `sha256:`
 * prefix). That subject↔body equality is enforced at the Statement layer (as
 * gate-result's I1/I2 are in evidence-statement.ts), NOT inside this body schema
 * — the body schema validates the body alone.
 *
 * Runs in `sigstore_staging` (the `ln` SigningMode) until ALL FOUR DR-082 Q3
 * production triggers hold. The `skill_version_id` / `parent_version_id` /
 * `source_snapshot_hash` triple references the SkillVersion by the kernel's
 * EXISTING id/hash primitives — it does NOT define a SkillVersion entity
 * (DR-028 one-way-door).
 */

import { z } from 'zod';
import { KebabSlugSchema, Sha256PrefixedSchema, Uuidv7Schema } from './_primitives.js';

/**
 * Verdict — CLOSED enum. The row is emitted on `accept`; widening this enum is a
 * /v2 trigger (DR-082 Q5 CISO binding).
 */
export const SkillRefinerVerdictSchema = z.enum(['accept', 'reject']);

/**
 * Statistical-test family — CONST for v1 (one-sided z-test, DR-028 + DR-082 Q2).
 * Changing the test family is a SEMANTIC change that mints /v2.
 */
export const SkillRefinerTestStatisticKindSchema = z.literal('one-sided-z');

/** Replay-fidelity ladder, mirroring gate-result/v1's iel-E11 RF-0..RF-4. */
export const SkillRefinerReplayFidelityLevelSchema = z.enum([
  'RF-0',
  'RF-1',
  'RF-2',
  'RF-3',
  'RF-4',
]);

/**
 * Reference to the FROZEN eval-set the verdict was derived against. `.strict()`
 * + all three fields required — the frozen eval identity is the epistemic basis
 * of the claim (DR-082 Q2).
 */
export const EvalSetRefSchema = z
  .object({
    hash: Sha256PrefixedSchema,
    version: z.string().min(1),
    lineage_id: Uuidv7Schema,
  })
  .strict();

/**
 * Observed delta on one named (non-behavioral) dimension — the non-regression
 * surface of the accept gate. Independently re-checkable by a verifier.
 */
export const NamedDimensionDeltaSchema = z
  .object({
    id: KebabSlugSchema,
    delta: z.number(),
    non_regressed: z.boolean(),
  })
  .strict();

/**
 * The full skill-refiner-pass/v1 predicate body — the DR-082 Q2 determinant set
 * (required) plus the descriptive optionals. `.strict()` mirrors the JSON
 * Schema `additionalProperties: false`.
 *
 * `alpha` is the falsifiability anchor; constrained to (0, 1) to match the JSON
 * Schema `exclusiveMinimum`/`exclusiveMaximum`. `reason` is non-empty always
 * (the row is emitted on a real verdict).
 */
export const SkillRefinerPassV1Schema = z
  .object({
    verdict: SkillRefinerVerdictSchema,
    reason: z.array(z.string()).min(1),
    refiner_strategy_id: z.string().min(1),
    skill_version_id: Uuidv7Schema,
    parent_version_id: Uuidv7Schema,
    source_snapshot_hash: Sha256PrefixedSchema,
    eval_set_ref: EvalSetRefSchema,
    edit_proposal_hash: Sha256PrefixedSchema,
    behavioral_delta: z.number(),
    named_dimension_deltas: z.array(NamedDimensionDeltaSchema),
    alpha: z.number().gt(0).lt(1),
    test_statistic_kind: SkillRefinerTestStatisticKindSchema,
    cost_record_ref: Uuidv7Schema.optional(),
    replay_fidelity_level: SkillRefinerReplayFidelityLevelSchema.optional(),
    signing_downgrade_reason: z.string().min(1).optional(),
  })
  .strict();

export type SkillRefinerPassV1 = z.infer<typeof SkillRefinerPassV1Schema>;

/**
 * Canonical predicate URI per ISEDC CISO binding (evals.intentsolutions.io,
 * never labs). FLAT — a sibling of gate-result/v1, no `/authoring/` segment
 * (DR-082 Q1).
 */
export const SKILL_REFINER_PASS_V1_URI =
  'https://evals.intentsolutions.io/skill-refiner-pass/v1' as const;
