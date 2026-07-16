---
name: irodori-product-evidence-normalizer
description: irodori-product-researchが登録したsource_record/evidence_claimを、IRODORI共通の評価軸へ正規化するSkill。単位・表記の統一、evidence_claimの確定、normalized_feature/review_theme_summaryの作成、重複・転載候補の検出、矛盾状態の記録、事実とIRODORI推論の分離を行う。証拠の正規化・比較項目への変換・口コミ傾向の整理を頼まれたら使う。順位決定・自由採点・新規のWeb調査はしない。
---

# irodori-product-evidence-normalizer — 証拠の正規化

## Purpose

調査済みの証拠(`source_record` / `evidence_claim` 下書き)を、単位・表記・評価軸を
統一した `normalized_feature` と `review_theme_summary` へ変換する。
事実とIRODORI推論を分離し、矛盾・重複・旧モデル混入を検出可能な状態にする。

## Use When

- `irodori-product-research` の出力を比較・ランキングに使える形へ変換するとき
- 口コミの肯定・否定・中立の傾向整理を依頼されたとき
- 既存 claim 群の矛盾確認・重複(転載)候補検出を依頼されたとき
- `irodori-product-intelligence` から正規化工程として呼ばれたとき

## Do Not Use When

- 情報源の新規取得・Web調査 → `irodori-product-research`(このスキルは新規取得をしない)
- ランキング定義・得点・順位・充足率の計算 → `irodori-ranking-engine`
- 出典のない情報の正規化(入力契約違反として差し戻す)

## Required Inputs

1. `product_identity`(`identification_status: identified` または `provisional`)
2. `source_record` の配列
3. `evidence_claim`(下書き)の配列
4. 評価軸定義(`terminology.md` §5 の axis 一覧。カテゴリ拡張がある場合はその版)

入力が契約(`data-contracts.md`)を満たさない場合は処理せず、違反箇所を列挙して差し戻す。

## Optional Inputs

- 表現正規化辞書(存在する場合。無い場合は辞書追加候補を出力に含める)
- 既存の `normalized_feature` / `review_theme_summary`(更新の場合)

## Workflow

1. `shared/references/` の `evidence-model.md`・`terminology.md`・`status-model.md`・
   `copyright-and-acquisition-policy.md`・`data-contracts.md` を読む。
2. **入力検証**: 入力が契約に沿うか確認する(URL必須・claim→source参照など)。
   違反は `validation_result: fail` として差し戻す。
3. **claim の確定**: 下書き claim ごとに
   - `axis_id` への分類(分類できないものは `claim_kind: other` のまま残す。無理に押し込まない)
   - 単位・表記の正規化(`value_normalized` / `unit`。適用した変換を `normalization_notes` に記録)
   - `claim_class` と `fact_or_inference` の確認
4. **分離**: 旧モデル・海外仕様・別商品(`match_status: unmatched` / `probable` で型番不一致)由来の
   claim を現行商品の集約から除外し、除外一覧を出力する。
5. **重複・転載候補の検出**: 同一値・同一文言の claim に `duplicate_candidate_of` を付ける。
   **候補の提示まで**(確定は決定論的処理または人間 → `ranking-principles.md` §3)。
6. **矛盾の記録**: 同一商品×同一軸で値が食い違う claim を相互に `conflicting` +
   `conflict_with` とし、`source-policy.md` §2 の優先順位で採用案と理由を付ける。
   解決できないものは矛盾のまま残す。
7. **normalized_feature の作成**: 商品×軸ごとに作成する。
   - 値がある軸の `supporting_claims` は転載確定分を除いた独立ソースで構成する
   - 値が確認できない軸は `value: null` + `evidence_status: unconfirmed`
     + `supporting_claims: []` + `independent_source_count: 0`
     (**軸レコード自体を黙って省略しない**。unconfirmed の明示が目的)
   - 矛盾により値を確定できない軸は `value: null` + `evidence_status: conflicting` とし、
     相反claimへの参照を残す。旧`included_items`は`included_accessories`へ正規化する
   - シーン適性などの導出値は `fact_or_inference: inference` +
     `irodori_inference` claim(`derived_from` 必須)を経由して作る
8. **review_theme_summary の作成**: 口コミ系 claim をテーマ別に集約し、
   sentiment、観測/重複除外後件数、sample size、短い要約、制約を分離する。
   件数不明はnull+unknownとし、PII/引用/人間レビューを検証する。
   `ranking_score_impact` は必ず`none`とする(詳細は`evidence-model.md` §7)。
9. **成果物の出力と自己検証**(→ Verification)。

## Source Priority

`shared/references/source-policy.md` §2 を正本とする。矛盾時の採用案はこの優先順位に
従って**提案**し、優先順位で決まらない場合は `conflicting` のまま残す(独自基準を作らない)。

## Evidence Classification

`terminology.md` §2 を正本とする。このスキルで新たに作れる claim は
`irodori_inference`(`fact_or_inference: inference`、`derived_from` 必須)のみ。
既存 claim の `claim_class` を出典確認なしに変更しない。

## Decision Rules

- 未確認は0点でも低評価でもない: `unconfirmed` を維持し、値を埋めない。
- 矛盾は未確認へ格下げせず、`conflicting`のままランキング参加判定へ渡す。
- ordinal(評価傾向)への変換は、辞書にある表現のみ機械的に対応付ける。
  辞書にない表現は「その他所見」として text のまま保持し、辞書追加候補として報告する。
- 数値の単位換算は換算式を `normalization_notes` に残す(例: g→kg)。
  換算に仮定が必要な場合(税込/税別不明など)は換算せず `unconfirmed` とする。
- 観測件数(sentiment counts)は見えた範囲の事実として記録し、母数の推定をしない。

## Failure Handling

- 入力契約違反: 処理せず fail 一覧を返す(部分的に処理してよいのは違反レコードと
  独立な商品単位のみ。その場合も違反を報告する)。
- 軸定義に存在しない重要属性を発見: 勝手に軸を追加せず、「新軸候補」として
  報告に含める(軸の追加は `terminology.md` の版管理に従う)。
- 出典に戻れない claim を発見: 正規化に使わず、fail として research へ差し戻す。

## Avoid / Prohibited

- 最終順位の決定・順位への言及(「この商品が1位相当」等)
- 自由判断による数値採点(ordinalへの変換は辞書ベースのみ)
- 未確認項目の0点化・補完・平均値埋め
- 原文の大量保存・口コミ本文の転記・個人特定情報の保持(→ `copyright-and-acquisition-policy.md`)
- 新規のWeb調査・情報源の追加取得(必要なら research への差し戻しとして報告)
- 他媒体の点数・順位のIRODORI点への変換
- DB書き込み・サイト変更・`agent-skills/irodori/` 配下以外のファイル変更

## Output Format

`data-contracts.md` の契約に従う:

1. 確定済み `evidence_claim` の配列(正規化値・矛盾・転載候補付き)
2. `normalized_feature` の配列(unconfirmed 軸を含む全軸)
3. `review_theme_summary` の配列
4. 正規化サマリ: 商品ごとの軸充足状況(確認済み軸数/全軸数) / 矛盾一覧(採用案+理由) /
   転載候補一覧 / 除外した claim 一覧(旧モデル等・理由付き) / 辞書追加候補 / 新軸候補

## Verification

各項目を `pass / fail / unknown / not_applicable` で報告する:

- [ ] 値がある全 `normalized_feature` の `supporting_claims` が1件以上で、全参照IDが実在する
- [ ] `value: null` の nf は `supporting_claims: []` / `independent_source_count: 0` である
- [ ] `value: null` の nf がすべて `evidence_status: unconfirmed` になっている
- [ ] `inference` の nf / claim がすべて `derived_from` を持つ
- [ ] `conflicting` の claim がすべて `conflict_with` で相互参照されている
- [ ] 数値系 nf に `unit` があり、`normalization_notes` に換算記録がある
- [ ] `review_theme_summary` がすべてPIIなし・対応source参照あり・人間レビュー条件充足である
- [ ] 件数不明がnull+unknownで、根拠のない一般化表現がなく、`ranking_score_impact: none`である
- [ ] 除外 claim(旧モデル・別商品)が現行商品の nf に混入していない
- [ ] 出力に順位・総合点に相当する値が含まれていない

## Completion Criteria

- 入力された全 claim が「確定 / 除外(理由付き) / 差し戻し(理由付き)」のいずれかに分類されている
- 対象商品×全評価軸の `normalized_feature` が存在する(unconfirmed を含む)
- Verification の全項目が `pass`(または理由付き `not_applicable`)
- fail が残る場合は完了とせず、修正または差し戻しを報告して停止する

## Related Skills

- 前工程: `irodori-product-research`(入力の作成者)
- 次工程: `irodori-ranking-engine`(本スキルの出力が入力になる)
- 統括: `irodori-product-intelligence`

## References

- `../shared/references/evidence-model.md`(概念モデル — 正本)
- `../shared/references/terminology.md`(評価軸・claim_class — 正本)
- `../shared/references/status-model.md`(状態の使い分け — 正本)
- `../shared/references/source-policy.md`(優先順位)
- `../shared/references/copyright-and-acquisition-policy.md`(保存の制限)
- `../shared/references/data-contracts.md`(入出力契約 — 正本)
