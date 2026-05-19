# `intent-eval-core/000-docs/` — Index

Document filing standard: [Document Filing Standard v4.3](~/000-projects/002-command-bible/DOCUMENT-FILING-STANDARD-v3.0.md) (despite the path name, the version is v4.3).

Naming: `NNN-CC-ABCD-description-YYYY-MM-DD.md` where:
- `NNN` is the next sequential 3-digit number (chronological)
- `CC` is the category-type code:
  - `AA` — After-action / audit / archive
  - `AT` — Architectural / technical authority docs
  - `DR` — Decision Records (reserved; canonical home is `intent-eval-lab/000-docs/`)
  - `RR` — Research / recon
  - `PP` — Planning / proposal
- `ABCD` is the sub-category code (e.g., `AACR` = After-Action Critical Review, `ARCH` = Architecture)
- `description` is kebab-case
- Date is the landing date (when the doc was first committed)

## Inventory

| ID | Title | Date | Category | Status |
|---|---|---|---|---|
| 001 | [Release v0.1.0 AAR](001-AA-AACR-release-v0.1.0-2026-05-17.md) | 2026-05-17 | AA-AACR | committed |
| 002 | [Per-repo blueprint (applies Blueprint C)](002-AT-ARCH-repo-blueprint-2026-05-18.md) | 2026-05-18 | AT-ARCH | NORMATIVE (binding authority for this repo) |

## Cross-repo authority chain

This repo's `000-docs/` is **downstream** of `intent-eval-lab/000-docs/`. Canonical decisions live in the lab; this repo's docs are repo-local applications (AARs, per-repo blueprints) plus repo-specific decision records (none yet at v0.1.0).

The authority chain for any doc in this directory:

1. Blueprint A (lab) — ecosystem constitution
2. Blueprint B (lab) — runtime + canonical domain model
3. Blueprint C (lab) — per-repo blueprint template
4. Canonical Glossary (lab)
5. Binding DRs cited in this doc's frontmatter (lab)
6. This per-repo blueprint (002-AT-ARCH) — NORMATIVE for this repo
7. Other docs in this directory — informative unless explicitly marked NORMATIVE

Drift from a higher-authority doc is treated as drift from the constitution itself.
