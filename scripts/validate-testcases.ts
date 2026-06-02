/**
 * CLI: master/specs/ 以下の全テスト仕様書を検証する。
 *
 * チェック内容:
 *   1. メタデータ必須フィールド（案件名 / 案件タイプ / 作成日 / バージョン）
 *   2. TC-ID フォーマット（TC-NNN 形式）
 *   3. TC-ID 重複（スペック間を含む）
 *   4. 手順・期待結果が空でないこと
 *   5. 上流ID フォーマット（DD-NNN 形式、記載がある場合）
 *
 * 終了コード: 0 = OK、1 = エラーあり
 *
 * 使用方法:
 *   npm run validate
 *   tsx scripts/validate-testcases.ts
 */

import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { loadTestSpecs } from './lib/loader.js'
import { TestSpecMetadataSchema, TestCaseRowSchema } from '../schemas/testspec.js'
import type { ValidationError } from './lib/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

function rel(filePath: string): string {
  return relative(ROOT_DIR, filePath).replace(/\\/g, '/')
}

function run(): void {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  QA テスト仕様書 バリデーター          ║')
  console.log('╚══════════════════════════════════════╝\n')

  const specs = loadTestSpecs(ROOT_DIR)

  if (specs.length === 0) {
    console.warn('⚠  master/specs/ にテスト仕様書が見つかりません')
    console.warn('   .md ファイルを1件以上作成してください。\n')
    process.exit(0)
  }

  const totalTCs = specs.reduce((n, s) => n + s.testCases.length, 0)
  console.log(`${specs.length} 件の仕様書（計 ${totalTCs} TC）を検証中...\n`)

  const errors: ValidationError[] = []

  // ── 1. メタデータ必須フィールド ────────────
  for (const spec of specs) {
    const result = TestSpecMetadataSchema.safeParse(spec.metadata)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          file: rel(spec.filePath),
          errorType: 'METADATA_ERROR',
          message: `[${issue.path.join('.') || 'root'}] ${issue.message}`,
        })
      }
    }
  }

  // ── 2. TC-ID フォーマット & フィールド検証 ─
  for (const spec of specs) {
    for (const tc of spec.testCases) {
      const result = TestCaseRowSchema.safeParse(tc)
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: rel(spec.filePath),
            errorType: 'TC_SCHEMA_ERROR',
            message: `[${tc.id ?? '?'}][${issue.path.join('.') || 'root'}] ${issue.message}`,
          })
        }
      }
    }
  }

  // ── 3. TC-ID 重複チェック ─────────────────
  const idMap = new Map<string, string[]>()
  for (const spec of specs) {
    for (const tc of spec.testCases) {
      const id = tc.id ?? '(id なし)'
      if (!idMap.has(id)) idMap.set(id, [])
      idMap.get(id)!.push(rel(spec.filePath))
    }
  }
  for (const [id, files] of idMap) {
    if (files.length > 1) {
      const unique = [...new Set(files)]
      for (const file of unique) {
        errors.push({
          file,
          errorType: 'DUPLICATE_ID',
          message: `TC-ID "${id}" が複数箇所に存在します: ${files.join(', ')}`,
        })
      }
    }
  }

  // ── 4. 手順・期待結果 空チェック ──────────
  for (const spec of specs) {
    for (const tc of spec.testCases) {
      if (!tc.手順 || tc.手順.trim() === '') {
        errors.push({
          file: rel(spec.filePath),
          errorType: 'MISSING_手順',
          message: `"${tc.id ?? '?'}" — 手順が空です`,
        })
      }
      if (!tc.期待結果 || tc.期待結果.trim() === '') {
        errors.push({
          file: rel(spec.filePath),
          errorType: 'MISSING_期待結果',
          message: `"${tc.id ?? '?'}" — 期待結果が空です`,
        })
      }
    }
  }

  // ── 5. 上流ID フォーマット ─────────────────
  const ddPattern = /^DD-\d+$/
  for (const spec of specs) {
    for (const tc of spec.testCases) {
      if (tc.上流ID && !ddPattern.test(tc.上流ID)) {
        errors.push({
          file: rel(spec.filePath),
          errorType: 'INVALID_上流ID',
          message: `"${tc.id}" — 上流ID "${tc.上流ID}" は DD-NNN 形式ではありません`,
        })
      }
    }
  }

  // ── レポート ──────────────────────────────
  if (errors.length === 0) {
    console.log(`✅  全 ${totalTCs} TC のバリデーションを通過しました。\n`)
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
