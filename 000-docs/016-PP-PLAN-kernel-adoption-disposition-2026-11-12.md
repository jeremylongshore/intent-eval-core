# Kernel adoption disposition packet

**Status:** PROPOSED — decision not made; no contract adoption or release.
**Bead:** `bd_000-projects-6fwn`; related `bd_000-projects-dn6j.8`.
**Decision owner:** unset. **Decision date:** unset. **Ratification record:** unset.
**Source baseline:** core `488cf6aa999700e1c71ff3b07be42959fe4b6650`.

## Decision requested

Review the three proposals in [core issue 90](https://github.com/jeremylongshore/intent-eval-core/issues/90)
individually. The recommendation below is a proposed disposition, not an approved
policy. It preserves [core document 012](012-AT-SPEC-eval-substrate-contract-identity-2026-08-01.md):
one canonical kernel `EvalSpec`, with separately named runtime-owned profiles and
explicit adapters. This packet does not replace that decision or publish a schema.

| Proposal | Recommended disposition for review | Concrete boundary | Owner decision |
| --- | --- | --- | --- |
| `skill-contract` | Adopt a stable contract after a bounded design/parity implementation; do not import the draft unchanged | A separately versioned IS-authored skill-card contract, proposed `canonical/v1` family; no invented upstream-base attribution | unset |
| `capability` | Adopt the abstract capability value contract; defer promotion of the complete marketplace map | Publish a typed vocabulary and scope representation; retain harness-token mappings, parser and corpus exceptions in their consumer | unset |
| `eval-spec` profile | Reject a second unrelated contract named `EvalSpec`; defer public kernel profile promotion until a versioned case-family design is reviewed | Preserve the existing canonical entity and J-Rig adapter; compare model-turn and scripted-case semantics before promoting either profile | unset |

“Adopt” here requests a design direction and implementation work, not immediate
publication of the current bytes. An owner may instead defer or reject either
proposal; record the selected disposition, rationale and authority for each row.
No row is decided merely by merging this proposed packet.

## Pinned proposal evidence

Marketplace main was verified as `0500b275e963c027f6b410e8c49c0446945c574e`.
The stale, dirty primary checkout was not used as current authority or modified.

| Artifact | Exact source and history | SHA-256 of reviewed bytes |
| --- | --- | --- |
| Skill-card JSON Schema | [skill-contract.schema.json](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/0500b275e963c027f6b410e8c49c0446945c574e/schemas/canonical/v0/skill-contract.schema.json); last change `da0b9db3f5a1b80d6547431ce5b07bc10086b5ce`, ownership record PR1276; initial draft PR1266 | `2a88935800997de3f03d52af11184affb9cdb4801fb9366005274b501214667d` |
| Capability map | [capability-map.json](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/0500b275e963c027f6b410e8c49c0446945c574e/schemas/canonical/v0/capability-map.json); last change `fec1fd6096f512bc7b85f12e9e257b30b12ab974`, PR1268 | `11700e6f992eb14df81aba152c1180b34323307d92c52a878ff16509581b8ff8` |
| Evaluation-profile proposal | Issue90's criteria-shaped profile proposal; current [SkillEvalSpec](https://github.com/jeremylongshore/j-rig-skill-binary-eval/blob/5cb7b98bb881a1680cd4073860de583ea212b463/packages/core/src/schemas/skill-eval-spec.ts) and [versioned adapter](https://github.com/jeremylongshore/j-rig-skill-binary-eval/blob/5cb7b98bb881a1680cd4073860de583ea212b463/packages/core/src/schemas/skill-eval-spec-adapter.ts) are the concrete implementation evidence | Pin both Git blobs above when preparing parity fixtures; they are not a third marketplace JSON Schema |

The pinned J-Rig profile SHA-256 is
`9fc2745a5c9e0cfb454b4b039743f076fe7a67d7acc2c9620264d39eaad97eb7`;
the adapter SHA-256 is
`333678e6ba2c9fb205d0c063fa04143a1d05586735e4eabe96a9f844df6dcc99`.

The [v0 directory](https://github.com/jeremylongshore/tons-of-skills-marketplace/tree/0500b275e963c027f6b410e8c49c0446945c574e/schemas/canonical/v0)
contains no standalone eval-spec schema. This does not erase the third proposal:
issue90 explicitly proposes the criteria-shaped evaluation profile already used by
J-Rig. The review must define its intended public artifact rather than pretend a
third completed schema exists.

[Blueprint 727 E3.13](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/0500b275e963c027f6b410e8c49c0446945c574e/000-docs/727-AT-ARCH-master-modernization-blueprint.md)
required filing the kernel proposal and recording the ownership boundary. Its
boundary record at lines 1358–1364 keeps the drafts upstream-pending until actual
kernel adoption. That marketplace deliverable was not an adoption decision.
Issue90 remains open and has only the original proposal and Beads-link comment.
No later adoption record was found in the inspected core/lab tracked documents,
matching branches or relevant core PR search. Existing document 012 and J-Rig's
local draft 049 supply prior work; this packet builds on them.

## Fit, compatibility and versioning

### Skill card

The draft governs `skill-card.yaml`, separate from model-facing `SKILL.md`
frontmatter. It adds capabilities, model classes, provenance, adapter declarations
and evaluation references; it does not replace the existing frontmatter contract.
Its current `$id` is marketplace-owned and its status is DRAFT/UPSTREAM-PENDING.
An adopted kernel artifact needs a new versioned identity and a documented mapping
from that draft, without claiming old documents already satisfy the new contract.

A proposed new `canonical/v1` family (not existing kernel infrastructure) is
recommended because this card is an IS-authored
contract, not an upstream artifact projected through authoring-base/overlay folds.
The alternative is a new authoring/v2 member with explicitly IS-authored provenance
and reviewed fold/codegen integration. Neither option may mutate frozen
`authoring/v1` or imply an authority flip in marketplace validation. The existing
[frozen write guard](https://github.com/jeremylongshore/intent-eval-core/blob/488cf6aa999700e1c71ff3b07be42959fe4b6650/scripts/codegen-authoring.ts#L110-L114)
and [frozen-family regression](https://github.com/jeremylongshore/intent-eval-core/blob/488cf6aa999700e1c71ff3b07be42959fe4b6650/src/__tests__/authoring-v1-frozen.test.ts)
make this an existing constraint, not a new freeze proposed here.

The JSON Schema alone cannot establish all intended draft guarantees. Its
[SPDX expression comment](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/0500b275e963c027f6b410e8c49c0446945c574e/schemas/canonical/v0/skill-contract.schema.json#L220-L229)
assigns operand checking to a gate; its
[upstream-license field](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/0500b275e963c027f6b410e8c49c0446945c574e/schemas/canonical/v0/skill-contract.schema.json#L145-L148)
requires equality with external provenance. This review did not locate executable
operand/equality checks in the inspected canonical-schema/adapters code, so these
are implementation-evidence gaps, not certified existing enforcement. The
[portability gate](https://github.com/jeremylongshore/tons-of-skills-marketplace/blob/0500b275e963c027f6b410e8c49c0446945c574e/scripts/check-portability-claims.mjs#L35-L41)
checks claims against a registered-adapter set; it does not by itself prove an
artifact exists for each individual card. Decide which invariants are intrinsic
validation and which require a consumer's registry/context. Preserve closed unknown-key handling, resolved commit
pins, capability scoping and omitted degradation meaning fail-closed. Do not turn
cross-file checks into an unsupported universal-validity claim.

### Capability contract versus mapping data

The current file is a versioned mapping document, not a JSON Schema: 15 abstract
capabilities, 20 builtin tool mappings, MCP/namespaced token rules and tolerated
corpus tokens. These portions have different ownership and update rates.

The proposed kernel portion is the stable capability identifier/scope contract and
its versioned vocabulary. Harness spellings, token parsing and exceptions for
particular mirrored files remain consumer data/logic. A kernel contract must not
silently make a marketplace exception a universal permission. Capability labels
also describe intent; they do not prove runtime permission enforcement.

Changing a vocabulary, supported scope or closed enum changes accepted inputs.
Define extension/version behavior explicitly, including unknown capabilities and
unresolvable adapter/model classes. Prefer an explicit rejection to silently
mapping an unknown capability onto a broader one.

### Evaluation profile

The canonical [EvalSpec schema](https://github.com/jeremylongshore/intent-eval-core/blob/488cf6aa999700e1c71ff3b07be42959fe4b6650/schemas/v1/eval-spec.schema.json)
has identity, assertions, scoring, composition, artifacts, resource limits and
provider constraints. It is not a filename convention for criteria/test cases.
Core012, merged in [PR84](https://github.com/jeremylongshore/intent-eval-core/pull/84),
expressly leaves skill-profile promotion to a follow-up decision and excludes
execution, grading, sampling and storage from the kernel.

J-Rig's adapter records source-profile hash/version, mapping revision, canonical
hash and coverage. At the pinned J-Rig commit it names kernel `0.11.0` and mapping
`j-rig-skill-eval-to-eval-spec@1.0.0`. Core's inspected main package version is
`0.11.1`; core012's `0.10.0` currency paragraph is its historical migration
baseline. These are distinct observations, not authorization to bump consumer
pins or reinterpret old evidence.

A public profile may eventually use distinct names/URIs for model-turn cases and
scripted assertion suites, or an explicitly discriminated family where shared
semantics are real. Preserve numeric versus string IDs, ordered/shared-state
assertions, fixture input identity, source bytes, unknown fields and duplicate-ID
rejection. Prose expectations must not silently become executable assertions,
judge prompts or release blockers. Existing profiles stay readable through an
explicit, versioned migration path.

## Relation to the current scripted importer

The in-progress `dn6j.8` J-Rig draft049 at
`design/dn6j8-lossless-import` builds on main
`5cb7b98bb881a1680cd4073860de583ea212b463`. Its Whiteglove source baseline is
`5dea575d51ac18ae855050cbdbddaa3ebce1a919`, containing 14 cases and 29 ordered
shell assertions. Draft049's field matrix demonstrates why this dialect cannot
be flattened into existing skill-model turns without losing exits, shared output
state, fixture identity or descriptive prose. This is local implementation
context, not a published kernel proposal or a final interoperability result.

The useful implementation prepares generic task/config/run/grade inputs and a
versioned producer receipt while leaving the shell in an explicitly selected
Whiteglove runner. It does not publish a kernel eval-case schema, add a scripted
canonical-EvalSpec adapter, or reconcile every skill-creator dialect. Passing its
integration tests therefore cannot alone close the original `dn6j.8` requirement:
“Publish one eval-case schema in the kernel and reconcile evals.json with
eval-spec.yaml,” with the description allowing a schema/converter or deprecation.

Two honest outcomes remain: implement and publish the approved kernel profile
contract plus consumer migration, or record a reviewed decision that supersedes
that publication requirement while retaining runtime-owned profiles. Neither
outcome is inferred here. Keep `dn6j.8` open for this residual decision even if
its bounded importer/producer delivery completes.

## Required parity and delivery envelope if adopted

| Surface | Required treatment |
| --- | --- |
| TypeScript, JSON Schema, Zod | Ship all three together under stable distinct exports; use supported deterministic generators and matching positive/negative fixtures |
| Python | Generate the Pydantic mirror, exercise AJV/Zod/Pydantic parity and preserve package version lockstep; do not assume authoring codegen alone provides this |
| Authoring family, if selected | Add reviewed index/export/codegen integration, effective-required/fold provenance, prose anchors, coverage map and extension rationale without changing frozen v1 |
| Version and compatibility | Distinguish schema family version, document/profile version, package version, vocabulary version and adapter mapping revision; review API surface and accepted-input changes before selecting a release |
| Consumers | Pin the actual adopted release; replace draft copies with cited kernel artifacts; add migration/round-trip and negative fixtures before removing old paths |
| Rollback | Retain old draft identities and source bytes, restore prior consumer pins/readers through a normal reviewed revert; do not rewrite signed evidence or silently downgrade new documents |

Coverage/parity checks must include strict extra-key behavior, default versus
omitted fields, SPDX expressions, capability registry changes, unknown adapters,
ordered cases/assertions, duplicate IDs and malformed references. Runtime parser,
execution, provider selection and grading implementations remain in consumers.
No new entity, state machine or predicate URI is implied by this packet; any
proposal that requires one needs a separately explicit contract decision.

After the owner records each disposition and the family/versioning choice,
create bounded implementation and consumer-pinning work under existing governance.
Update issue90 with the actual reviewed decision. Keep upstream-pending labels
until the adopted kernel artifacts are published and consumers demonstrably use
them. Bead6fwn remains open until its decision-record acceptance is met; a draft
packet is preparation, not ratification.
