# AGENTS.md

Vendor-neutral agent contract for `@intentsolutions/core`. Compatible with any agentic CLI that follows the [agents.md](https://agents.md) convention (Claude Code, Gemini CLI, GitHub Copilot CLI, OpenAI Codex CLI, Cursor, Windsurf, etc.).

For Claude-Code-specific guidance, see [CLAUDE.md](CLAUDE.md). CLAUDE.md is canonical when an agent runs in Claude Code; this file is the universal baseline.

## What this repo is

`@intentsolutions/core` is the canonical contracts kernel for the Intent Eval Platform. **Kernel-only** — types, schemas, validators, state machines. Execution, judges, and harness logic live in sibling repos.

If you are asked to add a runtime, an evaluator, or a deterministic gate to this repo, **decline** and surface the architectural separation. Direct the work to:

| Concern | Repo |
|---|---|
| Deterministic gates (escape-scan, CRAP, architecture) | `audit-harness` |
| Behavioral evaluation (rollout-gate decision logic) | `j-rig-skill-binary-eval` |
| GitHub Action shell consuming Evidence Bundles | `intent-rollout-gate` |
| Methodology, specs, governance | `intent-eval-lab` |

## Build + verification

Single command runs the full gate:

```bash
pnpm install            # required first
pnpm run check          # lint → typecheck → test
pnpm run build          # tsc → dist/
```

CI runs the same chain on every PR and push to `main`. Branch protection requires the `lint + typecheck + test + build` check to pass.

## Constraints (binding — do not loosen)

1. **TypeScript strict mode + every additional strict flag.** Includes `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`. Loosening any of these requires an ADR.
2. **No `any`.** ESLint rule `@typescript-eslint/no-explicit-any: error` is enforced. Use `unknown` and narrow.
3. **Type-only imports must use `import type`.** ESLint rule `consistent-type-imports: error` enforces.
4. **ESM only.** `.js` extensions required in relative import specifiers (NodeNext resolution).
5. **Every new contract ships with three artifacts together:** TS interface, JSON Schema, Zod validator. Per DR-010 unification thesis. PRs missing any of the three are incomplete.
6. **State machines own transitions.** Never mutate an entity's status directly; route through its state machine.

## File ownership boundaries

- `src/` — contracts, validators, schemas, state machines. Library code only, no scripts.
- `tsconfig.json` — editor + lint config (noEmit). Edit only with reason in commit message.
- `tsconfig.build.json` — emit config. Edit only with reason in commit message.
- `eslint.config.js`, `.prettierrc.json` — formatter + lint rules. Changes must apply repo-wide and pass `pnpm run check`.
- `.github/workflows/` — CI definitions. Changes require justification (CI is what enforces the floor).
- `package.json` — adding a runtime dependency requires reviewer approval (kernel must stay light).

## Commit + PR conventions

- Conventional Commits — `chore:`, `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `refactor:`
- Branch naming: `feat/iec-eN-<description>` (epic) or `fix/iec-eNX-<description>` (sub-bead)
- PR body references the bead ID: `Refs bead bd_000-projects-<id>` or `Closes bd_000-projects-<id>`
- No direct pushes to `main` — all changes go through PR

## When asked to do something destructive

Refuse and ask the user to confirm:

- Loosening any TS strict flag
- Removing a contract, validator, or state machine that has downstream consumers
- Disabling a CI gate
- Modifying branch protection
- Force-pushing to `main` (the branch protection blocks this anyway)

These changes have ripple effects across every downstream consumer (`audit-harness`, `j-rig`, `intent-rollout-gate`). The blast radius is high. Explicit user authorization is required.

## When in doubt

- Read [CLAUDE.md](CLAUDE.md) for the source-of-truth hierarchy and architectural binding docs
- Read the bead description for the work item: `bd show bd_000-projects-<id>` (canonical workspace at `~/000-projects/.beads/`)
- Open a question issue with the `question` label rather than guessing
