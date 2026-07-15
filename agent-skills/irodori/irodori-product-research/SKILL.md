---
name: irodori-product-research
description: IRODORI(iLy.)の育児用品について、商品同定・調査計画・情報源の登録を行うSkill。メーカー公式/取扱説明書/マイベスト/価格.com/たまひよ/第三者レビュー/購入者口コミ等を、出典へ戻れるsource_recordとして整理する。商品調査・スペック確認・レビュー収集・新旧モデル判別を頼まれたら使う。得点計算・順位決定・正規化・DB書き込みはしない。
---

# irodori-product-research — 商品調査・情報源登録

## Purpose

対象商品を同定し、一次情報(公式・取説)と二次情報(メディア・口コミ)を
`source_record` と `evidence_claim`(下書き)として、出典へ戻れる形で登録する。
確認できない事実を補完せず、未確認・取得不能を明示的に記録する。

## Use When

- 商品(または候補リスト)の調査・情報収集を依頼されたとき
- 正式商品名・型番・モデル年・現行/旧の確認(商品同定)を依頼されたとき
- 既存 `source_record` の鮮度更新・追加調査を依頼されたとき
- `irodori-product-intelligence` から調査工程として呼ばれたとき

## Do Not Use When

- 単位変換・評価軸への正規化 → `irodori-product-evidence-normalizer`
- ランキング定義・得点・順位 → `irodori-ranking-engine`
- サイト実装・UI・Supabase操作(このスキル群の対象外)
- 実在商品のランキング決定(identity・調査契約・設定値が人間確認されるまで全スキルで禁止)

## Required Inputs

1. 対象カテゴリ(例: ベビーカー)
2. 対象商品名(暫定表記でよい)または候補選定条件
3. 調査対象媒体のリスト、時間窓、媒体ごとの件数上限
4. `run_id`(intelligence 経由の場合。単独実行なら自分で採番し報告に含める)

Required Inputs が欠けている場合は調査を開始せず、不足項目を列挙して確認する。

## Optional Inputs

- 対象モデル年・市場(指定がなければ同定工程で確定を試みる)
- 既存の `product_identity` / `source_record`(更新調査の場合)
- 既存サイトの `products.id`(`site_product_id` として対応付けのみ。書き込みはしない)

## Workflow

1. `shared/references/` の `product-identity-rules.md`・`source-policy.md`・
   `copyright-and-acquisition-policy.md`・`data-contracts.md` を読む。
2. **商品同定**: メーカー公式で正式商品名・型番・発売時期・現行/旧を確認し、
   `product_identity` を作成する(`product-identity-rules.md` §3 の手順)。
   確定できない要素は `unconfirmed_fields` に列挙する。
3. **調査計画の宣言**: 対象媒体・時間窓・件数上限・情報源の優先順位を成果物冒頭に記す。
4. **一次情報の登録**: 公式製品ページ・仕様表・取扱説明書・安全情報・公式ニュースを
   `source_record` 化し、仕様値を `evidence_claim`(下書き。`value_normalized` は null)
   として抽出する。
5. **二次情報の登録**: 計画で宣言した媒体を調査し、1情報源=1 `source_record` で登録する。
   - 全レコードで型番・商品名照合を行い `match_status` を付ける。
   - 他媒体の順位・星は `external_rank_metadata` にのみ記録する(得点化しない)。
   - 商業的関係(`commercial_relation`)を必ず判定・記録する。
   - 抽出は「1仕様・1測定値・1評価・1口コミ傾向 = 1 claim」で分割する。
6. **取得不能の記録**: 取得できなかった情報源も `acquisition_status: failed / skipped` +
   理由付きで残す。
7. **矛盾候補の提示**: 同じ属性で値が食い違う claim に `conflict_with` を付け、
   一覧として報告する(採用判断はしない。それは normalizer 以降)。
8. **成果物の出力と自己検証**(→ Verification)。

## Source Priority

`shared/references/source-policy.md` §2 を正本とする(このSKILL.mdでは再定義しない)。
要点のみ: 公式仕様 > 取説 > 第三者実測 > 編集部評価 > 口コミ > 体験談 > 宣伝表現。
上位が存在する属性を下位からの推定で埋めない。

## Evidence Classification

`shared/references/terminology.md` §2(claim_class)と `source-policy.md` §1(source_type)を
正本とする。このスキルの段階では `fact_or_inference: inference` の claim を**作らない**
(推論の生成は normalizer 以降の `irodori_inference` に限る)。

## Decision Rules

- 商品を確定できない情報源は `match_status: unmatched` とし、現行商品の evidence に使わない。
- 記事公開日がモデル発売時期より古い場合は旧モデルの可能性を検討し、判断根拠を notes に書く。
- 日付の種類(公開日か更新日か)が判定できない場合、公開日として扱わず `date_kind_note` に記録する。
- URLが確認できない情報は `source_record` を作らない(=成果物に含めない)。

## Failure Handling

- 媒体にアクセスできない: `acquisition_status: failed` + 理由。代替媒体は計画を更新してから使う。
- 商品同定が公式情報で完了できない: `identification_status: provisional` のまま停止し、
  何が確認できれば `identified` になるかを報告する(推測で確定しない)。
- 時間窓内に情報源がほぼ無い: 件数と探索した媒体を報告し、時間窓拡大の判断をユーザーに返す。

## Avoid / Prohibited

- 確認できない値の推測・補完(未確認は `unconfirmed` として残す)
- 出典URLのないレコードの作成
- 原文の長文転載・比較表/画像の複製・口コミ本文の大量保存・個人特定情報の保存
  (→ `copyright-and-acquisition-policy.md`)
- 他媒体順位の得点化・換算(参考メタデータ保存のみ可)
- Webスクレイピングの実行・外部取得サービスへの接続(第2段階のローカル試作)
- 得点計算・順位決定・DB書き込み・サイト公開・`products.rank_no` の変更
- `agent-skills/irodori/` 配下以外のファイル変更

## Output Format

`data-contracts.md` の契約に従う JSON(または同構造のYAML/Markdown表):

1. `product_identity`(対象商品ごと)
2. `source_record` の配列
3. `evidence_claim`(下書き)の配列
4. 調査サマリ: 対象商品 / 確定した同定要素と未確認要素 / 媒体別レコード数 /
   時間窓 / 取得不能一覧(理由付き) / 矛盾候補一覧 / 未確認事項一覧

## Verification

成果物に対し次を確認し、各項目を `pass / fail / unknown / not_applicable` で報告する:

- [ ] 全 `source_record` に `url`・`media_name`・`accessed_date` がある
- [ ] 全 `source_record` に `match_status`・`source_type`・`commercial_relation` がある
- [ ] `failed / skipped` に `acquisition_failure_reason` がある
- [ ] 全 `evidence_claim` が1つの `source_record_id` を参照している
- [ ] `fact_or_inference: inference` の claim が存在しない(このスキルでは禁止)
- [ ] `product_identity.unconfirmed_fields` が実態と一致している
- [ ] 原文の長文転載・個人特定情報が含まれていない

## Completion Criteria

- Required Inputs で宣言した媒体・時間窓の調査が完了し、対象内の全情報源が
  `acquired / partial / failed / skipped` のいずれかで記録されている
- Verification の全項目が `pass`(または理由付き `not_applicable`)である
- 調査サマリに未確認事項・矛盾候補・取得不能が漏れなく列挙されている
- fail が残る場合は完了とせず、修正または blocker を報告して停止する

## Related Skills

- 次工程: `irodori-product-evidence-normalizer`(本スキルの出力が入力になる)
- 統括: `irodori-product-intelligence`
- 本スキルは順位・スコアに関与しない: `irodori-ranking-engine` の責務を代行しない

## References

- `../shared/references/product-identity-rules.md`(商品同定 — 正本)
- `../shared/references/source-policy.md`(情報源分類・優先順位 — 正本)
- `../shared/references/evidence-model.md`(source/claim の概念)
- `../shared/references/status-model.md`(状態の使い分け)
- `../shared/references/copyright-and-acquisition-policy.md`(保存・取得の制限)
- `../shared/references/data-contracts.md`(出力契約 — 正本)
- `../shared/references/terminology.md`(用語)
