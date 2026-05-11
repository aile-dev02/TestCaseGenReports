---
id: AUTH-001
title: 正常ログイン
requirement: REQ-LOGIN-001
priority: high
category: auth
type: positive
preconditions:
  - ユーザーアカウントが存在する
  - アカウントが有効（停止・削除されていない）
tags:
  - smoke
  - login
---

# 手順

1. ブラウザでログイン画面を開く
2. 有効なユーザーIDをIDフィールドに入力する
3. 正しいパスワードをパスワードフィールドに入力する
4. ログインボタンを押下する

# 期待結果

- マイページ（/dashboard）へリダイレクトされる
- セッションCookieが生成される
- ヘッダーにログインユーザー名が表示される
