/**
 * dependency-cruiser config for @intent-eval/core.
 *
 * Enforces Blueprint A anti-goals + the kernel's internal layering:
 *
 *   primitives.ts  ←──  state-machines  ←──  entities  ←──  predicates
 *
 * Predicates may consume entities (for FK typing) but the wire-layer rule
 * is that predicate URIs are the canonical signed surface — entities are
 * the database-side projection. This config locks the import direction so
 * future contributors can't accidentally invert it.
 *
 * Per IS Testing SOP: this config is hash-pinned. Edits require
 * `pnpm exec audit-harness init` to re-pin.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies break tree-shaking and indicate layering rot.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphaned modules are usually dead code; investigate.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|webpack)\\.config\\.(cjs|mjs|js)$',
          '(^|/)vitest\\.config\\.ts$',
          '(^|/)eslint\\.config\\.js$',
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment: 'Do not depend on Node.js deprecated core modules.',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: ['^(punycode|domain|constants|sys|_linklist|_stream_wrap)$'],
      },
    },
    {
      name: 'kernel-no-runtime-deps',
      severity: 'error',
      comment:
        'Blueprint A anti-goal: the kernel ships pure types. No runtime npm packages may appear ' +
        'in src/. All declared deps are devDependencies (build/test tooling) — none should land in dist.',
      from: { path: '^src' },
      to: {
        dependencyTypes: ['npm'],
        // Allow nothing — every runtime import must be explicitly waived here with a comment.
        pathNot: [],
      },
    },
    {
      name: 'predicates-no-entities',
      severity: 'error',
      comment:
        'Architectural invariant: predicates are the canonical signed surface (gate-result/v1 et al.). ' +
        'Entities are the database-side projection. Predicates MUST NOT import from entities — ' +
        "a predicate body must be definable WITHOUT requiring the kernel's entity types. " +
        "EvidenceBundle imports from predicates/ (the reverse direction) — that's the canonical flow.",
      from: { path: '^src/predicates' },
      to: { path: '^src/entities' },
    },
    {
      name: 'no-test-imports-in-src',
      severity: 'error',
      comment: 'Test files (*.test.ts) must never be imported by non-test source.',
      from: { pathNot: '\\.(test|spec)\\.ts$' },
      to: { path: '\\.(test|spec)\\.ts$' },
    },
    {
      name: 'state-machines-pure',
      severity: 'error',
      comment:
        'state-machines/ is a leaf layer: it depends on nothing inside src/. Entities import the ' +
        'transition map type from here; do not invert.',
      from: { path: '^src/state-machines' },
      to: {
        path: '^src/(entities|predicates)',
      },
    },
  ],

  allowed: [
    {
      from: { path: '^src/index\\.ts$' },
      to: { path: '^src/(primitives|state-machines|entities|predicates)' },
    },
    {
      from: { path: '^src/entities' },
      to: { path: '^src/(primitives|state-machines|entities|predicates)' },
    },
    {
      from: { path: '^src/predicates' },
      to: { path: '^src/(primitives|state-machines|predicates)' },
    },
    {
      from: { path: '^src/state-machines' },
      to: { path: '^src/state-machines' },
    },
    {
      from: { path: '^src/primitives\\.ts$' },
      to: { pathNot: '.*' }, // primitives is a leaf — depends on nothing
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // Exclude test files from architecture rules. Tests are not consumer-
    // shipped code — they MAY import vitest, ajv, node:fs, etc. that
    // production src/ MUST NOT. The 7 forbidden rules above govern the
    // consumer-facing surface only.
    exclude: { path: '\\.(test|spec)\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
