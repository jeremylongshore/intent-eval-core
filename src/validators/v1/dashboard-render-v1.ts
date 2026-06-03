/**
 * dashboard-render/v1 predicate body runtime validator (B3 binding, v0.2.0
 * additive, sequenced).
 *
 * Attests a rendered dashboard HTML artifact was produced from a specific,
 * content-addressed set of evidence inputs. `input_bundles` MUST be non-empty
 * and each entry MUST carry at least one of bundle_id / content_hash so the
 * input set is reproducible (mirrors the JSON Schema `minItems` +
 * `minProperties`).
 */

import { z } from 'zod';
import {
  Rfc3339Schema,
  RunnerIdentifierSchema,
  Sha256PrefixedSchema,
  Uuidv7Schema,
} from './_primitives.js';

/** The rendered dashboard artifact a row attests. */
export const RenderedArtifactSchema = z
  .object({
    uri: z.string().min(1).optional(),
    content_hash: Sha256PrefixedSchema,
    media_type: z.string().min(1).optional(),
  })
  .strict();

/** A content-addressed evidence input the artifact was rendered from. */
export const DashboardInputBundleSchema = z
  .object({
    bundle_id: Uuidv7Schema.optional(),
    content_hash: Sha256PrefixedSchema.optional(),
  })
  .strict()
  .refine((b) => b.bundle_id !== undefined || b.content_hash !== undefined, {
    message: 'each input_bundles entry MUST carry at least one of bundle_id, content_hash',
  });

/** The full dashboard-render/v1 predicate body. */
export const DashboardRenderV1Schema = z
  .object({
    rendered_artifact: RenderedArtifactSchema,
    input_bundles: z.array(DashboardInputBundleSchema).min(1),
    rendered_at: Rfc3339Schema,
    renderer: RunnerIdentifierSchema,
    renderer_config_hash: Sha256PrefixedSchema.optional(),
  })
  .strict();

export type DashboardRenderV1 = z.infer<typeof DashboardRenderV1Schema>;

/** Canonical predicate URI per ISEDC CISO binding (evals.intentsolutions.io). */
export const DASHBOARD_RENDER_V1_URI =
  'https://evals.intentsolutions.io/dashboard-render/v1' as const;
