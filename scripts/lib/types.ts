/**
 * Shared domain types for the QA test management system.
 * All types are derived from Zod schemas or composed here.
 */

import type { TestCaseFrontmatter } from '../../schemas/testcase.js'
import type { RequirementFrontmatter } from '../../schemas/requirement.js'
import type { TestResult } from '../../schemas/results.js'

// ─────────────────────────────────────────────
// Re-export schema-derived types for convenience
// ─────────────────────────────────────────────
export type { TestCaseFrontmatter, RequirementFrontmatter, TestResult }

// ─────────────────────────────────────────────
// Parsed document types
// ─────────────────────────────────────────────

/** A test case Markdown file parsed into structured data */
export interface ParsedTestCase {
  frontmatter: TestCaseFrontmatter
  /** Ordered list of step descriptions extracted from the # 手順 section */
  steps: string[]
  /** Bulleted expected results from the # 期待結果 section */
  expectedResults: string[]
  filePath: string
  rawContent: string
}

/** A requirements Markdown file parsed into structured data */
export interface ParsedRequirement {
  frontmatter: RequirementFrontmatter
  /** First paragraph text before any heading in the body */
  description: string
  /** Bullet items from the # 受入基準 section */
  acceptanceCriteria: string[]
  filePath: string
}

// ─────────────────────────────────────────────
// Enriched / report types
// ─────────────────────────────────────────────

/** A test case combined with its latest execution result */
export interface EnrichedTestCase extends ParsedTestCase {
  result: TestResult | undefined
}

/** Aggregated statistics and fail list for a QA summary report */
export interface QASummary {
  runId: string
  generatedAt: string
  total: number
  pass: number
  fail: number
  skip: number
  notExecuted: number
  /** Pass rate out of executed (pass+fail+skip) cases, 0–100 */
  passRate: number
  /** IDs of high-priority cases whose status is FAIL */
  highPriorityFails: string[]
  failList: FailEntry[]
}

export interface FailEntry {
  id: string
  title: string
  priority: string
  assignee: string | undefined
  bug: string | undefined
  notes: string | undefined
  /** テストケースファイルの絶対パス（リンク生成用） */
  filePath: string
}

/** One row in the traceability matrix output */
export interface TraceabilityRow {
  requirementId: string
  requirementTitle: string
  /** 要件ファイルの絶対パス（リンク生成用） */
  requirementFilePath: string
  testCaseId: string
  testCaseTitle: string
  /** テストケースファイルの絶対パス（リンク生成用） */
  testCaseFilePath: string
  priority: string
  status: string
}

/** Full traceability matrix with a coverage summary */
export interface TraceabilityMatrix {
  rows: TraceabilityRow[]
  summary: {
    totalRequirements: number
    coveredRequirements: number
    totalTestCases: number
    coverageRate: number
  }
}

/** Validation error produced by validate-testcases.ts */
export interface ValidationError {
  file: string
  errorType: string
  message: string
}
