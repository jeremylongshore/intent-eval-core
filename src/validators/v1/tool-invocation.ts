/**
 * ToolInvocation runtime validator (Blueprint B § 2.11).
 *
 * HARD RULE per § 2.11: credential-shaped string in args or result_summary
 * MUST cause runtime to reject + fail parent EvalRun with terminal_reason=
 * credential_leak_detected. The credential-leak check is a RUNTIME sanitizer
 * concern (audit-harness escape-scan, iaj-E06a) — this schema validates only
 * the structural shape.
 */

import { z } from 'zod';
import {
  OtelSpanIdSchema,
  Rfc3339Schema,
  SemVerSchema,
  Sha256Schema,
  StorageKeySchema,
  Uuidv7Schema,
} from './_primitives.js';

/**
 * Error-class format (deferral-E, bd_000-projects-84li). Mirrors
 * `_common.schema.json#/$defs/errorClass` and `ERROR_CLASS_PATTERN` on the
 * entity: a `<domain>.<condition>` dot-separated lowercase string. The
 * registration CONVENTION is constrained; the enum stays OPEN (a
 * kernel-registered class and a tool-defined class both match this pattern).
 */
export const ErrorClassSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Must be a <domain>.<condition> error class');

export const ToolInvocationErrorSchema = z
  .object({
    enum_class: ErrorClassSchema,
    message: z.string(),
  })
  .strict();

export const ToolInvocationSchema = z
  .object({
    id: Uuidv7Schema,
    session_trace_id: Uuidv7Schema,
    parent_span_id: OtelSpanIdSchema,
    tool_id: z.string().min(1),
    tool_version: SemVerSchema,
    args: z.record(z.string(), z.unknown()),
    args_hash: Sha256Schema,
    result_summary: z.record(z.string(), z.unknown()),
    result_hash: Sha256Schema,
    result_storage_key: StorageKeySchema.nullable(),
    invoked_at: Rfc3339Schema,
    latency_ms: z.number().int().nonnegative(),
    cost_record_ref: Uuidv7Schema,
    error: ToolInvocationErrorSchema.nullable(),
    retry_attempt: z.number().int().nonnegative(),
  })
  .strict();

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
