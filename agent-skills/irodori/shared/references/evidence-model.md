# evidence-model — source_record / evidence_claim の概念モデル(正本)

区分ラベル: **[C] = Confirmed Principle / [P] = Proposed Default / [O] = Open Decision / [U] = Unverified**
フィールドの完全な定義とJSON例は `data-contracts.md` を正本とする(本ファイルは概念の説明)。

## 1. 2層構造 [C]

```text
source_record(情報源: どこから得たか)
   1 ─── n
evidence_claim(主張: そこに何が書いてあったか)
   n ─── 1
normalized_feature(正規化値: 商品×評価軸ごとの確定値)
```

- `source_record` は情報源1つ(1ページ・1PDF)につき1レコード。
- `evidence_claim` は「1つの仕様・1つの測定値・1つの評価・1つの口コミ傾向」につき1レコード。
  **1つの source_record から複数の evidence_claim を作れる**(例: 1記事から
  重量の実測値、段差評価、折りたたみ評価の3クレームを別々に作る)。
- `normalized_feature` は商品×評価軸ごとに1レコードで、複数の evidence_claim を
  `supporting_claims` として参照する。

## 2. 事実と推論の分離 [C]

- 確認済み事実と推論を同じフィールドに入れない。
- `evidence_claim.claim_class` で性質を分類し(→ `terminology.md` §2)、さらに
  `fact_or_inference: fact | inference` を明示する。
- `irodori_inference`(IRODORIによる導出。例: 重量と折りたたみサイズから
  「電車移動に向く可能性」を導く)は必ず `inference` とし、導出元の claim ID を
  `derived_from` に列挙する。導出元のない inference は作らない。

## 3. 測定条件の記録 [C]

- 実測値(`third_party_measured`)には測定条件(`measurement_condition`)を記録する。
  例: 「編集部が段差2cmで試験」「体重計で計測、カゴ含む」。
- 条件が書かれていない実測値は、条件不明として記録する(条件を推測で補わない)。

## 4. 矛盾の扱い [C]

- 同じ商品・同じ属性について値が食い違う claim が複数ある場合:
  1. どちらも残す(黙って片方を捨てない)。
  2. 双方の `evidence_status` を `conflicting` にし、`conflict_with` で相互参照する。
  3. 採用判断は `source-policy.md` §2 の優先順位に従い、判断理由を記録する。
  4. 優先順位で解決できない場合は「矛盾のまま」とし、normalized_feature の
     `evidence_status` も `conflicting` にする(比較表では「情報が割れている」と表示できる状態)。

## 5. 重複・転載の扱い [C](原則) / [P](検出方法)

- 同一の元データ(メーカー公表値の転載、記事の再掲載)を複数媒体が載せている場合、
  独立した証拠として重複カウントしない。
- 検出方法の初期案 [P]: 数値・文言の完全一致 + 出典明記の有無から転載候補を検出し、
  `duplicate_of`(claim間参照)を付ける。**AIは「候補の提示」まで**。確定は人間または
  決定論的ルールが行う(→ `ranking-principles.md` §3)。
- 転載候補が確定したら、supporting_claims では代表1件のみを独立証拠として数える。

## 6. 鮮度の扱い [C](原則) / [O](基準値)

- `source_record` の公開日・更新日と、モデル年の関係から、旧情報を `outdated` と
  マークできる構造にする。
- 何日/何年で outdated とするかの基準は未確定(Open Decision。カテゴリ・属性により
  異なる可能性があるため、`ranking_definition` 側で設定可能にする)。

## 7. 口コミの扱い [C]

- 口コミは個別本文を保存せず、テーマ別の傾向(`review_theme_summary`)として集約する。
  sentiment、観測件数、重複除外後件数、sample size、制約、人間レビュー、引用/PII有無を分ける。
- 件数不明は `observed_item_count: null` / `deduplicated_item_count: null` /
  `sample_size_status: unknown` とし、0件へ変換しない。
- `ranking_score_impact` は現段階で必ず`none`。sentimentや件数を品質scoreへ接続しない。
- 件数根拠なし、または`known_small`で「多くの口コミ」等の一般化表現を使わない。
- 個人を特定できる情報(投稿者名・ID・顔写真への言及等)を保存しない
  (→ `copyright-and-acquisition-policy.md`)。
- 第三者媒体の要約は参照sourceの `source_usage_audit_id`、capture/quote/PII方針、
  人間レビュー要否を検証してから成果物に含める。

## 8. 市場需要シグナル [C]

- 楽天rank・review_count・review_averageは商品品質の証拠ではなく、
  `rakuten_ranking_snapshot`の市場需要メタデータとして保持する。
- 楽天店舗listing(`rakuten_item_code` + `shop_code`)とIRODORI商品モデルを分離し、
  商品名だけ・shopだけ・順位だけでidentityをconfirmedにしない。
- 公式daily/weekly、公式API realtime、IRODORI 7日派生集計の出所と期間を分離する。
- TTLを超えた価格・availability・metadataをcurrentとして表示・公開しない。
