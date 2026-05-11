---
id: USER-002
title: 無効メールアドレスへの更新バリデーション
requirement: REQ-USER-001
priority: medium
category: user
type: negative
preconditions:
  - ログイン済みであること
tags:
  - profile
  - validation
---

# 手順

1. プロフィール編集画面を開く
2. メールアドレスフィールドに無効な値（例: "not-an-email"）を入力する
3. 「保存」ボタンを押下する

# 期待結果

- 保存が拒否される
- 「有効なメールアドレスを入力してください」バリデーションエラーが表示される
- DBへの更新は行われない
