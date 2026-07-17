---
name: irodori-ranking-engine
description: IRODORI独自の総合・シーン別ランキング定義と入力を作成し、検証済み入力を決定論的TypeScript処理でpartial observed score・criterion/parent/weighted coverage・score表示可否・ranking可否・confidence・同点・感度分析へ変換するSkill。ランキング基準、proposed coverage profile、除外/評価保留条件、架空fixtureによる再現性検証を頼まれたら使う。AIによる自由順位、Web調査、出典取得、products.rank_noへの書き込み、公開処理はしない。
---

# irodori-ranking-engine — ランキング定義・入力整備

## Purpose

`normalized_feature` / `review_theme_summary` を入力として、再現可能なランキングの
**仕様**(`ranking_definition`)と**入力スナップショット**(`ranking_input`)を整備し、
`scripts/ranking-engine.ts` の決定論的処理で `ranking_result` を生成・検証する。
AIは設定候補を提案できるが、得点・順位・充足率・confidence・同点・感度分析を代行しない。

## Use When

- 総合・シーン別ランキングの基準(重み・必須項目・足切り・同点規則)を設計するとき
- ランキング入力(候補・除外・評価保留)のスナップショットを作るとき
- 決定論的処理が出した `ranking_result` に対し、契約準拠・説明可能性を点検するとき
- `irodori-product-intelligence` からランキング工程として呼ばれたとき

## Do Not Use When

- Web調査・口コミ本文の要約・出典の新規取得 → `irodori-product-research` / normalizer
- 正規化(単位変換・軸分類) → `irodori-product-evidence-normalizer`
- **未承認の実在商品の順位決定そのもの**。承認後も順位はAIではなくcalcが算出する
- サイトへの公開・`products.rank_no` の変更(全段階で本スキルの責務外)

## Required Inputs

1. `ranking_definition` の対象(カテゴリ、scope: overall / scene、scene_tag)
2. `normalized_feature` / `review_theme_summary`(ranking_input を作る場合)
3. `run_id`

## Optional Inputs

- 既存の `ranking_definition`(改訂の場合。`definition_version` を上げる)
- ユーザーが確定した設定値(あれば `value_status: confirmed` にできる)
- 既存の `calc_version`(再現実行の場合)

## Workflow

1. `shared/references/ranking-principles.md`・`status-model.md`・`data-contracts.md` と
   `../shared/contracts/` の型・バリデーターを読む。coverage設計・採点可否・表示可否・ranking可否を
   扱う場合は`references/coverage-contract.md`と`config/coverage-*.proposed.json`も読む。
2. **定義の作成/改訂**(`ranking_definition`):
   - 軸の重み・必須軸・最低充足率・失格条件・同点規則・感度分析幅を、
     すべて `value_status: proposed | confirmed` 付きで記述する。
   - ユーザーが明示的に確定した値のみ `confirmed` にする。**勝手に確定しない。**
   - confidence 式は第2段階の試験式 `confidence-proposed-v1` を `proposed` として使う。
     confidenceをscoreへ加算しない。
   - criterion、parent-axis、weighted coverageの閾値、represented parent数、critical_axes、
     必須criterion、必須/非必須/重要事項別の矛盾方針をすべてproposed設定として外出しする。
3. **入力の整備**(`ranking_input`):
   - 候補商品を列挙し、失格条件(例: 現行品でない)に該当するものを
     `excluded` + 理由へ分離する。
   - 各候補の `feature_refs` / `review_refs` を確定し、スナップショット日を記録する。
   - `data_coverage` の数値は入れない(決定論的処理が計算する。手前では null)。
4. **決定論的計算**:
   - `shared/contracts/validators.ts` で契約と参照整合性を検証する。
   - `scripts/ranking-engine.ts` を使い、入力順に依存しない `ranking_result` を生成する。
   - coverage profileはscore計算を書き換えず、score表示・ranking可否だけを制御する。
   - 実在商品のcoverage分析では`partial_observed_score`だけを内部保持し、確定total score・順位を生成しない。
     通常のranking result計算はidentityと調査契約が人間確認されるまで架空fixtureだけを使う。
5. **結果の点検**:
   - 契約準拠(必須フィールド・参照の実在)を確認する。
   - 各エントリが出典まで遡れるか(`per_axis_breakdown` → nf → claim → source)を確認する。
   - `reason_text` / `strengths` / `cautions` / `unconfirmed_axes` の欠落を指摘する。
   - proposed 設定のみで作られた結果が `draft` を超えていないことを確認する。
6. **成果物の出力と自己検証**(→ Verification)。

## Source Priority

本スキルは情報源を直接扱わない。入力は正規化済みデータのみとし、
生の記事・生の口コミ・他媒体の順位を入力に加えない(→ `ranking-principles.md` §1)。

## Evidence Classification

`normalized_feature.fact_or_inference` を尊重する。`inference` 由来の軸を使う定義は、
その旨を `ranking_definition.notes` に明示する。`evidence_status: conflicting / outdated` の
値の扱い(除外するか・保留にするか)は定義側の設定として明記する(既定案: 除外 [P])。

## Decision Rules

- `partial_observed_score` / criterion coverage / parent-axis coverage / weighted coverage /
  score表示可否 / ranking可否 / `confidence`を分離する。未確認軸は0点にせず計算から除外し、
  評価済み軸の重みで正規化する(仕様として定義に明記する)。
- 1 criterionだけの再正規化値をtotal quality scoreとして表示しない。親軸の最低評価幅をproposed設定で持ち、
  1 criterion親軸を十分評価済みへ自動昇格しない。
- いずれかのcoverageが最低充足率未満の商品は `on_hold`(評価保留)へ分離する。
  下位に置かない。最低充足率の値は未確定のため `proposed` で提案する。
- 同点処理・感度分析幅は候補を列挙し `proposed` とする(確定は Open Decision #10, #11)。
- 商業条件(アフィリエイト報酬率・広告金額・在庫・販売店都合)を定義のどの項目にも
  入れない。`commercial_relation` は独立性メタデータとして結果の注記にのみ使える。
- `external_rank_metadata`、review sentiment/件数、楽天rank/review値、affiliate rate、
  `market_demand_signal` は説明・調査優先順位用であり、品質scoreの入力にしない。
- 情報量の多い商品が有利にならないよう、軸ごとの加点上限を定義で固定する。

## Failure Handling

- 入力の `normalized_feature` が契約違反: 処理せず normalizer へ差し戻す(fail 一覧付き)。
- 必須軸が全候補で unconfirmed: ランキング成立不可として停止し、
  どの軸のデータがあれば成立するかを報告する。
- `calc_version` が入力定義と実装で一致しない: `ranking_result` を生成せずfailとして停止する。

## Avoid / Prohibited

- AIによる自由な順位決定・「総合的に判断して◯位」という出力
- 未承認の実在商品のランキング決定
- 未確認項目の0点化
- 他媒体順位の平均・合算・換算、掲載回数だけの加点、尺度の違う星の単純合算
- 商業条件のスコア反映
- 重み等のハードコード(必ず `ranking_definition` に外出しし `value_status` を付ける)
- proposed 設定のみで作られた結果を `draft` より先の `publication_status` へ進めること
- `products.rank_no` への書き込み、公開処理、DB書き込み
- `agent-skills/irodori/` 配下以外のファイル変更

## Output Format

`data-contracts.md` の契約に従う:

1. `ranking_definition`(全設定値に `value_status` 付き)
2. `ranking_input`(候補・除外・スナップショット日付き)
3. 架空fixtureまたは承認済み入力の場合のみ `ranking_result`
4. `ranking_result` に対する点検報告(validation_result の一覧)
5. 定義サマリ: proposed のまま残る設定の一覧(=ユーザー確定待ち一覧) /
   除外・保留条件の一覧 / 説明可能性チェックの結果

## Verification

リポジトリルートから次を実行する(追加パッケージ不要):

```powershell
& '.\node_modules\.bin\tsc.cmd' -p 'agent-skills\irodori\tsconfig.json' --pretty false
node --no-warnings --experimental-strip-types --test --test-isolation=none 'agent-skills/irodori/irodori-ranking-engine/tests/ranking-engine.test.mjs' 'agent-skills/irodori/irodori-ranking-engine/tests/external-source-policy.test.mjs'
node --no-warnings --experimental-strip-types --test --test-isolation=none 'agent-skills/irodori/irodori-ranking-engine/tests/coverage-contract.test.mjs'
node --no-warnings --experimental-strip-types 'agent-skills/irodori/irodori-ranking-engine/scripts/validate-coverage-contract.mjs'
```

各項目を `pass / fail / unknown / not_applicable` で報告する:

- [ ] `ranking_definition` の全設定値に `value_status` がある
- [ ] ユーザーの明示確認なしに `confirmed` にした値がない
- [ ] 定義に商業条件由来の項目が含まれていない
- [ ] 定義に他媒体の順位・星・点数を参照する項目が含まれていない
- [ ] review件数/sentiment・楽天rank/review値・affiliate rate・需要シグナルが品質scoreへ接続されていない
- [ ] 未確認軸の扱いが「計算から除外+評価済み軸で正規化」と明記されている
- [ ] observed_score・2種のcoverage・confidenceが別々に出力され、SHA-256入力hashが残る
- [ ] `on_hold`(充足率不足)と `excluded`(失格)が区別されている
- [ ] criterion / parent-axis / weighted coverageが別々に計算される
- [ ] partial observed score / total quality score / score表示可否 / ranking可否が分離される
- [ ] unknown / conflict / ineligible / not-comparable / analysis errorが0点へ変換されない
- [ ] proposed profile変更がscore自体を書き換えない
- [ ] `ranking_input.candidates` の全参照ID(nf / rts)が実在する
- [ ] 出力に未承認の実在商品の順位・得点が含まれていない

## Completion Criteria

- `ranking_definition` と(依頼された場合)`ranking_input` が契約に準拠して存在する
- proposed 設定の一覧が「ユーザー確定待ち」として明示されている
- Verification の全項目が `pass`(または理由付き `not_applicable`)
- fail が残る場合は完了とせず、修正または blocker を報告して停止する

## Related Skills

- 前工程: `irodori-product-evidence-normalizer`(入力の作成者)
- 統括: `irodori-product-intelligence`
- 決定論的処理: `scripts/ranking-engine.ts`

## References

- `../shared/references/ranking-principles.md`(ランキング原則 — 正本)
- `../shared/references/status-model.md`(publication_status の制約 — 正本)
- `../shared/references/data-contracts.md`(ranking_definition / input / result 契約 — 正本)
- `../shared/references/terminology.md`(observed_score / 2種のcoverage / confidence の定義)
- `../shared/references/source-policy.md` §4(他媒体順位の禁止則)
- `../shared/contracts/types.ts`(機械処理用TypeScript型)
- `../shared/contracts/validators.ts`(実行時検証)
- `references/coverage-contract.md`(proposed coverage契約とstate model)
- `contracts/coverage-contract.schema.json`(将来DB設計用の機械可読契約。migrationではない)
- `config/coverage-contract.proposed.json` / `config/coverage-profiles.proposed.json`(分析用設定)
- `scripts/coverage-contract.ts` / `scripts/validate-coverage-contract.mjs`(決定論的計算とvalidator)
- `scripts/ranking-engine.ts`(決定論的計算)
- `fixtures/fictional-train-commute.ts`(架空fixtureとproposed定義)
- `fixtures/fictional-external-sources.ts`(第三者媒体・楽天需要シグナルの架空fixture)
