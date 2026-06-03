# FORBIDDEN — `@intentsolutions/core` boundary enforcement

> **NORMATIVE.** Machine-readable by `scripts/check-boundaries.ts`. Hash-pinned via `@intentsolutions/audit-harness`. Edits require `pnpm exec audit-harness init` + commit the updated `.harness-hash` in the same commit.
>
> **Authority chain**: [`000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md`](000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md) (doctrine) → this file (machine-readable enumeration) → [`scripts/check-boundaries.ts`](scripts/check-boundaries.ts) (enforcement).

The kernel's role is **types, schemas, validators, state machines** — no runtime execution, no orchestration, no judges, no queues, no provider adapters, no optimization engines, no runtime telemetry. The 4 axes below enumerate the violations that take the kernel out of role. Any match against any axis is a BLOCK.

## Axis 1 — Forbidden package patterns

Adding any of these as a runtime dependency (`package.json#dependencies`) is forbidden. DevDeps allow these if explicitly listed in `ALLOWLIST.md § DevDep allowlist` with rationale.

### Web frameworks (kernel is not a service)

```text
express
fastify
koa
@nestjs/*
hapi
restify
polka
hono
elysia
next
nuxt
remix
sveltekit
astro
```

### HTTP clients (kernel makes no network calls)

```text
axios
got
node-fetch
undici
superagent
```

### Database drivers + ORMs (kernel persists nothing)

```text
pg
mysql
mysql2
mongodb
mongoose
redis
ioredis
sqlite3
better-sqlite3
prisma
@prisma/*
typeorm
sequelize
knex
kysely
drizzle-orm
```

### Job queues + schedulers (kernel runs nothing)

```text
bullmq
bull
agenda
bee-queue
queue-async
@temporalio/*
node-cron
node-schedule
cron
agendash
```

### LLM provider adapters (kernel invokes nothing)

```text
openai
@openai/*
@anthropic-ai/*
@google-ai/*
@google/generative-ai
@google-cloud/aiplatform
cohere-ai
@cohere-ai/*
replicate
@mistralai/*
ollama
@ollama/*
together-ai
groq-sdk
@huggingface/*
langchain
@langchain/*
llamaindex
@llamaindex/*
ai
```

### Optimization / RL / agent frameworks (kernel is not a runtime)

```text
@dspy/*
dspy
@openai-agents/*
autogen
autogpt
@crewai/*
@swarms/*
```

### Real-time / streaming (kernel is synchronous over plain data)

```text
socket.io
@socket.io/*
ws
sockjs
@grpc/*
graphql-subscriptions
```

### Observability runtime (kernel emits nothing; defines OTel SHAPES only)

```text
@opentelemetry/sdk-node
@opentelemetry/instrumentation
@opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-*
@sentry/node
@datadog/*
dd-trace
newrelic
prom-client
@prom-client/*
```

### Storage SDKs (kernel persists nothing)

```text
@aws-sdk/client-s3
@aws-sdk/client-dynamodb
aws-sdk
@google-cloud/storage
@google-cloud/firestore
@azure/storage-blob
@azure/cosmos
ipfs
ipfs-http-client
```

### Auth + session (kernel has no users + no sessions)

```text
passport
@passport/*
express-session
jsonwebtoken
jose
cookie-session
@auth0/*
@clerk/*
next-auth
better-auth
```

### General process management (kernel is library-only)

```text
pm2
nodemon
forever
@nestjs/cli
ts-node-dev
```

## Axis 2 — Forbidden import paths

Adding any of these source-tree paths is forbidden (regardless of what's imported into them).

```text
src/runtime/
src/runtimes/
src/orchestration/
src/orchestrator/
src/orchestrators/
src/scheduling/
src/scheduler/
src/queues/
src/queue/
src/worker/
src/workers/
src/judges/
src/judge/
src/judging/
src/adapters/
src/providers/
src/provider/
src/llm/
src/llms/
src/optimization/
src/optimizer/
src/optimizers/
src/agents/
src/agent/
src/server/
src/servers/
src/api/
src/http/
src/grpc/
src/db/
src/database/
src/persistence/
src/cache/
src/caches/
src/telemetry/runtime/
src/observability/runtime/
src/auth/
src/session/
src/sessions/
src/users/
src/cli/
src/bin/
src/commands/
```

**Allowed `src/` subpaths** (whitelist — kernel-only):

```text
src/
src/entities/
src/predicates/
src/validators/
src/validators/v1/
src/validators/v1/_generated/
src/state-machines/
src/__tests__/
```

Annotations:

- `src/` — top-level: barrel + primitives + integration test
- `src/entities/` — per Blueprint B § 2 (13 canonical entity definitions)
- `src/predicates/` — gate-result/v1 + URI constants (Blueprint B § 7)
- `src/validators/v1/` — Zod runtime parsers (opt-in subpath)
- `src/validators/v1/_generated/` — codegen reference output (not exported)
- `src/state-machines/` — transition-map type + canTransition helper
- `src/__tests__/` — test-only

Any path outside the allowed list triggers a BLOCK. Adding a new allowed-path requires PR review + update to this file + matching update to `.dependency-cruiser.cjs`.

## Axis 3 — Forbidden top-level directory names

Adding any of these directories at repo root is forbidden.

```text
services/
orchestrator/
orchestrators/
runtime/
runtimes/
workers/
queues/
agents/
agent/
bin/
servers/
server/
db/
database/
persistence/
cache/
caches/
sandbox/
sandboxes/
playground/
examples/
demo/
demos/
ops/
deployment/
deployments/
k8s/
helm/
terraform/
infrastructure/
docker/
.devcontainer/
```

**Allowed top-level directories** (whitelist — repo is library-only):

```text
.beads/         (gitignored — task tracking)
.github/        (CI workflows)
.harness-hash   (file — hash-pinned policy manifest)
.husky/         (pre-commit hooks)
.vscode/        (editor settings — optional)
000-docs/       (repo-local docs per Document Filing Standard v4.3)
coverage/       (gitignored — test coverage output)
dist/           (gitignored — build artifacts)
node_modules/   (gitignored — installed deps)
reports/        (gitignored — arch-check + harness logs)
schemas/        (versioned JSON Schemas — language-agnostic wire format)
scripts/        (boundary checker + other dev tools)
src/            (TypeScript source — see Axis 2)
test-d/         (tsd type-test files)
tests/          (engineer-owned policy + RTM + PERSONAS + JOURNEYS + fixtures)
```

Files at the repo root are also bounded; see `ALLOWLIST.md § Top-level files allowlist` for the file-level enumeration.

## Axis 4 — Forbidden package categories (heuristic)

`scripts/check-boundaries.ts` runs `npm view <pkg> keywords` on every dependency in `package.json` and matches against forbidden keywords. This is a **best-effort heuristic** — many packages don't declare keywords, and category-by-self-declaration is imperfect — but it catches many violations the explicit Axis 1 enumeration misses.

Forbidden keywords (any match BLOCKS):

```text
agent
agents
ai-agent
autonomous
orchestration
orchestrator
workflow-engine
job-queue
task-queue
scheduler
cron
llm
llms
gpt
claude
gemini
openai
anthropic
provider
sdk
adapter
database
db
orm
query-builder
sql
nosql
cache
caching
session
authentication
authorization
oauth
saml
jwt
http-server
web-server
web-framework
api-server
rest-api
graphql-server
grpc-server
microservice
serverless
faas
lambda
worker
background-job
streaming
real-time
websocket
sse
deployment
infrastructure
devops
container
docker
kubernetes
k8s
helm
terraform
```

A package may declare multiple keywords; if **any** keyword matches the forbidden list, the package fails this axis.

**Exemption rule**: if a package is on the explicit `ALLOWLIST.md` allowlist, its keywords are not checked. This is by design — the explicit allowlist overrides the heuristic. For example, `zod` declares keywords like `validation` and `schema` (neither forbidden); even if it declared `database` (it doesn't), the allowlist would exempt it.

## Forbidden URL patterns (separate from the 4 axes — checked in docs + code + schemas)

These URL patterns MUST NOT appear as live URLs in any source file, schema, fixture, or test as the host of a predicate URI:

```text
labs.intentsolutions.io
```

Rationale: CISO binding per DR-004 + DR-010 § 10. Predicate URIs MUST live at `evals.intentsolutions.io`. `labs.intentsolutions.io` may host blog/methodology content but never an in-toto predicate URI, OTel attribute namespace, or attestation predicate identifier. The checker recognizes lines that explicitly document the rule (e.g., this one) and excludes them from violation detection.

## Compliance audit (informational; this section may be regenerated)

As of the most recent boundary check on `main`:

- Runtime deps in `package.json#dependencies`: 1 (`zod`)
- ALLOWLIST.md cap: ≤8
- Forbidden import paths under `src/`: 0
- Forbidden top-level directories: 0
- Forbidden URL-pattern hits: 0
