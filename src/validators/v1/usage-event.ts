/**
 * UsageEvent runtime validator — 15th canonical entity (DR-103 D1).
 *
 * Append-only product-metering LEDGER row, DISTINCT from CostRecord: CostRecord
 * attributes provider spend (money + tokens); UsageEvent meters product-meter
 * COUNTS in business units (`meter` + `quantity` + `unit`). The nullable
 * `cost_record_ref` back-reference is the seam proving they are SEPARATE tables.
 * Single terminal state `recorded`; corrections are new rows, never mutation.
 *
 * **Anti-gaming (DR-103 D1 B1.2) — machine-enforced via `.superRefine`, NOT
 * prose.** A metered (non-`api_call`) row MUST bind to a VERIFIED gated source:
 * non-null `source_entity_type` + `source_entity_id` AND `source_verified ===
 * true`. An arbitrary hand-supplied `quantity` with no verified provenance is
 * REFUSED. The exact mirror of this block lives in the JSON-Schema `if/then`
 * (`schemas/v1/usage-event.schema.json`) and the Pydantic `model_validator`
 * (`python/.../models.py`) — one rule, three layers.
 *
 * **`tenant_id` is optional-NOT-nullable** (DR-103 D2 / deferral-G), byte-
 * identical to EvalSpec/EvalRun/SkillSnapshot/SkillVersion: `.optional()` not
 * `.nullable()`, omitted from the required set — an explicit `null` is rejected.
 */

import { z } from 'zod';
import { Rfc3339Schema, Uuidv7Schema } from './_primitives.js';

/**
 * meter — CLOSED pricing enum (DR-103 D1 B1.4). HETEROGENEOUS; cross-`(meter,
 * unit)` SUM is forbidden (C3). FREEZES at the first production-Rekor signature
 * (widening after is a /v2 trigger). `dashboard_render` is intentionally absent
 * (a predicate body, not a lifecycle metering event).
 */
export const UsageMeterSchema = z.enum([
  'api_call',
  'eval_run',
  'skill_invocation',
  'judge_decision',
  'gate_evaluation',
  'report_render',
]);

/** unit — CLOSED enum; MIXED across meters (a tokens count and a plain count are NON-COMPARABLE). */
export const UsageUnitSchema = z.enum(['count', 'tokens', 'seconds', 'bytes']);

/** source_entity_type — CLOSED enum of the gated entity types a metered row binds to. */
export const UsageSourceEntityTypeSchema = z.enum([
  'eval_run',
  'session_trace',
  'judge_decision',
  'tool_invocation',
  'skill_version',
]);

export const UsageEventSchema = z
  .object({
    id: Uuidv7Schema,
    /** Metered product-meter dimension. HETEROGENEOUS; freezes at first prod signature. */
    meter: UsageMeterSchema,
    /** Non-negative COUNT of a verified action — never an assigned utility (DR-103 Rule 1). */
    quantity: z.number().int().nonnegative(),
    /** Business unit `quantity` is expressed in. MIXED across meters (C3). */
    unit: UsageUnitSchema,
    /** Gated entity TYPE; non-null for metered (non-api_call) rows (anti-gaming). */
    source_entity_type: UsageSourceEntityTypeSchema.nullable(),
    /** Reference to the gated source entity; non-null for metered rows (anti-gaming). */
    source_entity_id: Uuidv7Schema.nullable(),
    /**
     * Verified marker set by the runtime ONLY after the source session clears its
     * quality gate. MUST be true for metered rows (anti-gaming, B1.2).
     */
    source_verified: z.boolean(),
    /**
     * NULLABLE back-reference to the CostRecord that priced the same action — the
     * seam proving UsageEvent and CostRecord are SEPARATE tables. null in the
     * common case.
     */
    cost_record_ref: Uuidv7Schema.nullable(),
    recorded_at: Rfc3339Schema,
    /**
     * RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj). Optional-NOT-
     * nullable, byte-identical to EvalSpec/EvalRun/SkillSnapshot/SkillVersion.
     */
    tenant_id: Uuidv7Schema.optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    // DR-103 D1 B1.2 anti-gaming invariant — a metered (non-`api_call`) row MUST
    // bind to a VERIFIED gated source. `api_call` is the only exempt meter (the
    // leaf action has no gated parent session). Three independent failure modes,
    // each surfaced on its own field path so the violation is legible.
    if (event.meter !== 'api_call') {
      if (event.source_entity_type === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source_entity_type'],
          message: `DR-103 D1 B1.2: a metered "${event.meter}" row MUST name a non-null source_entity_type (anti-gaming: no metered count without a gated source)`,
        });
      }
      if (event.source_entity_id === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source_entity_id'],
          message: `DR-103 D1 B1.2: a metered "${event.meter}" row MUST name a non-null source_entity_id (anti-gaming: no metered count without a gated source)`,
        });
      }
      if (event.source_verified !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source_verified'],
          message: `DR-103 D1 B1.2: a metered "${event.meter}" row MUST carry source_verified === true (the runtime sets it only after the source session clears its quality gate; a hand-supplied quantity with no verified provenance is refused)`,
        });
      }
    }
  });

export type UsageEvent = z.infer<typeof UsageEventSchema>;
