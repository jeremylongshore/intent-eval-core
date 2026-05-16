/**
 * Canonical 13-entity domain model — re-export surface.
 *
 * Per Blueprint B § 2. Every entity in the canonical model exports:
 *   - its TS interface (the entity type itself)
 *   - any state-machine state literal types
 *   - any enum literal unions referenced by the entity
 *   - the const transition map (where applicable)
 *
 * Authoring order: E02a, E02b (this iteration), E02c, E02d.
 */

export * from './EvalSpec.js';
export * from './EvalRun.js';
export * from './MatcherMap.js';
export * from './EvidenceBundle.js';
export * from './JudgeDecision.js';
export * from './RuntimeReceipt.js';
