---
name: irodori-product-intelligence
description: irodori-product-research → irodori-product-evidence-normalizer → irodori-ranking-engine の実行順・入力確認・中間成果物の受け渡しを統括する薄いオーケストレーターSkill。実行ID(run_manifest)の記録、途中失敗時の停止、最終レビュー用report(review_report)の作成を行う。商品調査からランキング準備までの一連の実行、または進行状況の確認を頼まれたら使う。調査ルール・正規化ロジック・スコア式はここで再定義せず、各スキルと shared/references を正本とする。
---

# irodori-product-intelligence — 実行統括(薄いオーケストレーター)

## Purpose

3スキル(research / normalizer / ranking-engine)を正しい順序・正しい入力で実行し、
実行記録(`run_manifest`)と最終レビュー報告(`review_report`)を作る。
**ロジックを持たない**: 調査ルール・正規化ルール・ランキング原則の正本は
各SKILL.mdと `shared/references/` であり、本スキルはそれらを再定義・再実装しない。

## Use When

- 商品調査〜正規化〜ランキング準備の一連の実行を依頼されたとき
- 実行の途中経過・失敗箇所・次の工程の確認を依頼されたとき
- 複数スキルの成果物をまとめた最終レビュー報告を求められたとき

## Do Not Use When

- 単一工程だけの依頼(該当スキルを直接使う)
- 調査ルール・正規化ロジック・スコア式の設計変更(各スキルと shared/references の改訂として行う)
- サイト実装・Supabase操作・公開処理(全スキル共通の対象外)

## Required Inputs

1. 実行の目的(完了判定できる1〜2文)
2. 対象商品(または候補選定条件)とカテゴリ
3. 実行範囲: どの工程まで進めるか(research のみ / normalizer まで / ranking-engine まで)

## Optional Inputs

- 既存の `run_manifest`(再開・追加実行の場合)
- 使用する `ranking_definition_id` と版(ranking 工程を含む場合)

## Workflow

1. `run_id` を採番し、`run_manifest` を作成する(`data-contracts.md` §1)。
   目的・対象・実行範囲・使用する契約版(`contracts_version` 等)を記録する。
   Node.js/TypeScript/OS/platform/arch、型チェック・テストコマンド、test isolation、
   計算版・定義版を実測可能な範囲で`execution_environment`へ記録する。推測値は入れない。
   第三者媒体を含む場合は対応する`SourceUsageAudit`の版と再確認期限も成果物参照へ加える。
2. **工程ごとに次を繰り返す**(標準順序: research → normalizer → ranking-engine):
   a. そのスキルの Required Inputs が揃っているか確認する。
      揃っていなければ実行せず、不足を `review_report.open_questions` に記録して停止する。
   b. スキルを実行する(各スキルのSKILL.mdの手順に従う。手順の言い換え・省略をしない)。
   c. スキルの Verification 結果を `run_manifest.steps[].result` に記録する
      (`pass / fail / unknown / not_applicable`)。
   d. **停止条件の判定**(→ Decision Rules)。停止する場合は `stop_reason` を記録する。
   e. 中間成果物のパスを `run_manifest.artifacts` に追記し、次工程の入力として渡す。
3. 実行範囲の完了(または停止)後、`review_report` を作成する:
   - 何をどこまで実行したか / 商品ごとの同定状況・ソース数・未確認軸・矛盾数
   - 検証結果の一覧(**fail / unknown を隠さない**)
   - ユーザー判断が必要な事項(README の Open Decisions への参照を含む)
   - 推奨される次の作業(実行はしない)
   - `publication_status: review_required` で終える(approved / published にしない)
4. 最終報告として `run_manifest` と `review_report` を提示する。

## Source Priority

本スキルは情報源を直接扱わない。`shared/references/source-policy.md` を正本として
参照するのみで、優先順位の再定義をしない。

## Evidence Classification

本スキルは claim を作成・変更しない。分類は `terminology.md` §2 を正本とする。

## Decision Rules(停止条件)

次のいずれかに該当したら、後続工程へ進まず停止して報告する:

1. 工程の Verification に `fail` が残った(修正されるまで次工程の入力にしない)
2. `product_identity.identification_status` が `unidentified` のまま
   (同定できない商品を正規化・ランキングへ進めない)
3. 次工程の Required Inputs が揃わない
4. ユーザー判断が必要な Open Decision に依存する分岐に到達した
   (例: 色違いの分割単位が結果を左右する場合)
5. 現段階の禁止事項(未承認の実在商品の順位決定・スクレイピング実行・DB接続等)に
   踏み込まないと先へ進めない場合
6. 第三者媒体の監査がない、operationが`prohibited/not_adopted`、または必要な法務・人間レビューが未完了の場合

`unknown` が残る場合: 停止はしないが、`review_report.validation_summary` に
「何が揃えば判定できるか」を必ず記載する。

## Failure Handling

- 工程が途中失敗: `run_manifest.steps[].result: fail` + `stop_reason` を記録し、
  完了済み工程の成果物は破棄せず保持する(再開可能な状態を保つ)。
- 再開時: 新しい `run_id` を採番せず既存 `run_manifest` を更新するか、
  参照付きの新規 run にするかを報告で明示する(黙って上書きしない)。
- 成果物の欠落を発見: 該当工程を fail として扱い、担当スキルへ差し戻す。

## Avoid / Prohibited

- 調査ルール・正規化ロジック・スコア式・重みの再定義・再実装・上書き
- 3スキルの手順の代行(「まとめて自分でやる」ことによる責務の混在)
- DB書き込み・Supabase接続・migration・サイト本体の変更・`products.rank_no` の変更
- 自動公開・`publication_status` を `approved` / `published` へ進めること
- fail / unknown を報告から省くこと
- 未承認の実在商品のランキング決定
- `agent-skills/irodori/` 配下以外のファイル変更

## Output Format

`data-contracts.md` の契約に従う:

1. `run_manifest`(実行ID・工程結果・使用した設定版・成果物一覧・停止理由)
2. `review_report`(publication_status: review_required)
3. 実行サマリ(人間向け): 完了した工程 / 停止した場合はどこで・なぜ /
   ユーザーに確認したいこと(箇条書き)

## Verification

各項目を `pass / fail / unknown / not_applicable` で報告する:

- [ ] `run_manifest` に全実行工程が `result` 付きで記録されている
- [ ] 使用した契約版・定義版(`config_refs`)が記録されている
- [ ] 各工程の成果物パスが `artifacts` に列挙され、実在する
- [ ] fail のある工程の後続が実行されていない
- [ ] `review_report` に fail / unknown がすべて記載されている
- [ ] `review_report.publication_status` が `review_required` である
- [ ] 本スキル自身が調査・正規化・採点のロジックを新設していない
- [ ] 第三者媒体を使った工程が対応監査ID・運用判断・法務/人間レビュー状態を記録している

## Completion Criteria

- 依頼された実行範囲について、全工程が「pass で完了」または「停止条件+理由の記録付きで停止」の
  いずれかになっている
- `run_manifest` と `review_report` が契約に準拠して存在する
- Verification の全項目が `pass`(または理由付き `not_applicable`)

## Related Skills

- 工程1: `irodori-product-research`
- 工程2: `irodori-product-evidence-normalizer`
- 工程3: `irodori-ranking-engine`

## References

- `../README.md`(全体像・Open Decisions — 停止条件の参照先)
- `../shared/references/data-contracts.md`(run_manifest / review_report 契約 — 正本)
- `../shared/references/status-model.md`(validation_result / publication_status — 正本)
- `../shared/references/terminology.md`(用語)
