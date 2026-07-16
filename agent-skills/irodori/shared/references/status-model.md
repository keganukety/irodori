# status-model — 3系統の状態モデル(正本)

区分ラベル: **[C] = Confirmed Principle / [P] = Proposed Default**

3つの状態系統は**別概念**であり、混同・相互変換・格下げをしない [C]。

## 1. evidence_status — 証拠の確からしさ [C]

対象: `evidence_claim`, `normalized_feature`(および間接的に `review_theme_summary`)

| 値 | 意味 | なってはいけない誤用 |
|---|---|---|
| `confirmed` | 出典と照合済みで矛盾がない | 推論を confirmed にする |
| `unconfirmed` | 出典が不足・未確認(**低評価という意味ではない**) | unconfirmed を0点として扱う |
| `conflicting` | 複数の証拠が食い違っている(両論を保持) | 都合の悪い側を削除して confirmed にする |
| `outdated` | 旧モデル・古い情報の可能性が高い | 気づいた古さを黙って無視する |
| `not_applicable` | その商品にその属性が該当しない(例: 対象外カテゴリ) | 「データがない」の意味で使う(それは unconfirmed) |

## 2. validation_result — 機械的検証の結果 [C]

対象: 入力検証・契約準拠チェック・整合性チェックの1項目ごと

| 値 | 意味 |
|---|---|
| `pass` | 検証項目を満たした |
| `fail` | 検証項目を満たさなかった(修正が必要) |
| `unknown` | 検証に必要な入力が欠けていて判定できない(何があれば判定できるかを併記する) |
| `not_applicable` | この対象にはその検証項目が適用されない |

運用ルール [C]:
- `fail` を都合により `unknown` に格下げしない。
- `unknown` には「何が揃えば pass/fail を判定できるか」を必ず添える。
- 検証は決定論的処理が担当する(AIの心証で pass にしない)。

## 3. publication_status — 公開ワークフロー上の位置 [C]

対象: `ranking_definition`, `ranking_result`, `review_report` などの成果物

| 値 | 意味 |
|---|---|
| `draft` | 作成中・未レビュー |
| `review_required` | 人間のレビュー待ち |
| `approved` | レビュー済み・公開可と判断された |
| `rejected` | 公開不可と判断された(理由を記録) |
| `published` | 公開済み |

運用ルール [C]:
- 本スキル群では `published` へ遷移させる処理を実装しない。公開は常に
  人間の明示的な判断と操作による。
- `approved` の付与は自動化しない(review_report を人間が確認した後にのみ進む)。

## 4. 3系統の関係 [C]

- `evidence_status: unconfirmed` は `validation_result: fail` を意味しない
  (未確認でも契約準拠なら pass しうる)。
- `validation_result: pass` は `publication_status: approved` を意味しない
  (機械検証を通っても公開判断は別)。
- 遷移の記録: 状態を変更した場合、いつ・何を根拠に変更したかを対象レコードの
  `status_history`(→ `data-contracts.md`)に残す [P]。
