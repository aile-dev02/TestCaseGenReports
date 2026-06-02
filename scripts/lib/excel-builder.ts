/**
 * Excel ワークブックビルダー。
 *
 * シート構成
 * ──────────
 *   1. テストケース一覧  – 全 TC と最新実行ステータス・担当者・完了日時・メモ
 *   2. FAIL一覧         – FAIL のみ抽出（トリアージ用）
 */

import ExcelJS from 'exceljs'
import type { TestCaseRow } from './types.js'
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

// ─────────────────────────────────────────────
// Sheet 1 – テストケース一覧
// ─────────────────────────────────────────────

function addTestCaseListSheet(
  wb: ExcelJS.Workbook,
  testCases: TestCaseRow[],
  results: Map<string, TestResult>,
): void {
  const ws = wb.addWorksheet('テストケース一覧', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws.columns = [
    { header: 'TC-ID', key: 'id', width: 12 },
    { header: 'テスト名', key: 'テスト名', width: 40 },
    { header: '種別', key: '種別', width: 10 },
    { header: '手順', key: '手順', width: 52 },
    { header: '期待結果', key: '期待結果', width: 52 },
    { header: '上流ID', key: '上流ID', width: 12 },
    { header: '備考', key: '備考', width: 28 },
    { header: '担当者', key: '担当者', width: 14 },
    { header: '完了日時', key: '完了日時', width: 22 },
    { header: 'メモ', key: 'メモ', width: 36 },
    { header: '実行ステータス', key: 'status', width: 16 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } }

  testCases.forEach((tc, idx) => {
    const result = results.get(tc.id)
    const status = result?.ステータス ?? 'NOT_EXECUTED'

    const row = ws.addRow({
      id: tc.id,
      'テスト名': tc.テスト名,
      '種別': tc.種別,
      '手順': tc.手順,
      '期待結果': tc.期待結果,
      '上流ID': tc.上流ID ?? '',
      '備考': tc.備考 ?? '',
      '担当者': result?.担当者 ?? '',
      '完了日時': result?.完了日時 ?? '',
      'メモ': result?.メモ ?? '',
      status,
    })

    applyDataRowStyle(row, idx % 2 === 1)
    applyStatusStyle(row.getCell('status'), status)

    const lineCount = Math.max(
      tc.手順.split('\n').length,
      tc.期待結果.split('\n').length,
    )
    row.height = Math.max(20, lineCount * 18)
  })
}

// ─────────────────────────────────────────────
// Sheet 2 – FAIL一覧
// ─────────────────────────────────────────────

function addFailListSheet(
  wb: ExcelJS.Workbook,
  testCases: TestCaseRow[],
  results: Map<string, TestResult>,
): void {
  const ws = wb.addWorksheet('FAIL一覧', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws.columns = [
    { header: 'TC-ID', key: 'id', width: 12 },
    { header: 'テスト名', key: 'テスト名', width: 40 },
    { header: '種別', key: '種別', width: 10 },
    { header: '上流ID', key: '上流ID', width: 12 },
    { header: '担当者', key: '担当者', width: 14 },
    { header: '完了日時', key: '完了日時', width: 22 },
    { header: '不具合ID', key: '不具合', width: 14 },
    { header: 'メモ', key: 'メモ', width: 40 },
  ]

  applyHeaderStyle(ws.getRow(1))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } }

  const failCases = testCases.filter(
    (tc) => results.get(tc.id)?.ステータス === 'FAIL',
  )

  if (failCases.length === 0) {
    const row = ws.addRow({ id: '(FAILなし)', 'テスト名': '' })
    applyDataRowStyle(row, false)
    return
  }

  failCases.forEach((tc, idx) => {
    const result = results.get(tc.id)!
    const row = ws.addRow({
      id: tc.id,
      'テスト名': tc.テスト名,
      '種別': tc.種別,
      '上流ID': tc.上流ID ?? '',
      '担当者': result.担当者 ?? '',
      '完了日時': result.完了日時 ?? '',
      '不具合': result.不具合 ?? '',
      'メモ': result.メモ ?? '',
    })
    applyDataRowStyle(row, idx % 2 === 1)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
    })
  })
}

// ─────────────────────────────────────────────
// 公開エントリポイント
// ─────────────────────────────────────────────

/**
 * QA Excel ワークブックをビルドしてディスクに書き込む。
 *
 * @param testCases  全テストケース行（loadAllTestCaseRows の戻り値）
 * @param results    実行結果マップ（loadLatestResults の戻り値）
 * @param outputPath 出力先 .xlsx ファイルの絶対パス
 */
export async function buildExcel(
  testCases: TestCaseRow[],
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
