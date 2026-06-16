# `_generated/` — Pydantic codegen reference output (NOT the public API)

This directory holds the **raw output** of
[`datamodel-code-generator`](https://github.com/koxudaxi/datamodel-code-generator)
run against `schemas/v1/*.json`. It is the Python analogue of the Zod
`src/validators/v1/_generated/` directory — **reference material, not the
canonical public surface.**

The canonical Python surface lives one level up at
`intent_eval_core/models.py`, which:

1. Re-exports each generated root model under its canonical name
   (`GateResultV1`, `EvalSpec`, …) — the generator derives verbose class names
   from each schema's `title`.
2. Layers hand-written cross-field `model_validator`s for the `allOf`/`if-then`
   conditional rules the generator cannot express (e.g. gate-result/v1's
   "advisory requires advisory_severity", "fail/advisory/error requires a
   non-empty reason"). These mirror the Zod `.superRefine()` blocks exactly.

## Codegen invocation

```bash
pnpm run codegen:pydantic          # regenerate (pinned datamodel-code-generator)
pnpm run codegen:pydantic:check    # idempotency gate (CI)
```

The script (`scripts/codegen_pydantic.py`) is reproducible: same schemas + the
pinned generator version => byte-identical output. It normalizes the absolute
`$ref`/`$id` the predicate schemas carry down to relative refs so the generator
resolves them locally (AJV resolves them against each schema's `$id` base; we
collapse to relative paths — both arrive at the same target file).

## What NOT to do

- **Don't import from `_generated/`** — import from `intent_eval_core` /
  `intent_eval_core.models` (the public surface).
- **Don't edit `_generated/*.py` by hand** — they're overwritten on next codegen
  and CI-gated for staleness.
