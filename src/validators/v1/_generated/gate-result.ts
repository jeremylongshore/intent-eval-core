import { z } from 'zod';

export default z
  .object({
    gate_id: z
      .any()
      .describe(
        'Pipeline-hop-qualified gate identifier. MUST match the in-toto subject `name` per § 7.3.',
      ),
    gate_name: z.any().describe('Short human-readable kebab-case gate name.'),
    gate_version: z.any().describe('SemVer version of the gate logic that produced this row.'),
    gate_decision: z
      .enum(['pass', 'fail', 'advisory', 'error'])
      .describe(
        'Decision verdict (Blueprint B § 7.4 line 800, closed 4-element enum). Distinct from JudgeVerdict (UPPERCASE) and RolloutGateDecision (ship/no_ship).',
      ),
    gate_reasons: z
      .array(z.string())
      .describe(
        'Structured reason strings. Empty array permitted ONLY for unconditional pass. For fail/advisory/error, at least one entry MUST appear; for error, gate_reasons[0] MUST capture the error class per § 7.4 line 829.',
      ),
    coverage: z.any(),
    policy_ref: z
      .string()
      .regex(new RegExp('^sha256:[a-f0-9]{64}:.+$'))
      .describe(
        'Format: `sha256:<hex>:<repo-relative-path>`. Defends against mid-flight policy mutation per § 7.4 line 810.',
      ),
    policy_hash: z.any().describe('sha256-prefixed hash of the policy file content.'),
    input_hash: z
      .any()
      .describe(
        'sha256-prefixed hash of the input the gate evaluated. MUST equal the in-toto subject[].digest.sha256 for the row per § 7.4 line 814 + § 7.3 line 792.',
      ),
    evaluated_at: z.any(),
    runner: z.any(),
    commit_sha: z.any(),
    metadata: z
      .record(z.string(), z.any())
      .describe(
        'Tool-specific free-form metadata. Consumers MUST NOT use this for ship/no-ship decisions per § 7.4 line 818.',
      )
      .optional(),
    failure_mode: z
      .string()
      .describe(
        "Failure-mode classifier. MUST be populated when gate_decision='fail' AND the originating tool defines failure modes (e.g., MM-class for audit-harness gates).",
      )
      .optional(),
    advisory_severity: z
      .enum(['info', 'warn', 'error'])
      .describe(
        "Severity hint when gate_decision='advisory'. Consumer policy decides whether to elevate to blocking.",
      )
      .optional(),
    cost_record_ref: z.any().describe('FK → CostRecord.id for cost attribution.').optional(),
    replay_fidelity_level: z
      .enum(['RF-0', 'RF-1', 'RF-2', 'RF-3', 'RF-4'])
      .describe('Replay fidelity level per iel-E11.')
      .optional(),
  })
  .strict()
  .and(
    z.intersection(
      z.any().describe("When gate_decision='advisory', advisory_severity SHOULD be populated."),
      z
        .any()
        .describe(
          'Blueprint B § 7.4 line 829 (NORMATIVE): empty gate_reasons is permitted ONLY for unconditional pass — when gate_decision is fail/advisory/error at least one reason MUST appear.',
        ),
    ),
  )
  .describe(
    "Predicate body of an in-toto Statement v1 whose predicateType is https://evals.intentsolutions.io/gate-result/v1. Source of truth: Blueprint B § 7.4 (lines 794-834). The ONLY predicate body fully spec-bound at v1; every other predicate URI runs in sigstore_staging until its SPEC.md normative section lands per DR-010 Q3. This schema validates ONLY the predicate body — the enclosing in-toto Statement envelope (_type, subject, predicateType) is validated separately. Each row independently verifiable; NO top-level bundle signature per § 7 line 754. Adding/loosening any field requires Class-1 ISEDC convening.\n\nMigration note: this schema SUPERSEDES the lab's v0.1.0-draft schema (which used `result`/`timestamp` and was missing gate_name/gate_version/gate_reasons/coverage/policy_ref). Blueprint B § 7.4 is the canonical source — the lab schema was authored before Blueprint B landed on main.",
  );
