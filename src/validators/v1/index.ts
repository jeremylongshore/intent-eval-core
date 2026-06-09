/**
 * Zod runtime validators v1 — barrel export.
 *
 * Per-entity schemas are re-exported from named files for tree-shaking.
 * Consumers who only need a subset (e.g., j-rig only needs JudgeDecision +
 * EvalRun) import directly from `@intentsolutions/core/validators/v1/<entity>`
 * to drop unused validators at build time.
 *
 * This barrel exists for one-stop ergonomics; production consumers SHOULD
 * prefer per-file imports for minimum bundle size.
 */

export * from './_primitives.js';
export * from './eval-spec.js';
export * from './eval-run.js';
export * from './matcher-map.js';
export * from './evidence-bundle.js';
export * from './evidence-statement.js';
export * from './judge-decision.js';
export * from './runtime-receipt.js';
export * from './regression-pack.js';
export * from './rollout-gate.js';
export * from './skill-snapshot.js';
export * from './session-trace.js';
export * from './tool-invocation.js';
export * from './cost-record.js';
export * from './failure-taxonomy.js';
export * from './gate-result-v1.js';
export * from './retraction-v1.js';
export * from './dashboard-render-v1.js';

// Authoring-tier validators (Spec Authority Kernel, plan 033 § 14).
export * from './authoring/index.js';
