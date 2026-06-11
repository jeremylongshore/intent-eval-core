# DR-RFC — CompositionDag wire format normative spec

| Field | Value |
|---|---|
| Doc | `009-DR-RFC-compositiondag-wire-format-2026-06-10.md` |
| Status | Accepted (acting-head, 2026-06-10) |
| Scope | Locks the on-the-wire serialization of `CompositionDag` (EvalSpec § composition) as canonical for downstream consumers |
| Bead | `bd_000-projects-3sjx` (iec-deferral-F) |
| Binds to | Blueprint B § 1.3 (composition semantics — node types, edge enum, cycle policy, failure propagation) — **already NORMATIVE**, not re-litigated here |
| Implements | `src/entities/EvalSpec.ts` (`CompositionDag` / `CompositionNode` / `CompositionEdge`) + `src/validators/v1/eval-spec.ts` (`CompositionDagSchema`) |

**Beads:** `bd_000-projects-3sjx`

## 1. What this RFC does (and does not do)

This RFC **ratifies an already-made and already-shipped choice**: the serialization shape of the composition DAG carried in `EvalSpec.composition`. It introduces **no new design**. The semantics of composition — what a node is, what an edge means, when a cycle is rejected, how failure propagates — are **bound by Blueprint B § 1.3** and are NOT in scope here. The only thing this RFC locks is the **wire format** (the `engineer's-choice delta` Blueprint B § 1.3 explicitly delegates), so downstream tools that read or emit an `EvalSpec` do not fork into incompatible representations.

Per `src/entities/EvalSpec.ts`:

> Wire format (adjacency vs edge list) is engineer's choice; this kernel picks adjacency with `id` + `kind` + reference because it minimizes cycle-detection cost and matches the textual examples in § 1.3.

This RFC promotes that in-code comment to a **normative, citable lock**.

## 2. The locked wire format (verbatim from the implementing source)

The canonical wire format is **adjacency-list-with-typed-edges**: a `nodes` array plus an `edges` array. This is exactly the shape in `src/entities/EvalSpec.ts` and enforced by `CompositionDagSchema` in `src/validators/v1/eval-spec.ts`.

### 2.1 `CompositionDag`

```ts
export interface CompositionDag {
  readonly nodes: readonly CompositionNode[];
  readonly edges: readonly CompositionEdge[];
}
```

Both arrays are required; the Zod validator is `.strict()` (no extra keys). Empty `nodes`/`edges` arrays are structurally well-formed — acyclicity and reachability are validator/runtime concerns (§ 3), not wire-format concerns.

### 2.2 `CompositionNode`

```ts
export interface CompositionNode {
  /** Local-to-DAG node identifier (unique within composition). */
  readonly id: string;
  /** Node type — drives runtime dispatch (Blueprint B § 1.3 line 92). */
  readonly kind: 'eval_run' | 'tool_invocation';
  /** Reference to the entity this node materializes. */
  readonly ref: Uuidv7;
}
```

- `id` — string, local-to-DAG, unique within the composition. It is **not** a UUIDv7; it is an in-graph handle that edges reference. Distinct from `ref`.
- `kind` — closed two-element enum `'eval_run' | 'tool_invocation'` (Blueprint B § 1.3 line 92). Adding a third node kind touches the canonical-domain schema surface — Class-1 ISEDC.
- `ref` — `Uuidv7` FK to the entity the node materializes (the EvalRun or ToolInvocation).

### 2.3 `CompositionEdge`

```ts
export interface CompositionEdge {
  /** Source node id (CompositionNode.id). */
  readonly from: string;
  /** Target node id (CompositionNode.id). */
  readonly to: string;
  /** Edge type. Drives runtime failure-propagation per § 1.3 line 100. */
  readonly kind: CompositionEdgeKind;
}

export type CompositionEdgeKind = 'feeds' | 'gates' | 'enriches';
```

- `from` / `to` — strings referencing `CompositionNode.id` values (NOT `ref` UUIDs). This is the adjacency: edges connect node-local ids.
- `kind` — closed three-element enum `'feeds' | 'gates' | 'enriches'` (Blueprint B § 1.3 lines 94–96).

### 2.4 Worked example

```json
{
  "nodes": [
    { "id": "n1", "kind": "tool_invocation", "ref": "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
    { "id": "n2", "kind": "eval_run",        "ref": "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a6c" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "kind": "feeds" }
  ]
}
```

## 3. Bound semantics (cite-only — owned by Blueprint B § 1.3, NOT this RFC)

This RFC does not define these; it records the binding so a reader of the wire format knows where the semantics live. All of the following are **NORMATIVE in Blueprint B § 1.3** and mirrored in the kernel doc-comments on `EvalSpec.ts`:

| Concern | Binding | Kernel surface |
|---|---|---|
| Node types | `'eval_run' \| 'tool_invocation'` (§ 1.3 line 92) | `CompositionNode.kind` |
| Edge enum | `'feeds' \| 'gates' \| 'enriches'` (§ 1.3 lines 94–96) | `CompositionEdgeKind` |
| Cycle policy | runtime topologically sorts; cycles detected at EvalSpec validation time and rejected at submission with `400 Bad Request` (§ 1.3 line 98) | validator/runtime — NOT type-level |
| Failure propagation | `gates` upstream FAIL → downstream `skipped_due_to_gate`; `feeds` upstream FAIL → downstream `archived_failed` (terminal_reason `upstream_feed_failed`); `enriches` upstream FAIL → downstream proceeds, missing-enrichment recorded in RuntimeReceipt (§ 1.3 line 100) | runtime |

**Extension policy:** adding a fourth edge kind or a third node kind requires **Class-1 ISEDC convening** per DR-010 § 7 Q6 (touches canonical-domain schema surface). The wire format (this RFC) is additive-only at the representation layer; semantic enum growth is gated upstream.

## 4. Why adjacency-list-with-typed-edges (the engineer's-choice rationale)

- **Minimizes cycle-detection cost** — adjacency over node ids lets the runtime build the dependency graph in one pass; a flat edge list with embedded node copies would force de-duplication first.
- **Matches the textual examples in Blueprint B § 1.3** — the spec's own illustrations are node/edge separated, so the wire format mirrors the source of truth rather than re-encoding it.
- **Stable content-addressing** — `nodes`/`edges` as two ordered arrays serialize deterministically under the kernel's canonical-form rules, so `EvalSpec.content_hash` is reproducible across producers.

## 5. Conformance & verification

- **Structural enforcement.** `CompositionDagSchema` (`.strict()`) in `src/validators/v1/eval-spec.ts` rejects any DAG that is not exactly `{nodes, edges}` with the node/edge shapes above. Any downstream producer that emits a different shape fails kernel validation.
- **Gate.** `pnpm run check` (lint + typecheck + test + arch + boundaries) stays green — this is a doc-only change; it touches no code path, adds no dependency, and changes no public surface.
- **Doc-quality.** markdownlint / Vale / lychee (advisory `doc-quality.yml`) run on the markdown.

## 6. Cross-references

- `000-docs/002-AT-ARCH-repo-blueprint-2026-05-18.md` § deferrals — `CompositionDag` wire-format normative spec listed under `iec-deferral-F`; this RFC discharges that deferral.
- `000-docs/001-AA-AACR-release-v0.1.0-2026-05-17.md` — deferral table row for `bd_000-projects-3sjx`.
- `000-docs/005-AA-AUDT-appaudit-devops-playbook.md` — appaudit note flagging the unlocked wire format; closed by this RFC.
- `src/entities/EvalSpec.ts` — the implementing TypeScript types.
- `src/validators/v1/eval-spec.ts` — `CompositionDagSchema` (the runtime contract).
