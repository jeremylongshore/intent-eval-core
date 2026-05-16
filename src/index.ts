/**
 * @intent-eval/core
 *
 * Canonical contracts kernel for the Intent Eval Platform.
 *
 * Bound by:
 * - DR-010 (ISEDC Session 4 widened-scope lock)
 * - Blueprint A (Ecosystem Master Blueprint) — 12 binding principles
 * - Blueprint B (Platform Runtime Blueprint) — 13-entity canonical domain model
 * - Blueprint C (Repo Blueprint Template) — applied per epic iec-E10
 *
 * Public surface:
 *   - branded primitive types (Uuidv7, Sha256, Sha256Prefixed, Rfc3339, SemVer, ...)
 *   - 13 canonical entities (EvalSpec, EvalRun, MatcherMap, ... — landing E02a..E02d)
 *   - gate-result/v1 normative predicate (landing in a future iec-E0X bead)
 */

export * from './primitives.js';
export * from './state-machines/types.js';
export * from './entities/index.js';
