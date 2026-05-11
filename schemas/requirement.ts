import { z } from 'zod'

/**
 * Zod schema for the YAML FrontMatter of a requirements Markdown file.
 *
 * Example: master/requirements/REQ-LOGIN-001.md
 */
export const RequirementFrontmatterSchema = z.object({
  /** Unique identifier matching REQ-CATEGORY-NNN */
  id: z
    .string()
    .regex(/^REQ-[A-Z0-9]+-\d+$/, 'id must match REQ-CATEGORY-NNN'),

  /** Short requirement title */
  title: z.string().min(1, 'title is required'),

  /** One-line summary shown in traceability matrix */
  description: z.string().optional(),

  /** Functional area / module */
  category: z.string().min(1, 'category is required'),

  /** Business priority */
  priority: z.enum(['high', 'medium', 'low']).default('medium'),

  /** Lifecycle status */
  status: z.enum(['draft', 'approved', 'deprecated']).default('draft'),
})

export type RequirementFrontmatter = z.infer<typeof RequirementFrontmatterSchema>
