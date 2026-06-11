/**
 * predicate-comment-coherence (3kye.7) — the generated $comment manifest must
 * AGREE with the schema's actual accept/reject behaviour.
 *
 * Each published authoring contract carries a generated EFFECTIVE-REQUIRED
 * MANIFEST in its `$comment` (one INHERITED / REQUIRED HERE row per
 * effective-required field — codegen-authoring.ts, DR-044 D7(e)). That manifest
 * is a documentation surface; nothing stops it from drifting out of step with
 * the schema it sits on. This test closes that gap by checking INTERNAL
 * COHERENCE three ways, per contract:
 *
 *   1. the manifest's claimed required set == the validator's actual required
 *      constant (base ∪ overlay) — no field claimed that the schema does not
 *      require, none required that the manifest forgets;
 *   2. BEHAVIOURAL coherence — a canonical valid fixture is accepted, and
 *      dropping ANY manifest-claimed field makes ajv (the published JSON Schema)
 *      REJECT it (so each "required" claim is true against real accept/reject);
 *   3. the manifest classifies INHERITED vs REQUIRED HERE exactly as the
 *      base/overlay split does (an inherited field is base-required; a
 *      required-here field is overlay-required).
 *
 * If the manifest and the schema ever disagree, this test fails — the $comment
 * cannot lie about what the contract requires.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SKILL_FRONTMATTER_BASE_REQUIRED,
  SKILL_FRONTMATTER_OVERLAY_REQUIRED,
  PLUGIN_MANIFEST_BASE_REQUIRED,
  PLUGIN_MANIFEST_OVERLAY_REQUIRED,
  AGENT_DEFINITION_BASE_REQUIRED,
  AGENT_DEFINITION_OVERLAY_REQUIRED,
  MCP_CONFIG_BASE_REQUIRED,
  MCP_CONFIG_OVERLAY_REQUIRED,
  HOOK_CONFIG_BASE_REQUIRED,
  HOOK_CONFIG_OVERLAY_REQUIRED,
  MARKETPLACE_CATALOG_BASE_REQUIRED,
  MARKETPLACE_CATALOG_OVERLAY_REQUIRED,
} from '../validators/v1/authoring/index.js';

interface ValidateFn {
  (data: unknown): boolean;
  errors: { instancePath: string; message?: string }[] | null;
}
interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): void;
  getSchema(ref: string): ValidateFn | undefined;
  addKeyword(def: { keyword: string }): AjvInstance;
}

const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts: object) => AjvInstance })
  .default;
const addFormats = (addFormatsModule as unknown as { default: (ajv: AjvInstance) => void }).default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTHORING_DIR = join(__dirname, '../../schemas/authoring/v1');
const FIXTURES_DIR = join(__dirname, '../../tests/authoring/v1/fixtures');
const BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';

interface ContractCase {
  readonly name: string;
  readonly baseRequired: readonly string[];
  readonly overlayRequired: readonly string[];
}

const CONTRACTS: readonly ContractCase[] = [
  {
    name: 'skill-frontmatter',
    baseRequired: SKILL_FRONTMATTER_BASE_REQUIRED,
    overlayRequired: SKILL_FRONTMATTER_OVERLAY_REQUIRED,
  },
  {
    name: 'plugin-manifest',
    baseRequired: PLUGIN_MANIFEST_BASE_REQUIRED,
    overlayRequired: PLUGIN_MANIFEST_OVERLAY_REQUIRED,
  },
  {
    name: 'agent-definition',
    baseRequired: AGENT_DEFINITION_BASE_REQUIRED,
    overlayRequired: AGENT_DEFINITION_OVERLAY_REQUIRED,
  },
  {
    name: 'mcp-config',
    baseRequired: MCP_CONFIG_BASE_REQUIRED,
    overlayRequired: MCP_CONFIG_OVERLAY_REQUIRED,
  },
  {
    name: 'hook-config',
    baseRequired: HOOK_CONFIG_BASE_REQUIRED,
    overlayRequired: HOOK_CONFIG_OVERLAY_REQUIRED,
  },
  {
    name: 'marketplace-catalog',
    baseRequired: MARKETPLACE_CATALOG_BASE_REQUIRED,
    overlayRequired: MARKETPLACE_CATALOG_OVERLAY_REQUIRED,
  },
];

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

/** Parse the INHERITED / REQUIRED HERE rows out of a published $comment manifest. */
function parseManifest(comment: string): { inherited: string[]; requiredHere: string[] } {
  const inherited: string[] = [];
  const requiredHere: string[] = [];
  for (const line of comment.split('\n')) {
    const trimmed = line.trim();
    const [field] = trimmed.split(/\s+/);
    if (field === undefined || field.length === 0) continue;
    if (trimmed.includes('REQUIRED HERE')) {
      requiredHere.push(field);
    } else if (trimmed.includes('INHERITED')) {
      inherited.push(field);
    }
  }
  return { inherited, requiredHere };
}

function makeValidator(contract: string): ValidateFn {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  // kyh9 vendor annotation lives on the skill overlay; benign no-op for ajv.
  ajv.addKeyword({ keyword: 'x-mutually-exclusive-fields' });
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'upstream-base', `${contract}.v1.json`)));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'is-overlay', `${contract}.v1.json`)));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, `${contract}.schema.json`)));
  return ajv.getSchema(`${BASE}/${contract}.schema.json`)!;
}

describe('predicate-comment-coherence (3kye.7) — manifest agrees with the schema', () => {
  const validators = new Map<string, ValidateFn>();
  const canonicalFixtures = new Map<string, Record<string, unknown>>();
  const manifests = new Map<string, { inherited: string[]; requiredHere: string[] }>();

  beforeAll(() => {
    for (const { name } of CONTRACTS) {
      validators.set(name, makeValidator(name));
      canonicalFixtures.set(
        name,
        loadJson(join(FIXTURES_DIR, name, 'positive', 'canonical-01.json')),
      );
      const schema = loadJson(join(AUTHORING_DIR, `${name}.schema.json`));
      manifests.set(name, parseManifest(schema['$comment'] as string));
    }
  });

  it.each(CONTRACTS)(
    '$name — manifest required set == validator required constant (no drift)',
    ({ name, baseRequired, overlayRequired }) => {
      const manifest = manifests.get(name)!;
      const manifestRequired = [...manifest.inherited, ...manifest.requiredHere].sort();
      const actualRequired = [...baseRequired, ...overlayRequired].sort();
      expect(manifestRequired, `${name}: manifest required set drifted`).toEqual(actualRequired);
    },
  );

  it.each(CONTRACTS)(
    '$name — INHERITED == base-required, REQUIRED HERE == overlay-required',
    ({ name, baseRequired, overlayRequired }) => {
      const manifest = manifests.get(name)!;
      expect([...manifest.inherited].sort(), `${name}: INHERITED rows`).toEqual(
        [...baseRequired].sort(),
      );
      expect([...manifest.requiredHere].sort(), `${name}: REQUIRED HERE rows`).toEqual(
        [...overlayRequired].sort(),
      );
    },
  );

  it.each(CONTRACTS)(
    '$name — canonical fixture is accepted (manifest baseline holds)',
    ({ name }) => {
      const validate = validators.get(name)!;
      expect(
        validate(canonicalFixtures.get(name)),
        `${name}: canonical fixture should accept`,
      ).toBe(true);
    },
  );

  it.each(CONTRACTS)(
    '$name — dropping ANY manifest-claimed field makes the schema REJECT (behavioural coherence)',
    ({ name }) => {
      const validate = validators.get(name)!;
      const manifest = manifests.get(name)!;
      const canonical = canonicalFixtures.get(name)!;
      const claimed = [...manifest.inherited, ...manifest.requiredHere];
      for (const field of claimed) {
        expect(
          field in canonical,
          `${name}: canonical fixture is missing claimed field ${field}`,
        ).toBe(true);
        const dropped: Record<string, unknown> = { ...canonical };
        delete dropped[field];
        expect(
          validate(dropped),
          `${name}: manifest claims "${field}" required but the schema accepts without it`,
        ).toBe(false);
      }
    },
  );
});
