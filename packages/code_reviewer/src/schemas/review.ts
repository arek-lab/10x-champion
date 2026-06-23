import { z } from "zod";

/** Schema for a single review finding. */
export const findingSchema = z.object({
  severity: z.enum(["info", "minor", "major", "critical"]),
  line: z.number().int().positive().nullable(),
  message: z.string(),
  suggestion: z.string().nullable(),
});

/** Schema for the structured output of a code review. */
export const reviewSchema = z.object({
  summary: z.string(),
  findings: z.array(findingSchema),
});

export type Finding = z.infer<typeof findingSchema>;
export type Review = z.infer<typeof reviewSchema>;
