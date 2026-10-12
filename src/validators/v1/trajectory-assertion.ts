/**
 * Structural trajectory contract candidate (bd_000-projects-dn6j.15).
 * Regex syntax policy is pending Class-2 record 014; no syntax parity is claimed.
 */
import { z } from 'zod';

const nonempty = z.string().min(1);
const toolMatcherShape = { tool: nonempty, input_contains: nonempty.optional() };

/** Preserve omission and exactOptionalPropertyTypes in public parse results. */
function omitUndefined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  // This shallow mapping only removes undefined-valued keys; nested targets
  // are normalized by their own schemas before the enclosing assertion.
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

export const TrajectoryToolMatcherSchema = z
  .object(toolMatcherShape)
  .strict()
  .transform(omitUndefined);

export const ToolCalledTargetSchema = z
  .object({ ...toolMatcherShape, min_count: z.number().int().min(1).optional() })
  .strict()
  .transform(omitUndefined);

export const OrderBeforeTargetSchema = z
  .object({ first: TrajectoryToolMatcherSchema, then: TrajectoryToolMatcherSchema })
  .strict();

export const FileExistsTargetSchema = z
  .union([
    z.object({ path: nonempty, produced: z.boolean().optional() }).strict(),
    z.object({ pattern: nonempty, produced: z.boolean().optional() }).strict(),
  ])
  .transform(omitUndefined);

const shaRecordPath = nonempty.refine(
  (value) => !value.startsWith('/') && !value.split('/').includes('..'),
  'Must not start with / or contain a slash-delimited .. segment',
);

export const FileMatchesShaInTargetSchema = z.union([
  z.object({ path: nonempty, in: shaRecordPath }).strict(),
  z.object({ pattern: nonempty, in: shaRecordPath }).strict(),
]);

export const TrajectoryAssertionSchema = z
  .discriminatedUnion('class', [
    z
      .object({
        class: z.literal('tool-called'),
        target: ToolCalledTargetSchema,
        negate: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        class: z.literal('tool-not-called'),
        target: TrajectoryToolMatcherSchema,
        negate: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        class: z.literal('order-before'),
        target: OrderBeforeTargetSchema,
        negate: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        class: z.literal('file-exists'),
        target: FileExistsTargetSchema,
        negate: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        class: z.literal('file-matches-sha-in'),
        target: FileMatchesShaInTargetSchema,
        negate: z.boolean().optional(),
      })
      .strict(),
  ])
  .transform(omitUndefined);
