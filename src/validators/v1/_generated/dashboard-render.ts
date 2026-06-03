import { z } from 'zod';

export default z
  .object({
    rendered_artifact: z
      .object({
        uri: z
          .string()
          .min(1)
          .describe(
            'OPTIONAL location of the rendered artifact — relative path or absolute URL. The content_hash is the authoritative identifier; uri is a convenience pointer.',
          )
          .optional(),
        content_hash: z
          .any()
          .describe(
            'sha256-prefixed digest of the rendered HTML artifact bytes. Reproducing this from input_bundles is what a verifier checks.',
          ),
        media_type: z
          .string()
          .min(1)
          .describe('OPTIONAL IANA media type of the rendered artifact (e.g., text/html).')
          .optional(),
      })
      .strict()
      .describe('The rendered dashboard artifact this row attests.'),
    input_bundles: z
      .array(
        z
          .object({
            bundle_id: z
              .any()
              .describe('UUIDv7 of an input EvidenceBundle (FK → EvidenceBundle.id).')
              .optional(),
            content_hash: z
              .any()
              .describe(
                'sha256-prefixed digest of the input bundle payload, pinning exact content.',
              )
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .describe(
        'Content-addressed evidence inputs the artifact was rendered from. Each entry pins a bundle by id and/or digest so the input set is reproducible. MUST be non-empty — a render with no evidence inputs is not attestable.',
      ),
    rendered_at: z.any().describe('RFC 3339 UTC timestamp at which the render was produced.'),
    renderer: z
      .any()
      .describe(
        "Renderer tool identity + version in the form `<kebab-slug>@<semver>` (e.g., intent-eval-dashboard@0.2.0). Mirrors gate-result/v1's `runner` discipline so the producing tool is always pinned.",
      ),
    renderer_config_hash: z
      .any()
      .describe(
        'OPTIONAL sha256-prefixed hash of the renderer configuration / template set, so a verifier can pin not just the tool version but the exact template inputs.',
      )
      .optional(),
  })
  .strict()
  .describe(
    "Predicate body of an in-toto Statement v1 whose predicateType is https://evals.intentsolutions.io/dashboard-render/v1. Attests that a specific rendered dashboard HTML artifact was produced from a specific, content-addressed set of evidence inputs — i.e., 'this rendered page is a faithful function of exactly these signed bundles.' Enables sign-your-own-homework verification: a third party can re-run the renderer against the same inputs and reproduce rendered_artifact.content_hash. This schema validates ONLY the predicate body — the enclosing in-toto Statement envelope (_type, subject, predicateType) is validated separately. Each row independently verifiable; NO top-level bundle signature per Blueprint B § 7 line 754.\n\nADDITIVE in kernel v0.2.0 (B3 binding, sequenced): net-new predicate URI; no v0.1 contract changes. Per § 7.2 backward-compat, adding a predicate URI is allowed. Runs in sigstore_staging until a second independent verifier exists (sign-your-own-homework sequencing) and production-Rekor unlock per DR-010 Q3.",
  );
