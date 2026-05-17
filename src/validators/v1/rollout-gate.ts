/**
 * RolloutGate runtime validator (Blueprint B § 2.8).
 *
 * RolloutGateDecision (ship/no_ship/advisory/error) is DELIBERATELY DIFFERENT
 * from gate-result/v1.gate_decision (pass/fail/advisory/error) — see
 * src/entities/RolloutGate.ts for the architectural rationale.
 */

import { z } from 'zod';
import {
  CoverageSchema,
  Rfc3339Schema,
  SemVerSchema,
  Sha256Schema,
  Uuidv7Schema,
} from './_primitives.js';
import { SigningModeSchema } from './evidence-bundle.js';

export const RolloutGateDecisionSchema = z.enum(['ship', 'no_ship', 'advisory', 'error']);

export const RolloutGateSchema = z
  .object({
    id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema,
    evidence_bundle_id: Uuidv7Schema,
    policy_ref: z.string().regex(/^sha256:[a-f0-9]{64}:.+$/, 'Must be sha256:<hex>:<path>'),
    policy_content_hash: Sha256Schema,
    decision: RolloutGateDecisionSchema,
    decision_reasons: z.array(z.string()),
    coverage: CoverageSchema,
    evaluated_at: Rfc3339Schema,
    gate_version: SemVerSchema,
    signing_mode: SigningModeSchema,
    rekor_log_index: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type RolloutGate = z.infer<typeof RolloutGateSchema>;
