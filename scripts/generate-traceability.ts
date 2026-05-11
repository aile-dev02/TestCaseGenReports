/**
 * CLI: generate the traceability matrix.
 *
 * Produces:
 *   reports/latest/traceability.md    — Markdown version
 *   reports/latest/traceability.xlsx  — Excel version (second sheet in same workbook
 *                                       if generate-excel already ran; standalone here)
 *
 * Matrix structure: Requirement → TestCase → ExecutionResult
 *
 * Usage:
 *   npm run generate:traceability
 *   tsx scripts/generate-traceability.ts
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import ExcelJS from 'exceljs'
import {
  loadTestCases,
  loadRequirements,
  loadLatestResults,
  latestRunId,
  ensureDir,
} from './lib/loader.js'
import type { TraceabilityRow, TraceabilityMatrix } from './lib/types.js'
import type { ParsedTestCase, ParsedRequirement } from './lib/types.js'
import type { TestResult } from '../schemas/results.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

// ─────────────────────────────────────────────
// Matrix construction
// ─────────────────────────────────────────────

function buildMatrix(
  requirements: ParsedRequirement[],
  testCases: ParsedTestCase[],
  results: Map<string, TestResult>,
): TraceabilityMatrix {
  const rows: TraceabilityRow[] = []
  const coveredReqIds = new Set<string>()

  // For each requirement, find linked test cases
  for (const req of requirements) {
    const linked = testCases.filter(
      (tc) => tc.frontmatter.requirement === req.frontmatter.id,
    )

    if (linked.length === 0) {
      rows.push({
        requirementId: req.frontmatter.id,
        requirementTitle: req.frontmatter.title,
        testCaseId: '(テストケースなし)',
        testCaseTitle: '',
        priority: '',
        status: 'NOT_COVERED',
      })
    } else {
      coveredReqIds.add(req.frontmatter.id)
      for (const tc of linked) {
        rows.push({
          requirementId: req.frontmatter.id,
          requirementTitle: req.frontmatter.title,
          testCaseId: tc.frontmatter.id,
          testCaseTitle: tc.frontmatter.title,
          priority: tc.frontmatter.priority,
          status: results.get(tc.frontmatter.id)?.status ?? 'NOT_EXECUTED',
        })
      }
    }
  }

  // Test cases not linked to any requirement
  const knownReqIds = new Set(requirements.map((r) => r.frontmatter.id))
  for (const tc of testCases) {
    if (!tc.frontmatter.requirement || !knownReqIds.has(tc.frontmatter.requirement)) {
      rows.push({
        requirementId: tc.frontmatter.requirement ?? '(要件なし)',
        requirementTitle: '',
        testCaseId: tc.frontmatter.id,
        testCaseTitle: tc.frontmatter.title,
        priority: tc.frontmatter.priority,
        status: results.get(tc.frontmatter.id)?.status ?? 'NOT_EXECUTED',
      })
    }
  }

  return {
    rows,
    summary: {
      totalRequirements: requirements.length,
      coveredRequirements: coveredReqIds.size,
      totalTestCases: testCases.length,
      coverageRate:
        requirements.length > 0
          ? Math.round((coveredReqIds.size / requirements.length) * 100)
          : 0,
    },
  }
}

// ─────────────────────────────────────────────
// Markdown output
// ─────────────────────────────────────────────

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    PASS: '✅ PASS',
    FAIL: '❌ FAIL',
    SKIP: '⏭ SKIP',
    NOT_EXECUTED: '⬜ 未実施',
    NOT_COVERED: '🚫 未対応',
  }
  return map[status] ?? status
}

function renderMarkdown(matrix: TraceabilityMatrix, runId: string): string {
  const lines: string[] = []
  const { summary } = matrix

  lines.push('# トレーサビリティマトリクス')
  lines.push('')
  lines.push(`**生成日時:** ${new Date().toISOString()}  `)
  lines.push(`**実行セット:** ${runId}`)
  lines.push('')

  // ── Coverage summary ────────────────────────
  lines.push('## カバレッジサマリ')
  lines.push('')
  lines.push('| 項目 | 値 |')
  lines.push('|:-----|:--|')
  lines.push(`| 要件総数 | ${summary.totalRequirements} |`)
  lines.push(`| カバー済み要件 | ${summary.coveredRequirements} |`)
  lines.push(`| テストケース総数 | ${summary.totalTestCases} |`)
  lines.push(`| 要件カバレッジ率 | **${summary.coverageRate}%** |`)
  lines.push('')

  // ── Matrix table ────────────────────────────
  lines.push('## マトリクス')
  lines.push('')
  lines.push(
    '| 要件ID | 要件タイトル | テストケースID | テストケースタイトル | 優先度 | 実行ステータス |',
  )
  lines.push(
    '|:-------|:------------|:--------------|:--------------------|:-------|:--------------|',
  )

  let lastReqId = ''
  for (const row of matrix.rows) {
    const reqIdCell =
      row.requirementId === lastReqId ? '' : `\`${row.requirementId}\``
    lastReqId = row.requirementId

    lines.push(
      `| ${reqIdCell} | ${row.requirementTitle} | \`${row.testCaseId}\` | ${row.testCaseTitle} | ${row.priority} | ${statusBadge(row.status)} |`,
    )
  }
  lines.push('')

  lines.push('---')
  lines.push('')
  lines.push(
    '*このレポートは [QA Test Management System](../../README.md) により自動生成されました。*',
  )
  lines.push('')

  return lines.join('\n')
}

// ─────────────────────────────────────────────
// Excel output
// ─────────────────────────────────────────────

async function renderExcel(
  matrix: TraceabilityMatrix,
  outputPath: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'QA Test Management System'
  wb.created = new Date()

  const ws = wb.addWorksheet('トレーサビリティ', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  // Header
  ws.columns = [
    { header: '要件ID', key: 'reqId', width: 16 },
    { header: '要件タイトル', key: 'reqTitle', width: 30 },
    { header: 'テストケースID', key: 'tcId', width: 16 },
    { header: 'テストケースタイトル', key: 'tcTitle', width: 36 },
    { header: '優先度', key: 'priority', width: 10 },
    { header: '実行ステータス', key: 'status', width: 16 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 28

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } }

  const statusColors: Record<string, string> = {
    PASS: 'FF70AD47',
    FAIL: 'FFFF4444',
    SKIP: 'FFFFC000',
    NOT_EXECUTED: 'FFD9D9D9',
    NOT_COVERED: 'FFFF8C00',
  }

  matrix.rows.forEach((row, idx) => {
    const dataRow = ws.addRow({
      reqId: row.requirementId,
      reqTitle: row.requirementTitle,
      tcId: row.testCaseId,
      tcTitle: row.testCaseTitle,
      priority: row.priority,
      status: row.status,
    })

    const isAlt = idx % 2 === 1
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        bottom: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        left: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        right: { style: 'thin', color: { argb: 'FFB8B8B8' } },
      }
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }
      }
    })

    const statusCell = dataRow.getCell('status')
    const statusColor = statusColors[row.status] ?? 'FFD9D9D9'
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
    statusCell.font = {
      bold: row.status === 'FAIL',
      color: { argb: row.status === 'FAIL' ? 'FFFFFFFF' : 'FF000000' },
      size: 10,
    }
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Summary sheet
  const sumWs = wb.addWorksheet('カバレッジサマリ')
  sumWs.columns = [{ header: '項目', key: 'label', width: 24 }, { header: '値', key: 'value', width: 12 }]
  ;[
    ['要件総数', matrix.summary.totalRequirements],
    ['カバー済み要件', matrix.summary.coveredRequirements],
    ['テストケース総数', matrix.summary.totalTestCases],
    ['要件カバレッジ率 (%)', matrix.summary.coverageRate],
  ].forEach(([label, value]) => {
    sumWs.addRow({ label, value })
  })

  await wb.xlsx.writeFile(outputPath)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🗺  Traceability Matrix Generator')
  console.log('─'.repeat(40))

  const testCases = loadTestCases(ROOT_DIR)
  const requirements = loadRequirements(ROOT_DIR)
  const results = loadLatestResults(ROOT_DIR)
  const runId = latestRunId(ROOT_DIR)

  console.log(`  Test cases   : ${testCases.length}`)
  console.log(`  Requirements : ${requirements.length}`)
  console.log(`  Results      : ${results.size}`)

  const matrix = buildMatrix(requirements, testCases, results)

  const outputDir = join(ROOT_DIR, 'reports', 'latest')
  ensureDir(outputDir)

  // Markdown
  const mdPath = join(outputDir, 'traceability.md')
  writeFileSync(mdPath, renderMarkdown(matrix, runId), 'utf-8')
  console.log(`\n  📄 Markdown: ${mdPath}`)

  // Excel
  const xlsxPath = join(outputDir, 'traceability.xlsx')
  await renderExcel(matrix, xlsxPath)
  console.log(`  📊 Excel   : ${xlsxPath}`)

  console.log(
    `\n  Coverage: ${matrix.summary.coveredRequirements}/${matrix.summary.totalRequirements} requirements (${matrix.summary.coverageRate}%)`,
  )
  console.log('\n✅  Done.\n')
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
