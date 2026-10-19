import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const rootRequire = createRequire(import.meta.url);

function dependency(chain: string[], name: string): unknown {
  let from = rootRequire;
  for (const parent of chain) from = createRequire(from.resolve(parent));
  return from(name) as unknown;
}

interface BraceNode {
  type: string;
  value?: string;
  nodes?: BraceNode[];
}

type BraceMethod = (input: string | BraceNode) => unknown;
const braces = dependency(['tsd', 'globby', 'fast-glob', 'micromatch'], 'braces') as {
  parse: (input: string) => BraceNode;
  compile: BraceMethod;
  expand: BraceMethod;
  stringify: BraceMethod;
};
const { sprintf } = dependency(
  ['@microsoft/api-extractor', '@rushstack/ts-command-line', 'argparse'],
  'sprintf-js',
) as {
  sprintf: ((format: string, ...args: unknown[]) => string) & {
    format: (tree: unknown[], args: unknown[]) => string;
    parse: (format: string) => unknown[];
  };
};

describe('locked development dependency security patches', () => {
  it.each(['parse', 'compile', 'expand', 'stringify'] as const)(
    'braces.%s rejects excessive nesting before recursive work',
    (method) => {
      expect(() => braces[method]('{'.repeat(3000) + 'a,b' + '}'.repeat(3000))).toThrow(
        new SyntaxError('Brace pattern exceeds maximum nesting depth (64)'),
      );
      expect(() => braces[method]('('.repeat(3000) + 'x' + ')'.repeat(3000))).toThrow(
        new SyntaxError('Brace pattern exceeds maximum nesting depth (64)'),
      );
    },
  );

  it.each(['compile', 'expand', 'stringify'] as const)(
    'braces.%s also guards caller-supplied deep or cyclic ASTs',
    (method) => {
      let deep: BraceNode = { type: 'text', value: 'x' };
      for (let i = 0; i < 3000; i++) deep = { type: 'root', nodes: [deep] };
      expect(() => braces[method](deep)).toThrow(SyntaxError);
      const cycle: BraceNode = { type: 'root', nodes: [] };
      cycle.nodes?.push(cycle);
      expect(() => braces[method](cycle)).toThrow(SyntaxError);
      // A small shared graph can otherwise make an AST walk exponential.
      const leaf: BraceNode = { type: 'text', value: 'x' };
      expect(() => braces[method]({ type: 'root', nodes: [leaf, leaf] })).toThrow(
        new SyntaxError('Brace AST contains repeated nodes'),
      );
    },
  );

  it('preserves normal glob compilation, expansion, and escaped braces', () => {
    expect(braces.compile('test-d/**/*.{ts,tsx}')).toBe('test-d/**/*.(ts|tsx)');
    expect(braces.expand('a/{b,c}/{1..3}')).toEqual([
      'a/b/1',
      'a/b/2',
      'a/b/3',
      'a/c/1',
      'a/c/2',
      'a/c/3',
    ]);
    expect(braces.stringify(braces.parse('a/{b,c}/d'))).toBe('a/{b,c}/d');
    expect(braces.stringify('\\{'.repeat(100))).toBe('{'.repeat(100));
  });

  it.each(['%10001s', '%.10001s', '%999999999999999999999s', '%.999999999999999999999s'])(
    'sprintf rejects oversized width/precision in %s',
    (format) => {
      expect(() => sprintf(format, 'x')).toThrow(
        new RangeError('[sprintf] width or precision exceeds 10000'),
      );
    },
  );

  it('guards direct formatting of caller-supplied parse trees', () => {
    const tree = sprintf.parse('%1s') as (string | string[])[];
    const placeholder = tree[0];
    expect(Array.isArray(placeholder)).toBe(true);
    if (Array.isArray(placeholder)) placeholder[6] = '10001';
    expect(() => sprintf.format(tree, ['', 'x'])).toThrow(RangeError);
    expect(() => sprintf('a'.repeat(10001))).toThrow(
      new RangeError('[sprintf] format exceeds 10000 characters'),
    );
  });

  it('preserves argparse help formatting and ordinary numeric formatting', () => {
    expect(sprintf('Usage: %(prog)s', { prog: 'api-extractor' })).toBe('Usage: api-extractor');
    expect(sprintf('%04d %.2f %.3s', 7, 1.25, 'abcd')).toBe('0007 1.25 abc');
    expect(sprintf('%10000s', 'x')).toHaveLength(10000);
    expect(sprintf('%.10000s', 'x')).toBe('x');
  });
});
