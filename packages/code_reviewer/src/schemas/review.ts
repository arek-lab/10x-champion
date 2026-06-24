import { z } from "zod";

/**
 * The five review criteria, scored 1–10 each. These ids are load-bearing: they
 * are the keys of {@link reviewSchema.scores} and must stay in sync with
 * `criteria.md` and the promptfoo rubric.
 */
export const CRITERIA = ["correctness", "security", "conventions", "readability", "testing"] as const;

export type Criterion = (typeof CRITERIA)[number];

/** A 1–10 integer score. */
const scoreValue = z.number().int().min(1).max(10);

/** Per-criterion score plus a short justification. */
export const criterionScoreSchema = z.object({
  score: scoreValue,
  comment: z.string(),
});

/** Schema for a single review finding. */
export const findingSchema = z.object({
  severity: z.enum(["info", "minor", "major", "critical"]),
  line: z.number().int().positive().nullable(),
  message: z.string(),
  suggestion: z.string().nullable(),
});

/**
 * Schema for the structured output of a code review.
 *
 * This is the **merge gate**: downstream CI reads `verdict` and `score`
 * mechanically, so the shape is strict. `scores` carries one entry per
 * criterion (see {@link CRITERIA}); `findings` keeps the granular detail used by
 * the CLI report.
 */
export const reviewSchema = z.object({
  scores: z.object({
    correctness: criterionScoreSchema,
    security: criterionScoreSchema,
    conventions: criterionScoreSchema,
    readability: criterionScoreSchema,
    testing: criterionScoreSchema,
  }),
  score: scoreValue,
  verdict: z.enum(["pass", "fail"]),
  summary: z.string(),
  findings: z.array(findingSchema),
});

export type CriterionScore = z.infer<typeof criterionScoreSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Review = z.infer<typeof reviewSchema>;
