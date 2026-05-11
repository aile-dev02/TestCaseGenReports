/**
 * CLI: validate all Markdown test cases under master/testcases/.
 *
 * Checks:
 *   1. FrontMatter schema (via Zod) — missing fields, wrong types
 *   2. Duplicate IDs across files
 *   3. Missing requirement link
 *   4. Empty # 手順 section
 *   5. Empty # 期待結果 section
 *   6. Priority value correctness (covered by Zod but surfaced explicitly)
 *
 * Exit code: 0 on success, 1 on any error.
 *
 * Usage:
 *   npm run validate
 *   tsx scripts/validate-testcases.ts
 */

import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { loadTestCases } from './lib/loader.js'
import { TestCaseFrontmatterSchema } from '../schemas/testcase.js'
import type { ValidationError } from './lib/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function rel(filePath: string): string {
  return relative(ROOT_DIR, filePath).replace(/\\/g, '/')
}

// ─────────────────────────────────────────────
// Main validation logic
// ─────────────────────────────────────────────

function run(): void {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  QA Test Case Validator               ║')
  console.log('╚══════════════════════════════════════╝\n')

  const testCases = loadTestCases(ROOT_DIR)

  if (testCases.length === 0) {
    console.warn('⚠  No test cases found in master/testcases/')
    console.warn('   Create at least one .md file to begin.\n')
    process.exit(0)
  }

  console.log(`Found ${testCases.length} test case(s). Validating...\n`)

  const errors: ValidationError[] = []

  // ── 1. Schema validation ───────────────────
  for (const tc of testCases) {
    const result = TestCaseFrontmatterSchema.safeParse(tc.frontmatter)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          file: rel(tc.filePath),
          errorType: 'SCHEMA_ERROR',
          message: `[${issue.path.join('.') || 'root'}] ${issue.message}`,
        })
      }
    }
  }

  // ── 2. Duplicate ID check ──────────────────
  const idMap = new Map<string, string[]>()
  for (const tc of testCases) {
    const id = tc.frontmatter.id ?? '(no id)'
    if (!idMap.has(id)) idMap.set(id, [])
    idMap.get(id)!.push(rel(tc.filePath))
  }
  for (const [id, files] of idMap) {
    if (files.length > 1) {
      for (const file of files) {
        errors.push({
          file,
          errorType: 'DUPLICATE_ID',
          message: `ID "${id}" appears in multiple files: ${files.join(', ')}`,
        })
      }
    }
  }

  // ── 3. Missing requirement link ────────────
  for (const tc of testCases) {
    if (!tc.frontmatter.requirement) {
      errors.push({
        file: rel(tc.filePath),
        errorType: 'MISSING_REQUIREMENT',
        message: `"${tc.frontmatter.id ?? '?'}" has no requirement: field — add REQ-CATEGORY-NNN`,
      })
    }
  }

  // ── 4. Empty steps section ─────────────────
  for (const tc of testCases) {
    if (tc.steps.length === 0) {
      errors.push({
        file: rel(tc.filePath),
        errorType: 'MISSING_STEPS',
        message: `"${tc.frontmatter.id ?? '?'}" — # 手順 section is absent or contains no list items`,
      })
    }
  }

  // ── 5. Empty expected results section ──────
  for (const tc of testCases) {
    if (tc.expectedResults.length === 0) {
      errors.push({
        file: rel(tc.filePath),
        errorType: 'MISSING_EXPECTED_RESULTS',
        message: `"${tc.frontmatter.id ?? '?'}" — # 期待結果 section is absent or contains no list items`,
      })
    }
  }

  // ─────────────────────────────────────────
  // Report
  // ─────────────────────────────────────────
  if (errors.length === 0) {
    console.log(`✅  All ${testCases.length} test case(s) passed validation.\n`)
    process.exit(0)
  }

  // Group by file for readable output
  const byFile = new Map<string, ValidationError[]>()
  for (const err of errors) {
    if (!byFile.has(err.file)) byFile.set(err.file, [])
    byFile.get(err.file)!.push(err)
  }

  console.error(`❌  Found ${errors.length} error(s) in ${byFile.size} file(s):\n`)

  for (const [file, fileErrors] of byFile) {
    console.error(`  📄 ${file}`)
    for (const err of fileErrors) {
      console.error(`     [${err.errorType}] ${err.message}`)
    }
    console.error('')
  }

  process.exit(1)
}

run()
