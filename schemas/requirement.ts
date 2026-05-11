import { z } from 'zod'

/**
 * 要件定義 Markdown ファイルの YAML FrontMatter スキーマ。
 * 各フィールドは日本語キーで定義する。
 */
export const RequirementFrontmatterSchema = z.object({
  /** 一意識別子。REQ-CATEGORY-NNN 形式 */
  id: z
    .string()
    .regex(/^REQ-[A-Z0-9]+-\d+$/, 'id は REQ-CATEGORY-NNN 形式で指定してください'),

  /** 要件タイトル */
  タイトル: z.string().min(1, 'タイトルは必須です'),

  /** トレーサビリティマトリクスに表示される一行説明 */
  説明: z.string().optional(),

  /** 機能カテゴリ／モジュール */
  カテゴリ: z.string().min(1, 'カテゴリは必須です'),

  /** ビジネス上の優先度 */
  優先度: z.enum(['high', 'medium', 'low']).default('medium'),

  /** ライフサイクルステータス */
  ステータス: z.enum(['draft', 'approved', 'deprecated']).default('draft'),
})

export type RequirementFrontmatter = z.infer<typeof RequirementFrontmatterSchema>
