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
        'Blueprint A anti-goal: the kernel ships pure types and a thin opt-in validators layer. ' +
        'src/entities, src/predicates, src/primitives, src/state-machines and the root index ' +
        'MUST NOT import runtime npm packages. The src/validators/ subtree is the ONLY exception ' +
        '— it imports `zod` for the opt-in runtime validators per iec-E04. Consumers who only ' +
        'need types import from the main entry and pay zero zod bundle cost.',
      from: { path: '^src/(?!validators/)' },
      to: {
        dependencyTypes: ['npm'],
        pathNot: [],
      },
    },
    {
      name: 'validators-only-import-zod',
      severity: 'error',
      comment:
        'src/validators/ is the only subtree allowed to import npm packages, and the ONLY npm ' +
        'package it may import is `zod`. Adding another runtime dep here requires explicit ' +
        'kernel-bloat review.',
      from: { path: '^src/validators/' },
      to: {
        dependencyTypes: ['npm'],
        // Match the resolved node_modules path. pnpm flattens via virtual
        // store at `.pnpm/<pkg>@<ver>/node_modules/<pkg>/`. Allow paths
        // ending in `/zod/...` (matches both the canonical and pnpm-store
        // variants).
        pathNot: ['(^|/)zod/'],
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
    {
      // Validators may import from sibling validator files + zod (via npm).
      // No imports from src/entities (which would create a duplicate-source
      // problem) or src/predicates (validators are the runtime parsers FOR
      // those types — the predicate body types are duplicated at the Zod
      // layer for tree-shakable runtime parsing).
      from: { path: '^src/validators/' },
      to: { path: '^(src/validators/|node_modules)' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // Exclude test files and codegen-reference output from architecture
    // rules. Test files are not consumer-shipped (they MAY import vitest/
    // ajv/node:fs that production src/ MUST NOT). The _generated/ subtree
    // is json-schema-to-zod reference output (see src/validators/v1/
    // _generated/README.md) — not canonical and not exported. The 7
    // forbidden rules govern the consumer-facing surface only.
    exclude: { path: '\\.(test|spec)\\.ts$|^src/validators/v1/_generated/' },
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
