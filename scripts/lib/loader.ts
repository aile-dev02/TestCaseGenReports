/**
 * File system loaders.
 *
 * Responsible for discovering Markdown and YAML files, reading them,
 * parsing them via the parser module, and validating their schemas.
 * All public functions are synchronous for simplicity; file I/O is tiny.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import { parseTestCase, parseRequirement } from './parser.js'
import { TestCaseFrontmatterSchema } from '../../schemas/testcase.js'
import { RequirementFrontmatterSchema } from '../../schemas/requirement.js'
import { ResultsFileSchema } from '../../schemas/results.js'
import type { ParsedTestCase, ParsedRequirement } from './types.js'
import type { TestResult } from '../../schemas/results.js'

// ─────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────

/** Recursively collect all files with a given extension under dir */
function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext))
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
  return results
}

// ─────────────────────────────────────────────
// Public loaders
// ─────────────────────────────────────────────

/**
 * Load and parse every .md file under master/testcases/.
 * Files that fail schema validation are logged and skipped.
 *
 * @param rootDir Absolute path to the repository root
 */
export function loadTestCases(rootDir: string): ParsedTestCase[] {
  const dir = join(rootDir, 'master', 'testcases')
  const files = findFiles(dir, '.md')

  const cases: ParsedTestCase[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = parseTestCase(content, filePath)

    const validation = TestCaseFrontmatterSchema.safeParse(parsed.frontmatter)
    if (!validation.success) {
      console.warn(
        `[loader] Schema warning in ${filePath}: ${validation.error.issues
          .map((i) => i.message)
          .join(', ')}`,
      )
      // Still include the file so validate-testcases.ts can report it
    }
    cases.push(parsed)
  }

  return cases.sort((a, b) =>
    a.frontmatter.id.localeCompare(b.frontmatter.id),
  )
}

/**
 * Load and parse every .md file under master/requirements/.
 * Files that fail schema validation are logged and skipped.
 *
 * @param rootDir Absolute path to the repository root
 */
export function loadRequirements(rootDir: string): ParsedRequirement[] {
  const dir = join(rootDir, 'master', 'requirements')
  const files = findFiles(dir, '.md')

  const reqs: ParsedRequirement[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = parseRequirement(content, filePath)

    const validation = RequirementFrontmatterSchema.safeParse(
      parsed.frontmatter,
    )
    if (!validation.success) {
      console.warn(
        `[loader] Schema warning in ${filePath}: ${validation.error.issues
          .map((i) => i.message)
          .join(', ')}`,
      )
    }
    reqs.push(parsed)
  }

  return reqs.sort((a, b) =>
    a.frontmatter.id.localeCompare(b.frontmatter.id),
  )
}

/**
 * Load results from the most recent runs/{run-id}/results.yml file.
 * Run directories are sorted alphabetically; the last one wins
 * (e.g. "2026-05-release" > "2026-04-release").
 *
 * Returns a Map<testCaseId, TestResult>.
 *
 * @param rootDir Absolute path to the repository root
 */
export function loadLatestResults(rootDir: string): Map<string, TestResult> {
  const runsDir = join(rootDir, 'runs')
  if (!existsSync(runsDir)) return new Map()

  // Find all results.yml files and sort by directory name (latest last)
  const resultFiles = findFiles(runsDir, 'results.yml').sort()
  if (resultFiles.length === 0) return new Map()

  const latestFile = resultFiles[resultFiles.length - 1]
  const raw = parseYaml(readFileSync(latestFile, 'utf-8')) as unknown

  const parsed = ResultsFileSchema.safeParse(raw)
  if (!parsed.success) {
    console.error(
      `[loader] Results file validation error in ${latestFile}:\n`,
      parsed.error.format(),
    )
    return new Map()
  }

  return new Map(Object.entries(parsed.data))
}

/**
 * Return the run ID (directory name) of the most recent run.
 * Falls back to "unknown" if no runs directory exists.
 */
export function latestRunId(rootDir: string): string {
  const runsDir = join(rootDir, 'runs')
  if (!existsSync(runsDir)) return 'unknown'

  const dirs = readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  return dirs[dirs.length - 1] ?? 'unknown'
}

/** Ensure a directory exists, creating it (and parents) if necessary */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
