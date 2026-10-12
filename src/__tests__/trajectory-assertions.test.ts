/** Shared JSON acceptance corpus: AJV, public Zod, and Python use the same cases. */
import { describe, expect, it } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { isTrajectoryAssertion, TRAJECTORY_ASSERTION_CLASSES } from '../index.js';
import type { AssertionExpression, TrajectoryAssertion } from '../index.js';
import { AssertionExpressionSchema, EvalSpecSchema } from '../validators/v1/eval-spec.js';
import { TrajectoryAssertionSchema } from '../validators/v1/trajectory-assertion.js';

interface AjvInstance {
  addSchema(schema: unknown): void;
  compile(schema: unknown): ((value: unknown) => boolean) & { errors: unknown };
}
const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts: object) => AjvInstance })
  .default;
const addFormats = (addFormatsModule as unknown as { default: (ajv: AjvInstance) => void }).default;

function load(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as unknown;
}

const cases = load('../../tests/fixtures/trajectory-assertions.json') as {
  name: string;
  valid: boolean;
  assertion: Record<string, unknown>;
}[];
const base = load('../../tests/fixtures/v1/eval-spec.valid.json') as Record<string, unknown>;
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(load('../../schemas/v1/_common.schema.json'));
const validate = ajv.compile(load('../../schemas/v1/eval-spec.schema.json'));

describe('typed trajectory assertions — shared acceptance corpus', () => {
  it.each(cases)('$name', ({ valid, assertion }) => {
    const spec = { ...base, assertions: [assertion] };
    const parsed = AssertionExpressionSchema.safeParse(assertion);
    expect(parsed.success, JSON.stringify(parsed.error)).toBe(valid);
    expect(EvalSpecSchema.safeParse(spec).success).toBe(valid);
    expect(validate(spec), JSON.stringify(validate.errors)).toBe(valid);
    if (parsed.success) expect(parsed.data).toEqual(assertion);
  });
});

describe('trajectory narrowing', () => {
  it.each(TRAJECTORY_ASSERTION_CLASSES)('narrows %s after validation', (name) => {
    const fixture = cases.find((entry) => entry.name === name);
    expect(fixture).toBeDefined();
    const assertion: TrajectoryAssertion = TrajectoryAssertionSchema.parse(fixture?.assertion);
    expect(isTrajectoryAssertion(assertion)).toBe(true);
  });

  it('keeps every opaque extension outside the typed branch', () => {
    for (const name of [...TRAJECTORY_ASSERTION_CLASSES, 'vendor.check']) {
      const assertion: AssertionExpression = { class: name, target: null, extension: true };
      expect(isTrajectoryAssertion(assertion)).toBe(false);
      expect(TrajectoryAssertionSchema.safeParse(assertion).success).toBe(false);
    }
  });

  it('keeps legacy named assertions outside the trajectory branch', () => {
    expect(isTrajectoryAssertion({ class: 'output-equals', target: 'PASS' })).toBe(false);
  });

  it('normalizes native undefined optionals and accepts public parse results without casts', () => {
    const parsed = AssertionExpressionSchema.parse({
      class: 'tool-called',
      target: { tool: 'Read', input_contains: undefined, min_count: undefined },
      negate: undefined,
    });
    expect(parsed).toEqual({ class: 'tool-called', target: { tool: 'Read' } });
    expect(isTrajectoryAssertion(parsed)).toBe(true);
    expect(
      TrajectoryAssertionSchema.parse({
        class: 'file-exists',
        target: { path: 'report', produced: undefined },
      }),
    ).toEqual({ class: 'file-exists', target: { path: 'report' } });
  });
});
