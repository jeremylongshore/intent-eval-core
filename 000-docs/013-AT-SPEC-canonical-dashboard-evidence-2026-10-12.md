# Canonical Dashboard Evidence

The private `scripts/emit-evidence.ts` helper publishes this repository's `iec`
dashboard evidence. It dogfoods the built kernel 0.11.0 through the package
self-reference. It remains outside `src/` and the published package; public
contracts, validators, API exports and dependency pins are unchanged.

## Payload Contract

Each measured gate result becomes one invariant-checked in-toto statement in an
`EvidenceBundlePayload` array. The signed bundle's `storage_key` hashes the full
canonical array. Subjects, predicate types and row count derive from the same
validated payload. The manifest includes that payload and a checked `gateResults`
projection for compatible readers.

Assembly rejects missing or invalid payloads, inconsistent signed metadata and
divergent projections. Hashing covers all transported fields, including allowed
extensions. Workflow and dashboard verification still authenticate real signatures.

## Contributor Verification

Build first so the package self-reference resolves to `dist/`:

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm exec vitest run scripts/canonical-payload.test.ts
pnpm run check
pnpm run test:coverage
pnpm run test:types
pnpm run api:check
pnpm run harness:verify
```

Twelve contracts cover independently calculated synthetic bytes, four decisions,
source/signing identities, metadata and payload mutations, projection mismatch
and missing signature files. They run with the normal Vitest suite and again
before release emission. The existing 100% library coverage floor is unchanged;
private script tests do not expand the published library's coverage denominator.
Emitter, assembler, contracts and vector are hash-pinned. Synthetic fixtures
are unsigned and never count as measured evidence.

## Live Transition

Tag-only publication and the existing signing identity remain unchanged. After
an approved release, verify the live manifest source, complete digest, metadata,
real signature and dashboard ingest/render. Record receipts on
`bd_000-projects-0s2a`; retain legacy compatibility until every channel and
retained cache has a verified disposition. Source merge alone is not a live
transition.
