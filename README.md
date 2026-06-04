# QA Test Management System

Markdownをシングルソースオブトゥルースとして扱う、**Markdown駆動のQAテスト管理基盤**です。  
GitHubにpushするだけでExcelレポート・サマリ・トレーサビリティマトリクスが自動生成されます。

---

## 目次

1. [特徴](#特徴)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [セットアップ](#セットアップ)
4. [テスト仕様書記法](#テスト仕様書記法)
5. [要件記法](#要件記法)
6. [実行結果記法](#実行結果記法)
7. [実行方法](#実行方法)
8. [生成物一覧](#生成物一覧)
9. [GitHub Actions](#github-actions)
10. [運用フロー](#運用フロー)

---

## 特徴

| 機能 | 説明 |
|:-----|:-----|
| ✅ バリデーション | Zodスキーマ + 構造チェック (ID重複, 必須セクション等) |
| 📊 Excelレポート | テストケース一覧/要件別/実行結果/FAIL一覧の4シート |
| 📋 QAサマリ | PASS率・高優先度FAIL・FAIL一覧をMarkdownで出力 |
| 🗺 トレーサビリティ | 要件→テストケース→結果の対応をMarkdown/Excelで出力 |
| 📄 管理レポート | 管理者向けHTMLサマリレポートを出力 |
| ⚙️ GitHub Actions | push時に全レポートを自動生成・リポジトリコミット |
| 🔒 型安全 | TypeScript strict mode / Zod / any禁止 |

---

## ディレクトリ構成

```
.
├── master/
│   ├── specs/                # テスト仕様書 Markdown (.md)
│   ├── requirements/         # 要件定義 Markdown (.md)
│   └── automated/            # 自動テストデータ (任意)
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
│   ├── testspec.ts           # テスト仕様書スキーマ
│   └── results.ts            # 実行結果スキーマ
│
├── scripts/
│   ├── validate-testcases.ts    # バリデーション CLI
│   ├── generate-excel.ts        # Excel レポート生成
│   ├── generate-summary.ts      # QA サマリ生成
│   ├── generate-traceability.ts # トレーサビリティ生成
│   ├── generate-admin-report.ts # 管理者向けレポート生成
│   ├── generate-html.ts         # HTML レポート生成
│   └── lib/
│       ├── types.ts          # 共通型定義
│       ├── parser.ts         # Markdown パーサ
│       ├── loader.ts         # ファイルローダー
│       └── excel-builder.ts  # Excel ビルダー (exceljs)
│
├── templates/
│   ├── testspec-template.md       # テスト仕様書テンプレート
│   └── results-entry-template.yml # 実行結果エントリテンプレート
│
├── .github/
│   └── workflows/
│       ├── qa-report.yml     # push 時レポート生成・コミット
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

## テスト仕様書記法

`master/specs/` 以下に `.md` ファイルを作成します。

### ファイル名規則

```
{機能名}-spec.md
例: auth-spec.md, user-spec.md
```

### ドキュメント構造

テンプレートは `templates/testspec-template.md` を参照してください。

```
1. テスト方針・前提
   1.1 上流設計書との対応
   1.2 テスト体制
2. テスト環境・データ
3. テストケース         ← 必須：テーブル形式でTC-IDを記述
4. 結合・シナリオテスト
5. 合否基準・残課題
```

### メタデータテーブル

ファイル先頭に以下の形式でメタデータを記述します。

```markdown
| 項目 | 内容 |
|---|---|
| 案件タイプ | 新規開発 |
| 上流ファイル（主） | docs/詳細設計書.xlsx |
| 上流ファイル（副） | |
| 作成日 | 2026-06-01 |
| 顧客 | 顧客名 |
| 自社担当 | 担当者名 |
| バージョン | 0.1（草案） |
```

### テストケーステーブル（セクション3）

`## 3.` で始まるセクション内に以下のテーブルを記述します。

```markdown
| TC-ID | テスト名 | 種別 | 優先度 | 手順 | 期待結果 | 上流ID | 備考 | 担当者 | 完了日時 | 実行ステータス |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | 正常系：ログイン | 画面 | 高 | 1. 画面を開く 2. ID/PW入力 3. ボタン押下 | ダッシュボードへ遷移 | DD-001 | | | | |
| TC-002 | 異常系：誤パスワード | 画面 | 中 | 1. 誤PWで入力 2. ボタン押下 | エラーメッセージ表示 | DD-001 | | | | WAITING |
```

#### 実行ステータスの値

| 値 | 日本語エイリアス | 意味 |
|:--|:--|:--|
| `PASS` | `合格` | 合格 |
| `FAIL` | `失敗` | 不合格 |
| `SKIP` | `スキップ` | スキップ（環境・スコープ理由） |
| `NOT_EXECUTED` | `未実行` | 未実施（省略時のデフォルト） |
| `WAITING` | `質問待ち` | 質問・確認待ち |
| `NA` | `対象外` | 対象外 |

> テーブルのカラム順は固定です。`実行ステータス` は11列目（最終列）に記述してください。

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

`runs/{リリース名}/results.yml` に記述します。エントリテンプレートは `templates/results-entry-template.yml` を参照してください。

```yaml
TC-001:
  ステータス: PASS          # PASS | FAIL | SKIP | NOT_EXECUTED | NA | WAITING
  担当者: yamada            # 実行担当者
  完了日時: "2026-05-11T10:00:00"
  エビデンス:
    - evidence/TC-001/screenshot.png

TC-002:
  ステータス: FAIL
  担当者: yamada
  完了日時: "2026-05-11T11:00:00"
  不具合: BUG-192           # FAILの場合: バグチケットID
  メモ: "補足コメント"
  エビデンス:
    - evidence/TC-002/screenshot.png
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
npm run generate:excel          # reports/latest/test-report.xlsx
npm run generate:summary        # reports/latest/qa-summary.md
npm run generate:traceability   # reports/latest/traceability.md + .xlsx
npm run generate:admin-report   # reports/latest/admin-report.html
npm run generate:html           # Markdown → HTML 変換

# 全まとめて実行（excel + summary + traceability + admin-report）
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
| `reports/latest/admin-report.html` | 管理者向けHTMLサマリレポート |

### Excel フォーマット仕様

- ヘッダー行: 青背景・白太字
- PASS: 緑 / FAIL: 赤 / SKIP: 黄 / 未実施: グレー
- 高優先度 (高): 薄オレンジ背景
- 全セルに罫線
- 1行目でフリーズ、AutoFilter 付き

---

## GitHub Actions

### `qa-report.yml`

`master/**`, `runs/**`, `scripts/**`, `schemas/**`, `package.json` に push した際に起動します。手動実行（`workflow_dispatch`）も可能です。

```
1. npm ci
2. npm run validate       (失敗したら以降をスキップ)
3. npm run generate:excel
4. npm run generate:summary
5. npm run generate:traceability
6. npm run generate:admin-report
7. 生成物をリポジトリにコミット [skip ci]
8. Artifact: qa-reports-{sha} (90日保持)
```

### `qa-validate.yml`

テストケースや要件ファイルに変更が入ったPR・pushで起動し、バリデーションエラーがあればマージをブロックします。

---

## 運用フロー

```
1. 要件ファイル追加
   master/requirements/REQ-LOGIN-001.md を作成

2. テスト仕様書追加
   master/specs/auth-spec.md を作成
   セクション3のテーブルに TC-ID を記述し、上流IDで要件と紐づける

3. バリデーション
   npm run validate  →  ローカルで事前確認

4. PR作成・レビュー
   GitHub Actions が qa-validate を実行し自動チェック

5. テスト実行
   runs/2026-05-release/results.yml に TC-ID 単位で結果を記入

6. レポート生成
   push → qa-report ワークフローが自動実行・コミット
   または npm run ci でローカル生成

7. Artifact ダウンロード
   GitHub Actions の Artifacts から最新レポートを取得
   または reports/latest/ をリポジトリから直接参照
```

---

## 技術スタック

| パッケージ | 役割 |
|:---------|:-----|
| `exceljs` | Excel (.xlsx) 生成 |
| `yaml` | results.yml パース |
| `zod` | スキーマバリデーション |
| `@mermaid-js/mermaid-cli` | Mermaid 図のレンダリング |
| `tsx` | TypeScript 直接実行 |
| `typescript` | 型安全・strict mode |

---

*Generated by QA Test Management System*
