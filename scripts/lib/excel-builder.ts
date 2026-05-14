/**
 * Excel ワークブックビルダー。
 *
 * ExcelJS を使用して .xlsx ファイルを生成する。
 * ヘッダー色、罫線、AutoFilter、FreezePanes、条件付き書式、列幅調整をすべてここで適用。
 *
 * シート構成
 * ──────────
 *   1. テストケース一覧        – 全テストケースと最新実行ステータス・担当者・完了日時・メモ
 *   2. FAIL一覧               – FAIL のみ抽出（トリアージ用）
 */

import ExcelJS from 'exceljs'
import type { ParsedTestCase } from './types.js'
import type { TestResult } from '../../schemas/results.js'

// ─────────────────────────────────────────────
// カラー定数（ARGB、# なし）
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
// スタイルヘルパー
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } }
    cell.font = { bold: true, color: { argb: C.headerFg }, size: 10 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder
  })
}

function applyDataRowStyle(row: ExcelJS.Row, isAlt: boolean): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { wrapText: true, vertical: 'top' }
    cell.border = thinBorder
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.altRow } }
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
    { header: 'タイトル', key: 'タイトル', width: 36 },
    { header: '要件ID', key: '要件ID', width: 20 },
    { header: '優先度', key: '優先度', width: 10 },
    { header: 'カテゴリ', key: 'カテゴリ', width: 12 },
    { header: 'タイプ', key: 'タイプ', width: 13 },
    { header: '前提条件', key: '前提条件', width: 42 },
    { header: '手順', key: 'steps', width: 52 },
    { header: '期待結果', key: 'expectedResults', width: 52 },
    { header: 'メモ', key: 'メモ', width: 40 },
    { header: '担当者', key: '担当者', width: 14 },
    { header: '完了日時', key: '完了日時', width: 22 },
    { header: '実行ステータス', key: 'status', width: 16 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } }

  testCases.forEach((tc, idx) => {
    const result = results.get(tc.frontmatter.id)
    const status = result?.ステータス ?? 'NOT_EXECUTED'

    const row = ws.addRow({
      id: tc.frontmatter.id,
      'タイトル': tc.frontmatter.タイトル,
      '要件ID': (tc.frontmatter.要件ID ?? []).join('\n'),
      '優先度': tc.frontmatter.優先度,
      'カテゴリ': tc.frontmatter.カテゴリ,
      'タイプ': tc.frontmatter.タイプ,
      '前提条件': (tc.frontmatter.前提条件 ?? []).join('\n'),
      steps: tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      expectedResults: tc.expectedResults.map((r) => `• ${r}`).join('\n'),
      status,
      '担当者': result?.担当者 ?? '',
      '完了日時': result?.完了日時 ?? '',
      'メモ': result?.メモ ?? '',
    })

    applyDataRowStyle(row, idx % 2 === 1)
    applyStatusStyle(row.getCell('status'), status)
    applyPriorityStyle(row.getCell('優先度'), tc.frontmatter.優先度)

    row.height = Math.max(20, tc.steps.length * 18)
  })

  // 条件付き書式（直接スタイルに加えて視覚的フィードバックを追加）
  const lastRow = Math.max(testCases.length + 1, 2)
  ws.addConditionalFormatting({
    ref: `J2:J${lastRow}`,  // 実行ステータス列
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'FAIL',
        priority: 1,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.failBg } },
          font: { bold: true, color: { argb: C.failFg } },
        },
      } as ExcelJS.ConditionalFormattingRule,
    ],
  })
}

// ─────────────────────────────────────────────
// Sheet 2 – FAIL一覧
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
    { header: 'タイトル', key: 'タイトル', width: 36 },
    { header: '優先度', key: '優先度', width: 10 },
    { header: '担当者', key: '担当者', width: 14 },
    { header: '完了日時', key: '完了日時', width: 22 },
    { header: '不具合ID', key: '不具合', width: 14 },
    { header: 'メモ', key: 'メモ', width: 40 },
    { header: '要件ID', key: '要件ID', width: 16 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } }

  const failCases = testCases.filter(
    (tc) => results.get(tc.frontmatter.id)?.ステータス === 'FAIL',
  )

  if (failCases.length === 0) {
    const row = ws.addRow({ id: '(FAILなし)', 'タイトル': '', '優先度': '' })
    applyDataRowStyle(row, false)
    return
  }

  failCases.forEach((tc, idx) => {
    const result = results.get(tc.frontmatter.id)!
    const row = ws.addRow({
      id: tc.frontmatter.id,
      'タイトル': tc.frontmatter.タイトル,
      '優先度': tc.frontmatter.優先度,
      '担当者': result.担当者 ?? '',
      '完了日時': result.完了日時 ?? '',
      '不具合': result.不具合 ?? '',
      'メモ': result.メモ ?? '',
      '要件ID': (tc.frontmatter.要件ID ?? []).join('\n'),
    })
    applyDataRowStyle(row, idx % 2 === 1)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
    })
    applyPriorityStyle(row.getCell('優先度'), tc.frontmatter.優先度)
  })
}

// ─────────────────────────────────────────────
// 公開エントリポイント
// ─────────────────────────────────────────────

/**
 * QA Excel ワークブックをビルドしてディスクに書き込む。
 *
 * @param testCases  全テストケース（loader.loadTestCases の戻り値）
 * @param results    実行結果マップ（loader.loadLatestResults の戻り値）
 * @param outputPath 出力先 .xlsx ファイルの絶対パス
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
  addFailListSheet(wb, testCases, results)

  await wb.xlsx.writeFile(outputPath)
}
