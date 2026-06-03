import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Sha256Prefixed, Uuidv7 } from '../primitives.js';
import {
  DASHBOARD_RENDER_V1_URI,
  type DashboardInputBundle,
  type DashboardRenderV1,
  type DashboardRenderV1Statement,
  type RenderedArtifact,
} from './dashboard-render-v1.js';

describe('dashboard-render/v1 — predicate URI (B3 binding, sequenced)', () => {
  it('routes through evals.intentsolutions.io, NEVER labs (CISO binding)', () => {
    expect(DASHBOARD_RENDER_V1_URI).toBe('https://evals.intentsolutions.io/dashboard-render/v1');
    expect(DASHBOARD_RENDER_V1_URI).not.toContain('labs.intentsolutions.io');
  });
});

describe('dashboard-render/v1 — predicate body shape', () => {
  it('accepts a minimal required-only body', () => {
    const artifact: RenderedArtifact = {
      content_hash: ('sha256:' + 'a'.repeat(64)) as Sha256Prefixed,
    };
    const input: DashboardInputBundle = {
      bundle_id: '0192cae6-000b-7000-8000-000000000000' as Uuidv7,
    };
    const body: DashboardRenderV1 = {
      rendered_artifact: artifact,
      input_bundles: [input],
      rendered_at: '2026-06-01T12:05:00Z' as DashboardRenderV1['rendered_at'],
      renderer: 'intent-eval-dashboard@0.2.0',
    };
    expect(body.input_bundles).toHaveLength(1);
  });

  it('accepts full optional fields (uri, media_type, renderer_config_hash)', () => {
    const body: DashboardRenderV1 = {
      rendered_artifact: {
        uri: '/results/x.html',
        content_hash: ('sha256:' + 'a'.repeat(64)) as Sha256Prefixed,
        media_type: 'text/html',
      },
      input_bundles: [{ content_hash: ('sha256:' + '3'.repeat(64)) as Sha256Prefixed }],
      rendered_at: '2026-06-01T12:05:00Z' as DashboardRenderV1['rendered_at'],
      renderer: 'intent-eval-dashboard@0.2.0',
      renderer_config_hash: ('sha256:' + 'c'.repeat(64)) as Sha256Prefixed,
    };
    expect(body.rendered_artifact.media_type).toBe('text/html');
  });

  it('Statement carries _type, predicateType, predicate', () => {
    expectTypeOf<DashboardRenderV1Statement>()
      .toHaveProperty('_type')
      .toEqualTypeOf<'https://in-toto.io/Statement/v1'>();
    expectTypeOf<DashboardRenderV1Statement>()
      .toHaveProperty('predicateType')
      .toEqualTypeOf<typeof DASHBOARD_RENDER_V1_URI>();
  });
});
