# irodori スキル群 — 商品リサーチ・証拠整理・ランキング設計(第2段階)

IRODORI(iLy.)を「育児用品の比較・ランキング」サイトへ発展させるための専用スキル群。
外部情報源(メーカー公式・取扱説明書・マイベスト・価格.com・たまひよ・第三者レビュー・購入者口コミ等)を
**出典へ戻れる状態**で整理し、IRODORI独自の比較データと総合・シーン別ランキングへ変換する。

第1段階のスキル定義とMarkdown契約を正本として維持し、第2段階ではTypeScript型、
明示的バリデーター、架空fixture、決定論的ランキング試作、依存追加なしのテストを追加した。
サイト本体・Supabase・migration・実在商品のランキングは含まない。

## 構成

```text
agent-skills/irodori/
├─ README.md                          … 本ファイル(全体像・Open Decisions)
├─ shared/
│  ├─ references/                     … 共通原則の正本(4スキルはここを参照する)
│     ├─ terminology.md               … 用語と評価軸の定義
│     ├─ source-policy.md             … 情報源の分類・優先順位・商業的関係
│     ├─ product-identity-rules.md    … 商品同定ルール
│     ├─ evidence-model.md            … source_record / evidence_claim の概念モデル
│     ├─ status-model.md              … 3系統の状態モデル(混同禁止)
│     ├─ ranking-principles.md        … ランキング原則(禁止事項含む)
│     ├─ copyright-and-acquisition-policy.md … 著作権・取得・保存ポリシー
│     └─ data-contracts.md            … 全データ契約のフィールド案とJSON例(正本)
│  └─ contracts/
│     ├─ types.ts                     … 10契約のTypeScript型
│     ├─ validators.ts                … 明示的な実行時検証
│     └─ index.ts
├─ irodori-product-research/SKILL.md
├─ irodori-product-evidence-normalizer/SKILL.md
├─ irodori-ranking-engine/
│  ├─ SKILL.md
│  ├─ scripts/ranking-engine.ts       … 決定論的試作
│  ├─ fixtures/fictional-train-commute.ts
│  └─ tests/ranking-engine.test.mjs
├─ irodori-product-intelligence/SKILL.md
└─ tsconfig.json                      … 第2段階TypeScript型チェック
```

## 4スキルの責務(要約)

| スキル | 担当 | 担当しない |
|---|---|---|
| `irodori-product-research` | 商品同定、調査計画、情報源の登録(`source_record`)、取得不能理由の記録 | 得点計算、順位決定、他媒体順位の換算、DB書き込み、公開 |
| `irodori-product-evidence-normalizer` | `evidence_claim` の分離、単位・表記の正規化、評価軸/シーン分類、口コミ傾向整理、重複・矛盾の検出 | 最終順位の決定、自由判断による採点、未確認の0点化、原文の大量保存 |
| `irodori-ranking-engine` | ランキング定義、入力検証、決定論的score・充足率・confidence・同点・感度分析、結果説明 | Web調査、口コミ要約、出典取得、AIによる自由順位、`products.rank_no`、公開 |
| `irodori-product-intelligence` | 3スキルの実行順・入力確認・中間成果物の受け渡し・実行記録(`run_manifest`)・最終レビュー報告 | 調査ルール/正規化ロジック/スコア式の再定義・再実装、DB書き込み、自動公開 |

実行順の標準は research → normalizer → ranking-engine で、統括は intelligence が行う。

## 表現上のルール(全文書共通)

各文書内の記述は次の4区分を明示する。未確認の内容を確定事項として書かない。

- **Confirmed Principle** … 今回すでに確定している原則
- **Proposed Default** … 今後検証する初期案(変更されうる)
- **Open Decision** … ユーザー判断または実証が必要な事項
- **Unverified** … ローカル・外部でまだ確認できていない事項

## Confirmed Principle(このスキル群全体の確定原則)

1. スキル名の接頭辞は `irodori-`、正本の置き場所は `agent-skills/irodori/`。
2. 商品同定を最初に行い、同定できない情報を現行商品の根拠へ混ぜない(→ `shared/references/product-identity-rules.md`)。
3. 情報の性質(公式仕様/宣伝/取説/実測/編集部評価/口コミ/体験談/広告関係/IRODORI推論/不明)を分離する(→ `source-policy.md`, `evidence-model.md`)。
4. 出典へ戻れる構造にする。情報源(`source_record`)と抽出内容(`evidence_claim`)を分け、1ページから複数の `evidence_claim` を作れる(→ `evidence-model.md`, `data-contracts.md`)。
5. `evidence_status` / `validation_result` / `publication_status` は別概念として扱う(→ `status-model.md`)。
6. 他媒体の順位は参考メタデータとしてのみ保持し、得点化しない(→ `ranking-principles.md`)。
7. AIは候補抽出・分類・短い要約・矛盾候補の提示まで。数値変換・検証・重複排除・得点・充足率・confidence・順位・同点処理・感度分析・計算バージョンは決定論的処理が担当する。第2段階の試作は `irodori-ranking-engine/scripts/ranking-engine.ts`。同じ入力・設定・計算バージョンなら同じ結果になる。
8. `score` / `data_coverage` / `confidence` を分離し、未確認項目を自動的に0点にしない(→ `ranking-principles.md`)。
9. アフィリエイト報酬率・広告金額・在庫状況・販売店都合はランキング得点へ反映しない。広告・提供品・アフィリエイト関係は証拠の独立性メタデータとして保持する(→ `ranking-principles.md`, `source-policy.md`)。
10. 原文の大量保存をしない。URLへ戻れる短い構造化要約を基本とし、個人を特定できる情報を保存しない(→ `copyright-and-acquisition-policy.md`)。
11. 4スキルは責務を重複させない。共通ルールは `shared/references/` を正本とし、各SKILL.mdには参照だけを書く。
12. 第2段階のローカル試作でも、実在商品のランキング決定・Webスクレイピング・Supabase接続・migration・サイト本体・`products.rank_no` の変更を行わない。

## Decisions / Open Decisions(確定値とproposedを混同しない)

確定済み事項と、引き続きユーザー判断または実証が必要な事項を併記する。
試験値は「提案値(Proposed Default)」のまま扱い、確定値と区別する。

| # | 事項 | 現状 |
|---|---|---|
| 1 | 最初に試験する商品 | 候補は CYBEX メリオ カーボン 2026。ローカルでは型番・市場を確定できず unverified |
| 2 | 最初のランキング種別 | 電車移動向けランキング |
| 3 | `product_identity` の粒度 | ブランド + 正式商品名 + モデル年 + 対象市場 + 型番。仕様同一の色違いはvariant |
| 4 | カテゴリslugの管理方法(現状は `src/main.ts` の `categoryToQuery()` にハードコード) | 未定 |
| 5 | ランキングの具体的な重み | 全値proposed。架空fixtureに試験値あり |
| 6 | 最低データ充足率 | proposed 0.7 |
| 7 | 必須項目 | proposed: 本体重量・使用時横幅・折りたたみ操作 |
| 8 | confidence の計算式 | `confidence-proposed-v1` を試作。未確定 |
| 9 | 口コミ件数補正(件数の多寡をどう扱うか) | 未確定。生の件数は事実として保持 |
| 10 | 同点処理の規則 | proposed: 同scoreは同順位。表示順だけidentity ID |
| 11 | 感度分析の変動幅 | proposed: 各軸weight ±0.05 |
| 12 | データ契約の機械表現 | TypeScript型 + 明示的バリデーター。Markdownを人間向け正本として維持 |
| 13 | テスト基盤 | Node標準testを使用。新規依存なし |
| 14 | Supabaseへ保存する範囲(source_record 全部か、要約のみか等) | 未定 |
| 15 | 既存 `products.rank_no` の将来の扱い(並走・置換・廃止) | 未定。当面は変更禁止 |
| 16 | Codex・Claude Code から正本(`agent-skills/irodori/`)を参照する方法(手動参照 / `.claude/skills/` への展開 / CLAUDE.md追記) | 未定。今回は自動検出用コピー・リンク・ラッパーを作らない |
| 17 | `agent-skills/` をGit管理する範囲(現在は全体が未追跡) | 未定 |
| 18 | Apify・Firecrawl 等の外部取得サービスの採否 | 未定。必須依存にしない(公式性・ライセンス・安全性・更新状況は未確認 = Unverified) |
| 19 | 外部媒体(価格.com・マイベスト等)の利用規約・引用適法性 | Unverified。公開運用前に規約確認と専門家相談が必要 |

## 第2段階のローカル実装範囲

第1段階の成果物を正本として、次を実装済み。

1. `data-contracts.md` の10契約をTypeScript型へ変換
2. 条件付き必須項目と参照整合性の明示的バリデーター
3. 単位変換・重複排除・score・coverage・confidence・同点・感度分析の決定論的試作
4. 架空ベビーカー5候補 + 旧モデル/別市場の隔離identity
5. Node標準testによる再現性・入力順非依存・証拠trace検証

パイロット商品は `unverified` のため、実在商品での通し実行は未着手。

## 更新の記録

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-07-15 | 0.1.0 | 初版作成(第1段階: スキル定義とデータ契約の初版) |
| 2026-07-15 | 0.2.0 | 第2段階: TypeScript契約・バリデーター・架空fixture・決定論的ランキング試作 |
