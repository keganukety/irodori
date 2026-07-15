# source-policy — 情報源の分類・優先順位・商業的関係(正本)

区分ラベル: **[C] = Confirmed Principle / [P] = Proposed Default / [O] = Open Decision / [U] = Unverified**

## 1. 情報源種別(source_type)の分類 [C](体系) / [P](値の名称)

| source_type | 例 | 一次/二次の既定値 |
|---|---|---|
| `official_product_page` | メーカー公式の製品ページ | primary |
| `official_spec_sheet` | 公式仕様表・カタログ | primary |
| `official_manual` | 取扱説明書・安全情報PDF | primary |
| `official_news` | 公式ニュースリリース(発売日・リニューアル情報) | primary |
| `editorial_test_media` | 実測テストを行う編集部メディア(例: マイベスト) | secondary |
| `aggregate_review_site` | 口コミ・価格集約サイト(例: 価格.com) | secondary |
| `parenting_media` | 育児メディア(例: たまひよ) | secondary |
| `independent_review` | 国内外の独立レビュー記事・動画 | secondary |
| `buyer_review` | 購入者口コミ(購入確認あり) | secondary |
| `user_testimonial` | 一般利用者の体験談(購入確認なし) | secondary |
| `retailer_page` | 販売店の商品ページ | secondary |
| `other` | 上記に当てはまらないもの(理由をnotesに書く) | secondary |

## 2. 証拠の優先順位 [C]

同じ属性について情報源が競合した場合の採用順位:

1. 公式仕様(`official_spec_sheet` / `official_product_page` の仕様欄)
2. 取扱説明書・安全情報(`official_manual`)
3. 第三者実測(測定条件が明記されているもの)
4. 編集部評価
5. 購入者口コミの傾向
6. 一般利用者の体験談
7. メーカーの宣伝表現(`manufacturer_claim` — 事実としては最下位。主張としてのみ記録)

適用ルール [C]:
- 上位が存在する属性で、下位からの推定で値を埋めない。
- 上位と下位が矛盾する場合、上位を採用しつつ矛盾を `conflicting` として記録する(黙って捨てない)。
- 主張の強さを証拠に比例させる。実測なしに「最軽量」等の断定をしない。

## 3. 商業的関係(commercial_relation) [C]

証拠の独立性を判断するためのメタデータ。**ランキング得点には反映しない**が、必ず記録する。

| 値 | 意味 |
|---|---|
| `none_declared` | 商業的関係の表示なし |
| `affiliate` | アフィリエイトリンクを含むページ |
| `sponsored` | 広告・タイアップ表記あり |
| `provided_sample` | 提供品によるレビューと明記 |
| `advertiser_relation` | 広告主関係が推定される(根拠をnotesに書く) |
| `self_published_by_maker` | メーカー自身の発信 |
| `unknown` | 判定できない |

## 4. 他媒体の順位・スコアの扱い [C]

- 他媒体のランキング順位・星評価・受賞ラベルは `source_record.external_rank_metadata` に
  **参考メタデータとして保持できる**。
- 禁止: 他媒体1位をIRODORI1位の根拠にする / 媒体順位の平均・合算 /
  他媒体の点数をIRODORI点へ無条件変換 / 掲載回数だけで加点 / 星の尺度が違う媒体の単純合算。
- 順位そのものではなく、その媒体が **なぜ** その評価をしたか(実測値・評価観点)を
  `evidence_claim` として抽出する。

## 5. 収集の範囲と上限 [C](原則) / [P](数値)

- 収集開始前に、対象媒体・時間窓・件数上限を宣言する(無限調査をしない)。
- Proposed Default: 公開日が古い情報は `outdated` 判定の候補とする。基準日数はカテゴリごとに未定 [O]。
- 記事の公開日・更新日と、IRODORIの調査日(accessed_date)を別フィールドで記録する。
  日付の種類が不明な場合は「どの日付か不明」と記録し、公開日として扱わない。

## 6. 取得状態と取得不能理由 [C]

| acquisition_status | 意味 |
|---|---|
| `acquired` | 取得できた |
| `partial` | 一部のみ取得(欠けた範囲をnotesに書く) |
| `failed` | 取得できなかった(`acquisition_failure_reason` 必須) |
| `skipped` | 方針により取得しない(理由必須。例: 規約未確認、ログイン必須) |

`acquisition_failure_reason` の例: ページ削除・ログイン必須・ペイウォール・地域制限・
規約上の懸念・技術的失敗。**取得できなかった事実も成果物に残す**(黙って落とさない)。

## 7. 取得手段について [C](本段階) / [U](外部サービス)

- 第2段階のローカル試作では、Webスクレイピングの実行・外部取得サービスへの接続を行わない。
- Apify・Firecrawl 等の外部サービスは必須依存にしない。公式性・ライセンス・安全性・更新状況は
  未確認(Unverified)であり、採否は Open Decision #18。
- 各媒体の利用規約・取得可否は Unverified。公開運用前に `copyright-and-acquisition-policy.md` の
  手続きに従い確認する。
