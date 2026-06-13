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
| --- | --- | --- | --- | --- |
| 001 | [Release v0.1.0 AAR](001-AA-AACR-release-v0.1.0-2026-05-17.md) | 2026-05-17 | AA-AACR | committed |
| 002 | [Per-repo blueprint (applies Blueprint C)](002-AT-ARCH-repo-blueprint-2026-05-18.md) | 2026-05-18 | AT-ARCH | NORMATIVE (binding authority for this repo) |
| 003 | [Core repo boundary doctrine](003-AT-STND-core-repo-boundaries-2026-05-18.md) | 2026-05-18 | AT-STND | NORMATIVE (boundary enforcement; pairs with FORBIDDEN.md + ALLOWLIST.md + scripts/check-boundaries.ts) |
| 004 | [Testing SOP + CI/CD bootstrap AAR](004-AT-AAR-testing-cicd-bootstrap-2026-05-19.md) | 2026-05-19 | AT-AAR | informational (iec-E12 ratify-and-close) |
| 005 | [appaudit DevOps playbook](005-AA-AUDT-appaudit-devops-playbook.md) | 2026-05-20 | AA-AUDT | informational |
| 006 | [v0.2.0 additive schema evolution AAR](006-AA-AACR-v0.2.0-additive-schema-evolution-2026-06-03.md) | 2026-06-03 | AA-AACR | additive surface landed; publish held pending iec-E12 |
| 007 | [Emit signed gate-result evidence for the dashboard](007-DR-RFC-emit-evidence-dashboard-ingest-2026-06-07.md) | 2026-06-07 | DR-RFC | accepted (nr75.4; emit engine + release.yml job) |
| 008 | [Schema-policy eval — marketplace-tier foundation](008-AA-EVAL-schema-policy-marketplace-tier-2026-06-09.md) | 2026-06-09 | AA-EVAL | closes audit C2 (foundation sound; coverage boundary measured) |
| 009 | [CompositionDag wire format normative spec](009-DR-RFC-compositiondag-wire-format-2026-06-10.md) | 2026-06-10 | DR-RFC | accepted (iec-deferral-F; locks CompositionDag serialization) |
| 010 | [ID + event-ID invariants](010-AT-STND-id-and-event-id-invariants-2026-06-13.md) | 2026-06-13 | AT-STND | NORMATIVE (iec-E06 invariant register; kernel-vs-runtime generation boundary) |

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
