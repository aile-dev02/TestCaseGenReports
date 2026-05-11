/**
 * CLI: master/testcases/ 以下の全 Markdown テストケースを検証する。
 *
 * チェック内容:
 *   1. FrontMatter スキーマ（Zod）— 必須フィールド不足・型不正
 *   2. ID 重複
 *   3. 要件ID 未設定
 *   4. # 手順 セクションが空または欠落
 *   5. # 期待結果 セクションが空または欠落
 *
 * 終了コード: 0 = OK、1 = エラーあり
 *
 * 使用方法:
 *   npm run validate
 *   tsx scripts/validate-testcases.ts
 */

import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { loadTestCases } from './lib/loader.js'
import { TestCaseFrontmatterSchema } from '../schemas/testcase.js'
import type { ValidationError } from './lib/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

function rel(filePath: string): string {
  return relative(ROOT_DIR, filePath).replace(/\\/g, '/')
}

function run(): void {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  QA テストケース バリデーター         ║')
  console.log('╚══════════════════════════════════════╝\n')

  const testCases = loadTestCases(ROOT_DIR)

  if (testCases.length === 0) {
    console.warn('⚠  master/testcases/ にテストケースが見つかりません')
    console.warn('   .md ファイルを1件以上作成してください。\n')
    process.exit(0)
  }

  console.log(`${testCases.length} 件のテストケースを検証中...\n`)

  const errors: ValidationError[] = []

  // ── 1. スキーマ検証 ────────────────────────
  for (const tc of testCases) {
    const result = TestCaseFrontmatterSchema.safeParse(tc.frontmatter)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          file: rel(tc.filePath),
          errorType: 'SCHEMA_ERROR',
          message: `[${issue.path.join('.') || 'root'}] ${issue.message}`,
        })
      }
    }
  }

  // ── 2. ID 重複チェック ─────────────────────
  const idMap = new Map<string, string[]>()
  for (const tc of testCases) {
    const id = tc.frontmatter.id ?? '(id なし)'
    if (!idMap.has(id)) idMap.set(id, [])
    idMap.get(id)!.push(rel(tc.filePath))
  }
  for (const [id, files] of idMap) {
    if (files.length > 1) {
      for (const file of files) {
        errors.push({
          file,
          errorType: 'DUPLICATE_ID',
          message: `ID "${id}" が複数のファイルに存在します: ${files.join(', ')}`,
        })
      }
    }
  }

  // ── 3. 要件ID 未設定 ──────────────────────
  for (const tc of testCases) {
    if (!tc.frontmatter.要件ID) {
      errors.push({
        file: rel(tc.filePath),
        errorType: 'MISSING_要件ID',
        message: `"${tc.frontmatter.id ?? '?'}" に 要件ID フィールドがありません — REQ-CATEGORY-NNN を設定してください`,
      })
    }
  }

  // ── 4. 手順セクション空 ───────────────────
  for (const tc of testCases) {
    if (tc.steps.length === 0) {
      errors.push({
        file: rel(tc.filePath),
        errorType: 'MISSING_手順',
        message: `"${tc.frontmatter.id ?? '?'}" — # 手順 セクションがないか、リスト項目がありません`,
      })
    }
  }

  // ── 5. 期待結果セクション空 ───────────────
  for (const tc of testCases) {
    if (tc.expectedResults.length === 0) {
      errors.push({
        file: rel(tc.filePath),
        errorType: 'MISSING_期待結果',
        message: `"${tc.frontmatter.id ?? '?'}" — # 期待結果 セクションがないか、リスト項目がありません`,
      })
    }
  }

  // ── レポート ──────────────────────────────
  if (errors.length === 0) {
    console.log(`✅  全 ${testCases.length} 件のテストケースがバリデーションを通過しました。\n`)
    process.exit(0)
  }

  const byFile = new Map<string, ValidationError[]>()
  for (const err of errors) {
    if (!byFile.has(err.file)) byFile.set(err.file, [])
    byFile.get(err.file)!.push(err)
  }

  console.error(`❌  ${byFile.size} ファイルで ${errors.length} 件のエラーが見つかりました:\n`)

  for (const [file, fileErrors] of byFile) {
    console.error(`  📄 ${file}`)
    for (const err of fileErrors) {
      console.error(`     [${err.errorType}] ${err.message}`)
    }
    console.error('')
  }

  process.exit(1)
}

run()
