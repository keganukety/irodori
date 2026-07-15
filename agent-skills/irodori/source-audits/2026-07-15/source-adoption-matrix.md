# 情報源採用マトリクス — マイベスト / 価格.com / たまひよ / 楽天市場ランキング (2026-07-15)

判定は各媒体ファイルの根拠に基づく。**法的判断ではなく運用判断**であり、
「PASS(条件付き)」はIRODORI自主ルール(原文非保存・少数閲覧・公開前人間確認)の遵守を前提とする。
楽天市場ランキングは編集評価3媒体と役割が異なり、**市場人気・需要の鮮度指標**
(`market_demand_signal` / `external_sales_ranking_metadata`)として扱う。

## 1. 利用方式A〜Lの横断比較

| 方式 | マイベスト | 価格.com | たまひよ | 楽天市場ランキング |
|---|---|---|---|---|
| A 人がブラウザで読み手動構造化 | PASS(条件付き) | UNKNOWN | PASS(条件付き) | PASS(条件付き) |
| B AIブラウザ少数ページ+出典付き短い要約 | PASS(条件付き) | UNKNOWN | PASS(条件付き) | PASS(条件付き) |
| C HTML自動取得・構造化 | FAIL | FAIL | FAIL | FAIL |
| D 定期巡回による更新検知 | FAIL | FAIL | UNKNOWN(不採用) | FAIL(HTML) |
| E 公式API・RSS・データ提供 | UNKNOWN | UNKNOWN | UNKNOWN | **PASS(条件付き)** |
| F 客観的商品仕様だけ確認 | PASS(条件付き) | UNKNOWN | PASS(条件付き) | PASS(条件付き) |
| G 編集部評価のテーマ・論点構造化 | PASS(条件付き) | NOT_APPLICABLE | PASS(条件付き) | NOT_APPLICABLE(売上集計であり編集評価でない) |
| H 口コミ1投稿単位の保存 | FAIL | FAIL | FAIL | FAIL(APIはレビュー本文を返さない) |
| I 件数・肯定/否定傾向のみ保存 | PASS(条件付き) | UNKNOWN | PASS(条件付き) | PASS(条件付き・reviewCount/reviewAverageはAPI正式出力) |
| J 他媒体順位の参考メタデータ保存 | FAIL(公開)/UNKNOWN(内部) | UNKNOWN(内部)/FAIL(公開) | PASS(条件付き・内部のみ) | PASS(条件付き・内部/公開はリンク・クレジット・法務確認前提) |
| K 短い引用の保存 | FAIL | UNKNOWN | UNKNOWN | NOT_APPLICABLE(引用対象の記事本文がない) |
| L URL・ページ名・確認日のみ保存 | PASS | PASS | PASS | PASS |

判定を分けた主因:

- **マイベスト**: 引用・転載ページが「順位」を明示対象とし「法人・企業による営利・販売目的での引用は禁じます」と明記(K・J公開がFAIL)。
- **価格.com**: 第1編第4条が利用自体を「私的かつ非営利目的」に限定し事前承諾制(A・B・F・IまでUNKNOWNに波及)。
  第13条が「保管」を明示的に禁止(C・D FAIL)。
- **たまひよ**: 禁止行為は無断転載・サイト上の営業活動等で、閲覧・事実参照への明示的制限は確認されず(A・B・I・J内部がPASS側)。
- **楽天市場ランキング**: 4媒体で唯一、**公式API(楽天ウェブサービス)が存在し利用が明示的に許諾される**。
  ただし条件が多い: 楽天アフィリエイト条項(第10条4号・5号)、利用目的の限定(紹介+リンク)、
  キャッシュ期間(価格・在庫24時間/その他3ヶ月)、クレジット表示、楽天サイトへのリンク義務、1秒1回制限。
  内部分析専用利用の目的適合性はRequires Legal Review。

## 2. 保存項目の横断比較(◯=PASS / △=条件付き・内部のみ / ?=UNKNOWN / ×=FAIL / —=N/A)

| 保存項目 | マイベスト | 価格.com | たまひよ | 楽天市場ランキング |
|---|---|---|---|---|
| 媒体名・ページ名・URL・確認日 | ◯ | ◯ | ◯ | ◯ |
| 公開日・更新日 | ◯(確認可能時のみ) | ◯(同左) | ◯(同左) | ◯(更新日・集計日・lastBuildDate) |
| 対象商品・型番・モデル年 | ◯ | ? | ◯ | ◯(itemCode/shopCode/itemName・3ヶ月以内) |
| 他媒体内の順位 | ?(内部)/×(公開) | ?(内部)/×(公開) | △(内部のみ) | △(3ヶ月以内。公開は条件付き+法務確認) |
| 評価方法の概要 | ◯ | ◯ | ◯ | ?(集計方法の公式説明が未確認) |
| 編集部による評価軸 | △ | — | △ | —(編集評価でない) |
| 実測値・測定条件 | ? | — | — | — |
| 短い評価傾向・肯定/否定テーマ | △ | ? | △ | —(該当コンテンツなし) |
| 口コミ件数・星評価分布 | △ | ? | △ | △(reviewCount/reviewAverage・3ヶ月以内・得点化禁止) |
| 価格・在庫(availability) | — | ? | — | △(**24時間以内**・表示時は更新要件あり) |
| 短い引用 | × | ? | ? | —(対象なし) |
| 投稿者名・投稿者ID・投稿日 | × | × | × | ×(APIが返さない/IRODORI方針) |
| 記事本文・口コミ本文 | × | × | × | ×(同上) |
| 画像・比較表・グラフ | × | × | × | ×(画像ファイルの複製保存は不採用。URL保存のみ△) |
| ページHTML・スクリーンショット | × | × | × | × |
| 元のAPIレスポンス(raw) | — | — | — | △(内部のみ・恒久保存不可・3ヶ月上限/価格系24時間) |
| ランキング履歴(日次snapshot蓄積) | — | — | — | △(内部のみ・3ヶ月以内。長期履歴は?) |

## 3. 運用区分と自動化採否

| 媒体 | 運用区分 | 自動化 |
|---|---|---|
| マイベスト | browser_assisted_review + manual_reference_only(順位・引用の公開利用はunknown_pending_review) | prohibited_automation |
| 価格.com | unknown_pending_review(当面はmanual_reference_only=URLメモのみ) | prohibited_automation |
| たまひよ | manual_reference_only + browser_assisted_review | prohibited_automation |
| 楽天市場ランキング | browser_assisted_review(当面) + official_api_candidate(法務確認後) | **conditional_api_only**(HTML自動取得・巡回はprohibited。official_api/scheduled_api_snapshotのみ条件付きで採用可能。本監査時点では未使用) |

## 4. IRODORIでの役割

| 役割 | マイベスト | 価格.com | たまひよ | 楽天市場ランキング |
|---|---|---|---|---|
| product_identity_confirmation | 不適(仕様入力に生成AI利用と自己申告) | 保留 | 補助的(公式優先) | 補助的(itemCode/shopCodeは店舗商品の識別子であり製品identityではない) |
| official_spec_cross_check | 不適 | 保留 | 補助的 | 不適(店舗商品ページは販促情報) |
| third_party_measurement | 保留(Requires Legal Review) | — | — | — |
| editorial_evaluation | ◯(論点参考・当面はこれのみ) | — | ◯ | —(編集評価でない) |
| review_theme_source | 不採用 | 保留 | **◯(第一候補)** | 不採用(レビュー本文なし) |
| buyer_review_source | 不採用 | 保留(承諾取得が前提) | 不採用 | 不採用 |
| external_ranking_metadata / external_sales_ranking_metadata | 保留 | 保留 | △(内部のみ) | **◯(第一候補・内部)** 公開表示は法務確認後 |
| market_demand_signal(市場人気・需要の鮮度指標) | — | — | — | **◯(専用の役割・得点化しない)** |
| not_adopted | — | **当面not_adopted** | — | — |

## 5. ランキングとの関係(確定原則の再確認)

4媒体すべてに共通して、以下をIRODORI側の確定原則として適用する。

- 他媒体順位をIRODORI得点へ変換しない / 平均・合算しない / 掲載回数だけで加点しない
- 他媒体の星評価を無条件に共通点へ変換しない
- 広告・アフィリエイト条件(楽天のaffiliateRateを含む)を得点へ反映しない
- 媒体順位は`external_rank_metadata`(参考メタデータ)としてのみ保持可能(保持可否自体は上記Jの判定に従う)
- 編集部評価(`editorial_opinion`)・実測(`third_party_measured`)・購入者口コミ(`review_aggregate`)・
  manufacturer claimをclaim_classで分離し混合しない
- 楽天固有の追加原則: 楽天順位は`market_demand_signal`(需要・鮮度)であり品質evidenceではない。
  楽天1位をIRODORI 1位の根拠にしない。IRODORI派生の7日集計(`irodori_7day_*`)を
  楽天公式週間ランキング(`rakuten_official_weekly_rank`)と混同・混記しない。

## 6. 推奨(Proposed Default)

- **最初に採用検討する媒体: たまひよ**(editorial_evaluation / review_theme_source として) —
  (1)閲覧・事実参照への規約上の明示的制限が編集評価3媒体で最も少ない
  (2)評価方法(読者アンケートの調査概要)が公開されており、IRODORIのreview_theme_source/
     external_rank_metadata構造に事実として整理しやすい
  (3)ベビー・育児カテゴリとの適合が高い
- **市場需要指標として採用検討する媒体: 楽天市場ランキング**(役割が異なるため、たまひよと競合しない) —
  当面は方式B(AIブラウザ少数ページ)で内部メタデータのみ。official_apiは
  規約第10条4号・5号(アフィリエイト)とIRODORI収益構造の法務確認完了後に導入を再判定。
- **最初の取得方法: 方式B**(AIブラウザで少数ページ→出典URL付き短い構造化要約。原文非保存・公開前人間確認)
- 価格.comは営利利用の事前承諾問題が解消するまでnot_adopted。
- マイベストは論点参考(editorial_evaluation)に限定し、実測値・順位・引用の利用は法務確認後に再判定。
