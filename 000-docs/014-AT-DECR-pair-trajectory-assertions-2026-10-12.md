# Class-2 pair review: typed trajectory assertions

**Status: PROPOSED — awaiting Jeremy Longshore’s decision.** Neither review is owner ratification. Kernel merge, release preparation and J-Rig migration remain pending.

## Scope and authority

Bead `bd_000-projects-dn6j.15` requests shared typed trajectory assertions. [DR-010 Q6](https://github.com/jeremylongshore/intent-eval-lab/blob/ba25e998de26a6d14be3041d2d836976c48c85a0/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md) requires a CTO/VP DevRel pair for validator additions. The executive decision council workflow was applied with that repository-defined two-seat roster. These are AI-assisted advisory reviews, not statements by human officers. Jeremy is the final decision-maker; no acting-board delegation is assumed.

## Questions

1. Use five named typed assertions or a separate trajectory block while preserving existing extensions?

2. How should parameter validation and ECMAScript regex syntax work across TypeScript, JSON Schema, Zod and Python?

3. What governance, compatibility and release order must precede the J-Rig adapter migration?

## Review outcome

```text
Typed trajectory assertions
├── Wire shape: both seats recommend five named classes
├── Extensions: preserve arbitrary extension:true payloads
├── Regex syntax: decision required
│   ├── CTO: identical ECMAScript acceptance in every binding
│   └── VP DevRel: structural kernel checks; syntax at executor load
└── Sequence: ratify → kernel release → J-Rig adapter
```

## Concrete contract proposal

Use `tool-called`, `tool-not-called`, `order-before`, `file-exists` and `file-matches-sha-in` in the existing `assertions` array, with J-Rig’s current parameter names in `target`. Keep one assertion per criterion at its existing index. Preserve legacy named classes and opaque `extension: true` values; check the extension marker before interpreting a class as typed.

```json
{"class":"file-matches-sha-in","target":{"path":"report.md","in":"{path}.sha256"}}
```

All parameter objects are strict. File selectors require exactly one nonempty `path` or `pattern`; optional fields reject null. Preserve the existing slash-based `in` restrictions without inventing additional path normalization. `negate` must never turn invalid or missing evidence into success; that rule is executor-owned.

## Decision still required: regex boundary

The existing J-Rig validator calls JavaScript `new RegExp(pattern)` without flags. That differs from Python `re` and the installed standard JSON Schema regex checker. For example, `a\Z`, `\8`, and `(?<name>x)` expose differing acceptance. Passing a structural string check does not prove valid ECMAScript syntax.

| Option | Result | Cost |
| --- | --- | --- |
| Exact ECMAScript validation | Every kernel binding rejects the same syntax J-Rig rejects | Python needs a verified ECMAScript parser or a bounded Node syntax oracle; dependency and deployment implications require a decision |
| Structural contract | Kernel validates parameter types, requiredness and cross-field rules; executor compiles patterns before spend | No JavaScript runtime dependency for Python; explicitly accepts some structurally valid declarations that J-Rig rejects |

No portable-subset restriction or Python-regex substitution is proposed. Until Jeremy selects this boundary, a structural candidate is a review artifact and must not be merged or advertised as full acceptance parity.

## CTO review

These are my CTO recommendations, pending Jeremy’s ratification.

**Q1 — Use five typed named assertions in the existing `assertions` array.**

**Position/recommendation:** Add `tool-called`, `tool-not-called`, `order-before`, `file-exists`, and `file-matches-sha-in`, with each `target` containing the corresponding J-Rig parameters unchanged. Define an explicit mapping from J-Rig’s underscore names. Retain the existing six classes with `target: unknown`.

Split the existing `NamedAssertionExpression` into a union of legacy expressions and five concrete trajectory variants. Add `extension?: never` to named variants; preserve the existing `extension: true` branch with arbitrary `class` and `target`. Consumers must discriminate on `extension` first, then on `class`. Export the trajectory union and a guard so consumers can obtain useful narrowing without casts.

**Pros:** One assertion location, natural preservation of `canonical_assertion_index`, no duplicate canonical parameter copies, reusable types for other emitters, and strict rejection of malformed named trajectory targets.

**Cons:** The complete assertion union cannot discriminate solely on `class`, because extension classes remain arbitrary strings. This limitation already exists and must be documented.

**Evidence:** `intent-eval-core/src/entities/EvalSpec.ts` says extension names must not collide, but `intent-eval-core/schemas/v1/eval-spec.schema.json` and the public Zod validator accept every extension class string, including collisions. Tightening that branch would violate the requested compatibility. Simply expanding `AssertionClass` while keeping `NamedAssertionExpression.target: unknown` would fail the bead’s typed-contract goal.

**Expected DevRel tension:** A separate `trajectory_assertions` block offers cleaner local narrowing. However, preserving criterion identity then requires `assertion_index` references, index validation, association rules, and precedence between duplicate parameter copies.

**Accepted compromise:** Keep J-Rig-specific criterion metadata in lineage, keyed by the existing assertion index and source ID. Preserve original criteria there as source provenance if needed; declare the canonical typed target authoritative. Do not create two executable representations.

**Q2 — Preserve the actual acceptance contract; require an explicit ECMAScript validation strategy.**

**Position/recommendation:** Encode strict parameter objects in canonical JSON Schema, mirror them in public Zod/Pydantic validators, and regenerate reference artifacts:

- `tool_called`: nonempty `tool`, optional nonempty `input_contains`, optional integer `min_count >= 1`.
- `tool_not_called`: the same matcher without `min_count`.
- `order_before`: required strict `first` and `then` matchers.
- `file_exists`: exactly one nonempty `path` or `pattern`; optional boolean `produced`.
- `file_matches_sha_in`: the same selector XOR plus required nonempty `in`.

For `in`, preserve exactly `!startsWith("/") && !split("/").includes("..")`. Do not silently reject backslashes, drive-letter strings, `.` segments, or repeated separators that current J-Rig accepts. Do not transfer this restriction onto `path`; that would also narrow current acceptance. Preserve `{path}` substitution semantics. Apply no schema defaults.

Use TS `path?: never`/`pattern?: never` alternatives for selector XOR, JSON Schema `oneOf`, and corresponding public-validator checks. Omitted fields remain absent; explicit `null` is invalid.

**Critical finding:** Stock `format: "regex"` is insufficient for exact compatibility. I verified locally that J-Rig’s `new RegExp("a\\Z")` succeeds while installed `ajv-formats@3.0.1` rejects it. Python `re` also disagrees with JavaScript: `(?<name>x)` and `\\8` pass JavaScript but fail Python; `(?P<name>x)` does the reverse.

**Recommendation:** Name the required format as ECMAScript regex syntax with no flags and provide its actual implementation. Zod/AJV can use `new RegExp`. For immediate exact Python support, a bounded, shell-free Node syntax oracle is concrete and avoids inventing a partial regex parser, but introduces a real Node requirement. An embedded ECMAScript syntax parser is preferable operationally only after demonstrated compatibility. Neither option executes checks against trajectories.

**Pros:** Honest, reproducible validation; no false claim that Python regex or generated code establishes parity.

**Cons/tension with DevRel:** Exact syntax compatibility imposes deployment or dependency cost. Rejecting currently valid patterns as a “portable subset” changes the contract.

**Accepted compromise:** Ratify the wire shape independently, but make the Python syntax strategy an explicit release condition. Never advertise full parity while silently skipping regex validation.

Generated Pydantic optionals currently become `T | None`; the public models need overrides for optional-but-not-nullable fields. Test explicit nulls, coercion, unknown keys, selector XOR, extension collisions, and cross-engine regex examples. Generation alone proves neither semantic parity nor acceptance parity.

J-Rig’s fail-closed missing/truncated-trajectory behavior remains runtime-owned. If trajectory assertions inherit `negate`, specify that it cannot convert invalid or missing evidence into success.

**Q3 — Ratify, release the kernel, then migrate J-Rig.**

**Position/recommendation:** File the Class-2 pair record with Jeremy as final decision-maker. After ratification, ship the kernel through a PR with synchronized TS, JSON Schema, Zod, Python, generated references, API surface, and compatibility fixtures. Use the next appropriate feature release, with npm/PyPI versions in lockstep; verify published artifacts before touching J-Rig.

The bead explicitly says J-Rig waits for the kernel release. Its adapter currently pins kernel `0.11.0` and mapping revision `@1.0.0`. Its later PR must update the dependency, kernel-version constant, mapping revision, typed projection, and lineage tests together. Existing content-addressed published specs stay immutable; changed projections receive new hashes and revisions.

**Pros:** Reviewable sequencing and reproducible provenance. **Cons:** Two releases and temporarily retained extension output.

**Expected DevRel tension:** Pressure to combine migration for faster delivery. **Accepted compromise:** Prepare migration examples and fixtures now; implement the adapter only after publication. Older validators need not accept newly introduced classes, but new validators must continue accepting old payloads.

**Council memo:** The greatest recovery cost is publishing a “shared typed contract” whose acceptance differs across languages or whose extension collision silently bypasses typed interpretation. Those errors can persist inside content-addressed evidence. The schema design is manageable; validation honesty is the release-critical issue.

## VP DevRel review

VP DevRel recommendation; advisory only. Jeremy has not ratified these proposals.

**Q1 — Contract shape**

**Position:** Add five named classes—`tool-called`, `tool-not-called`, `order-before`, `file-exists`, `file-matches-sha-in`—with typed `target` payloads in the existing `assertions` array.

**Pros:** Developers already understand this collection. Each source criterion retains one canonical assertion and its existing index. Other emitters can use the same contract without adopting J-Rig’s criterion envelope.

**Cons:** Expanding the class union affects exhaustive consumers. The open extension branch prevents safe narrowing by `class` alone.

**Tension with CTO:** A separate optional block appears less invasive, but creates another collection to correlate and potentially another authoritative parameter copy. Governance cost is equal; usability and ambiguity favor named assertions.

**Recommended answer:** Keep the six existing classes and their open targets unchanged. Preserve every currently accepted `extension: true` payload, including class-name collisions: current JSON Schema explicitly accepts any extension class string. Treat the extension marker as authoritative; such payloads remain opaque extensions, not canonically validated trajectory assertions. Correct the contrary comment that prohibits collisions. Ensure the legacy named branch does **not** widen into `{class: allElevenClasses, target: unknown}`, which would bypass typed validation. [Current contract and collision discrepancy](https://github.com/jeremylongshore/intent-eval-core/blob/d25a8757d112aec9b99706841c70b204090c7013/src/entities/EvalSpec.ts#L148); [accepted extension shape](https://github.com/jeremylongshore/intent-eval-core/blob/d25a8757d112aec9b99706841c70b204090c7013/schemas/v1/eval-spec.schema.json#L59).

Example:

```json
{"class":"file-matches-sha-in","target":{"path":"report.md","in":"{path}.sha256"}}
```

**Accepted compromise:** An optional block containing `{assertion_index, kind, params}` is workable only with unique, in-range references and a declared single authority. If the adapter retains original parameters in its extension target, it must reject conflicting copies. The kernel must not import J-Rig-specific criterion semantics to enforce that correspondence.

**Q2 — Validation parity**

**Position:** Make structural acceptance identical across JSON Schema, Zod, and Python; TypeScript must expose corresponding discriminated types without coercion or serialization defaults.

**Pros:** Errors occur before evaluation, and transferring JSON between bindings preserves meaning.

**Cons:** The existing ECMAScript syntax check cannot honestly be replaced by Python regex compilation.

**Tension with CTO:** I favor a clearly bounded structural contract over introducing a JavaScript runtime dependency into Python merely to validate pattern syntax. I oppose claiming identical syntax validation when implementations use different regex dialects.

**Recommended answer:**

- All parameter objects reject unknown keys.
- `tool` and optional `input_contains` are nonempty strings.
- Optional `min_count` is an integer ≥1; omission remains omission.
- `order_before` requires strict `first` and `then` tool matchers.
- File selectors require exactly one nonempty `path` or `pattern`.
- Optional `produced` is boolean; every optional field rejects explicit `null`.
- `in` is nonempty, does not start with `/`, and contains no slash-delimited `..` segment. Preserve `{path}` substitution text. Do not silently strengthen the present contract into Windows-path normalization or reject ordinary selector paths beyond current rules.
- Describe patterns as ECMAScript source evaluated without flags. Do not use Python `re` as its validator.

These rules come directly from [the existing parameter schemas](https://github.com/jeremylongshore/j-rig-binary-eval/blob/b75364db5f21b874ca1f7fa12ce76c01e3c9a7b4/packages/core/src/checks/trajectory-checks.ts#L22).

My preferred syntax boundary is explicit: the kernel accepts a nonempty pattern declaration; the executor performs ECMAScript compilation at spec load before spend. Thus `"["` passes canonical structural validation but fails J-Rig validation. That is an intentional difference from J-Rig’s current acceptance, **not** complete regex-validation parity.

**Accepted compromise:** If identical regex acceptance is mandatory, use one verified ECMAScript grammar across all bindings and fail the release until shared fixtures demonstrate parity. Never add syntax rejection only to Zod or approximate it with Python regex rules. Kernel validators must not inspect trajectories, read files, hash artifacts, or judge outcomes.

Useful rejection examples: both `path` and `pattern`; neither selector; `min_count: 0`; `produced: null`; `in: "../receipt.txt"`; misspelled `input_contans`.

**Q3 — Adoption and release sequence**

**Position:** Release the kernel first, then migrate the adapter with an explicit mapping revision and recorded compatibility evidence.

**Pros:** Consumers get an installable contract; source identities remain traceable; historical canonical hashes retain meaning.

**Cons:** Old consumers cannot necessarily read newly emitted classes. Additive acceptance in the new kernel does not imply forward compatibility with older validators.

**Tension with CTO:** Do not require ecosystem-wide migration before shipping the additive kernel, but also do not call a tag or merged PR an available package release.

**Recommended answer:** Preserve old fixtures for all six classes, arbitrary extensions, and extension collisions. Add each new class’s valid/invalid fixtures, omission/null cases, selector XOR, strict objects, numeric coercion rejection, and pattern-boundary cases. Exercise the same corpus in AJV, Zod, and Python; add TypeScript narrowing checks. Release npm and Python together under the repository’s version policy, verify installation, then begin J-Rig changes—the bead explicitly requires this order. Bead `bd_000-projects-dn6j.15`.

The future adapter should replace a recognized trajectory criterion at the **same assertion index**, preserve source IDs, flags, descriptions, and test-case coverage, and update mapping revision and hashes. Existing [adapter lines 196–220](https://github.com/jeremylongshore/j-rig-binary-eval/blob/b75364db5f21b874ca1f7fa12ce76c01e3c9a7b4/packages/core/src/schemas/skill-eval-spec-adapter.ts#L196) already preserve test-case/criterion identity; lines 230–234 emit one extension assertion per criterion. Keep unmapped criteria on that path. Preserve source metadata separately from executable target parameters.

**Accepted compromise:** A temporary explicit legacy projection mode is acceptable; silent fallback or rewriting historical projections is not.

**Council memo:** “We create industries that don't exist — we think outside of the box's box.” Here, ambition depends on a contract developers can validate without learning hidden adapter rules. The costliest recovery risk is publishing evidence whose apparently typed assertion actually came through an opaque extension or disagrees with a duplicate parameter copy. Shape, authority, and provenance must be unambiguous before release.

## Implementation and acceptance gates

The candidate must include TypeScript types, canonical JSON Schema, public Zod/Pydantic validators, regenerated references, shared positive/negative fixtures, type narrowing and legacy compatibility evidence. Public API changes require a feature-version decision; no version bump or release authorization is implied by this draft. The later J-Rig migration must preserve source criterion identity, metadata, coverage and immutable projection hashes while updating its mapping revision and dependency pin. It starts only after the published kernel artifacts are verified.

## Decision and provenance

**Decision: pending.** Jeremy has not selected the regex strategy, ratified this proposal, or authorized a specific release commit. The complete verbatim seat returns and structured vote records are retained in executive decision council session `2026-10-12-typed-trajectory-assertions`, `session.jsonl`. This Markdown is generated from those session records and filed with the document-filing workflow.

## Candidate implementation and review follow-up

The branch contains the common structural candidate only; regex rejection remains undecided. It adds shared fixtures for strict fields, selector XOR, existing path rules, integer/coercion boundaries, omission versus null, extension collisions, and Unicode strings. No version is bumped and no J-Rig adapter code changes.

The existing `NamedAssertionExpression` interface is retained for the six legacy classes so downstream interfaces can continue extending it. Trajectory variants have typed targets. After public validation, `isTrajectoryAssertion` checks the extension marker before narrowing. The Zod parsers omit native `undefined` optionals so their outputs satisfy `exactOptionalPropertyTypes` without consumer casts.

A second CTO/VP DevRel implementation review found and prompted fixes for parse-to-guard compatibility, escaped Unicode acceptance, and generated-reference ambiguity. The Python README now documents `model_dump(mode="json", by_alias=True, exclude_unset=True)` and identifies repository JSON Schemas as canonical; Pydantic's emitted schemas describe its Python representation. Shared Python fixtures use `json.loads` plus `model_validate`.

An independent Python generator preservation defect was recorded as `bd_000-projects-0k3s` ([core #114](https://github.com/jeremylongshore/intent-eval-core/issues/114)); the reference README was preserved in this candidate. This follow-up does not determine the trajectory contract or change its release gate.
