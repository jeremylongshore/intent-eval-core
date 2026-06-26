/**
 * Canonical entity domain model — re-export surface.
 *
 * Per Blueprint B § 2 (13 entities) + DR-028 T1 (SkillVersion) +
 * ISEDC DR-103 D1 (HumanReview — open-ended human-trust signal). This branch
 * carries 15 entities; DR-103 D1 also ratified `UsageEvent` (parallel PR #73 off
 * the same `main`), so the canonical set settles at 16 once both land. Per
 * DR-103 D1 B1.5 the council does NOT ratify a fixed integer — no fixed ordinal
 * is claimed here. Every entity in the canonical model exports:
 *   - its TS interface (the entity type itself)
 *   - any state-machine state literal types
 *   - any enum literal unions referenced by the entity
 *   - the const transition map (where applicable)
 *
 * Authoring order: E02a (1-3) + E02b (4-6) + E02c (7-9) + E02d (10-13).
 * Complete (this branch): 13 Blueprint B entities + SkillVersion (DR-028 T1
 * DISCRIMINATOR) + HumanReview (ISEDC DR-103 D1 — open-ended human-trust signal).
 */

export * from './EvalSpec.js';
export * from './EvalRun.js';
export * from './MatcherMap.js';
export * from './EvidenceBundle.js';
export * from './EvidenceBundlePayload.js';
export * from './JudgeDecision.js';
export * from './RuntimeReceipt.js';
export * from './RegressionPack.js';
export * from './RolloutGate.js';
export * from './SkillSnapshot.js';
export * from './SkillVersion.js';
export * from './HumanReview.js';
export * from './SessionTrace.js';
export * from './ToolInvocation.js';
export * from './CostRecord.js';
export * from './FailureTaxonomy.js';
