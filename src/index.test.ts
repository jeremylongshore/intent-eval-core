import { describe, it, expect } from 'vitest';

describe('@intent-eval/core scaffold', () => {
  it('framework wired (vitest runs, module loads)', async () => {
    const mod = await import('./index.js');
    expect(mod).toBeDefined();
  });
});
