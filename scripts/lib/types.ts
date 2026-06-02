import type { TestResult } from '../../schemas/results.js'
import type { TestSpecMetadata, TestCaseRow, UpstreamMapping } from '../../schemas/testspec.js'

export type { TestResult, TestSpecMetadata, TestCaseRow, UpstreamMapping }

// ─────────────────────────────────────────────
// Parsed document types
// ─────────────────────────────────────────────

/** テスト仕様書 Markdown ファイルをパースした結果 */
export interface ParsedTestSpec {
  metadata: TestSpecMetadata
  upstreamMappings: UpstreamMapping[]
  testCases: TestCaseRow[]
  filePath: string
  rawContent: string
}

/** テストケース行に実行結果を付加した型 */
export interface EnrichedTestCaseRow extends TestCaseRow {
  result: TestResult | undefined
  specFilePath: string
}

// ─────────────────────────────────────────────
// Report types
// ─────────────────────────────────────────────

/** QA サマリレポート用集計データ */
export interface QASummary {
  runId: string
  generatedAt: string
  total: number
  pass: number
  fail: number
  skip: number
  notExecuted: number
  /** Pass率（実施済み件数を分母、0–100） */
  passRate: number
  failList: FailEntry[]
}

export interface FailEntry {
  id: string
  テスト名: string
  種別: string
  上流ID: string
  assignee: string | undefined
  bug: string | undefined
  notes: string | undefined
  specFilePath: string
}

/** トレーサビリティマトリクスの1行 */
export interface TraceabilityRow {
  上流ID: string
  機能名: string
  testCaseId: string
  testCaseTitle: string
  種別: string
  status: string
}

/** トレーサビリティマトリクス全体 */
export interface TraceabilityMatrix {
  rows: TraceabilityRow[]
  summary: {
    total上流ID: number
    covered上流ID: number
    totalTestCases: number
    coverageRate: number
  }
}

/** バリデーションエラー */
export interface ValidationError {
  file: string
  errorType: string
  message: string
}
