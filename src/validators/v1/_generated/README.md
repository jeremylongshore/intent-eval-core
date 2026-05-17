# `_generated/` — codegen reference output (NOT canonical)

This directory holds the **raw output** of `json-schema-to-zod` run against
`schemas/v1/*.schema.json`. **It is not the canonical source of validators.**
The canonical validators live one level up at `src/validators/v1/*.ts` and
are **hand-authored** to:

1. Apply Zod `.brand<'X'>()` to primitive fields so the inferred Zod output
   types are structurally identical to the TS interfaces in `src/entities/`
2. Resolve cross-file `$ref`s (which `json-schema-to-zod` produces as
   `z.any()` because it doesn't follow refs across files)
3. Use `z.discriminatedUnion` for variant types (better narrowing than
   `z.union`)
4. Apply normative `superRefine` rules from `if/then` schema blocks
   (e.g., `gate_decision === 'advisory'` requires `advisory_severity`)

## Codegen invocation

```bash
pnpm run codegen:validators
```

This regenerates `_generated/*.ts` from the schemas. The script is reproducible
(same input → same output, pinned `json-schema-to-zod` version in `package.json`).

## When to consult this dir

- **Before hand-authoring a new entity validator**: run codegen, read the
  generated shape to understand what the schema implies before adding brands
- **When updating an existing schema**: re-run codegen, diff the generated
  output against the previous version to spot what changed at the structural
  level (then propagate the changes to the hand-authored canonical version)

## What NOT to do

- Don't import from `_generated/` — it's reference material, not API
- Don't edit `_generated/*.ts` by hand — they'll be overwritten on next codegen
- Don't ship `_generated/` to consumers via `package.json#exports` — the
  canonical `index.ts` one level up is the only public surface
