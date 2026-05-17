/**
 * EvalRun runtime validator (Blueprint B § 2.2 + § 3.1).
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  Rfc3339Schema,
  SemVerSchema,
  Sha256Schema,
  Uuidv7Schema,
} from './_primitives.js';

export const EvalRunStateSchema = z.enum([
  'queued',
  'running',
  'judged',
  'reported',
  'archived',
  'skipped_due_to_gate',
  'archived_failed',
]);

export const EvalRunTerminalReasonSchema = z.enum([
  'queued_timeout_elapsed',
  'run_timeout_elapsed',
  'worker_crash_exhausted',
  'credential_leak_detected',
  'judge_unavailable_exhausted',
  'token_ceiling_exceeded',
  'evidence_contract_violation',
  'upstream_feed_failed',
]);

export const EvalRunSchema = z
  .object({
    id: Uuidv7Schema,
    eval_spec_id: Uuidv7Schema,
    eval_spec_version: SemVerSchema,
    eval_spec_content_hash: Sha256Schema,
    skill_snapshot_id: Uuidv7Schema,
    state: EvalRunStateSchema,
    terminal_reason: EvalRunTerminalReasonSchema.nullable(),
    queued_at: Rfc3339Schema,
    started_at: Rfc3339Schema.nullable(),
    judged_at: Rfc3339Schema.nullable(),
    reported_at: Rfc3339Schema.nullable(),
    archived_at: Rfc3339Schema.nullable(),
    worker_id: z.string().min(1).nullable(),
    lease_expires_at: Rfc3339Schema.nullable(),
    session_trace_id: Uuidv7Schema,
    evidence_bundle_id: Uuidv7Schema.nullable(),
    cost_record_id: Uuidv7Schema,
    parent_run_id: Uuidv7Schema.nullable(),
    idempotency_key: Uuidv7Schema,
    submitted_by: ActorIdentitySchema,
  })
  .strict();

export type EvalRun = z.infer<typeof EvalRunSchema>;
