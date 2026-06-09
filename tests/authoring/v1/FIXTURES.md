# Authoring fixture corpus — `tests/authoring/v1/fixtures/`

> **Phase 1 test corpus** for the Spec Authority Kernel (SAK) authoring contracts,
> per plan 033 § 14.21 (closes audit C2 / F-KB-002). The corpus is authored
> **before** the per-contract schemas (corpus-first discipline, plan 033 § 14.18:
> *Phase 1 test corpus → Phase 1.5 decompose-via-test-failure → Phase 2*). It is
> the golden ground truth those schemas will be decomposed against.

## Shape

**240 fixtures** = **40 per contract × 6 contracts**. The six authoring contracts
(plan 033 § 14.A):

| Contract | Directory |
|---|---|
| Skill frontmatter | `skill-frontmatter/` |
| Plugin manifest | `plugin-manifest/` |
| Agent definition | `agent-definition/` |
| MCP config | `mcp-config/` |
| Hook config | `hook-config/` |
| Marketplace catalog | `marketplace-catalog/` |

Each contract holds three class directories (`positive/`, `negative/`, `edge/`) with
the per-class composition from plan 033 § 14.21.1:

| Class dir | Sub-class | Count | Filename prefix | Expected `valid_C(fixture, isMarketplace)` |
|---|---|---|---|---|
| `positive/` | canonical | 10 | `canonical-NN` | **TRUE** — clear-PASS, common author shapes |
| `positive/` | edge (pass) | 5 | `edge-NN-*` | **TRUE** — pass-but-uncommon (minimal-required-only, etc.) |
| `negative/` | each required field absent | 8 | `missing-<field>` | **FALSE** — one omission per the contract's required-field set |
| `negative/` | type errors | 5 | `type-<field>` | **FALSE** — wrong type for a field |
| `negative/` | constraint violation | 5 | `constraint-<label>` | **FALSE** — uppercase name, over-budget description, reserved word, etc. |
| `edge/` | Anthropic-spec ambiguity | 5 | `ambiguity-NN-*` | documented — cases where the upstream spec is silent (intentional under-spec to surface schema judgment) |
| `edge/` | frontier-model-generated | 2 | `frontier-NN-*` | documented — realistic model-generated shapes; future-proofing |
| **Total** | | **40** | | |

`positive/` = 15, `negative/` = 18, `edge/` = 7 → 40 per contract.

## Storage format + scope note

Fixtures are stored as **`.json`** (the post-parse object form). Plan 033 § 14.21.2
permits "a YAML or JSON file"; JSON keeps the structural test dependency-free (no
YAML parser in the kernel's dependency budget — see `ALLOWLIST.md`).

This bead (`iec-E11-fixtures-discipline`, scoped here to the **corpus + this doc**)
delivers the golden corpus and its structural integrity test. **Deferred to a
follow-on bead** (the full § 14.21.2 validating harness):

- Running each fixture through `valid_C(fixture, isMarketplace)` once the per-contract
  schemas land. The `marketplace-tier` foundation (`schemas/authoring/v1/`, bead
  `iec-E11-decomp`) is the first composable piece; per-contract schemas inherit it.
- YAML-source variants for the `well_formed_yaml` / `frontmatter_parses` sub-predicates
  (those negatives cannot be represented as parsed JSON objects).

## Structural integrity test

`src/__tests__/authoring-fixtures.test.ts` asserts, every run: 240 total fixtures;
exactly 40 per contract; the 15/18/7 class split; the per-sub-class counts above; and
that every fixture parses as JSON. This guards the corpus against silent drift.
