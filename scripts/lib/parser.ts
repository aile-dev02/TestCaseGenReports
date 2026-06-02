import type { TestSpecMetadata, TestCaseRow, UpstreamMapping } from '../../schemas/testspec.js'
import type { ParsedTestSpec } from './types.js'

// ─────────────────────────────────────────────
// MD テーブル パース ヘルパー
// ─────────────────────────────────────────────

/** `| a | b | c |` → `['a', 'b', 'c']` */
function parseTableRow(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => c.trim())
}

/** セパレータ行（`|---|---|`）を判定する */
function isSeparatorRow(line: string): boolean {
  return /^\|[\s|:=-]+\|$/.test(line.trim())
}

/**
 * テーブルセルにまたがる複数行を結合する。
 *
 * MD テーブルの行が途中で改行されている場合（セル内改行）、
 * 継続行を前の行に `\n` で結合し、1行に収める。
 *
 * 判定ルール:
 *   - `|` で始まらず `|` で終わらない行 → 継続行
 *   - `|` で終わる行 → 行の終端（結合完了）
 *   - 空行 → 強制フラッシュ
 */
function joinMultilineCells(lines: string[]): string[] {
  const result: string[] = []
  let pending: string | null = null

  for (const line of lines) {
    const t = line.trimEnd()

    if (t.startsWith('|')) {
      if (pending !== null) {
        result.push(pending)
        pending = null
      }
      if (t.endsWith('|')) {
        result.push(t)
      } else {
        pending = t
      }
    } else if (pending !== null) {
      if (t.trim() === '') {
        result.push(pending)
        pending = null
        result.push(line)
      } else {
        pending += '\n' + t.trim()
        if (t.trimEnd().endsWith('|')) {
          result.push(pending)
          pending = null
        }
      }
    } else {
      result.push(line)
    }
  }

  if (pending !== null) result.push(pending)
  return result
}

// ─────────────────────────────────────────────
// 公開パース関数
// ─────────────────────────────────────────────

/**
 * テスト仕様書 Markdown ファイルをパースする。
 *
 * 抽出対象:
 *   - H1 見出し から 案件名
 *   - 最初のテーブル（`## 1.` より前）からメタデータ（キー→値）
 *   - `### 1.1 上流設計書との対応` テーブルから UpstreamMapping[]
 *   - `## 3. テストケース` テーブルから TestCaseRow[]
 */
export function parseTestSpec(content: string, filePath: string): ParsedTestSpec {
  const lines = joinMultilineCells(content.split('\n'))

  // ── 1. 案件名（H1 見出し） ─────────────────
  const h1Line = lines.find((l) => /^#\s/.test(l))
  const 案件名 = h1Line
    ? h1Line.replace(/^#\s+テスト仕様書[：:]\s*/, '').trim()
    : ''

  // ── 2. メタデータテーブル（最初の ## より前） ─
  const metadataMap: Record<string, string> = {}
  for (const line of lines) {
    if (/^##\s/.test(line)) break
    if (!line.startsWith('|') || isSeparatorRow(line)) continue
    const cells = parseTableRow(line)
    if (cells.length >= 2 && cells[0] !== '項目') {
      metadataMap[cells[0]] = cells[1]
    }
  }

  // ── 3. 上流設計書との対応テーブル（### 1.1） ─
  const upstreamMappings: UpstreamMapping[] = []
  let inSection11 = false
  for (const line of lines) {
    if (/^###\s*1\.1/.test(line)) { inSection11 = true; continue }
    if (inSection11 && (/^###/.test(line) || /^##\s/.test(line))) {
      inSection11 = false
    }
    if (!inSection11 || !line.startsWith('|') || isSeparatorRow(line)) continue
    const cells = parseTableRow(line)
    if (cells.length >= 3 && /^DD-/.test(cells[0])) {
      upstreamMappings.push({
        上流ID: cells[0],
        機能名: cells[1],
        展開先TCIDs: cells[2]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
    }
  }

  // ── 4. テストケーステーブル（## 3.） ──────
  const testCases: TestCaseRow[] = []
  let inSection3 = false
  for (const line of lines) {
    if (/^##\s*3\./.test(line)) { inSection3 = true; continue }
    if (inSection3 && /^##\s*\d+\./.test(line)) { inSection3 = false }
    if (!inSection3 || !line.startsWith('|') || isSeparatorRow(line)) continue
    const cells = parseTableRow(line)
    // ヘッダー行（TC-ID という文字列を持つ行）はスキップ
    if (cells[0] === 'TC-ID') continue
    if (cells.length >= 5 && /^TC-/.test(cells[0])) {
      testCases.push({
        id: cells[0],
        テスト名: cells[1],
        種別: cells[2],
        手順: cells[3],
        期待結果: cells[4],
        上流ID: cells[5] || undefined,
        備考: cells[6] || undefined,
      })
    }
  }

  // ── 5. メタデータオブジェクト組み立て ──────
  const metadata: TestSpecMetadata = {
    案件名,
    案件タイプ: metadataMap['案件タイプ'] ?? '',
    上流ファイル主: metadataMap['上流ファイル（主）'] || undefined,
    上流ファイル副: metadataMap['上流ファイル（副）'] || undefined,
    作成日: metadataMap['作成日'] ?? '',
    顧客: metadataMap['顧客'] || undefined,
    自社担当: metadataMap['自社担当'] || undefined,
    バージョン: metadataMap['バージョン'] ?? '',
  }

  return { metadata, upstreamMappings, testCases, filePath, rawContent: content }
}
