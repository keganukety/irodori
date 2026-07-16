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
- マイベスト・価格.com・たまひよ・楽天市場ランキングは
  `source-audits/2026-07-15/` の媒体別Markdownを監査正本とし、機械判定は
  `source-usage-audits.json` を使う。監査後も未解決事項は推測せず、法務確認前に公開しない。

## 8. 公式ページから配信される外部ドメイン資産 [C]

- PDF等の直接URLだけでは公式資料と判定しない。
- メーカー公式のダウンロードページから直接リンクされたことを確認できる場合に限り利用し、
  `discovery_page_url` / `direct_asset_url` / `discovered_via_official_page: true` を保存する。
- PDF表題だけで対象商品・年式を確定できない場合、公式到達経路があっても `match_status: probable`
  を維持する。

## 9. 第三者媒体の利用監査 [C]

- schema 0.4.0以降の第三者 `source_record` は `source_usage_audit_id` を必須とする。
  メーカー公式sourceはnull可とし、0.3.xパイロットを後方互換で読み取る。
- `terms_permission_status` / `operational_decision` / `legal_review_status` / `audit_result` を
  分離する。`audit_result: pass`を規約上の許諾や自動取得許可へ読み替えない。
- sourceの取得方法・保存方針・引用方針・PII方針・自動化利用・人間レビュー状態を
  `source_record`へ保持し、対応する監査operationと照合する。
- 記事本文、口コミ本文、画像、表、raw HTML、投稿者名・IDを保存しない。

媒体別の現在の運用判断 [C]:

| medium_id | operational_decision | 許容範囲 |
|---|---|---|
| `my-best` | `allowed_with_conditions` | 少数ページの手動/AIブラウザ参照と短い論点。HTML取得・巡回・引用は禁止。順位等はpending_review |
| `kakaku-com` | `not_adopted` | URL・ページ名・確認日のみ。人/AI閲覧もpending_review。正式承諾なしで採用しない |
| `tamahiyo` | `allowed_with_conditions` | 手動/AIブラウザ参照、短い構造化テーマ、公開前人間確認。明示的許諾とは扱わない |
| `rakuten-ichiba-ranking` | `pending_review` | HTML取得・巡回は禁止。法務確認後のofficial_api / scheduled_api_snapshotだけが条件付き候補 |

## 10. 外部順位・需要シグナルの役割分離 [C]

- 編集媒体の順位は `external_ranking_metadata`、楽天市場ランキングは
  `market_demand_signal` / `external_sales_ranking_metadata` とする。
- 他媒体順位、星、掲載/受賞回数、review sentiment/件数、楽天rank/review値、affiliate rate、
  売上人気シグナルは品質ランキングscoreへ加算・乗算・換算しない。
- 用途は説明用メタデータ、人気傾向表示、更新・調査優先順位、将来の独立市場人気表示に限定する。

## 11. 楽天API情報の保持 [C](監査確認値) / [U](派生保持)

- 価格・availabilityは取得から24時間、その他API情報は3か月を上限とし、値を
  `retention_policy`へ記録する。ランキングエンジンへ直書きしない。
- 期限切れを`retention_status: current`または公開用currentとして扱わない。
- APIで取得可能と確認できたランキングperiodは`realtime`のみ。daily/weeklyは公式Web区分として
  保持できるがAPI対応はUNKNOWN。IRODORI 7日派生集計と楽天公式週間順位を混同しない。
- 派生集計を3か月超保持できるかはUnverifiedのままにする。
