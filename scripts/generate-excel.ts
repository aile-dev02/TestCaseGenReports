/**
 * CLI: generate the QA Excel workbook.
 *
 * Output: reports/latest/test-report.xlsx
 *
 * Usage:
 *   npm run generate:excel
 *   tsx scripts/generate-excel.ts
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadTestCases, loadLatestResults, ensureDir } from './lib/loader.js'
import { buildExcel } from './lib/excel-builder.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

async function main(): Promise<void> {
  console.log('📊 QA Excel Report Generator')
  console.log('─'.repeat(40))

  console.log('\n1/3 Loading test cases...')
  const testCases = loadTestCases(ROOT_DIR)
  console.log(`     → ${testCases.length} test case(s) found`)

  console.log('2/3 Loading execution results...')
  const results = loadLatestResults(ROOT_DIR)
  console.log(`     → ${results.size} result(s) found`)

  const outputDir = join(ROOT_DIR, 'reports', 'latest')
  ensureDir(outputDir)
  const outputPath = join(outputDir, 'test-report.xlsx')

  console.log('3/3 Building Excel workbook...')
  await buildExcel(testCases, results, outputPath)

  console.log(`\n✅  Saved: ${outputPath}`)
  console.log('   Sheets: テストケース一覧 / 要件別テストケース / 実行結果 / FAIL一覧\n')
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
