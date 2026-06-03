/**
 * CLI: QA サマリ Markdown レポートを生成する。
 *
 * 出力先: reports/latest/qa-summary.md
 *
 * 使用方法:
 *   npm run generate:summary
 *   tsx scripts/generate-summary.ts
 */

import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import {
  loadAllTestCaseRows,
  loadLatestResults,
  latestRunId,
  ensureDir,
} from './lib/loader.js'
import type { QASummary, FailEntry } from './lib/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const REPORTS_DIR = join(ROOT_DIR, 'reports', 'latest')

function specLink(id: string, filePath: string): string {
  const rel = relative(REPORTS_DIR, filePath).replace(/\\/g, '/')
  return `[${id}](${rel})`
}

// ─────────────────────────────────────────────
// 集計
// ─────────────────────────────────────────────

function computeSummary(): QASummary {
  const allRows = loadAllTestCaseRows(ROOT_DIR)
  const results = loadLatestResults(ROOT_DIR)

  let pass = 0
  let fail = 0
  let skip = 0
  let na = 0
  let waiting = 0
  let notExecuted = 0
  const failList: FailEntry[] = []

  for (const row of allRows) {
    const status = row.実行ステータス ?? 'NOT_EXECUTED'

    if (status === 'PASS') pass++
    else if (status === 'FAIL') fail++
    else if (status === 'SKIP') skip++
    else if (status === 'NA') na++
    else if (status === 'WAITING') waiting++
    else notExecuted++

    if (status === 'FAIL') {
      failList.push({
        id: row.id,
        テスト名: row.テスト名,
        種別: row.種別,
        優先度: row.優先度 ?? '未設定',
        上流ID: row.上流ID ?? '',
        assignee: row.担当者,
        bug: results.get(row.id)?.不具合,
        specFilePath: row.specFilePath,
      })
    }
  }

  const executed = pass + fail
  const passRate = executed > 0 ? Math.round((pass / executed) * 100) : 0
  const executionRate = allRows.length > 0 ? Math.round((executed / allRows.length) * 100) : 0

  return {
    runId: latestRunId(ROOT_DIR),
    generatedAt: new Date().toISOString(),
    total: allRows.length,
    pass,
    fail,
    skip,
    na,
    waiting,
    notExecuted,
    executed,
    passRate,
    executionRate,
    failList,
  }
}

// ─────────────────────────────────────────────
// Markdown レンダリング
// ─────────────────────────────────────────────

function passRateEmoji(rate: number): string {
  if (rate === 100) return '🟢'
  if (rate >= 80) return '🟡'
  return '🔴'
}

function renderMarkdown(s: QASummary): string {
  const lines: string[] = []

  lines.push('# QA実行サマリレポート')
  lines.push('')
  lines.push(`**生成日時:** ${s.generatedAt}  `)
  lines.push(`**実行セット:** ${s.runId}`)
  lines.push('')

  lines.push('## 実行統計')
  lines.push('')
  lines.push('| 項目 | 件数 |')
  lines.push('|:-----|-----:|')
  lines.push(`| 総件数 | **${s.total}** |`)
  lines.push(`| 実行済み（PASS+FAIL） | **${s.executed}** |`)
  lines.push(`| ✅ PASS | ${s.pass} |`)
  lines.push(`| ❌ FAIL | ${s.fail} |`)
  lines.push(`| ➖ N/A | ${s.na} |`)
  lines.push(`| ⬜ 未実行 | ${s.notExecuted} |`)
  lines.push(`| ⏳ 質問待ち | ${s.waiting} |`)
  if (s.skip > 0) lines.push(`| ⏭ SKIP | ${s.skip} |`)
  lines.push('')
  lines.push(
    `**実行率: ${s.executionRate}%** (${s.executed} / ${s.total} 件)  `,
  )
  lines.push(
    `**Pass率: ${passRateEmoji(s.passRate)} ${s.passRate}%** (実施済み ${s.executed} 件中 ${s.pass} 件合格)`,
  )
  lines.push('')

  lines.push('## FAIL一覧')
  lines.push('')

  if (s.failList.length === 0) {
    lines.push('> FAILはありません。')
  } else {
    lines.push('| TC-ID | テスト名 | 種別 | 優先度 | 上流ID | 担当者 | 不具合ID |')
    lines.push('|:------|:--------|:-----|:-------|:-------|:-------|:---------|')
    for (const f of s.failList) {
      const row = [
        specLink(f.id, f.specFilePath),
        f.テスト名,
        f.種別,
        f.優先度,
        f.上流ID,
        f.assignee ?? '',
        f.bug ? `\`${f.bug}\`` : '',
      ]
      lines.push(`| ${row.join(' | ')} |`)
    }
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
// Main
// ─────────────────────────────────────────────

function main(): void {
  console.log('📋 QA サマリ ジェネレーター')
  console.log('─'.repeat(40))

  const summary = computeSummary()
  const md = renderMarkdown(summary)

  ensureDir(REPORTS_DIR)
  const outputPath = join(REPORTS_DIR, 'qa-summary.md')
  writeFileSync(outputPath, md, 'utf-8')

  console.log(`\n実行セット: ${summary.runId}`)
  console.log(`  総件数   : ${summary.total}`)
  console.log(`  PASS     : ${summary.pass}`)
  console.log(`  FAIL     : ${summary.fail}`)
  console.log(`  N/A      : ${summary.na}`)
  console.log(`  未実行   : ${summary.notExecuted}`)
  console.log(`  質問待ち : ${summary.waiting}`)
  console.log(`  実行率   : ${summary.executionRate}%`)
  console.log(`  Pass率   : ${summary.passRate}%`)
  console.log(`\n✅  保存先: ${outputPath}\n`)
}

main()
