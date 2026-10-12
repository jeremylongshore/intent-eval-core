import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateValidators } from './codegen-validators.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots: string[] = [];
const output = 'src/validators/v1/_generated';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'core-codegen-'));
  roots.push(root);
  mkdirSync(join(root, 'schemas/v1'), { recursive: true });
  mkdirSync(join(root, output), { recursive: true });
  cpSync(join(repo, '.prettierrc.json'), join(root, '.prettierrc.json'));
  writeFileSync(join(root, output, 'README.md'), 'Reference material; retain this file.\n');
  writeFileSync(
    join(root, 'schemas/v1/sample.schema.json'),
    JSON.stringify({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
      additionalProperties: false,
    }),
  );
  return root;
}

function snapshot(root: string) {
  return readdirSync(join(root, output))
    .sort()
    .map((name) => ({
      name,
      bytes: readFileSync(join(root, output, name)),
      mtime: statSync(join(root, output, name)).mtimeMs,
    }));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('runtime reference codegen', () => {
  it('generates formatted ESM, keeps documentation, and is idempotent', async () => {
    const root = fixture();
    expect(await generateValidators(root, false)).toEqual(['sample.ts']);
    expect(readFileSync(join(root, output, 'sample.ts'), 'utf8')).toBe(
      "import { z } from 'zod';\n\nexport default z.object({ name: z.string() }).strict();\n",
    );
    expect(readFileSync(join(root, output, 'README.md'), 'utf8')).toContain('retain this file');
    const before = snapshot(root);
    expect(await generateValidators(root, true)).toEqual([]);
    expect(await generateValidators(root, false)).toEqual([]);
    expect(snapshot(root)).toEqual(before);
  });

  it('finds schema changes without modifying the output', async () => {
    const root = fixture();
    await generateValidators(root, false);
    writeFileSync(join(root, 'schemas/v1/sample.schema.json'), '{"type":"number"}');
    const before = snapshot(root);
    expect(await generateValidators(root, true)).toEqual(['sample.ts']);
    expect(snapshot(root)).toEqual(before);
  });

  it('detects simultaneous changed, missing, and obsolete generated files', async () => {
    const root = fixture();
    await generateValidators(root, false);
    writeFileSync(join(root, output, 'sample.ts'), '// stale\n');
    writeFileSync(join(root, output, 'removed.ts'), '// orphan\n');
    writeFileSync(join(root, 'schemas/v1/new.schema.json'), '{"type":"boolean"}');
    const before = snapshot(root);
    expect(await generateValidators(root, true)).toEqual(['new.ts', 'removed.ts', 'sample.ts']);
    expect(snapshot(root)).toEqual(before);
    await generateValidators(root, false);
    expect(await generateValidators(root, true)).toEqual([]);
    expect(readdirSync(join(root, output)).sort()).toEqual(['README.md', 'new.ts', 'sample.ts']);
  });

  it('detects an absent output directory without creating it', async () => {
    const root = fixture();
    rmSync(join(root, output), { recursive: true });
    expect(await generateValidators(root, true)).toEqual(['sample.ts']);
    expect(() => statSync(join(root, output))).toThrow();
    await generateValidators(root, false);
    expect(await generateValidators(root, true)).toEqual([]);
  });

  it.each(['{broken', 'null', '[]', '42'])(
    'fails on invalid input %s before any writes',
    async (invalid) => {
      const root = fixture();
      await generateValidators(root, false);
      writeFileSync(join(root, 'schemas/v1/sample.schema.json'), '{"type":"number"}');
      writeFileSync(join(root, 'schemas/v1/z-invalid.schema.json'), invalid);
      const before = snapshot(root);
      await expect(generateValidators(root, true)).rejects.toThrow();
      await expect(generateValidators(root, false)).rejects.toThrow();
      expect(snapshot(root)).toEqual(before);
    },
  );

  it('refuses an empty input set rather than deleting all references', async () => {
    const root = fixture();
    await generateValidators(root, false);
    rmSync(join(root, 'schemas/v1/sample.schema.json'));
    const before = snapshot(root);
    await expect(generateValidators(root, false)).rejects.toThrow('No runtime schemas');
    expect(snapshot(root)).toEqual(before);
  });

  it('refuses a symlink in generated output before writing through it', async () => {
    const root = fixture();
    const target = join(root, 'unrelated.ts');
    writeFileSync(target, 'untouched');
    symlinkSync(target, join(root, output, 'sample.ts'));
    await expect(generateValidators(root, false)).rejects.toThrow('Expected a regular file');
    expect(readFileSync(target, 'utf8')).toBe('untouched');
  });

  it('CLI fails on drift and invalid arguments, and passes after regeneration', () => {
    const root = fixture();
    mkdirSync(join(root, 'scripts'));
    cpSync(
      join(repo, 'scripts/codegen-validators.ts'),
      join(root, 'scripts/codegen-validators.ts'),
    );
    symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        ['--experimental-strip-types', join(root, 'scripts/codegen-validators.ts'), ...args],
        { cwd: tmpdir(), encoding: 'utf8' },
      );
    expect(run('--unknown').status).toBe(1);
    const stale = run('--check');
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('sample.ts');
    expect(readdirSync(join(root, output))).toEqual(['README.md']);
    expect(run().status).toBe(0);
    expect(run('--check').status).toBe(0);
    writeFileSync(join(root, output, 'sample.ts'), '// tampered\n');
    expect(run('--check').status).toBe(1);
    expect(readFileSync(join(root, output, 'sample.ts'), 'utf8')).toBe('// tampered\n');
    writeFileSync(join(root, 'schemas/v1/sample.schema.json'), '{broken');
    expect(run('--check').status).toBe(1);
  });
});
