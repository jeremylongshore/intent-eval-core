#!/usr/bin/env -S node --experimental-strip-types
/**
 * parse-spec-headings.ts — deterministic markdown section-heading parser for
 * the 6767-h master spec (033-PP-PLAN-skill-refiner-sak-amendment-v7 § 14.16.1).
 *
 * The kernel's schema `$comment` fields cite 6767-h sections (e.g. "6767-h
 * §3.1"). The 6767-h master spec lives in ANOTHER repo
 * (claude-code-plugins/000-docs/), which this repo cannot read at CI time, so
 * the section-heading inventory is VENDORED as a checked-in projection at
 * `schemas/prose-anchors/6767-h.headings.json`. This script generates that
 * projection.
 *
 * Per § 14.16.1 the parser:
 *   - reads markdown headers (`^#+\s+`) as heading TOKENS via a pinned
 *     `markdown-it` (exact version in package.json) — no HTML rendering, no
 *     LLM in the loop, deterministic given input;
 *   - extracts section IDs: the numerical hierarchy form (`§1.2.3`) and the
 *     named form (`§Skill-Frontmatter`, slug-normalized);
 *   - builds the section tree as a flat heading list carrying levels (the
 *     tree shape is recoverable from the level sequence; the validity check
 *     only needs node membership — every heading is a leaf or intermediate
 *     node).
 *
 * Usage:
 *   node --experimental-strip-types scripts/parse-spec-headings.ts <spec.md> [--out <file>]
 *
 * Without `--out` the inventory JSON is written to stdout. Regeneration is
 * wired as `pnpm run codegen:prose-anchors -- <spec.md> --out <file>`.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

type Token = ReturnType<MarkdownIt['parse']>[number];

export interface SpecHeading {
  /** Heading depth: 1 for `#`, 2 for `##`, ... */
  readonly level: number;
  /** Plain heading text (inline markup stripped, code spans kept verbatim). */
  readonly text: string;
  /** 1-based source line of the heading in the spec document. */
  readonly line: number;
  /** Numerical-hierarchy section ID ("1", "3.1", "1.2.3") or null for named sections. */
  readonly numeric_id: string | null;
  /** Every anchor form this heading resolves under (numeric ID + slug forms). */
  readonly anchors: readonly string[];
}

export interface HeadingInventory {
  readonly $comment: string;
  readonly source: string;
  readonly source_sha256: string;
  readonly generated_at: string;
  readonly generator: string;
  readonly parser: string;
  readonly headings: readonly SpecHeading[];
}

/** Pinned parser identity, recorded in the inventory for audit. */
export const PARSER_ID = 'markdown-it@14.1.0';

/**
 * Slug-normalize a heading text or a cited named anchor so the two compare
 * deterministically: lowercase, every non-alphanumeric run collapses to one
 * hyphen, no leading/trailing hyphens. "Skill-Frontmatter" and
 * "Skill Frontmatter" both normalize to "skill-frontmatter".
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract the numerical-hierarchy section ID from a heading text, accepting
 * the spec's marker styles: "3.1 Title", "1) Title", "2. Title", "4: Title".
 * Returns null for named (non-numbered) sections.
 */
export function extractNumericId(text: string): string | null {
  const match = /^(\d+(?:\.\d+)*)\s*[).:]?\s+/.exec(text);
  return match?.[1] ?? null;
}

/** Plain text of a heading's inline token (children flattened; code spans kept). */
function inlineText(token: Token): string {
  const children = token.children ?? [];
  let out = '';
  for (const child of children) {
    if (child.type === 'text' || child.type === 'code_inline') {
      out += child.content;
    } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
      out += ' ';
    }
  }
  return out.trim();
}

/** Every anchor form a heading resolves under. Deterministic, deduplicated. */
export function anchorsFor(text: string, numericId: string | null): string[] {
  const anchors = new Set<string>();
  if (numericId !== null) anchors.add(numericId);

  const fullSlug = slugify(text);
  if (fullSlug.length > 0) anchors.add(fullSlug);

  // Slug without the numeric marker, so "§Plugin-Manifest" can cite
  // "## 2) Plugin Manifest: ..." by name as well as by number.
  if (numericId !== null) {
    const stripped = slugify(text.replace(/^\d+(?:\.\d+)*\s*[).:]?\s+/, ''));
    if (stripped.length > 0) anchors.add(stripped);
  }

  // Appendix shorthand: "Appendix A: In-Repo Canonical References" is citable
  // as "§Appendix-A".
  const appendix = /^appendix\s+([a-z0-9]+)\b/i.exec(text);
  if (appendix?.[1] !== undefined) anchors.add(`appendix-${appendix[1].toLowerCase()}`);

  return [...anchors];
}

/**
 * Parse every markdown heading into a SpecHeading. Heading TOKENS only — the
 * document body is never rendered, and fenced code blocks containing `#` lines
 * are not misread as headings (the reason this is a real parser, not a regex).
 */
export function parseHeadings(markdown: string): SpecHeading[] {
  const md = new MarkdownIt('commonmark');
  const tokens = md.parse(markdown, {});
  const headings: SpecHeading[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token?.type !== 'heading_open') continue;
    const inline = tokens[i + 1];
    const text = inline?.type === 'inline' ? inlineText(inline) : '';
    const numericId = extractNumericId(text);
    headings.push({
      level: Number(token.tag.slice(1)),
      text,
      line: (token.map?.[0] ?? 0) + 1,
      numeric_id: numericId,
      anchors: anchorsFor(text, numericId),
    });
  }

  return headings;
}

/** Build the full vendored inventory document for a spec source file. */
export function buildInventory(markdown: string, sourceName: string): HeadingInventory {
  return {
    $comment:
      `Vendored projection of the section-heading inventory of ${sourceName} ` +
      '(the 6767-h master spec, which lives in the claude-code-plugins repo and is ' +
      'unreadable from this repo at CI time). Consumed by scripts/check-prose-anchors.ts ' +
      '(pnpm run check:prose-anchors) to verify every 6767-h section cited in a schema ' +
      '$comment resolves to a real heading. Regenerate with: pnpm run codegen:prose-anchors ' +
      `-- <path-to>/${sourceName} --out schemas/prose-anchors/6767-h.headings.json. ` +
      'Renumbering a 6767-h section requires regenerating this file in the same commit ' +
      '(033-PP-PLAN v7 § 14.16.1 stability discipline).',
    source: sourceName,
    source_sha256: createHash('sha256').update(markdown).digest('hex'),
    generated_at: new Date().toISOString(),
    generator: 'scripts/parse-spec-headings.ts',
    parser: PARSER_ID,
    headings: parseHeadings(markdown),
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const outFlag = args.indexOf('--out');
  const outPath = outFlag !== -1 ? args[outFlag + 1] : undefined;
  const positional = args.filter((a, i) => a !== '--out' && (outFlag === -1 || i !== outFlag + 1));
  const sourcePath = positional[0];

  if (sourcePath === undefined) {
    process.stderr.write(
      'usage: parse-spec-headings.ts <spec.md> [--out <file>]\n' +
        '  Parses markdown section headings into the vendored inventory JSON\n' +
        '  consumed by scripts/check-prose-anchors.ts (033-PP-PLAN v7 § 14.16.1).\n',
    );
    process.exit(1);
  }

  const markdown = readFileSync(sourcePath, 'utf-8');
  const inventory = buildInventory(markdown, basename(sourcePath));
  const json = `${JSON.stringify(inventory, null, 2)}\n`;

  if (outPath !== undefined) {
    writeFileSync(outPath, json);
    process.stdout.write(
      `prose-anchors: wrote ${inventory.headings.length} headings ` +
        `(source sha256 ${inventory.source_sha256.slice(0, 12)}…) to ${outPath}\n`,
    );
  } else {
    process.stdout.write(json);
  }
}

// Run only when invoked as a script (not when imported by the test harness).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
