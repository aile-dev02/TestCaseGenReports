# トレーサビリティマトリクス

**生成日時:** 2026-05-11T06:24:52.140Z  
**実行セット:** 2026-05-release

## カバレッジサマリ

| 項目 | 値 |
|:-----|:--|
| 要件総数 | 2 |
| カバー済み要件 | 2 |
| テストケース総数 | 6 |
| 要件カバレッジ率 | **100%** |

## マトリクス

| 要件ID | 要件タイトル | テストケースID | テストケースタイトル | 優先度 | 実行ステータス |
|:-------|:------------|:--------------|:--------------------|:-------|:--------------|
| [REQ-LOGIN-001](../../master/requirements/REQ-LOGIN-001.md) | ユーザーログイン機能 | [AUTH-001](../../master/testcases/AUTH/AUTH-001.md) | 正常ログイン | high | ✅ PASS |
|  | ユーザーログイン機能 | [AUTH-002](../../master/testcases/AUTH/AUTH-002.md) | 誤パスワードによるログイン失敗 | high | ❌ FAIL |
|  | ユーザーログイン機能 | [AUTH-003](../../master/testcases/AUTH/AUTH-003.md) | アカウントロックアウト（連続失敗） | high | ⬜ 未実施 |
|  | ユーザーログイン機能 | [AUTH-004](../../master/testcases/AUTH/AUTH-004.md) | ログアウト | high | ⏭ SKIP |
| [REQ-USER-001](../../master/requirements/REQ-USER-001.md) | ユーザープロフィール管理 | [USER-001](../../master/testcases/USER-001.md) | ユーザープロフィール更新（正常） | medium | ✅ PASS |
|  | ユーザープロフィール管理 | [USER-002](../../master/testcases/USER-002.md) | 無効メールアドレスへの更新バリデーション | medium | ⬜ 未実施 |

---

*このレポートは [QA Test Management System](../../README.md) により自動生成されました。*
