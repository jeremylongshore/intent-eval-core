/**
 * gate-result/v1 NORMATIVE predicate body runtime validator (Blueprint B § 7.4).
 *
 * This is the only Zod schema in v1 that corresponds to a NORMATIVE predicate
 * URI — gate_decision values, advisory_severity values, hash-prefix format,
 * and the if/then advisory rule are all spec-bound. Adding/loosening any field
 * requires Class-1 ISEDC convening.
 */

import { z } from 'zod';
import {
  CommitShaSchema,
  CoverageSchema,
  KebabSlugSchema,
  Rfc3339Schema,
  RunnerIdentifierSchema,
  SemVerSchema,
  Sha256PrefixedSchema,
  SubjectNameSchema,
  Uuidv7Schema,
} from './_primitives.js';

/** Predicate decision enum (Blueprint B § 7.4 line 800). */
export const GateDecisionSchema = z.enum(['pass', 'fail', 'advisory', 'error']);

/** Advisory severity (Blueprint B § 7.4 line 820). */
export const AdvisorySeveritySchema = z.enum(['info', 'warn', 'error']);

/** Replay fidelity (Blueprint B § 7.4 line 823, iel-E11). */
export const ReplayFidelityLevelSchema = z.enum(['RF-0', 'RF-1', 'RF-2', 'RF-3', 'RF-4']);

/** Subject side (Blueprint B § 7.3 line 779). */
export const SubjectSideSchema = z.enum(['client', 'server', 'ci', 'sandbox', 'local']);

/** Per-dimension coverage status (deferral-D, bd_000-projects-9xyk). */
export const CoverageDimensionStatusSchema = z.enum(['evaluated', 'skipped']);

/**
 * Richer per-dimension coverage element (deferral-D lockup,
 * bd_000-projects-9xyk). Additive companion to the required `coverage` string
 * arrays — see the cross-field consistency check in the body superRefine.
 */
export const CoverageDimensionDetailSchema = z
  .object({
    id: z.string(),
    status: CoverageDimensionStatusSchema,
    skip_reason: z.string().optional(),
    threshold: z.number().optional(),
    observed: z.number().optional(),
  })
  .strict();

/**
 * The full gate-result/v1 predicate body.
 *
 * Uses `.strict()` (closed-world) + an `.superRefine()` to enforce the
 * advisory → advisory_severity if/then rule from the JSON Schema's
 * allOf/if/then block.
 */
export const GateResultV1Schema = z
  .object({
    gate_id: SubjectNameSchema,
    gate_name: KebabSlugSchema,
    gate_version: SemVerSchema,
    gate_decision: GateDecisionSchema,
    gate_reasons: z.array(z.string()),
    coverage: CoverageSchema,
    policy_ref: z.string().regex(/^sha256:[a-f0-9]{64}:.+$/, 'Must be sha256:<hex>:<path>'),
    policy_hash: Sha256PrefixedSchema,
    input_hash: Sha256PrefixedSchema,
    evaluated_at: Rfc3339Schema,
    runner: RunnerIdentifierSchema,
    commit_sha: CommitShaSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
    failure_mode: z.string().optional(),
    advisory_severity: AdvisorySeveritySchema.optional(),
    cost_record_ref: Uuidv7Schema.optional(),
    replay_fidelity_level: ReplayFidelityLevelSchema.optional(),
    coverage_detail: z.array(CoverageDimensionDetailSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.gate_decision === 'advisory' && data.advisory_severity === undefined) {
      ctx.addIssue({
        code: 'custom',
        message:
          'gate_decision="advisory" requires advisory_severity per Blueprint B § 7.4 conditional rule',
        path: ['advisory_severity'],
      });
    }
    // NORMATIVE (Blueprint B § 7.4 line 829): empty gate_reasons is permitted
    // ONLY for unconditional pass — fail/advisory/error MUST carry at least one
    // reason. Mirrors the allOf/if/then block in gate-result.schema.json.
    // [f-iec-validators-3]
    if (
      (data.gate_decision === 'fail' ||
        data.gate_decision === 'advisory' ||
        data.gate_decision === 'error') &&
      data.gate_reasons.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'gate_reasons MUST be non-empty when gate_decision is "fail", "advisory", or "error" per Blueprint B § 7.4 line 829 (empty permitted ONLY for pass)',
        path: ['gate_reasons'],
      });
    }
    // Cross-field invariant (deferral-D, bd_000-projects-9xyk): every
    // coverage_detail entry's id MUST appear in the matching `coverage` array —
    // `evaluated` → dimensions_evaluated, `skipped` → dimensions_skipped. The
    // richer detail describes the SAME dimensions the required arrays declare;
    // a detail naming a dimension not in coverage is a contradiction.
    if (data.coverage_detail !== undefined) {
      const evaluated = new Set(data.coverage.dimensions_evaluated);
      const skipped = new Set(data.coverage.dimensions_skipped);
      data.coverage_detail.forEach((detail, i) => {
        const pool = detail.status === 'evaluated' ? evaluated : skipped;
        if (!pool.has(detail.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `coverage_detail[${i}].id "${detail.id}" (status=${detail.status}) is not in coverage.dimensions_${detail.status === 'evaluated' ? 'evaluated' : 'skipped'} (deferral-D cross-field invariant)`,
            path: ['coverage_detail', i, 'id'],
          });
        }
      });
    }
  });

export type GateResultV1 = z.infer<typeof GateResultV1Schema>;

/** Canonical predicate URI per ISEDC CISO binding (evals.intentsolutions.io). */
export const GATE_RESULT_V1_URI = 'https://evals.intentsolutions.io/gate-result/v1' as const;
