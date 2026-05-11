import { z } from 'zod'

/**
 * Zod schema for the YAML FrontMatter block of a test case Markdown file.
 * All fields are validated here; the Markdown body (steps / expected results)
 * is validated separately via the parser.
 */
export const TestCaseFrontmatterSchema = z.object({
  /** Unique identifier. Must match PREFIX-NNN format, e.g. AUTH-001 */
  id: z
    .string()
    .regex(/^[A-Z]+-\d+$/, 'ID must match pattern PREFIX-NNN (e.g., AUTH-001)'),

  /** Human-readable title (Japanese OK) */
  title: z.string().min(1, 'title is required'),

  /**
   * Linked requirement ID. Should match REQ-CATEGORY-NNN.
   * Optional to allow draft test cases without a requirement yet.
   */
  requirement: z
    .string()
    .regex(/^REQ-[A-Z0-9]+-\d+$/, 'requirement must match REQ-CATEGORY-NNN')
    .optional(),

  /** Execution priority */
  priority: z.enum(['high', 'medium', 'low']),

  /** Functional area / module label */
  category: z.string().min(1, 'category is required'),

  /** Test design type */
  type: z.enum([
    'positive',
    'negative',
    'boundary',
    'security',
    'performance',
  ]),

  /** List of preconditions that must be satisfied before execution */
  preconditions: z.array(z.string()).optional(),

  /** Free-form tags for filtering/grouping */
  tags: z.array(z.string()).optional(),
})

export type TestCaseFrontmatter = z.infer<typeof TestCaseFrontmatterSchema>
