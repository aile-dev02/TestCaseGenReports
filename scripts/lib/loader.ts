import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import { parseTestSpec } from './parser.js'
import { ResultsFileSchema } from '../../schemas/results.js'
import type { ParsedTestSpec, TestCaseRow } from './types.js'
import type { TestResult } from '../../schemas/results.js'

// ─────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────

/** dir 以下の指定拡張子ファイルを再帰収集 */
function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext))
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
  return results
}

// ─────────────────────────────────────────────
// Public loaders
// ─────────────────────────────────────────────

/**
 * master/specs/ 以下の全テスト仕様書 .md をロードする。
 *
 * @param rootDir リポジトリルートの絶対パス
 */
export function loadTestSpecs(rootDir: string): ParsedTestSpec[] {
  const dir = join(rootDir, 'master', 'specs')
  const files = findFiles(dir, '.md')

  const specs: ParsedTestSpec[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    specs.push(parseTestSpec(content, filePath))
  }
  return specs
}

/**
 * 全テスト仕様書から TestCaseRow をフラット展開して返す。
 *
 * @param rootDir リポジトリルートの絶対パス
 */
export function loadAllTestCaseRows(
  rootDir: string,
): Array<TestCaseRow & { specFilePath: string }> {
  return loadTestSpecs(rootDir).flatMap((spec) =>
    spec.testCases.map((row) => ({ ...row, specFilePath: spec.filePath })),
  )
}

/**
 * 最新の runs/{run-id}/results.yml をロードする。
 * ディレクトリ名をアルファベット順にソートし末尾のものを使用。
 *
 * @param rootDir リポジトリルートの絶対パス
 */
export function loadLatestResults(rootDir: string): Map<string, TestResult> {
  const runsDir = join(rootDir, 'runs')
  if (!existsSync(runsDir)) return new Map()

  const resultFiles = findFiles(runsDir, 'results.yml').sort()
  if (resultFiles.length === 0) return new Map()

  const latestFile = resultFiles[resultFiles.length - 1]
  const raw = parseYaml(readFileSync(latestFile, 'utf-8')) as unknown

  const parsed = ResultsFileSchema.safeParse(raw)
  if (!parsed.success) {
    console.error(
      `[loader] Results file validation error in ${latestFile}:\n`,
      parsed.error.format(),
    )
    return new Map()
  }

  return new Map(Object.entries(parsed.data))
}

/**
 * 最新 run のディレクトリ名を返す。runs/ がなければ "unknown"。
 */
export function latestRunId(rootDir: string): string {
  const runsDir = join(rootDir, 'runs')
  if (!existsSync(runsDir)) return 'unknown'

  const dirs = readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  return dirs[dirs.length - 1] ?? 'unknown'
}

/** ディレクトリが存在しない場合は再帰的に作成する */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
