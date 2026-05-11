/**
 * Excel workbook builder.
 *
 * Produces a multi-sheet .xlsx file using ExcelJS.  All formatting
 * (header colours, borders, auto-filter, freeze panes, conditional
 * formatting, column widths) is applied here so the caller only needs
 * to pass data.
 *
 * Sheet structure
 * ───────────────
 *   1. テストケース一覧        – All test cases with latest status
 *   2. 要件別テストケース       – Test cases grouped per requirement
 *   3. 実行結果               – Full execution result details
 *   4. FAIL一覧               – Failed cases only, for quick triage
 */

import ExcelJS from 'exceljs'
import type { ParsedTestCase } from './types.js'
import type { TestResult } from '../../schemas/results.js'

// ─────────────────────────────────────────────
// Colour constants (ARGB without leading #)
// ─────────────────────────────────────────────
const C = {
  headerBg: 'FF4472C4',
  headerFg: 'FFFFFFFF',
  passBg: 'FF70AD47',
  passFg: 'FFFFFFFF',
  failBg: 'FFFF4444',
  failFg: 'FFFFFFFF',
  skipBg: 'FFFFC000',
  skipFg: 'FF000000',
  notExecBg: 'FFD9D9D9',
  notExecFg: 'FF404040',
  highBg: 'FFFFD6CC',
  medBg: 'FFFFF2CC',
  altRow: 'FFF7F7F7',
  border: 'FFB8B8B8',
} as const

// ─────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  left: { style: 'thin', color: { argb: C.border } },
  right: { style: 'thin', color: { argb: C.border } },
}

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.height = 28
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C.headerBg },
    }
    cell.font = { bold: true, color: { argb: C.headerFg }, size: 10 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder
  })
}

function applyDataRowStyle(
  row: ExcelJS.Row,
  isAlt: boolean,
): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { wrapText: true, vertical: 'top' }
    cell.border = thinBorder
    if (isAlt) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: C.altRow },
      }
    }
  })
}

function applyStatusStyle(cell: ExcelJS.Cell, status: string): void {
  const map: Record<string, [string, string]> = {
    PASS: [C.passBg, C.passFg],
    FAIL: [C.failBg, C.failFg],
    SKIP: [C.skipBg, C.skipFg],
    NOT_EXECUTED: [C.notExecBg, C.notExecFg],
  }
  const [bg, fg] = map[status] ?? [C.notExecBg, C.notExecFg]
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.font = { bold: status === 'FAIL', color: { argb: fg }, size: 10 }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
}

function applyPriorityStyle(cell: ExcelJS.Cell, priority: string): void {
  if (priority === 'high') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.highBg } }
    cell.font = { bold: true, size: 10 }
  } else if (priority === 'medium') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.medBg } }
  }
  cell.alignment = { horizontal: 'center', vertical: 'top' }
}

// ─────────────────────────────────────────────
// Sheet 1 – テストケース一覧
// ─────────────────────────────────────────────

function addTestCaseListSheet(
  wb: ExcelJS.Workbook,
  testCases: ParsedTestCase[],
  results: Map<string, TestResult>,
): void {
  const ws = wb.addWorksheet('テストケース一覧', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'タイトル', key: 'title', width: 36 },
    { header: '要件ID', key: 'requirement', width: 16 },
    { header: '優先度', key: 'priority', width: 10 },
    { header: 'カテゴリ', key: 'category', width: 12 },
    { header: 'タイプ', key: 'type', width: 13 },
    { header: '前提条件', key: 'preconditions', width: 42 },
    { header: '手順', key: 'steps', width: 52 },
    { header: '期待結果', key: 'expectedResults', width: 52 },
    { header: '実行ステータス', key: 'status', width: 16 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 10 },
  }

  testCases.forEach((tc, idx) => {
    const result = results.get(tc.frontmatter.id)
    const status = result?.status ?? 'NOT_EXECUTED'

    const row = ws.addRow({
      id: tc.frontmatter.id,
      title: tc.frontmatter.title,
      requirement: tc.frontmatter.requirement ?? '',
      priority: tc.frontmatter.priority,
      category: tc.frontmatter.category,
      type: tc.frontmatter.type,
      preconditions: (tc.frontmatter.preconditions ?? []).join('\n'),
      steps: tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      expectedResults: tc.expectedResults.map((r) => `• ${r}`).join('\n'),
      status,
    })

    applyDataRowStyle(row, idx % 2 === 1)
    applyStatusStyle(row.getCell('status'), status)
    applyPriorityStyle(row.getCell('priority'), tc.frontmatter.priority)

    // Auto-height hint: rough estimate based on steps count
    row.height = Math.max(20, tc.steps.length * 18)
  })

  // Conditional formatting as an extra visual layer (complements direct styles)
  const lastRow = Math.max(testCases.length + 1, 2)
  ws.addConditionalFormatting({
    ref: `J2:J${lastRow}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'FAIL',
        priority: 1,
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: C.failBg },
          },
          font: { bold: true, color: { argb: C.failFg } },
        },
      } as ExcelJS.ConditionalFormattingRule,
    ],
  })
}

// ─────────────────────────────────────────────
// Sheet 2 – 要件別テストケース
// ─────────────────────────────────────────────

function addByRequirementSheet(
  wb: ExcelJS.Workbook,
  testCases: ParsedTestCase[],
  results: Map<string, TestResult>,
): void {
  const ws = wb.addWorksheet('要件別テストケース', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws.columns = [
    { header: '要件ID', key: 'requirement', width: 16 },
    { header: 'テストケースID', key: 'id', width: 14 },
    { header: 'タイトル', key: 'title', width: 36 },
    { header: '優先度', key: 'priority', width: 10 },
    { header: 'タイプ', key: 'type', width: 13 },
    { header: '実行ステータス', key: 'status', width: 16 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 6 },
  }

  // Group by requirement ID
  const grouped = new Map<string, ParsedTestCase[]>()
  for (const tc of testCases) {
    const key = tc.frontmatter.requirement ?? '(要件なし)'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(tc)
  }

  let idx = 0
  for (const [reqId, tcs] of [...grouped.entries()].sort()) {
    for (const tc of tcs) {
      const status = results.get(tc.frontmatter.id)?.status ?? 'NOT_EXECUTED'
      const row = ws.addRow({
        requirement: reqId,
        id: tc.frontmatter.id,
        title: tc.frontmatter.title,
        priority: tc.frontmatter.priority,
        type: tc.frontmatter.type,
        status,
      })
      applyDataRowStyle(row, idx % 2 === 1)
      applyStatusStyle(row.getCell('status'), status)
      applyPriorityStyle(row.getCell('priority'), tc.frontmatter.priority)
      idx++
    }
  }
}

// ─────────────────────────────────────────────
// Sheet 3 – 実行結果
// ─────────────────────────────────────────────

function addExecutionResultsSheet(
  wb: ExcelJS.Workbook,
  testCases: ParsedTestCase[],
  results: Map<string, TestResult>,
): void {
  const ws = wb.addWorksheet('実行結果', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'タイトル', key: 'title', width: 36 },
    { header: '優先度', key: 'priority', width: 10 },
    { header: '実行ステータス', key: 'status', width: 16 },
    { header: '担当者', key: 'assignee', width: 14 },
    { header: '完了日時', key: 'completed_at', width: 22 },
    { header: 'エビデンス', key: 'evidence', width: 40 },
    { header: '不具合ID', key: 'bug', width: 14 },
    { header: 'メモ', key: 'notes', width: 40 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 9 },
  }

  testCases.forEach((tc, idx) => {
    const result = results.get(tc.frontmatter.id)
    const status = result?.status ?? 'NOT_EXECUTED'

    const row = ws.addRow({
      id: tc.frontmatter.id,
      title: tc.frontmatter.title,
      priority: tc.frontmatter.priority,
      status,
      assignee: result?.assignee ?? '',
      completed_at: result?.completed_at ?? '',
      evidence: (result?.evidence ?? []).join('\n'),
      bug: result?.bug ?? '',
      notes: result?.notes ?? '',
    })

    applyDataRowStyle(row, idx % 2 === 1)
    applyStatusStyle(row.getCell('status'), status)
    applyPriorityStyle(row.getCell('priority'), tc.frontmatter.priority)
  })
}

// ─────────────────────────────────────────────
// Sheet 4 – FAIL一覧
// ─────────────────────────────────────────────

function addFailListSheet(
  wb: ExcelJS.Workbook,
  testCases: ParsedTestCase[],
  results: Map<string, TestResult>,
): void {
  const ws = wb.addWorksheet('FAIL一覧', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'タイトル', key: 'title', width: 36 },
    { header: '優先度', key: 'priority', width: 10 },
    { header: '担当者', key: 'assignee', width: 14 },
    { header: '完了日時', key: 'completed_at', width: 22 },
    { header: '不具合ID', key: 'bug', width: 14 },
    { header: 'メモ', key: 'notes', width: 40 },
    { header: '要件ID', key: 'requirement', width: 16 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 8 },
  }

  const failCases = testCases.filter(
    (tc) => results.get(tc.frontmatter.id)?.status === 'FAIL',
  )

  if (failCases.length === 0) {
    const row = ws.addRow({ id: '(FAILなし)', title: '', priority: '' })
    applyDataRowStyle(row, false)
    return
  }

  failCases.forEach((tc, idx) => {
    const result = results.get(tc.frontmatter.id)!
    const row = ws.addRow({
      id: tc.frontmatter.id,
      title: tc.frontmatter.title,
      priority: tc.frontmatter.priority,
      assignee: result.assignee ?? '',
      completed_at: result.completed_at ?? '',
      bug: result.bug ?? '',
      notes: result.notes ?? '',
      requirement: tc.frontmatter.requirement ?? '',
    })
    applyDataRowStyle(row, idx % 2 === 1)
    // Entire row in fail colour
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
    })
    applyPriorityStyle(row.getCell('priority'), tc.frontmatter.priority)
  })
}

// ─────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────

/**
 * Build and write a complete QA Excel workbook to disk.
 *
 * @param testCases  All parsed test cases (from loader.loadTestCases)
 * @param results    Execution results map (from loader.loadLatestResults)
 * @param outputPath Absolute path for the output .xlsx file
 */
export async function buildExcel(
  testCases: ParsedTestCase[],
  results: Map<string, TestResult>,
  outputPath: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'QA Test Management System'
  wb.lastModifiedBy = 'qa-bot'
  wb.created = new Date()
  wb.modified = new Date()

  addTestCaseListSheet(wb, testCases, results)
  addByRequirementSheet(wb, testCases, results)
  addExecutionResultsSheet(wb, testCases, results)
  addFailListSheet(wb, testCases, results)

  await wb.xlsx.writeFile(outputPath)
}
