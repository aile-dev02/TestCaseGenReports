import { z } from 'zod'

export const TestSpecMetadataSchema = z.object({
  案件名: z.string().min(1, '案件名は必須です'),
  案件タイプ: z.string().min(1, '案件タイプは必須です'),
  上流ファイル主: z.string().optional(),
  上流ファイル副: z.string().optional(),
  作成日: z.string().min(1, '作成日は必須です'),
  顧客: z.string().optional(),
  自社担当: z.string().optional(),
  バージョン: z.string().min(1, 'バージョンは必須です'),
})

export const TestCaseRowSchema = z.object({
  id: z
    .string()
    .regex(/^TC-\d+$/, 'TC-ID は TC-NNN 形式で指定してください（例: TC-001）'),
  テスト名: z.string().min(1, 'テスト名は必須です'),
  種別: z.string().min(1, '種別は必須です'),
  手順: z.string().min(1, '手順は必須です'),
  期待結果: z.string().min(1, '期待結果は必須です'),
  上流ID: z.string().optional(),
  優先度: z.string().optional(),
  備考: z.string().optional(),
  担当者: z.string().optional(),
  完了日時: z.string().optional(),
  実行ステータス: z.enum(['PASS', 'FAIL', 'SKIP', 'NOT_EXECUTED', 'NA', 'WAITING']).optional(),
})

export const UpstreamMappingSchema = z.object({
  上流ID: z
    .string()
    .regex(/^DD-\d+$/, '上流ID は DD-NNN 形式で指定してください（例: DD-001）'),
  機能名: z.string().min(1),
  展開先TCIDs: z.array(z.string()),
})

export type TestSpecMetadata = z.infer<typeof TestSpecMetadataSchema>
export type TestCaseRow = z.infer<typeof TestCaseRowSchema>
export type UpstreamMapping = z.infer<typeof UpstreamMappingSchema>
