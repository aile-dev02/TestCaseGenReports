/**
 * CLI: generate the QA summary Markdown report.
 *
 * Output: reports/latest/qa-summary.md
 *
 * Usage:
 *   npm run generate:summary
 *   tsx scripts/generate-summary.ts
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import {
  loadTestCases,
  loadLatestResults,
  latestRunId,
  ensureDir,
} from './lib/loader.js'
import type { QASummary, FailEntry } from './lib/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

// ─────────────────────────────────────────────
// Computation
// ─────────────────────────────────────────────

function computeSummary(): QASummary {
  const testCases = loadTestCases(ROOT_DIR)
  const results = loadLatestResults(ROOT_DIR)

  let pass = 0
  let fail = 0
  let skip = 0
  let notExecuted = 0

  const highPriorityFails: string[] = []
  const failList: FailEntry[] = []

  for (const tc of testCases) {
    const result = results.get(tc.frontmatter.id)
    const status = result?.status ?? 'NOT_EXECUTED'

    if (status === 'PASS') pass++
    else if (status === 'FAIL') fail++
    else if (status === 'SKIP') skip++
    else notExecuted++

    if (status === 'FAIL') {
      if (tc.frontmatter.priority === 'high') {
        highPriorityFails.push(tc.frontmatter.id)
      }
      failList.push({
        id: tc.frontmatter.id,
        title: tc.frontmatter.title,
        priority: tc.frontmatter.priority,
        assignee: result?.assignee,
        bug: result?.bug,
        notes: result?.notes,
      })
    }
  }

  const executed = pass + fail + skip
  const passRate = executed > 0 ? Math.round((pass / executed) * 100) : 0

  return {
    runId: latestRunId(ROOT_DIR),
    generatedAt: new Date().toISOString(),
    total: testCases.length,
    pass,
    fail,
    skip,
    notExecuted,
    passRate,
    highPriorityFails,
    failList,
  }
}

// ─────────────────────────────────────────────
// Markdown rendering
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

  // ── Statistics table ────────────────────────
  lines.push('## 実行統計')
  lines.push('')
  lines.push('| 項目 | 件数 |')
  lines.push('|:-----|-----:|')
  lines.push(`| 総件数 | **${s.total}** |`)
  lines.push(`| ✅ PASS | ${s.pass} |`)
  lines.push(`| ❌ FAIL | ${s.fail} |`)
  lines.push(`| ⏭ SKIP | ${s.skip} |`)
  lines.push(`| ⬜ 未実施 | ${s.notExecuted} |`)
  lines.push('')
  lines.push(
    `**Pass率: ${passRateEmoji(s.passRate)} ${s.passRate}%** (実施済み ${s.pass + s.fail + s.skip} 件中 ${s.pass} 件合格)`,
  )
  lines.push('')

  // ── High priority fails ─────────────────────
  lines.push('## 高優先度FAIL')
  lines.push('')
  if (s.highPriorityFails.length === 0) {
    lines.push('> 高優先度のFAILはありません。')
  } else {
    for (const id of s.highPriorityFails) {
      lines.push(`- \`${id}\``)
    }
  }
  lines.push('')

  // ── Fail list table ─────────────────────────
  lines.push('## FAIL一覧')
  lines.push('')

  if (s.failList.length === 0) {
    lines.push('> FAILはありません。')
  } else {
    lines.push('| ID | タイトル | 優先度 | 担当者 | 不具合ID | メモ |')
    lines.push('|:---|:--------|:-------|:-------|:---------|:-----|')
    for (const f of s.failList) {
      const row = [
        `\`${f.id}\``,
        f.title,
        f.priority,
        f.assignee ?? '',
        f.bug ? `\`${f.bug}\`` : '',
        f.notes ?? '',
      ]
      lines.push(`| ${row.join(' | ')} |`)
    }
  }
  lines.push('')

  // ── Footer ──────────────────────────────────
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
  console.log('📋 QA Summary Generator')
  console.log('─'.repeat(40))

  const summary = computeSummary()
  const md = renderMarkdown(summary)

  const outputDir = join(ROOT_DIR, 'reports', 'latest')
  ensureDir(outputDir)
  const outputPath = join(outputDir, 'qa-summary.md')
  writeFileSync(outputPath, md, 'utf-8')

  console.log(`\nResults for run: ${summary.runId}`)
  console.log(`  Total      : ${summary.total}`)
  console.log(`  PASS       : ${summary.pass}`)
  console.log(`  FAIL       : ${summary.fail}`)
  console.log(`  SKIP       : ${summary.skip}`)
  console.log(`  Not Exec.  : ${summary.notExecuted}`)
  console.log(`  Pass Rate  : ${summary.passRate}%`)
  console.log(`\n✅  Saved: ${outputPath}\n`)
}

main()
