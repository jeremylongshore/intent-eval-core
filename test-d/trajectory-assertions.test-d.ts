import { expectAssignable, expectError, expectType } from 'tsd';
import { isTrajectoryAssertion } from '../dist/index.js';
import { AssertionExpressionSchema, EvalSpecSchema } from '../dist/validators/v1/eval-spec.js';
import { TrajectoryAssertionSchema } from '../dist/validators/v1/trajectory-assertion.js';
import type {
  AssertionExpression,
  FileExistsTarget,
  FileMatchesShaInTarget,
  NamedAssertionExpression,
  OrderBeforeTarget,
  ToolCalledTarget,
  TrajectoryAssertion,
  TrajectoryToolMatcher,
} from '../dist/index.js';

declare const assertion: AssertionExpression;
declare const wire: unknown;
const parsed = AssertionExpressionSchema.parse(wire);
if (isTrajectoryAssertion(parsed)) expectAssignable<TrajectoryAssertion>(parsed);
const fromSpec = EvalSpecSchema.parse(wire).assertions[0]!;
if (isTrajectoryAssertion(fromSpec)) expectAssignable<TrajectoryAssertion>(fromSpec);
expectAssignable<TrajectoryAssertion>(TrajectoryAssertionSchema.parse(wire));
if (isTrajectoryAssertion(assertion)) {
  switch (assertion.class) {
    case 'tool-called':
      expectType<ToolCalledTarget>(assertion.target);
      break;
    case 'tool-not-called':
      expectType<TrajectoryToolMatcher>(assertion.target);
      break;
    case 'order-before':
      expectType<OrderBeforeTarget>(assertion.target);
      break;
    case 'file-exists':
      expectType<FileExistsTarget>(assertion.target);
      break;
    case 'file-matches-sha-in':
      expectType<FileMatchesShaInTarget>(assertion.target);
      break;
  }
}

// Preserve the existing interface so consumers can continue extending it.
interface CustomLegacyAssertion extends NamedAssertionExpression {
  readonly label: string;
}
expectAssignable<CustomLegacyAssertion>({ class: 'output-equals', target: null, label: 'legacy' });
expectAssignable<AssertionExpression>({ class: 'tool-called', target: null, extension: true });
expectAssignable<TrajectoryAssertion>({
  class: 'tool-called',
  target: { tool: 'Read', min_count: 2 },
});
expectAssignable<TrajectoryAssertion>({
  class: 'file-exists',
  target: { pattern: '.*', produced: false },
});
expectAssignable<TrajectoryAssertion>({
  class: 'file-matches-sha-in',
  target: { path: 'report', in: '{path}.sha256' },
});
expectError<TrajectoryAssertion>({ class: 'tool-called', target: {} });
expectError<TrajectoryAssertion>({
  class: 'tool-not-called',
  target: { tool: 'Read', min_count: 2 },
});
expectError<TrajectoryAssertion>({ class: 'order-before', target: { first: { tool: 'Read' } } });
expectError<TrajectoryAssertion>({
  class: 'file-exists',
  target: { path: 'report', pattern: '.*' },
});
expectError<TrajectoryAssertion>({ class: 'file-exists', target: {} });
expectError<TrajectoryAssertion>({
  class: 'file-exists',
  target: { path: 'report', produced: null },
});
expectError<TrajectoryAssertion>({ class: 'file-matches-sha-in', target: { path: 'report' } });
expectError<TrajectoryAssertion>({
  class: 'tool-called',
  target: { tool: 'Read' },
  extension: true,
});
expectError<AssertionExpression>({ class: 'tool-called', target: null });
expectError<NamedAssertionExpression>({ class: 'tool-called', target: {} });
