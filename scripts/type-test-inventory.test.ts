import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import vitestConfig from '../vitest.config.ts';

// Repository regression, not a shipped harness: the policy's count is an
// authored assertion count, not a count of parameterized runtime executions.
function countTypeAssertions(files: ReadonlyMap<string, string>): number {
  const options: ts.CompilerOptions = { noResolve: true, noLib: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => {
    const source = files.get(name);
    return source === undefined
      ? undefined
      : ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  };
  const program = ts.createProgram([...files.keys()], options, host);
  const checker = program.getTypeChecker();
  if (program.getSyntacticDiagnostics().length > 0) throw new Error('Invalid test syntax');
  let count = 0;
  for (const file of program.getSourceFiles()) {
    const imports = new Map<ts.Symbol, string>();
    for (const statement of file.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== 'vitest' ||
        statement.importClause?.isTypeOnly
      )
        continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const entry of bindings.elements) {
        if (entry.isTypeOnly) continue;
        const symbol = checker.getSymbolAtLocation(entry.name);
        if (symbol) imports.set(symbol, (entry.propertyName ?? entry.name).text);
      }
    }
    const suppressedLines = new Set<number>();
    if ([...imports.values()].includes('expectTypeOf')) {
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, undefined, file.text);
      let suppressNextLine = false;
      for (
        let token = scanner.scan();
        token !== ts.SyntaxKind.EndOfFileToken;
        token = scanner.scan()
      ) {
        if (
          [ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia].includes(
            token,
          )
        ) {
          if (/@ts-nocheck\b/.test(scanner.getTokenText())) {
            throw new Error(`Disabled typechecking in inventoried file: ${file.fileName}`);
          }
          if (/@ts-(?:ignore|expect-error)\b/.test(scanner.getTokenText())) suppressNextLine = true;
        } else if (![ts.SyntaxKind.WhitespaceTrivia, ts.SyntaxKind.NewLineTrivia].includes(token)) {
          if (suppressNextLine)
            suppressedLines.add(file.getLineAndCharacterOfPosition(scanner.getTokenPos()).line);
          suppressNextLine = false;
        }
      }
    }

    function importedName(node: ts.Node): string | undefined {
      if (!ts.isIdentifier(node)) return undefined;
      const symbol = checker.getSymbolAtLocation(node);
      return symbol ? imports.get(symbol) : undefined;
    }

    function registration(node: ts.Expression): { name: string; modifiers: string[] } | undefined {
      if (ts.isCallExpression(node)) return registration(node.expression);
      if (ts.isPropertyAccessExpression(node)) {
        const parent = registration(node.expression);
        return parent && { name: parent.name, modifiers: [...parent.modifiers, node.name.text] };
      }
      const name = importedName(node);
      return name && ['it', 'test', 'describe', 'suite'].includes(name)
        ? { name, modifiers: [] }
        : undefined;
    }

    function inCheckedTest(node: ts.Node): boolean {
      let inTest = false;
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
          const call = parent.parent;
          if (!ts.isCallExpression(call) || !call.arguments.includes(parent)) return false;
          const owner = registration(call.expression);
          if (!owner) return false; // Uncalled/nested helpers do not inflate the floor.
          if (owner.modifiers.some((name) => ['skip', 'todo', 'skipIf', 'runIf'].includes(name)))
            return false;
          if (
            owner.modifiers.some((name) => !['each', 'concurrent', 'sequential'].includes(name))
          ) {
            throw new Error(`Unsupported type-test registration: ${owner.modifiers.join('.')}`);
          }
          if (owner.name === 'it' || owner.name === 'test') inTest = true;
        } else if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) {
          return false;
        }
      }
      return inTest;
    }

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && importedName(node.expression) === 'expectTypeOf') {
        // A factory call alone makes no assertion. Follow only this factory's
        // direct chain, counting it once even when property and type checks chain.
        let chain: ts.Node = node;
        let asserted = false;
        while (true) {
          const parent = chain.parent;
          if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === chain) {
            chain = parent;
          } else if (parent && ts.isCallExpression(parent) && parent.expression === chain) {
            if (ts.isPropertyAccessExpression(chain) && /^to[A-Z]/.test(chain.name.text))
              asserted = true;
            chain = parent;
          } else break;
        }
        const startLine = file.getLineAndCharacterOfPosition(node.getStart()).line;
        const endLine = file.getLineAndCharacterOfPosition(chain.end).line;
        const suppressed = [...suppressedLines].some(
          (line) => line >= startLine && line <= endLine,
        );
        if (asserted && !suppressed && inCheckedTest(node)) count += 1;
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  return count;
}

function declaredFloor(policy: string): number {
  const rows = [...policy.matchAll(/^\|\s*`type-test\.count`\s*\|\s*(\d+)\s*\|/gm)];
  const floor = Number(rows[0]?.[1]);
  if (rows.length !== 1 || !Number.isSafeInteger(floor) || floor <= 0) {
    throw new Error('Expected exactly one positive type-test.count policy floor');
  }
  return floor;
}

function countFixture(body: string): number {
  return countTypeAssertions(new Map([['fixture.test.ts', body]]));
}

function verifyInventory(
  files: ReadonlyMap<string, string>,
  checked: ReadonlySet<string>,
  policy: string,
): number {
  if (files.size === 0) throw new Error('No discovered tests');
  for (const file of files.keys()) {
    if (!checked.has(file)) throw new Error(`${file} is omitted from typecheck`);
  }
  const floor = declaredFloor(policy);
  const count = countTypeAssertions(files);
  if (count < floor)
    throw new Error(`Type assertion count ${count} is below policy floor ${floor}`);
  return count;
}

describe('type-test inventory resists false evidence', () => {
  it('counts imported aliases and chained assertions once', () => {
    expect(
      countFixture(`import { test as caseOf, expectTypeOf as typeOf } from 'vitest';
      caseOf('type', () => { typeOf<{id: string}>().toHaveProperty('id').toEqualTypeOf<string>(); });`),
    ).toBe(1);
  });

  it('ignores comments, strings, bare factories, and shadowed imports', () => {
    expect(
      countFixture(`import { it, expectTypeOf } from 'vitest';
      // expectTypeOf<string>().toEqualTypeOf<string>();
      const text = 'expectTypeOf<string>().toEqualTypeOf<string>()';
      it('bare', () => { expectTypeOf<string>(); });
      it('shadow', (expectTypeOf: Function) => { expectTypeOf().toBeString(); });`),
    ).toBe(0);
  });

  it('excludes skipped, conditional, todo, and uncalled helper assertions', () => {
    expect(
      countFixture(`import { it, describe, expectTypeOf } from 'vitest';
      it.skip('skip', () => { expectTypeOf<string>().toBeString(); });
      describe.skip('suite', () => { it('nested', () => { expectTypeOf<string>().toBeString(); }); });
      it.skipIf(false)('conditional', () => { expectTypeOf<string>().toBeString(); });
      it.todo('todo', () => { expectTypeOf<string>().toBeString(); });
      it('helper', () => { function unused() { expectTypeOf<string>().toBeString(); } });`),
    ).toBe(0);
  });

  it('refuses focused or unsupported test registrations and invalid syntax', () => {
    expect(() =>
      countFixture(`import { it, expectTypeOf } from 'vitest';
      it.only('focused', () => { expectTypeOf<string>().toBeString(); });`),
    ).toThrow('Unsupported');
    expect(() => countFixture('const broken = ;')).toThrow('Invalid test syntax');
  });

  it('refuses disabled typechecking while ignoring directive text inside strings', () => {
    expect(() =>
      countFixture(`// @ts-nocheck
      import { it, expectTypeOf } from 'vitest';
      it('type', () => { expectTypeOf<string>().toBeString(); });`),
    ).toThrow('Disabled typechecking');
    expect(
      countFixture(`import { it, expectTypeOf } from 'vitest';
      const text = '// @ts-nocheck';
      it('type', () => { expectTypeOf<string>().toBeString(); });`),
    ).toBe(1);
  });

  it('does not count suppressed assertions but preserves unrelated negative type tests', () => {
    for (const directive of ['ignore', 'expect-error']) {
      expect(
        countFixture(`import { it, expectTypeOf } from 'vitest';
        it('types', () => {
          // @ts-${directive}
          expectTypeOf<string>().toBeNumber();
          // @ts-expect-error -- a meaningful negative assignment test
          const value: string = 42;
          expectTypeOf<string>().toBeString();
        });`),
      ).toBe(1);
    }
  });

  it('reads the declared floor and rejects missing, duplicate, or invalid policy', () => {
    const row = '| `type-test.count` | 90 | policy |';
    expect(declaredFloor(row)).toBe(90);
    for (const bad of ['', `${row}\n${row}`, row.replace('90', '0'), row.replace('90', 'NaN')]) {
      expect(() => declaredFloor(bad)).toThrow('policy floor');
    }
  });

  it('fails below the policy floor and when an assertion file is omitted from compilation', () => {
    const files = new Map([
      [
        'fixture.test.ts',
        `import { it, expectTypeOf } from 'vitest';
      it('one', () => { expectTypeOf<string>().toBeString(); });`,
      ],
    ]);
    expect(() =>
      verifyInventory(files, new Set(files.keys()), '| `type-test.count` | 2 | floor |'),
    ).toThrow('below policy floor 2');
    expect(() => verifyInventory(files, new Set(), '| `type-test.count` | 1 | floor |')).toThrow(
      'omitted from typecheck',
    );
    expect(verifyInventory(files, new Set(files.keys()), '| `type-test.count` | 1 | floor |')).toBe(
      1,
    );
  });
});

it('enforces the declared type-test floor over discovered, typechecked source tests', () => {
  // Fail closed if discovery conventions change: do not count files a modified
  // Vitest invocation or tsconfig would omit. tsc remains the type verdict.
  expect(vitestConfig).toMatchObject({
    test: { include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.test.ts'] },
  });
  const config: unknown = vitestConfig;
  expect(config).not.toHaveProperty('test.exclude');
  const root = resolve(import.meta.dirname, '..');
  const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  expect(manifest).toHaveProperty('scripts.typecheck', 'tsc --noEmit');
  const parsed = ts.getParsedCommandLineOfConfigFile(
    resolve(root, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (!parsed || parsed.errors.length > 0) throw new Error('Invalid typecheck configuration');
  expect(parsed.options.noCheck, 'typecheck must perform semantic checking').not.toBe(true);
  const discovered = ts.sys.readDirectory(
    root,
    ['.ts'],
    ['node_modules', 'dist'],
    ['src/**/*.test.ts', 'src/**/*.spec.ts', 'scripts/**/*.test.ts'],
  );
  const checked = new Set(parsed.fileNames.map((file) => resolve(file)));
  const policy = readFileSync(resolve(root, 'tests/TESTING.md'), 'utf8');
  const count = verifyInventory(
    new Map(discovered.map((file) => [resolve(file), readFileSync(file, 'utf8')])),
    checked,
    policy,
  );
  console.info(
    `Type assertion inventory: ${count} chains; declared floor ${declaredFloor(policy)}; ${discovered.length} discovered and typechecked files.`,
  );
}, 30_000);
