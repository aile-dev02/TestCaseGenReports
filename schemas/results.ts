import { z } from 'zod'

/**
 * Zod schema for a single test result entry inside results.yml.
 *
 * results.yml structure:
 *   AUTH-001:
 *     status: PASS
 *     assignee: yamada
 *     completed_at: "2026-05-11T10:00:00"
 *     evidence:
 *       - evidence/AUTH-001/step1.png
 */
export const TestResultSchema = z.object({
  status: z
    .enum(['PASS', 'FAIL', 'SKIP', 'NOT_EXECUTED'])
    .default('NOT_EXECUTED'),

  /** Tester who executed the case */
  assignee: z.string().optional(),

  /** ISO 8601 timestamp of test completion */
  completed_at: z.string().optional(),

  /** Relative paths to screenshot / log evidence */
  evidence: z.array(z.string()).optional(),

  /** Bug ticket ID when status is FAIL */
  bug: z.string().optional(),

  /** Free-form notes */
  notes: z.string().optional(),
})

/** Top-level results.yml is a map from test case ID to its result */
export const ResultsFileSchema = z.record(z.string(), TestResultSchema)

export type TestResult = z.infer<typeof TestResultSchema>
export type ResultsFile = z.infer<typeof ResultsFileSchema>
