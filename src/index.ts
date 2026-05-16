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
 *   - 13 canonical entities (E02a/b shipped; c+d in flight)
 *   - in-toto predicate body normative specs (gate-result/v1 in v1; others
 *     deferred per DR-010 Q3 conditional approval)
 *   - state-machine helpers
 */

export * from './primitives.js';
export * from './state-machines/types.js';
export * from './entities/index.js';
export * from './predicates/index.js';
