import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  cleanControl,
  loadCorpus,
  measureKernel,
  summarize,
} from './measure-shell-substitution.ts';
import type { Observation } from './measure-shell-substitution.ts';

describe('shell-substitution measurement', () => {
  it('reports unmet targets with a failing CLI exit status', () => {
    const run = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/measure-shell-substitution.ts'],
      { encoding: 'utf8' },
    );
    expect(run.error).toBeUndefined();
    const report: unknown = JSON.parse(run.stdout);
    expect(report).toEqual(measureKernel());
    const expected = measureKernel().profiles.every((profile) => profile.metrics.targetsMet)
      ? 0
      : 1;
    expect(run.status).toBe(expected);
  });
  it('loads 50 independently labeled cases per class across all five locations', () => {
    const cases = loadCorpus();
    expect(cases).toHaveLength(100);
    expect(new Set(cases.map((row) => row.id)).size).toBe(100);
    for (const label of ['legitimate', 'forbidden']) {
      expect(cases.filter((row) => row.label === label)).toHaveLength(50);
      for (const context of [
        'description',
        'compatibility',
        'metadata-note',
        'metadata-list',
        'metadata-nested',
      ]) {
        expect(cases.filter((row) => row.label === label && row.context === context)).toHaveLength(
          10,
        );
      }
    }
  });

  it('compares the actual JSON Schema and Zod folds and requires clean paired controls', () => {
    const report = measureKernel();
    expect(report.profiles.map((profile) => profile.profile)).toEqual([
      'kernel-v1-security-fold',
      'kernel-v2-security-fold',
    ]);
    for (const profile of report.profiles) {
      expect(profile.rows).toHaveLength(100);
      expect(profile.metrics.legitimate).toBe(50);
      expect(profile.metrics.forbidden).toBe(50);
      expect(Object.keys(profile.contexts)).toHaveLength(5);
    }
    // Threshold attainment is deliberately not asserted here: a reproducible
    // measurement is not a passing policy result. The measurement CLI exits 1
    // whenever its reported FP/FN targets fail.
  });

  it('enforces strict target boundaries without rounding an error away', () => {
    const rows: Observation[] = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      label: i < 50 ? 'legitimate' : 'forbidden',
      context: 'toy',
      flagged: i >= 50,
    }));
    expect(summarize(rows).targetsMet).toBe(true);
    expect(
      summarize(rows.map((row, i) => (i === 0 ? { ...row, flagged: true } : row))),
    ).toMatchObject({ fpRate: 0.02, targetsMet: false });
    expect(
      summarize(rows.map((row, i) => (i >= 98 ? { ...row, flagged: false } : row))),
    ).toMatchObject({ fnRate: 0.04, targetsMet: true });
    expect(
      summarize(rows.map((row, i) => (i >= 97 ? { ...row, flagged: false } : row))),
    ).toMatchObject({ fnRate: 0.06, targetsMet: false });
    expect(() => summarize(rows.slice(0, 50))).toThrow('Both classes');
  });

  it('does not mutate source cases while constructing a control', () => {
    const fixture = loadCorpus().find((row) => row.context === 'metadata-list');
    if (!fixture) throw new Error('Missing list fixture');
    const before = JSON.stringify(fixture);
    const control = cleanControl(fixture);
    expect(JSON.stringify(fixture)).toBe(before);
    expect(control['metadata']).toEqual({ examples: ['Offline fixture text.'] });
    expect(() => cleanControl({ ...fixture, path: ['missing'] })).toThrow('not a string');
  });
});
