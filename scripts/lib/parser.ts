/**
 * Markdown parsing utilities.
 *
 * Uses gray-matter to split FrontMatter from the body, then unified+remark-parse
 * to build an AST and extract structured sections (steps, expected results, etc.).
 */

import matter from 'gray-matter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Root, Heading, List, ListItem, Paragraph, Text } from 'mdast'
import type { Node } from 'unist'
import type { TestCaseFrontmatter } from '../../schemas/testcase.js'
import type { RequirementFrontmatter } from '../../schemas/requirement.js'
import type { ParsedTestCase, ParsedRequirement } from './types.js'

// ─────────────────────────────────────────────
// Internal AST helpers
// ─────────────────────────────────────────────

/** Extract all plain-text from a ListItem node */
function listItemText(item: ListItem): string {
  const parts: string[] = []
  visit(item as unknown as Node, 'text', (n) => {
    parts.push((n as Text).value)
  })
  return parts.join(' ').trim()
}

/**
 * Walk the AST and collect list items that appear immediately under a heading
 * whose text matches one of the given names.
 *
 * Supports both Japanese (手順 / 期待結果 / 受入基準) and English aliases so
 * English-first teams can also use the system.
 */
function extractSection(tree: Root, headingNames: string[]): string[] {
  const items: string[] = []
  let inSection = false

  for (const node of tree.children) {
    // Detect section boundary via h1 heading
    if (node.type === 'heading' && (node as Heading).depth === 1) {
      const h = node as Heading
      const textChild = h.children[0]
      const headingText =
        textChild?.type === 'text' ? (textChild as Text).value : ''
      inSection = headingNames.includes(headingText)
      continue
    }

    if (inSection && node.type === 'list') {
      for (const item of (node as List).children) {
        const text = listItemText(item as ListItem)
        if (text.length > 0) items.push(text)
      }
    }
  }

  return items
}

/** Extract concatenated text of all top-level paragraphs before the first heading */
function extractLeadParagraphs(tree: Root): string {
  const parts: string[] = []
  for (const node of tree.children) {
    if (node.type === 'heading') break
    if (node.type === 'paragraph') {
      const texts: string[] = []
      visit(node as unknown as Node, 'text', (n) => {
        texts.push((n as Text).value)
      })
      parts.push(texts.join(''))
    }
  }
  return parts.join('\n').trim()
}

// ─────────────────────────────────────────────
// Public parse functions
// ─────────────────────────────────────────────

/**
 * Parse a test case Markdown file.
 *
 * @param content  Raw file content (UTF-8)
 * @param filePath Absolute or repo-relative path (used for error messages)
 */
export function parseTestCase(
  content: string,
  filePath: string,
): ParsedTestCase {
  const { data, content: body } = matter(content)
  const tree = unified().use(remarkParse).parse(body) as Root

  return {
    frontmatter: data as TestCaseFrontmatter,
    steps: extractSection(tree, ['手順', 'Steps']),
    expectedResults: extractSection(tree, ['期待結果', 'Expected Results']),
    filePath,
    rawContent: content,
  }
}

/**
 * Parse a requirements Markdown file.
 *
 * @param content  Raw file content (UTF-8)
 * @param filePath Absolute or repo-relative path
 */
export function parseRequirement(
  content: string,
  filePath: string,
): ParsedRequirement {
  const { data, content: body } = matter(content)
  const tree = unified().use(remarkParse).parse(body) as Root

  return {
    frontmatter: data as RequirementFrontmatter,
    description: extractLeadParagraphs(tree),
    acceptanceCriteria: extractSection(tree, ['受入基準', 'Acceptance Criteria']),
    filePath,
  }
}

// ─────────────────────────────────────────────
// Structural validation helpers (used by validator)
// ─────────────────────────────────────────────

/** Return true if the Markdown body contains a recognisable # 手順 heading */
export function hasStepsSection(content: string): boolean {
  const { content: body } = matter(content)
  return /^#\s+(手順|Steps)\s*$/m.test(body)
}

/** Return true if the Markdown body contains a recognisable # 期待結果 heading */
export function hasExpectedResultsSection(content: string): boolean {
  const { content: body } = matter(content)
  return /^#\s+(期待結果|Expected Results)\s*$/m.test(body)
}
