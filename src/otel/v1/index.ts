/**
 * OpenTelemetry semantic-convention constants — v1 barrel.
 *
 * Exported at the package subpath `@intentsolutions/core/otel/v1`. Pins the
 * attribute names for the runtime events Blueprint B § 4.3 enumerates so the
 * five platform emitters share one spelling (Gregg finding #2). Source of
 * truth: `schemas/v1/otel-attributes.yaml`; drift-guarded by
 * `src/otel/v1/__tests__/attributes.test.ts`.
 */

export * from './attributes.js';
