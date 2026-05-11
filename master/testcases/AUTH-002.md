---
id: AUTH-002
title: 誤パスワードによるログイン失敗
requirement: REQ-LOGIN-001
priority: high
category: auth
type: negative
preconditions:
  - ユーザーアカウントが存在する
  - アカウントが有効
tags:
  - login
  - security
---

# 手順

1. ブラウザでログイン画面を開く
2. 有効なユーザーIDをIDフィールドに入力する
3. 誤ったパスワード（例: "wrongpass123"）を入力する
4. ログインボタンを押下する

# 期待結果

- ログインが拒否され、ダッシュボードへ遷移しない
- 「IDまたはパスワードが正しくありません」エラーメッセージが表示される
- パスワード試行失敗カウントがインクリメントされる
