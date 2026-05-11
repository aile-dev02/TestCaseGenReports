import { z } from 'zod'

/**
 * results.yml の各エントリスキーマ。
 * 各フィールドは日本語キーで定義する。
 *
 * results.yml 記述例:
 *   AUTH-001:
 *     ステータス: PASS
 *     担当者: yamada
 *     完了日時: "2026-05-11T10:00:00"
 *     エビデンス:
 *       - evidence/AUTH-001/step1.png
 */
export const TestResultSchema = z.object({
  /** 実行ステータス */
  ステータス: z
    .enum(['PASS', 'FAIL', 'SKIP', 'NOT_EXECUTED'])
    .default('NOT_EXECUTED'),

  /** テストを実行した担当者 */
  担当者: z.string().optional(),

  /** テスト完了日時（ISO 8601） */
  完了日時: z.string().optional(),

  /** スクリーンショット・ログ等のエビデンスへの相対パス */
  エビデンス: z.array(z.string()).optional(),

  /** ステータスが FAIL の場合のバグチケット ID */
  不具合: z.string().optional(),

  /** 自由記述メモ */
  メモ: z.string().optional(),
})

/** results.yml のトップレベルはテストケース ID → 結果のマップ */
export const ResultsFileSchema = z.record(z.string(), TestResultSchema)

export type TestResult = z.infer<typeof TestResultSchema>
export type ResultsFile = z.infer<typeof ResultsFileSchema>
