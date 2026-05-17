import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    mm_class: z.any().describe('Natural key. Accepts any MM-N value (broader than MmClass enum).'),
    name: z.any(),
    description: z.string().min(1),
    discriminating_question: z
      .string()
      .min(1)
      .describe(
        'The question a human asks to decide whether a given failure belongs in this class. Drives the classification UI.',
      ),
    examples: z.array(
      z
        .object({
          ref: z.string().describe('URL, gist, doc path, EvalRun id, etc.'),
          description: z.string().optional(),
        })
        .strict(),
    ),
    version: z.any(),
    status: z.enum(['proposed', 'canonical', 'deprecated']),
    created_at: z.any(),
    created_by: z.any(),
  })
  .strict()
  .describe(
    "State machine: proposed → canonical → deprecated (forward-only). canonical → deprecated requires Class-1 ISEDC DR. JudgeDecision with verdict='FAIL' MUST classify against an entry here. Drift emits `taxonomy.drift.detected` OTel event. Source of truth for what MM-N classes exist — MatcherMap.mm_class kernel enum is DOWNSTREAM of this entity (proposed → canonical → MmClass enum bump).",
  );
