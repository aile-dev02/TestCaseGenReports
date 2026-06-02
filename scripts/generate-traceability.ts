/**
 * CLI: トレーサビリティマトリクスを生成する。
 *
 * 出力:
 *   reports/latest/traceability.md    — Markdown 版
 *   reports/latest/traceability.xlsx  — Excel 版
 *
 * マトリクス構造: 上流設計書 DD-xxx → テストケース TC-xxx → 実行結果
 *
 * 使用方法:
 *   npm run generate:traceability
 *   tsx scripts/generate-traceability.ts
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import ExcelJS from 'exceljs'
import {
  loadTestSpecs,
  loadLatestResults,
  latestRunId,
  ensureDir,
} from './lib/loader.js'
import type {
  ParsedTestSpec,
  TraceabilityRow,
  TraceabilityMatrix,
  TestCaseRow,
} from './lib/types.js'
import type { TestResult } from '../schemas/results.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const REPORTS_DIR = join(ROOT_DIR, 'reports', 'latest')

// ─────────────────────────────────────────────
// マトリクス構築
// ─────────────────────────────────────────────

function buildMatrix(
  specs: ParsedTestSpec[],
  results: Map<string, TestResult>,
): TraceabilityMatrix {
  // 上流マッピングと TC を収集
  const upstreamMap = new Map<string, { 機能名: string; tcIds: string[] }>()
  const tcMap = new Map<string, TestCaseRow>()

  for (const spec of specs) {
    for (const m of spec.upstreamMappings) {
      upstreamMap.set(m.上流ID, { 機能名: m.機能名, tcIds: m.展開先TCIDs })
    }
    for (const tc of spec.testCases) {
      tcMap.set(tc.id, tc)
    }
  }

  const rows: TraceabilityRow[] = []
  const covered上流IDs = new Set<string>()

  for (const [上流ID, { 機能名, tcIds }] of upstreamMap) {
    if (tcIds.length === 0) {
      rows.push({
        上流ID,
        機能名,
        testCaseId: '(TCなし)',
        testCaseTitle: '',
        種別: '',
        status: 'NOT_COVERED',
      })
    } else {
      covered上流IDs.add(上流ID)
      for (const tcId of tcIds) {
        const tc = tcMap.get(tcId)
        rows.push({
          上流ID,
          機能名,
          testCaseId: tcId,
          testCaseTitle: tc?.テスト名 ?? '(未定義)',
          種別: tc?.種別 ?? '',
          status: tc?.実行ステータス ?? 'NOT_EXECUTED',
        })
      }
    }
  }

  // 上流マッピングに紐づかない TC
  for (const [tcId, tc] of tcMap) {
    const isReferenced = [...upstreamMap.values()].some((m) =>
      m.tcIds.includes(tcId),
    )
    if (!isReferenced) {
      rows.push({
        上流ID: tc.上流ID ?? '(上流ID未設定)',
        機能名: '',
        testCaseId: tcId,
        testCaseTitle: tc.テスト名,
        種別: tc.種別,
        status: tc.実行ステータス ?? 'NOT_EXECUTED',
      })
    }
  }

  return {
    rows,
    summary: {
      total上流ID: upstreamMap.size,
      covered上流ID: covered上流IDs.size,
      totalTestCases: tcMap.size,
      coverageRate:
        upstreamMap.size > 0
          ? Math.round((covered上流IDs.size / upstreamMap.size) * 100)
          : 0,
    },
  }
}

// ─────────────────────────────────────────────
// Markdown 出力
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

  lines.push('## カバレッジサマリ')
  lines.push('')
  lines.push('| 項目 | 値 |')
  lines.push('|:-----|:--|')
  lines.push(`| 上流設計書 ID 総数 | ${summary.total上流ID} |`)
  lines.push(`| カバー済み上流ID | ${summary.covered上流ID} |`)
  lines.push(`| テストケース総数 | ${summary.totalTestCases} |`)
  lines.push(`| 上流IDカバレッジ率 | **${summary.coverageRate}%** |`)
  lines.push('')

  lines.push('## マトリクス')
  lines.push('')
  lines.push(
    '| 上流ID | 機能名 | TC-ID | テスト名 | 種別 | 実行ステータス |',
  )
  lines.push(
    '|:-------|:------|:------|:--------|:-----|:--------------|',
  )

  let last上流ID = ''
  for (const row of matrix.rows) {
    const 上流IDCell = row.上流ID === last上流ID ? '' : row.上流ID
    last上流ID = row.上流ID

    lines.push(
      `| ${上流IDCell} | ${row.機能名} | ${row.testCaseId} | ${row.testCaseTitle} | ${row.種別} | ${statusBadge(row.status)} |`,
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
// Excel 出力
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

  ws.columns = [
    { header: '上流ID', key: '上流ID', width: 12 },
    { header: '機能名', key: '機能名', width: 28 },
    { header: 'TC-ID', key: 'tcId', width: 12 },
    { header: 'テスト名', key: 'tcTitle', width: 40 },
    { header: '種別', key: '種別', width: 10 },
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
      '上流ID': row.上流ID,
      '機能名': row.機能名,
      tcId: row.testCaseId,
      tcTitle: row.testCaseTitle,
      '種別': row.種別,
      status: row.status,
    })

    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        bottom: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        left: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        right: { style: 'thin', color: { argb: 'FFB8B8B8' } },
      }
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }
      }
    })

    const statusCell = dataRow.getCell('status')
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusColors[row.status] ?? 'FFD9D9D9' },
    }
    statusCell.font = {
      bold: row.status === 'FAIL',
      color: { argb: row.status === 'FAIL' ? 'FFFFFFFF' : 'FF000000' },
      size: 10,
    }
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // カバレッジサマリシート
  const sumWs = wb.addWorksheet('カバレッジサマリ')
  sumWs.columns = [
    { header: '項目', key: 'label', width: 28 },
    { header: '値', key: 'value', width: 12 },
  ]
  ;[
    ['上流設計書 ID 総数', matrix.summary.total上流ID],
    ['カバー済み上流ID', matrix.summary.covered上流ID],
    ['テストケース総数', matrix.summary.totalTestCases],
    ['上流IDカバレッジ率 (%)', matrix.summary.coverageRate],
  ].forEach(([label, value]) => {
    sumWs.addRow({ label, value })
  })

  await wb.xlsx.writeFile(outputPath)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🗺  トレーサビリティ マトリクス ジェネレーター')
  console.log('─'.repeat(40))

  const specs = loadTestSpecs(ROOT_DIR)
  const results = loadLatestResults(ROOT_DIR)
  const runId = latestRunId(ROOT_DIR)

  const totalTCs = specs.reduce((n, s) => n + s.testCases.length, 0)
  const totalMappings = specs.reduce((n, s) => n + s.upstreamMappings.length, 0)
  console.log(`  テスト仕様書   : ${specs.length}`)
  console.log(`  テストケース   : ${totalTCs}`)
  console.log(`  上流マッピング : ${totalMappings}`)
  console.log(`  実行結果       : ${results.size}`)

  const matrix = buildMatrix(specs, results)

  ensureDir(REPORTS_DIR)

  const mdPath = join(REPORTS_DIR, 'traceability.md')
  writeFileSync(mdPath, renderMarkdown(matrix, runId), 'utf-8')
  console.log(`\n  📄 Markdown: ${mdPath}`)

  const xlsxPath = join(REPORTS_DIR, 'traceability.xlsx')
  await renderExcel(matrix, xlsxPath)
  console.log(`  📊 Excel   : ${xlsxPath}`)

  console.log(
    `\n  カバレッジ: ${matrix.summary.covered上流ID}/${matrix.summary.total上流ID} 上流ID (${matrix.summary.coverageRate}%)`,
  )
  console.log('\n✅  完了。\n')
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
