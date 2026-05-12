/**
 * CLI: QA サマリ・トレーサビリティの HTML レポートを生成する。
 *
 * 出力先:
 *   reports/latest/qa-summary.html
 *   reports/latest/traceability.html
 *
 * 使用方法:
 *   npm run generate:html
 *   tsx scripts/generate-html.ts
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { marked } from 'marked'
import { ensureDir } from './lib/loader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = join(__dirname, '..', 'reports', 'latest')

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1a1a1a;
    max-width: 1100px;
    margin: 2rem auto;
    padding: 0 1.5rem;
    background: #fff;
  }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #1e3a5f; padding-bottom: .4rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; border-left: 4px solid #1e3a5f; padding-left: .6rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th {
    background: #1e3a5f;
    color: #fff;
    padding: .5rem .8rem;
    text-align: left;
    white-space: nowrap;
  }
  td { border: 1px solid #ccc; padding: .4rem .8rem; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f9fc; }
  code {
    background: #f0f0f0;
    border-radius: 3px;
    padding: .1em .4em;
    font-size: .9em;
  }
  blockquote {
    border-left: 4px solid #ccc;
    margin: .5rem 0;
    padding: .4rem 1rem;
    color: #555;
    background: #f9f9f9;
  }
  strong { color: #1e3a5f; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
  p { margin: .5rem 0; }
  ul, ol { margin: .5rem 0; padding-left: 1.5rem; }
  .footer { margin-top: 3rem; font-size: .8rem; color: #888; }
`

function buildHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`
}

function convertMdFile(srcPath: string, destPath: string, title: string): void {
  if (!existsSync(srcPath)) {
    console.warn(`  スキップ: ${srcPath} が見つかりません`)
    return
  }

  const md = readFileSync(srcPath, 'utf-8')
  const body = marked.parse(md) as string
  const html = buildHtml(title, body)
  writeFileSync(destPath, html, 'utf-8')
  console.log(`  ✅ 保存: ${destPath}`)
}

function main(): void {
  console.log('🌐 HTML レポート ジェネレーター')
  console.log('─'.repeat(40))

  ensureDir(REPORTS_DIR)

  convertMdFile(
    join(REPORTS_DIR, 'qa-summary.md'),
    join(REPORTS_DIR, 'qa-summary.html'),
    'QA実行サマリレポート',
  )

  convertMdFile(
    join(REPORTS_DIR, 'traceability.md'),
    join(REPORTS_DIR, 'traceability.html'),
    'トレーサビリティマトリクス',
  )

  console.log()
}

main()
