# AT-STND — ID + event-ID invariants

| Field | Value |
|---|---|
| Doc | `010-AT-STND-id-and-event-id-invariants-2026-06-13.md` |
| Status | NORMATIVE (invariant register for the ID/event-ID standard in `src/primitives.ts`) |
| Scope | Enumerates the invariants the kernel's ID + event-ID standard guarantees and pins the kernel-vs-runtime boundary for ID/event-ID GENERATION |
| Bead | `bd_000-projects-r1u` (iec-E06 — UUID + event-ID standards) |
| Implements | Epic iec-E06 AC clause 4 ("documented invariants land in `000-docs/`") |
| Authority chain | Blueprint A (ecosystem constitution) → Blueprint B § 2 + § 3.2 (replay semantics) → this doc → `src/primitives.ts` (the recognition/lineage standard) |

## 1. Why this doc exists

Epic iec-E06 (`bd_000-projects-r1u`) calls for a UUIDv7 strategy, a deterministic
event-ID derivation, lineage helpers, and **documented invariants in
`000-docs/`**. PR #44 landed the kernel half of the standard in
`src/primitives.ts` — recognition patterns, type guards, safe brand-or-null
helpers, the `EVENT_ID_CONTRACT` derivation pin, and the lineage-chain helpers —
but the invariants record was deferred. This doc is that record.

It also pins the boundary the standard deliberately draws: **the kernel owns
what a valid id LOOKS LIKE and how lineage chains COMPOSE; it does NOT generate
one.** Generation is runtime execution, and the kernel is not a runtime.

## 2. The kernel-vs-runtime boundary for ID generation (NORMATIVE)

> **The kernel SAYS what a valid id is. A runtime producer MAKES one.**

Generating a UUIDv7 requires a wall-clock read plus a CSPRNG draw. Deriving an
event-ID requires a SHA-256 hash over canonical inputs. Both are **runtime
execution**, forbidden in this kernel by:

- [`FORBIDDEN.md`](../FORBIDDEN.md) — the kernel's role is "types, schemas,
  validators, state machines — no runtime execution." A clock read and a hash
  are execution.
- The `.dependency-cruiser.cjs` `kernel-no-runtime-deps` rule + the
  `state-machines-pure` / leaf-purity rules.
- Blueprint A § 3 anti-goals (the kernel is not a producer).

Therefore the kernel exports the **standard** (recognition + lineage
composition) and **rescopes the GENERATORS to a runtime producer package**:

| Concern | Home | Rationale |
|---|---|---|
| What a valid id looks like (`UUIDV7_PATTERN`, `SHA256_PATTERN`, `SHA256_PREFIXED_PATTERN`, type guards, safe brands) | **kernel** (`primitives.ts`) | pure recognition over plain strings — no execution |
| The event-ID derivation RECIPE (`EVENT_ID_CONTRACT` = `evt-` + `sha256_hex(canonical_form)`) | **kernel** (`primitives.ts`) | a pinned contract object — the SINGLE place producer + verifier agree on the prefix and pattern, so they agree by construction |
| Lineage chain composition + validation (`LineageEdge`, `ancestorChain`, `validateLineage`) | **kernel** (`primitives.ts`) | pure graph walk over caller-supplied edges — no execution |
| GENERATING a UUIDv7 (clock + CSPRNG) | **runtime producer** | wall-clock read + random draw = runtime execution |
| COMPUTING the event-ID digest (SHA-256 over canonical inputs) | **runtime producer** | hashing = runtime execution |
| Drawing backoff jitter, sleeping, stamping `parent_id` | **runtime producer** | clock + scheduling = runtime execution |

The contract is the seam: a producer computes `evt- + sha256_hex(canonical)` and
the verifier (which may be the kernel-side `isEventId`) recognizes it — both
reading the **same** `EVENT_ID_CONTRACT.prefix` / `EVENT_ID_CONTRACT.pattern`, so
they never drift.

## 3. ID format invariants (NORMATIVE)

1. **Entity IDs are UUIDv7.** Every canonical-entity primary key is a UUIDv7
   (`Uuidv7` brand), matched by `UUIDV7_PATTERN`. Lowercase hex, RFC-9562
   version nibble `7`, variant nibble in `{8,9,a,b}`.
2. **Time-ordering.** UUIDv7 embeds a millisecond Unix timestamp in its high
   bits, so lexical sort over a set of UUIDv7s is (modulo same-ms ties)
   creation-time order. This is the property Blueprint B § 3.2 replay relies on
   for deterministic ordering of sibling events.
3. **Recognition is total and pure.** `isUuidv7` / `isSha256` /
   `isSha256Prefixed` / `isEventId` are total functions `string → boolean` with
   no side effects. `asUuidv7` / `asSha256` / `asSha256Prefixed` / `asEventId`
   return the branded value or `null` — they NEVER throw and NEVER fabricate a
   value. This replaces the unchecked `value as Uuidv7` cast, which trusted the
   source blindly.
4. **Digest forms are distinct and explicit.** A bare 64-hex SHA-256
   (`Sha256`) and a `sha256:`-prefixed form (`Sha256Prefixed`) are separate
   brands with separate patterns. A producer MUST NOT pass one where the other
   is expected; the safe-brand helpers enforce the distinction at the boundary.

## 4. Event-ID invariants (NORMATIVE)

The event-ID is the replay-determinism primitive: the id by which two
independent producers (or a producer and a replayer) agree they are describing
the SAME logical event.

1. **Uniqueness keyed on inputs (determinism, not randomness).** An event-ID is
   `evt- + sha256_hex(canonical_form)` where `canonical_form` is the producer's
   stable-stringified, key-sorted tuple of the event's DEFINING inputs. Two
   computations over the same defining inputs MUST produce the same event-ID;
   two genuinely different events MUST (modulo SHA-256 collision resistance)
   produce different event-IDs. Event-IDs are therefore **content-addressed**,
   not random — re-running a replay reproduces the id.
2. **Namespace prefix.** Every derived event-ID carries the `evt-` prefix
   (`EVENT_ID_CONTRACT.prefix`). This distinguishes a derived event-ID from a
   UUIDv7 entity id at a glance and reserves the `<prefix>-<digest>` shape for
   future id kinds. `isEventId` recognizes exactly `^evt-[0-9a-f]{64}$`.
3. **Single source of the recipe.** The prefix, the algorithm (`sha256`), and
   the recognition pattern live ONLY in `EVENT_ID_CONTRACT`. Producers and
   verifiers import that object rather than re-spelling the recipe — drift is
   structurally impossible.
4. **The kernel recognizes but never derives.** `isEventId` / `asEventId`
   recognize a well-formed event-ID; the SHA-256 that PRODUCES the digest is
   computed in the runtime producer (§ 2). The kernel asserting "this string is
   a valid event-ID" never implies the kernel computed it.
5. **Ordering is by the entity UUIDv7, not the event-ID.** Event-IDs are
   content hashes and carry no time bits, so they do NOT sort chronologically.
   When replay needs a deterministic order it sorts by the owning entity's
   UUIDv7 (invariant § 3.2) or follows the lineage chain (§ 5), never by the
   raw event-ID digest.

## 5. Lineage invariants (NORMATIVE)

Lineage is parent → child id resolution over a caller-supplied edge set
(`LineageEdge[]`), validated and walked by the kernel's pure helpers.

1. **A lineage is a forest, not a general graph.** Every node has at most one
   parent (`parentId: Uuidv7 | null`; `null` = root). `validateLineage` flags
   any edge set that is not a well-formed chain/forest — its `LineageDefect`
   list is empty iff the set is sound.
2. **No cycles, no self-parent, no dangling parent.** `validateLineage` rejects
   cycles, an id that is its own parent, and a `parentId` that names no known
   id. A consumer asserts `validateLineage(edges).length === 0` BEFORE trusting
   replay ordering — a malformed lineage has no well-defined ancestor chain.
3. **Ancestor resolution is deterministic or absent.** `ancestorChain(edges,
   id)` returns the ordered child → … → root chain, or `null` when the lineage
   is malformed (so the chain is undefined). It never loops forever and never
   fabricates a partial chain over a broken set.

## 6. What is OUT of scope for this doc / the kernel

- The actual UUIDv7 GENERATOR and the SHA-256 event-ID DIGEST computation
  (rescoped to the runtime producer per § 2; tracked as the iec-E06 generator
  follow-on, which also needs its runtime-package home / the Class-2 ISEDC
  override the `bd_000-projects-r1u` notes call for).
- The `canonical_form` serialization algorithm (key-sorting + stable
  stringify) — a producer-side detail. The kernel pins only the prefix +
  algorithm + recognition pattern, not the canonicalizer.
- Replay-fidelity LEVELS (RF-0..RF-4) — those are the lab's iel-E11
  enumeration; Blueprint B § 3.2 locks the semantics, not the level list.

## 7. Cross-references

- Standard implementation: [`src/primitives.ts`](../src/primitives.ts)
  (`EVENT_ID_CONTRACT`, `isUuidv7`/`asUuidv7`/…, `ancestorChain`,
  `validateLineage`).
- Boundary doctrine: [`FORBIDDEN.md`](../FORBIDDEN.md) +
  [`003-AT-STND-core-repo-boundaries-2026-05-18.md`](003-AT-STND-core-repo-boundaries-2026-05-18.md).
- Replay semantics that consume these invariants: Blueprint B § 3.2
  (intent-eval-lab `000-docs/012-AT-ARCH-platform-runtime-blueprint.md`).
- CHANGELOG record of the standard landing: `[Unreleased]` →
  "ID + event-ID standards (`primitives.ts`)".
