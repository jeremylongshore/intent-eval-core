/**
 * SessionTrace runtime validator (Blueprint B § 2.10).
 */

import { z } from 'zod';
import { OtelSpanIdSchema, Rfc3339Schema, StorageKeySchema, Uuidv7Schema } from './_primitives.js';

export const SessionTraceSchema = z
  .object({
    id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema,
    created_at: Rfc3339Schema,
    closed_at: Rfc3339Schema.nullable(),
    root_span_id: OtelSpanIdSchema,
    total_spans: z.number().int().nonnegative(),
    max_loop_depth: z.number().int().nonnegative(),
    total_tool_invocations: z.number().int().nonnegative(),
    total_judge_decisions: z.number().int().nonnegative(),
    trace_blob_storage_key: StorageKeySchema,
  })
  .strict();

export type SessionTrace = z.infer<typeof SessionTraceSchema>;
