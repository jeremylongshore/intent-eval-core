/**
 * dashboard-render/v1 — in-toto predicate body attesting a rendered dashboard
 * artifact.
 *
 * Attests that a specific rendered dashboard HTML artifact was produced from a
 * specific, content-addressed set of evidence inputs — "this rendered page is
 * a faithful function of exactly these signed bundles." Enables
 * sign-your-own-homework verification: a third party re-runs the renderer
 * against the same inputs and reproduces `rendered_artifact.content_hash`.
 *
 * Predicate URI: `https://evals.intentsolutions.io/dashboard-render/v1`
 *
 * Wrapped in an in-toto Statement v1 envelope wrapped in DSSE
 * (`application/vnd.in-toto+json`), like every other predicate body. Each row
 * is independently verifiable; there is NO top-level bundle signature
 * (Blueprint B § 7 line 754).
 *
 * ADDITIVE in kernel v0.2.0 (B3 binding, sequenced). Net-new predicate URI;
 * no v0.1 contract is changed. Per § 7.2 backward-compat, adding a predicate
 * URI is allowed. Runs in sigstore_staging until a second independent verifier
 * exists (sign-your-own-homework sequencing) per DR-010 Q3.
 */

import type { Rfc3339, Sha256Prefixed, Uuidv7 } from '../primitives.js';

// ─── Predicate URI ─────────────────────────────────────────────────────────

/**
 * Canonical predicate URI for dashboard-render/v1. Per ISEDC CISO binding
 * (DR-004 / DR-010): URIs live ONLY at `evals.intentsolutions.io`.
 * `labs.intentsolutions.io` is reserved-don't-touch for blog/methodology and
 * MUST NOT host a predicate URI.
 */
export const DASHBOARD_RENDER_V1_URI =
  'https://evals.intentsolutions.io/dashboard-render/v1' as const;
export type DashboardRenderV1Uri = typeof DASHBOARD_RENDER_V1_URI;

// ─── Rendered-artifact reference ───────────────────────────────────────────

/**
 * The rendered dashboard artifact a dashboard-render/v1 row attests.
 *
 * `content_hash` is the authoritative identifier — `uri` is a convenience
 * pointer. Reproducing `content_hash` from `input_bundles` is what a verifier
 * checks.
 */
export interface RenderedArtifact {
  /**
   * OPTIONAL location of the rendered artifact — relative path or absolute URL.
   */
  readonly uri?: string;
  /** sha256-prefixed digest of the rendered HTML artifact bytes. */
  readonly content_hash: Sha256Prefixed;
  /** OPTIONAL IANA media type of the rendered artifact (e.g., `text/html`). */
  readonly media_type?: string;
}

/**
 * A content-addressed evidence input the artifact was rendered from. At least
 * one field MUST be present (enforced by the validator) so the input set is
 * reproducible.
 */
export interface DashboardInputBundle {
  /** UUIDv7 of an input EvidenceBundle (FK → EvidenceBundle.id). */
  readonly bundle_id?: Uuidv7;
  /** sha256-prefixed digest of the input bundle payload, pinning exact content. */
  readonly content_hash?: Sha256Prefixed;
}

// ─── Predicate body ────────────────────────────────────────────────────────

/**
 * dashboard-render/v1 predicate body — full shape.
 *
 * Wrapping is identical to gate-result/v1: this object becomes the
 * `predicate` field of an in-toto Statement v1, base64-encoded as the
 * `payload` of a DSSE envelope.
 */
export interface DashboardRenderV1 {
  /** The rendered dashboard artifact this row attests. */
  readonly rendered_artifact: RenderedArtifact;

  /**
   * Content-addressed evidence inputs the artifact was rendered from. MUST be
   * non-empty — a render with no evidence inputs is not attestable.
   */
  readonly input_bundles: readonly DashboardInputBundle[];

  /** RFC 3339 UTC timestamp at which the render was produced. */
  readonly rendered_at: Rfc3339;

  /**
   * Renderer tool identity + version in the form `<kebab-slug>@<semver>`
   * (e.g., `intent-eval-dashboard@0.2.0`). Mirrors gate-result/v1's `runner`
   * discipline so the producing tool is always pinned.
   */
  readonly renderer: string;

  /**
   * OPTIONAL sha256-prefixed hash of the renderer configuration / template
   * set, so a verifier can pin not just the tool version but the exact
   * template inputs.
   */
  readonly renderer_config_hash?: Sha256Prefixed;
}

// ─── in-toto Statement wrapping ────────────────────────────────────────────

/**
 * in-toto Statement v1 wrapping a dashboard-render/v1 predicate body.
 *
 * `_type` MUST be the Statement v1 URI and `predicateType` MUST be the
 * canonical dashboard-render/v1 URI. The `subject` typically names the
 * rendered artifact; the predicate body carries the structured
 * `rendered_artifact` + `input_bundles` references.
 */
export interface DashboardRenderV1Statement {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly subject: readonly {
    readonly name: string;
    readonly digest: { readonly sha256: string };
  }[];
  readonly predicateType: DashboardRenderV1Uri;
  readonly predicate: DashboardRenderV1;
}
