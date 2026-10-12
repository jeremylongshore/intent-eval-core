# `_generated/` — codegen reference output (NOT canonical)

This directory holds the **formatted reference output** of `json-schema-to-zod` run against
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
pnpm run codegen:validators        # regenerate and format references
pnpm run codegen:validators:check  # verify without writing files
```

This regenerates `_generated/*.ts` from every runtime schema, using the
lockfile-resolved `json-schema-to-zod` version with ESM / Zod 4 output and the
repository Prettier configuration. Obsolete generated `.ts` files are removed;
this README is retained. Identical inputs produce byte-identical output.

The read-only check fails on changed, missing, or obsolete generated files. It
runs in `pnpm run check` and CI. A schema change must include its regenerated
reference files; formatting alone must not leave the check failing.

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
