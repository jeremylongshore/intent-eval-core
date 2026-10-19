/** Read-only measurement of the actual kernel folds; never evaluates fixture text. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv/dist/2020.js';
import { z } from 'zod';
import { SecurityChecksSchema as V1 } from '../src/validators/v1/authoring/marketplace-tier.ts';
import { SecurityChecksSchema as V2 } from '../src/validators/v1/authoring/v2/marketplace-tier.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = join(ROOT, 'tests/security-measurement/shell-substitution-v1');
const FixtureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.enum(['legitimate', 'forbidden']),
  context: z.string(),
  variant: z.string(),
  path: z.array(z.union([z.string(), z.number().int().nonnegative()])).min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  allowedBracedTokens: z.array(z.string()).length(7),
  fixtures: z.array(FixtureSchema).length(100),
});
export type Fixture = z.infer<typeof FixtureSchema> & {
  frontmatter: Record<string, unknown>;
};
export interface Observation {
  id: string;
  label: 'legitimate' | 'forbidden';
  context: string;
  flagged: boolean;
}

function hash(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function loadCorpus(): Fixture[] {
  const manifest = ManifestSchema.parse(
    JSON.parse(readFileSync(join(CORPUS, 'manifest.json'), 'utf8')),
  );
  const ids = new Set<string>();
  return manifest.fixtures.map((entry) => {
    if (ids.has(entry.id)) throw new Error(`Duplicate fixture: ${entry.id}`);
    ids.add(entry.id);
    const bytes = readFileSync(join(CORPUS, entry.id, 'SKILL.md'));
    if (hash(bytes) !== entry.sha256) throw new Error(`Fixture digest mismatch: ${entry.id}`);
    const match = /^---\n([\s\S]*?)\n---\n/.exec(bytes.toString('utf8'));
    if (!match?.[1]) throw new Error(`Missing frontmatter: ${entry.id}`);
    // The curated corpus deliberately uses the JSON subset of YAML. The
    // companion marketplace measurement also parses it with PyYAML and checks equality.
    const frontmatter = z.record(z.string(), z.unknown()).parse(JSON.parse(match[1]));
    return { ...entry, frontmatter };
  });
}

/** Negative control: replace only the labeled string, leaving its field and container intact. */
export function cleanControl(fixture: Fixture): Record<string, unknown> {
  const copy = structuredClone(fixture.frontmatter);
  let current: unknown = copy;
  for (const key of fixture.path.slice(0, -1)) {
    if (typeof current !== 'object' || current === null) throw new Error('Invalid fixture path');
    current = (current as Record<string | number, unknown>)[key];
  }
  const last = fixture.path.at(-1);
  if (last === undefined || typeof current !== 'object' || current === null) {
    throw new Error('Invalid fixture path');
  }
  const target = current as Record<string | number, unknown>;
  if (typeof target[last] !== 'string') throw new Error('Labeled fixture value is not a string');
  target[last] = 'Offline fixture text.';
  return copy;
}

export function summarize(rows: readonly Observation[]) {
  const legitimate = rows.filter((row) => row.label === 'legitimate');
  const forbidden = rows.filter((row) => row.label === 'forbidden');
  if (legitimate.length === 0 || forbidden.length === 0)
    throw new Error('Both classes are required');
  const falsePositives = legitimate.filter((row) => row.flagged).map((row) => row.id);
  const falseNegatives = forbidden.filter((row) => !row.flagged).map((row) => row.id);
  const fpRate = falsePositives.length / legitimate.length;
  const fnRate = falseNegatives.length / forbidden.length;
  return {
    legitimate: legitimate.length,
    forbidden: forbidden.length,
    trueNegatives: legitimate.length - falsePositives.length,
    truePositives: forbidden.length - falseNegatives.length,
    falsePositives,
    falseNegatives,
    fpRate,
    fnRate,
    targetsMet: fpRate < 0.02 && fnRate < 0.05,
  };
}

interface AjvInstance {
  addSchema(schema: unknown): void;
  getSchema(ref: string): ((data: unknown) => boolean) | undefined;
}
const Ajv = (AjvModule as unknown as { default: new (options: object) => AjvInstance }).default;

export function measureKernel(fixtures = loadCorpus()) {
  const profiles = (['v1', 'v2'] as const).map((version) => {
    const schemaBytes = readFileSync(
      join(ROOT, `schemas/authoring/${version}/marketplace-tier.schema.json`),
    );
    const schema: unknown = JSON.parse(schemaBytes.toString('utf8'));
    const id = z.object({ $id: z.string() }).parse(schema).$id;
    const ajv = new Ajv({ strict: true, allErrors: true });
    ajv.addSchema(schema);
    const validate = ajv.getSchema(`${id}#/$defs/securityChecks`);
    if (!validate) throw new Error(`Missing security fold: ${version}`);
    const validator = version === 'v1' ? V1 : V2;
    const rows: Observation[] = fixtures.map((fixture) => {
      const flagged = !validator.safeParse(fixture.frontmatter).success;
      if (flagged !== !validate(fixture.frontmatter))
        throw new Error(`JSON Schema/Zod disagreement: ${version}/${fixture.id}`);
      const control = cleanControl(fixture);
      if (!validator.safeParse(control).success || !validate(control))
        throw new Error(`Unrelated control failure: ${version}/${fixture.id}`);
      return { id: fixture.id, label: fixture.label, context: fixture.context, flagged };
    });
    return {
      profile: `kernel-${version}-security-fold`,
      schemaSha256: hash(schemaBytes),
      validatorSha256: hash(
        readFileSync(
          join(
            ROOT,
            `src/validators/v1/authoring/${version === 'v2' ? 'v2/' : ''}marketplace-tier.ts`,
          ),
        ),
      ),
      metrics: summarize(rows),
      contexts: Object.fromEntries(
        [...new Set(rows.map((row) => row.context))].map((context) => [
          context,
          summarize(rows.filter((row) => row.context === context)),
        ]),
      ),
      rows,
    };
  });
  return {
    measurementVersion: 1,
    corpusSha256: hash(readFileSync(join(CORPUS, 'manifest.json'))),
    labelPolicy: 'Marketplace YAML substitution policy; kernel policy equivalence is not assumed.',
    scope:
      'Security folds only. This is not full authoring conformance, execution-safety proof, or a population error-rate estimate.',
    profiles,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = measureKernel();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.profiles.every((profile) => profile.metrics.targetsMet) ? 0 : 1;
}
