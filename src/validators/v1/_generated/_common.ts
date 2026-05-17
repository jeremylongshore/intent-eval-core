import { z } from 'zod';

export default z
  .any()
  .describe(
    'Shared $defs referenced by every entity schema and the gate-result/v1 predicate body. Branded primitives correspond to the TypeScript brands in src/primitives.ts — at the JSON Schema level, they are pattern-validated strings/numbers.',
  );
