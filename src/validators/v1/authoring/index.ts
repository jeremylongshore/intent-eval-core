/**
 * Authoring-tier Zod validators v1 — barrel export.
 *
 * The Spec Authority Kernel (SAK) authoring contracts (DR-044). The
 * `marketplace-tier` foundation exposes the three universal folds + a
 * parameterizable `requiredFields` helper that every per-contract authoring
 * schema reuses. `skill-frontmatter` is authoring contract #1 (the walking
 * skeleton): the base + universal-folds + overlay composition the other five
 * contracts will follow.
 *
 * Reachable as `@intentsolutions/core/validators/v1/authoring` (direct) or via
 * the parent `@intentsolutions/core/validators/v1` barrel.
 */

export * from './marketplace-tier.js';
export * from './skill-frontmatter.js';
