import { z } from 'zod'

/**
 * テストケース Markdown ファイルの YAML FrontMatter スキーマ。
 * 各フィールドは日本語キーで定義する。
 */
export const TestCaseFrontmatterSchema = z.object({
  /** 一意識別子。PREFIX-NNN 形式（例: AUTH-001） */
  id: z
    .string()
    .regex(/^[A-Z]+-\d+$/, 'id は PREFIX-NNN 形式で指定してください（例: AUTH-001）'),

  /** テストケースのタイトル */
  タイトル: z.string().min(1, 'タイトルは必須です'),

  /**
   * 紐づく要件 ID（REQ-CATEGORY-NNN 形式）。
   * ドラフト段階では省略可。
   */
  要件ID: z
    .string()
    .regex(/^REQ-[A-Z0-9]+-\d+$/, '要件ID は REQ-CATEGORY-NNN 形式で指定してください')
    .optional(),

  /** 実行優先度 */
  優先度: z.enum(['high', 'medium', 'low']),

  /** 機能カテゴリ／モジュール */
  カテゴリ: z.string().min(1, 'カテゴリは必須です'),

  /** テスト設計タイプ */
  タイプ: z.enum([
    'positive',
    'negative',
    'boundary',
    'security',
    'performance',
  ]),

  /** 実行前に満たすべき前提条件の一覧 */
  前提条件: z.array(z.string()).optional(),

  /** フィルタリング・グループ化用の自由タグ */
  タグ: z.array(z.string()).optional(),
})

export type TestCaseFrontmatter = z.infer<typeof TestCaseFrontmatterSchema>
