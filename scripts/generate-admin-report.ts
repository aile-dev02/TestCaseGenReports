/**
 * CLI: 管理者向け QA 進捗 HTML ダッシュボードを生成する。
 *
 * 出力先: reports/latest/admin-report.html
 *
 * 使用方法:
 *   npm run generate:admin-report
 *   tsx scripts/generate-admin-report.ts
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const REPORTS_DIR = join(ROOT_DIR, 'reports', 'latest')

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface AdminSummary {
  runId: string
  generatedAt: string
  total: number
  executed: number
  executionRate: number
  pass: number
  fail: number
  na: number
  notExecuted: number
  waiting: number
  skip: number
  passRate: number
  failByPriority: Array<[string, number]>
  bugList: BugEntry[]
}

interface BugEntry {
  id: string
  テスト名: string
  種別: string
  優先度: string
  上流ID: string
  assignee: string
  bug: string
  specFilePath: string
}

// ─────────────────────────────────────────────
// 集計
// ─────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { 高: 0, 中: 1, 低: 2 }

function computeAdminSummary(): AdminSummary {
  const allRows = loadAllTestCaseRows(ROOT_DIR)
  const results = loadLatestResults(ROOT_DIR)

  let pass = 0, fail = 0, na = 0, notExecuted = 0, waiting = 0, skip = 0
  const priorityMap = new Map<string, number>()
  const bugList: BugEntry[] = []

  for (const row of allRows) {
    const status = row.実行ステータス ?? 'NOT_EXECUTED'

    if (status === 'PASS') pass++
    else if (status === 'FAIL') fail++
    else if (status === 'NA') na++
    else if (status === 'WAITING') waiting++
    else if (status === 'SKIP') skip++
    else notExecuted++

    if (status === 'FAIL') {
      const priority = row.優先度?.trim() || '未設定'
      priorityMap.set(priority, (priorityMap.get(priority) ?? 0) + 1)
      bugList.push({
        id: row.id,
        テスト名: row.テスト名,
        種別: row.種別,
        優先度: priority,
        上流ID: row.上流ID ?? '',
        assignee: row.担当者 ?? '',
        bug: results.get(row.id)?.不具合 ?? '',
        specFilePath: row.specFilePath,
      })
    }
  }

  const executed = pass + fail
  const executionRate = allRows.length > 0
    ? Math.round((executed / allRows.length) * 100)
    : 0
  const passRate = executed > 0 ? Math.round((pass / executed) * 100) : 0

  const failByPriority = [...priorityMap.entries()].sort(
    ([a], [b]) =>
      (PRIORITY_ORDER[a] ?? 99) - (PRIORITY_ORDER[b] ?? 99),
  )

  return {
    runId: latestRunId(ROOT_DIR),
    generatedAt: new Date().toISOString(),
    total: allRows.length,
    executed,
    executionRate,
    pass,
    fail,
    na,
    notExecuted,
    waiting,
    skip,
    passRate,
    failByPriority,
    bugList,
  }
}

// ─────────────────────────────────────────────
// HTML レンダリング
// ─────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0
}

function renderHtml(s: AdminSummary): string {
  const passRateColor =
    s.passRate === 100 ? '#27ae60' : s.passRate >= 80 ? '#f39c12' : '#e74c3c'
  const execRateColor =
    s.executionRate >= 80 ? '#2980b9' : s.executionRate >= 50 ? '#f39c12' : '#e74c3c'

  function specLink(id: string, filePath: string): string {
    const rel = relative(REPORTS_DIR, filePath).replace(/\\/g, '/')
    return `<a href="${rel}" target="_blank">${esc(id)}</a>`
  }

  const priorityRows = s.failByPriority
    .map(([p, n]) => `
      <tr>
        <td><span class="pri pri-${esc(p)}">${esc(p)}</span></td>
        <td class="num">${n}</td>
      </tr>`)
    .join('')

  const bugRows = s.bugList
    .map((f) => `
      <tr>
        <td>${specLink(f.id, f.specFilePath)}</td>
        <td>${esc(f.テスト名)}</td>
        <td>${esc(f.種別)}</td>
        <td><span class="pri pri-${esc(f.優先度)}">${esc(f.優先度)}</span></td>
        <td>${esc(f.上流ID)}</td>
        <td>${esc(f.assignee)}</td>
        <td>${f.bug ? `<code>${esc(f.bug)}</code>` : ''}</td>
      </tr>`)
    .join('')

  const skipRow = s.skip > 0
    ? `<div class="stat-item">
        <div class="stat-dot" style="background:#8e44ad"></div>
        <div><div class="stat-val">${s.skip}</div><div class="stat-lbl">SKIP</div></div>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>QA進捗レポート — ${esc(s.runId)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Hiragino Sans","Noto Sans JP","Meiryo",sans-serif;font-size:14px;
         line-height:1.6;color:#2c3e50;background:#f0f2f5;padding:24px}
    .wrap{max-width:1100px;margin:0 auto}

    /* Header */
    .hd{background:#1e3a5f;color:#fff;border-radius:8px;padding:20px 28px;margin-bottom:24px}
    .hd h1{font-size:22px;font-weight:700}
    .hd .meta{font-size:12px;opacity:.75;margin-top:6px}

    /* Cards */
    .cards{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px}
    .card{flex:1;min-width:160px;background:#fff;border-radius:8px;padding:16px 20px;
          box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:4px solid var(--ac)}
    .card-lbl{font-size:11px;color:#7f8c8d;text-transform:uppercase;letter-spacing:.05em}
    .card-val{font-size:28px;font-weight:700;color:var(--ac);margin-top:4px}
    .card-sub{font-size:11px;color:#95a5a6;margin-top:2px}

    /* Section */
    .sec{background:#fff;border-radius:8px;padding:20px 24px;
         margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .sec-title{font-size:15px;font-weight:700;color:#1e3a5f;
               border-left:4px solid #1e3a5f;padding-left:10px;margin-bottom:16px}

    /* Progress */
    .pg-wrap{margin:10px 0}
    .pg-label{display:flex;justify-content:space-between;font-size:12px;color:#7f8c8d;margin-bottom:4px}
    .pg-bar{height:10px;background:#ecf0f1;border-radius:5px;overflow:hidden}
    .pg-fill{height:100%;border-radius:5px}

    /* Status items */
    .stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}
    .stat-item{display:flex;align-items:center;gap:8px;background:#f8f9fa;
               border-radius:6px;padding:10px 14px;flex:1;min-width:120px}
    .stat-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
    .stat-val{font-size:22px;font-weight:700}
    .stat-lbl{font-size:11px;color:#7f8c8d}

    /* Summary table */
    .sum-tbl{width:100%;margin-top:20px;border-collapse:collapse;font-size:13px}
    .sum-tbl th{background:#f0f2f5;color:#555;padding:8px 12px;text-align:left;
                border-bottom:2px solid #dde1e7;white-space:nowrap}
    .sum-tbl td{padding:7px 12px;border-bottom:1px solid #eef0f3}
    .sum-tbl tr:last-child td{border-bottom:none}
    .num{text-align:right;font-variant-numeric:tabular-nums}

    /* Data table */
    .dtbl{border-collapse:collapse;width:100%;font-size:13px}
    .dtbl th{background:#1e3a5f;color:#fff;padding:8px 12px;text-align:left;
             white-space:nowrap;font-weight:600}
    .dtbl td{border:1px solid #e1e4e8;padding:7px 12px;vertical-align:middle}
    .dtbl tr:nth-child(even) td{background:#f8f9fa}

    a{color:#2980b9;text-decoration:none}
    a:hover{text-decoration:underline}
    code{background:#f0f0f0;border-radius:3px;padding:.1em .4em;font-size:.9em}

    /* Priority */
    .pri{font-weight:700;padding:1px 6px;border-radius:4px;font-size:12px}
    .pri-高{background:#fde8e8;color:#c0392b}
    .pri-中{background:#fef9e7;color:#d35400}
    .pri-低{background:#eafaf1;color:#1e8449}
    .pri-未設定{background:#f0f0f0;color:#95a5a6;font-weight:400}

    .no-fail{color:#27ae60;font-style:italic;padding:8px 0}
    .footer{text-align:center;font-size:11px;color:#95a5a6;margin-top:24px}
    .sub-title{font-size:13px;font-weight:600;margin-bottom:8px;color:#444}
  </style>
</head>
<body>
<div class="wrap">

  <div class="hd">
    <h1>QA進捗レポート</h1>
    <div class="meta">実行セット: ${esc(s.runId)} ／ 生成日時: ${esc(s.generatedAt)}</div>
  </div>

  <!-- KPI カード -->
  <div class="cards">
    <div class="card" style="--ac:#1e3a5f">
      <div class="card-lbl">総テストケース数</div>
      <div class="card-val">${s.total}</div>
    </div>
    <div class="card" style="--ac:#2980b9">
      <div class="card-lbl">実行済み</div>
      <div class="card-val">${s.executed}</div>
      <div class="card-sub">PASS + FAIL</div>
    </div>
    <div class="card" style="--ac:${execRateColor}">
      <div class="card-lbl">実行率</div>
      <div class="card-val">${s.executionRate}%</div>
      <div class="card-sub">${s.executed} / ${s.total} 件</div>
    </div>
    <div class="card" style="--ac:${passRateColor}">
      <div class="card-lbl">Pass率</div>
      <div class="card-val">${s.passRate}%</div>
      <div class="card-sub">${s.pass} / ${s.executed} 件合格</div>
    </div>
  </div>

  <!-- テスト結果サマリー -->
  <div class="sec">
    <div class="sec-title">テスト結果サマリー</div>

    <div class="pg-wrap">
      <div class="pg-label"><span>実行率（PASS+FAIL / 全件）</span><span>${s.executionRate}%</span></div>
      <div class="pg-bar">
        <div class="pg-fill" style="width:${s.executionRate}%;background:${execRateColor}"></div>
      </div>
    </div>
    <div class="pg-wrap" style="margin-top:12px">
      <div class="pg-label"><span>Pass率（PASS / 実施済み）</span><span>${s.passRate}%</span></div>
      <div class="pg-bar">
        <div class="pg-fill" style="width:${s.passRate}%;background:${passRateColor}"></div>
      </div>
    </div>

    <!-- ステータス別カウント -->
    <div class="stats">
      <div class="stat-item">
        <div class="stat-dot" style="background:#27ae60"></div>
        <div><div class="stat-val">${s.pass}</div><div class="stat-lbl">Pass</div></div>
      </div>
      <div class="stat-item">
        <div class="stat-dot" style="background:#e74c3c"></div>
        <div><div class="stat-val">${s.fail}</div><div class="stat-lbl">Fail</div></div>
      </div>
      <div class="stat-item">
        <div class="stat-dot" style="background:#95a5a6"></div>
        <div><div class="stat-val">${s.na}</div><div class="stat-lbl">N/A</div></div>
      </div>
      <div class="stat-item">
        <div class="stat-dot" style="background:#bdc3c7"></div>
        <div><div class="stat-val">${s.notExecuted}</div><div class="stat-lbl">未実行</div></div>
      </div>
      <div class="stat-item">
        <div class="stat-dot" style="background:#f39c12"></div>
        <div><div class="stat-val">${s.waiting}</div><div class="stat-lbl">質問待ち</div></div>
      </div>
      ${skipRow}
    </div>

    <!-- 集計テーブル -->
    <table class="sum-tbl">
      <tr><th>項目</th><th class="num">件数</th><th class="num">全体比</th></tr>
      <tr><td>全テストケース数</td><td class="num"><strong>${s.total}</strong></td><td class="num">—</td></tr>
      <tr><td>実行済み（PASS + FAIL）</td><td class="num"><strong>${s.executed}</strong></td><td class="num">${s.executionRate}%</td></tr>
      <tr><td>Pass</td><td class="num">${s.pass}</td><td class="num">${pct(s.pass, s.total)}%</td></tr>
      <tr><td>Fail</td><td class="num">${s.fail}</td><td class="num">${pct(s.fail, s.total)}%</td></tr>
      <tr><td>N/A</td><td class="num">${s.na}</td><td class="num">${pct(s.na, s.total)}%</td></tr>
      <tr><td>未実行</td><td class="num">${s.notExecuted}</td><td class="num">${pct(s.notExecuted, s.total)}%</td></tr>
      <tr><td>質問待ち</td><td class="num">${s.waiting}</td><td class="num">${pct(s.waiting, s.total)}%</td></tr>
      ${s.skip > 0 ? `<tr><td>SKIP</td><td class="num">${s.skip}</td><td class="num">${pct(s.skip, s.total)}%</td></tr>` : ''}
    </table>
  </div>

  <!-- FAIL サマリー -->
  <div class="sec">
    <div class="sec-title">FAILサマリー</div>

    ${s.fail === 0
      ? '<p class="no-fail">✅ FAILはありません。</p>'
      : `
    <!-- 優先度別FAIL数 -->
    <p class="sub-title">優先度別FAIL数</p>
    <table class="dtbl" style="width:auto;min-width:260px;margin-bottom:24px">
      <tr><th>優先度</th><th>FAIL数</th></tr>
      ${priorityRows}
    </table>

    <!-- バグリスト -->
    <p class="sub-title">バグリスト</p>
    <table class="dtbl">
      <tr>
        <th>TC-ID</th>
        <th>テスト名</th>
        <th>種別</th>
        <th>優先度</th>
        <th>上流ID</th>
        <th>担当者</th>
        <th>不具合ID</th>
      </tr>
      ${bugRows}
    </table>`
    }
  </div>

  <div class="footer">このレポートは QA Test Management System により自動生成されました。</div>
</div>
</body>
</html>`
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

function main(): void {
  console.log('📊 管理者向け QA 進捗レポート ジェネレーター')
  console.log('─'.repeat(40))

  const summary = computeAdminSummary()
  const html = renderHtml(summary)

  ensureDir(REPORTS_DIR)
  const outputPath = join(REPORTS_DIR, 'admin-report.html')
  writeFileSync(outputPath, html, 'utf-8')

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
