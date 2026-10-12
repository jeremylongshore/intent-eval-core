#!/usr/bin/env -S node --experimental-strip-types
/** Build-time reference generation; public validators remain hand-authored. */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import type { JsonSchema } from 'json-schema-to-zod';
import { format, resolveConfig } from 'prettier';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function filesWithSuffix(directory: string, suffix: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(suffix))
    .map((entry) => {
      if (!entry.isFile())
        throw new Error(`Expected a regular file: ${join(directory, entry.name)}`);
      return entry.name;
    })
    .sort();
}

export async function generateValidators(root: string, check: boolean): Promise<string[]> {
  const schemasDir = join(root, 'schemas/v1');
  const outputDir = join(root, 'src/validators/v1/_generated');
  const schemas = filesWithSuffix(schemasDir, '.schema.json');
  if (schemas.length === 0) throw new Error(`No runtime schemas found in ${schemasDir}`);
  const prettierConfig = await resolveConfig(join(root, '.prettierrc.json'));
  const generated = new Map<string, string>();

  // Render every input before writing, so invalid input cannot partially regenerate.
  for (const filename of schemas) {
    const schema = JSON.parse(readFileSync(join(schemasDir, filename), 'utf8')) as JsonSchema;
    if (
      schema === null ||
      (typeof schema !== 'boolean' && (typeof schema !== 'object' || Array.isArray(schema)))
    ) {
      throw new Error(`Expected a JSON Schema object or boolean: ${filename}`);
    }
    const outputName = filename.replace(/\.schema\.json$/, '.ts');
    // Match the existing CLI's ESM / Zod 4 defaults, then match repository formatting.
    const source = jsonSchemaToZod(schema, { module: 'esm', zodVersion: 4 });
    generated.set(outputName, await format(source, { ...prettierConfig, parser: 'typescript' }));
  }

  const existing = existsSync(outputDir) ? filesWithSuffix(outputDir, '.ts') : [];
  const stale: string[] = [];
  for (const [filename, source] of generated) {
    if (
      !existing.includes(filename) ||
      readFileSync(join(outputDir, filename), 'utf8') !== source
    ) {
      stale.push(filename);
    }
  }
  const obsolete = existing.filter((filename) => !generated.has(filename));
  stale.push(...obsolete);

  if (!check) {
    mkdirSync(outputDir, { recursive: true });
    for (const filename of stale) {
      const source = generated.get(filename);
      if (source === undefined) unlinkSync(join(outputDir, filename));
      else writeFileSync(join(outputDir, filename), source);
    }
  }
  return stale.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== '--check' && arg !== '--write')) {
    console.error('Usage: codegen-validators.ts [--check|--write]');
    process.exitCode = 1;
  } else {
    const check = args[0] === '--check';
    try {
      const stale = await generateValidators(REPO_ROOT, check);
      if (check && stale.length > 0) {
        console.error(
          `Stale generated validators:\n${stale.map((name) => `  ${name}`).join('\n')}\nRun pnpm run codegen:validators and commit the results.`,
        );
        process.exitCode = 1;
      } else {
        console.log(
          check
            ? 'Runtime Zod reference files are up to date.'
            : `Regenerated ${stale.length} runtime Zod reference files.`,
        );
      }
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
