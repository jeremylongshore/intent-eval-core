/**
 * RuntimeReceipt runtime validator (Blueprint B § 2.6).
 */

import { z } from 'zod';
import { Rfc3339Schema, Sha256Schema, Uuidv7Schema } from './_primitives.js';
import { EvalRunTerminalReasonSchema } from './eval-run.js';
import { RuntimeLimitsSchema } from './eval-spec.js';

export const EvalRunTerminalStateSchema = z.enum([
  'archived',
  'skipped_due_to_gate',
  'archived_failed',
]);

export const ActualResourceUsageSchema = z
  .object({
    tokens_consumed: z.number().int().nonnegative(),
    wall_clock_ms: z.number().int().nonnegative(),
    peak_memory_mb: z.number().int().nonnegative(),
    network_egress_bytes: z.number().int().nonnegative(),
  })
  .strict();

export const RuntimeReceiptSchema = z
  .object({
    id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema,
    created_at: Rfc3339Schema,
    eval_spec_content_hash: Sha256Schema,
    skill_snapshot_sha: Sha256Schema,
    provider_adapter_versions: z.record(z.string(), z.string()),
    tool_versions: z.record(z.string(), z.string()),
    runtime_limits_in_effect: RuntimeLimitsSchema,
    actual_resource_usage: ActualResourceUsageSchema,
    worker_identity: z.string().min(1),
    worker_host_fingerprint: Sha256Schema,
    terminal_state: EvalRunTerminalStateSchema,
    terminal_reason: EvalRunTerminalReasonSchema,
    evidence_bundle_id: Uuidv7Schema,
    cost_record_id: Uuidv7Schema,
  })
  .strict();

export type RuntimeReceipt = z.infer<typeof RuntimeReceiptSchema>;
