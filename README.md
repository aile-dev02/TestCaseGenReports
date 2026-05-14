# QA Test Management System

Markdownをシングルソースオブトゥルースとして扱う、**Markdown駆動のQAテスト管理基盤**です。  
GitHubにpushするだけでExcelレポート・サマリ・トレーサビリティマトリクスが自動生成されます。

---

## 目次

1. [特徴](#特徴)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [セットアップ](#セットアップ)
4. [テストケース記法](#テストケース記法)
5. [要件記法](#要件記法)
6. [実行結果記法](#実行結果記法)
7. [実行方法](#実行方法)
8. [生成物一覧](#生成物一覧)
9. [GitHub Actions](#github-actions)
10. [運用フロー](#運用フロー)
11. [拡張例](#拡張例)

---

## 特徴

| 機能 | 説明 |
|:-----|:-----|
| ✅ バリデーション | Zodスキーマ + 構造チェック (ID重複, 必須セクション等) |
| 📊 Excelレポート | テストケース一覧/要件別/実行結果/FAIL一覧の4シート |
| 📋 QAサマリ | PASS率・高優先度FAIL・FAIL一覧をMarkdownで出力 |
| 🗺 トレーサビリティ | 要件→テストケース→結果の対応をMarkdown/Excelで出力 |
| ⚙️ GitHub Actions | push時に全レポートを自動生成・artifact保存 |
| 🔒 型安全 | TypeScript strict mode / Zod / any禁止 |

---

## ディレクトリ構成

```
.
├── master/
│   ├── testcases/            # テストケース Markdown (.md)
│   ├── requirements/         # 要件定義 Markdown (.md)
│   └── matrices/             # 手動管理の補助マトリクス (任意)
│
├── runs/
│   └── YYYY-MM-release/      # リリース単位の実行セット
│       ├── results.yml       # テスト結果
│       └── evidence/         # スクリーンショット等
│
├── reports/
│   ├── latest/               # 最新生成物 (Git管理外推奨)
│   └── archive/              # 過去レポートのアーカイブ
│
├── schemas/
│   ├── testcase.ts           # テストケース FrontMatter スキーマ
│   ├── results.ts            # 実行結果スキーマ
│   └── requirement.ts        # 要件 FrontMatter スキーマ
│
├── scripts/
│   ├── validate-testcases.ts # バリデーション CLI
│   ├── generate-excel.ts     # Excel レポート生成
│   ├── generate-summary.ts   # QA サマリ生成
│   ├── generate-traceability.ts # トレーサビリティ生成
│   └── lib/
│       ├── types.ts          # 共通型定義
│       ├── parser.ts         # Markdown パーサ (remark)
│       ├── loader.ts         # ファイルローダー
│       └── excel-builder.ts  # Excel ビルダー (exceljs)
│
├── .github/
│   └── workflows/
│       ├── qa-report.yml     # push 時レポート生成
│       └── qa-validate.yml   # PR/push 時バリデーション
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## セットアップ

### 必要環境

- **Node.js 20+**
- npm 9+

### インストール

```bash
npm ci
```

---

## テストケース記法

`master/testcases/` 以下に `.md` ファイルを作成します。

### ファイル名規則

```
{カテゴリ接頭辞}-{連番3桁}.md
例: AUTH-001.md, USER-003.md
```

### FrontMatter フィールド

```yaml
---
id: AUTH-001              # 必須: PREFIX-NNN 形式
タイトル: 正常ログイン      # 必須: テストケースのタイトル
要件ID:                    # 推奨: 紐づく要件ID の一覧 (REQ-CATEGORY-NNN)
  - REQ-LOGIN-001
優先度: high               # 必須: high | medium | low
カテゴリ: auth             # 必須: 機能カテゴリ
タイプ: positive           # 必須: positive | negative | boundary | security | performance
前提条件:                  # 任意: 実行前提条件
  - ユーザーが存在する
タグ:                      # 任意: 自由タグ
  - smoke
---
```

### Markdown 本文

必ず以下の2セクションを含めること。

```markdown
# 手順

1. ログイン画面を開く
2. ID/PWを入力する
3. ログインボタンを押下する

# 期待結果

- マイページへ遷移する
- セッションが生成される
```

> **注意:** `# 手順` と `# 期待結果` の見出しは完全一致が必要です（英語エイリアス `# Steps` / `# Expected Results` も使用可）。

---

## 要件記法

`master/requirements/` 以下に `.md` ファイルを作成します。

```yaml
---
id: REQ-LOGIN-001          # 必須: REQ-CATEGORY-NNN 形式
タイトル: ユーザーログイン機能 # 必須
説明: ログイン機能の概要説明   # 任意: トレーサビリティに表示される一行説明
カテゴリ: LOGIN             # 必須
優先度: high               # 必須: high | medium | low
ステータス: approved        # 必須: draft | approved | deprecated
---
```

本文に `# 受入基準` セクションを記述するとトレーサビリティマトリクスに反映されます。

---

## 実行結果記法

`runs/{リリース名}/results.yml` に記述します。

```yaml
AUTH-001:
  status: PASS              # PASS | FAIL | SKIP | NOT_EXECUTED
  assignee: yamada          # 実行担当者
  completed_at: "2026-05-11T10:00:00"
  evidence:
    - evidence/AUTH-001/screenshot.png
  bug: BUG-192              # FAILの場合: バグチケットID
  notes: "補足コメント"
```

> 最も新しいディレクトリ名（アルファベット降順）の `results.yml` が使用されます。

---

## 実行方法

### バリデーション

```bash
npm run validate
```

- 0: 全件OK
- 1: エラーあり（ID重複, 必須項目不足, 構造崩れ等）

### レポート生成

```bash
# 個別実行
npm run generate:excel        # reports/latest/test-report.xlsx
npm run generate:summary      # reports/latest/qa-summary.md
npm run generate:traceability # reports/latest/traceability.md + .xlsx

# 全まとめて実行
npm run generate:all

# バリデーション + 全生成（CI用）
npm run ci
```

---

## 生成物一覧

| ファイル | 内容 |
|:--------|:-----|
| `reports/latest/test-report.xlsx` | テストケース一覧・要件別・実行結果・FAIL一覧（4シート） |
| `reports/latest/qa-summary.md` | PASS/FAIL/SKIP集計、Pass率、高優先度FAIL、FAIL一覧 |
| `reports/latest/traceability.md` | 要件↔テストケース↔実行ステータス対応表 |
| `reports/latest/traceability.xlsx` | トレーサビリティマトリクス（Excel） |

### Excel フォーマット仕様

- ヘッダー行: 青背景・白太字
- PASS: 緑 / FAIL: 赤 / SKIP: 黄 / 未実施: グレー
- 高優先度 (high): 薄オレンジ背景
- 全セルに罫線
- 1行目でフリーズ、AutoFilter 付き
- 条件付き書式 (FAIL セル)

---

## GitHub Actions

### `qa-report.yml`

`master/**`, `runs/**`, `scripts/**` 等に push した際に起動します。

```
1. npm ci
2. npm run validate       (失敗したら以降をスキップ)
3. npm run generate:excel
4. npm run generate:summary
5. npm run generate:traceability
6. Artifact: qa-reports-{sha} (90日保持)
7. ジョブサマリにQAサマリを書き出し
```

### `qa-validate.yml`

テストケースや要件ファイルに変更が入ったPRで起動し、マージをブロックします。

---

## 運用フロー

```
1. 要件ファイル追加
   master/requirements/REQ-LOGIN-001.md を作成

2. テストケース追加
   master/testcases/AUTH-001.md を作成 (requirement: REQ-LOGIN-001)

3. バリデーション
   npm run validate  →  ローカルで事前確認

4. PR作成・レビュー
   GitHub Actions が qa-validate を実行し自動チェック

5. テスト実行
   runs/2026-05-release/results.yml に結果を記入

6. レポート生成
   push → qa-report ワークフローが自動実行
   または npm run ci でローカル生成

7. Artifact ダウンロード
   GitHub Actions の Artifacts から最新レポートを取得
```

---

## 拡張例

### Playwright 自動テスト結果の取り込み

```typescript
// scripts/import-playwright-results.ts
import { readFileSync, writeFileSync } from 'fs'
import type { ResultsFile } from '../schemas/results.js'

// Playwright の JSON Reporter 出力を results.yml に変換するスクリプトをここに実装
```

### HTML レポート生成

```bash
npm install --save-dev @mermaid-js/mermaid-cli
```

`generate-html.ts` を追加して `qa-summary.md` を HTML に変換し、  
GitHub Pages にデプロイするワークフローを追加できます。

### Vue / React UI 化

`reports/` ディレクトリを静的 SPA のデータソースとして使用し、  
`qa-summary.md` を JSON API に変換する薄い Node.js サーバを立てることで  
リアルタイムダッシュボードを構築できます。

---

## 技術スタック

| パッケージ | 役割 |
|:---------|:-----|
| `exceljs` | Excel (.xlsx) 生成 |
| `gray-matter` | YAML FrontMatter パース |
| `remark` + `remark-parse` | Markdown AST 解析 |
| `unified` + `unist-util-visit` | AST トラバーサル |
| `yaml` | results.yml パース |
| `zod` | スキーマバリデーション |
| `tsx` | TypeScript 直接実行 |
| `typescript` | 型安全・strict mode |

---

*Generated by QA Test Management System*
