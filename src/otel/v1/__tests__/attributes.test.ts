import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
  OTEL_SHARED_ATTRIBUTES,
  OTEL_RUNTIME_DEDUP_ATTRIBUTES,
  OTEL_REPLAY_VERDICT_ATTRIBUTES,
  OTEL_REPLAY_VERDICT_VALUES,
  OTEL_REPLAY_INPUT_DRIFT_ATTRIBUTES,
  OTEL_REPLAY_DRIFTED_FIELD_VALUES,
  OTEL_BUNDLE_EMISSION_REFUSED_ATTRIBUTES,
  OTEL_BUNDLE_REFUSED_CONTRACT_VALUES,
  OTEL_RUNTIME_EVENTS,
  OTEL_EVENT_ATTRIBUTE_SETS,
  type OtelReplayVerdict,
  type OtelReplayDriftedField,
  type OtelBundleRefusedContract,
  type OtelRuntimeEventName,
} from '../attributes.js';

// ─── Minimal, scoped YAML reader ────────────────────────────────────────────
//
// otel-attributes.yaml has a known, shallow shape: a top-level `events:` map
// whose direct children are event names, each with an `attributes:` list of
// `- id: <name>` items. No general YAML parser (yaml/js-yaml) is an allowed
// devDep (ALLOWLIST.md), so this reader is purpose-built for THIS file's shape.
// It proves "the yaml parses" structurally and feeds the drift guard.

interface ParsedYaml {
  events: Record<string, { attributes: string[] }>;
}

function parseOtelYaml(text: string): ParsedYaml {
  const lines = text.split('\n');
  const events: Record<string, { attributes: string[] }> = {};

  let inEvents = false;
  let currentEvent: string | null = null;
  let inAttributes = false;

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith('#') || rawLine.trim() === '') continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trimEnd();

    // Top-level `events:` block opener (indent 0).
    if (indent === 0) {
      inEvents = line === 'events:';
      currentEvent = null;
      inAttributes = false;
      continue;
    }
    if (!inEvents) continue;

    // Event name: indent 2, `name:` with nothing after the colon.
    if (indent === 2 && /^ {2}[a-z][\w.]*:\s*$/.test(line)) {
      currentEvent = line.trim().slice(0, -1);
      events[currentEvent] = { attributes: [] };
      inAttributes = false;
      continue;
    }
    if (currentEvent === null) continue;

    // `attributes:` list opener (indent 4).
    if (indent === 4 && line.trim() === 'attributes:') {
      inAttributes = true;
      continue;
    }
    // Any other indent-4 key (brief:, category:) closes the attributes list.
    if (indent === 4) {
      inAttributes = false;
      continue;
    }

    // Attribute id line: indent 6, `- id: <name>`.
    if (inAttributes && indent === 6) {
      const m = /^- id:\s*(\S+)\s*$/.exec(line.trim());
      const bucket = events[currentEvent];
      if (m?.[1] && bucket) bucket.attributes.push(m[1]);
    }
  }

  return { events };
}

const here = dirname(fileURLToPath(import.meta.url));
const yamlPath = join(here, '..', '..', '..', '..', 'schemas', 'v1', 'otel-attributes.yaml');
const yamlText = readFileSync(yamlPath, 'utf-8');
const yaml = parseOtelYaml(yamlText);

// The § 4.3 events the kernel pins, by canonical dotted name.
const EXPECTED_EVENTS = [
  'runtime.dedup',
  'replay.verdict',
  'replay.input.drift',
  'bundle.emission.refused',
];

describe('otel-attributes.yaml — parses + carries every § 4.3 event', () => {
  it('parses into a non-empty events map', () => {
    expect(Object.keys(yaml.events).length).toBeGreaterThan(0);
  });

  it('contains exactly the four Blueprint B § 4.3 enumerated runtime events', () => {
    expect(Object.keys(yaml.events).sort()).toEqual([...EXPECTED_EVENTS].sort());
  });

  it('every event declares at least one attribute', () => {
    for (const [name, ev] of Object.entries(yaml.events)) {
      expect(ev.attributes.length, `${name} has attributes`).toBeGreaterThan(0);
    }
  });

  it('cites Blueprint B § 4.3 and the Gregg finding in $comment', () => {
    expect(yamlText).toContain('§ 4.3');
    expect(yamlText.toLowerCase()).toContain('gregg finding');
  });

  it('uses OTel dotted-lowercase keys, never camelCase or domain-prefixed', () => {
    for (const ev of Object.values(yaml.events)) {
      for (const attr of ev.attributes) {
        expect(attr, `${attr} is dotted-lowercase`).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/);
        expect(attr).not.toContain('labs.intentsolutions.io');
      }
    }
  });
});

describe('exported constants ↔ yaml drift guard', () => {
  it('event-name registry matches the yaml events keys exactly', () => {
    const constNames = Object.values(OTEL_RUNTIME_EVENTS).sort();
    expect(constNames).toEqual(Object.keys(yaml.events).sort());
  });

  it('every event constant set carries exactly the yaml attribute names', () => {
    for (const [eventName, attrSet] of Object.entries(OTEL_EVENT_ATTRIBUTE_SETS)) {
      const fromConst = Object.values(attrSet).sort();
      const fromYaml = (yaml.events[eventName]?.attributes ?? []).sort();
      expect(fromConst, `${eventName} attribute names`).toEqual(fromYaml);
    }
  });

  it('every attribute value in every constant set appears in the yaml', () => {
    const allYamlAttrs = new Set(Object.values(yaml.events).flatMap((e) => e.attributes));
    for (const attrSet of Object.values(OTEL_EVENT_ATTRIBUTE_SETS)) {
      for (const value of Object.values(attrSet)) {
        expect(allYamlAttrs.has(value), `${value} pinned in yaml`).toBe(true);
      }
    }
  });

  it('shared attribute keys are reused (not re-spelled) by the events', () => {
    expect(OTEL_RUNTIME_DEDUP_ATTRIBUTES.evalRunId).toBe(OTEL_SHARED_ATTRIBUTES.evalRunId);
    expect(OTEL_REPLAY_VERDICT_ATTRIBUTES.evalRunId).toBe(OTEL_SHARED_ATTRIBUTES.evalRunId);
    expect(OTEL_REPLAY_INPUT_DRIFT_ATTRIBUTES.evalRunId).toBe(OTEL_SHARED_ATTRIBUTES.evalRunId);
    expect(OTEL_BUNDLE_EMISSION_REFUSED_ATTRIBUTES.evalRunId).toBe(
      OTEL_SHARED_ATTRIBUTES.evalRunId,
    );
  });
});

describe('canonical naming authority — one pinned form per attribute', () => {
  it('eval.run_id is the ONLY spelling (no eval_run_id / evalRunId / run.id leak)', () => {
    expect(OTEL_SHARED_ATTRIBUTES.evalRunId).toBe('eval.run_id');
    // The drift Gregg flagged: alternate spellings must not appear as values.
    const allValues = Object.values(OTEL_EVENT_ATTRIBUTE_SETS).flatMap((s) => Object.values(s));
    expect(allValues).not.toContain('eval_run_id');
    expect(allValues).not.toContain('evalRunId');
    expect(allValues).not.toContain('run.id');
  });

  it('bundle.predicate_uri and gate-style dotted forms are pinned', () => {
    expect(OTEL_BUNDLE_EMISSION_REFUSED_ATTRIBUTES.predicateUri).toBe('bundle.predicate_uri');
  });
});

describe('closed enums are pinned with their § 3.x cardinality', () => {
  it('replay.verdict carries the 4-value § 3.2 enum', () => {
    expect([...OTEL_REPLAY_VERDICT_VALUES]).toEqual(['match', 'semantic_match', 'drift', 'failed']);
  });

  it('replay.input.drift carries the 5 frozen-input dimensions', () => {
    expect(OTEL_REPLAY_DRIFTED_FIELD_VALUES).toHaveLength(5);
  });

  it('bundle.emission.refused carries the 4 evidence contracts', () => {
    expect([...OTEL_BUNDLE_REFUSED_CONTRACT_VALUES]).toEqual([
      'subject',
      'predicate_type',
      'predicate_body',
      'signature',
    ]);
  });
});

describe('exported types compile', () => {
  it('verdict / drifted-field / contract / event-name unions resolve', () => {
    expectTypeOf<OtelReplayVerdict>().toEqualTypeOf<
      'match' | 'semantic_match' | 'drift' | 'failed'
    >();
    expectTypeOf<OtelReplayDriftedField>().toEqualTypeOf<
      | 'skill_snapshot_sha'
      | 'eval_spec_content_hash'
      | 'tokenized_inputs'
      | 'tool_versions'
      | 'environment_block'
    >();
    expectTypeOf<OtelBundleRefusedContract>().toEqualTypeOf<
      'subject' | 'predicate_type' | 'predicate_body' | 'signature'
    >();
    expectTypeOf<OtelRuntimeEventName>().toEqualTypeOf<
      'runtime.dedup' | 'replay.verdict' | 'replay.input.drift' | 'bundle.emission.refused'
    >();
  });
});
