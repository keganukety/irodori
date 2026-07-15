# decision-log — 情報源利用方針監査 (2026-07-15)

区分: Confirmed Fact / Operational Decision / Proposed Default / Unverified / Requires Legal Review

追記: 2026-07-15 楽天市場ランキング(4媒体目・market_demand_signal / external_sales_ranking_metadata候補)の監査を追加。
各セクション末尾の「楽天市場ランキング」項目を参照。

## Confirmed Fact(一次確認済みの事実。すべて確認日2026-07-15 JST・根拠URLつき)

1. マイベスト利用規約の最終改定は2025-12-22(改定履歴7件が規約末尾に明記) — https://my-best.com/terms
2. マイベスト「引用・転載について」は対象を「文字・写真・順位・画像データ等」とし、
   「法人・企業による営利・販売目的での引用は禁じます」「事前の承諾がない転載は許可しておりません」と明記 — https://my-best.com/citation_terms
3. マイベストは検証ランキング(5点満点レーティングのウェイト付き幾何平均)と人気ランキング(EC売れ筋等の集計)の2種類を公式説明し、
   広告出稿の有無で検証スコアを変更しないと宣言。一部商品情報入力に生成AIを利用(正解率約90%と自己申告) — https://my-best.com/content_policy
4. マイベストの運営は株式会社マイベスト(LINEヤフー株式会社の連結子会社と自己表示) — https://my-best.com/content_policy
5. my-best.comのrobots.txtは`User-agent: * / Disallow: /link`のみ — https://my-best.com/robots.txt
6. 価格.com利用規約(第1編第4条)は利用を「私的かつ非営利目的」に限定し、事前承諾のない営利目的利用・準備行為を禁止 — https://kakaku.com/terms/kiyaku.html
7. 同規約第13条は、事前同意なく「情報を…複製…またはこれらの目的で利用又は使用するために保管する行為」を禁止(保管自体が明示的禁止対象) — 同上
8. 同規約第5条は「法令により権利者からの許諾なく利用又は使用が許容されている場合」を複製等禁止の例外として明示 — 同上
9. 価格.com利用規約の改正日は2023-06-01 / 2024-03-26 / 2025-06-30 — 同上
10. 価格.com第3編コミュニティ規定(2024-06-10)は、投稿の全著作権的権利をカカクコムへ無償許諾させ、
    カカクコムが第三者へ再利用許諾できる構造を規定 — https://kakaku.com/terms/kiyaku_community.html
11. kakaku.comのrobots.txtは一般UAに対し`/kuchikomi/review/results/`・`/kuchikomi/review/history/`等をDisallowし、
    CCBotとBytespiderを全面Disallow — https://kakaku.com/robots.txt
12. 価格.com総合人気ランキングは「製品ページへのアクセス数」「推定販売数」を集計し順位付け(公式注記) — https://kakaku.com/ranking/
13. たまひよWEBメディア利用規約は制定2020-03-31・改定2023-09-28。運営は株式会社ベネッセコーポレーション。
    禁止行為に「掲載情報の無断転載」「広告・営業活動…」を含み、管轄は東京地方裁判所 — https://st.benesse.ne.jp/ninshin/content/?id=68748
14. たまひよサイトフッターに「本サイトに掲載されている記事・写真・イラスト等のコンテンツの無断転載を禁じます」と表示 — 同上ページで確認
15. たまひよ赤ちゃんグッズ大賞2026は読者ママ・パパ対象のWEBアンケート(2025-08-14〜09-10、有効回答2,062人)を
    編集部が集計してランキング化する企画であると公式説明 — https://st.benesse.ne.jp/babygoods_rank/
16. st.benesse.ne.jpのrobots.txtは`/cgi-bin/`等3パスのみDisallowで、AIクローラーのブロック行はコメントアウト状態 — https://st.benesse.ne.jp/robots.txt
17. 旧help.kakaku.comの規約URLはkakaku.com/terms/配下へ301リダイレクトされる(kiyaku_site.html→terms/kiyaku.html等) — 取得時のHTTP応答で確認
18. カカクコムは2006-09-27に「価格.com Webサービス」(API公開)開始のプレスリリースを掲載している(表題確認) — https://corporate.kakaku.com/press/release/20060927a

楽天市場ランキング(すべて確認日2026-07-15 JST・根拠URLつき):

19. 楽天ウェブサービス規約は制定2006-12-14・最終改定2012-06-28。第8条4項が楽天サイトへのリンク設置を義務化し、
    ウェブサービス使用部分での楽天サイト以外へのリンクを禁止 — https://webservice.rakuten.co.jp/guide/rule
20. 同規約第10条4号は「ウェブサービスの使用によって楽天アフィリエイト以外の方法で収入を得ること」、
    5号は楽天アフィリエイト成果対象商品への他社アフィリエイト利用、7号は「当社が別途定める目的以外」の使用・複製・改変、
    9号は不特定多数と共有可能な場所への取得情報の保管を禁止(いずれも明示的許可を除く) — 同上
21. 同規約第13条はクレジット表示義務を規定。表示ガイドはバナー(221×21px/311×30px)または
    テキスト「Supported by Rakuten Developers」の無改変表示を要求し、違反時はAPIアクセス無効化の可能性を明記 —
    https://webservice.rakuten.co.jp/guide/credit
22. 公式FAQ: キャッシュ可能期間は「商品の価格情報、および販売可能情報：24時間」「その他の情報：3か月間」。
    価格・販売可能情報を表示する場合は少なくとも週1回刷新し、1時間毎以上更新しない場合は
    更新日時と所定の免責文言を隣接掲載する義務 — https://webservice.faq.rakuten.net/hc/ja/articles/900001974343
23. 公式FAQ: API取得情報の利用目的は「利用者ソフトウェア上で当社の商品を紹介し、かつ当社内の当該商品のページに
    リンクを設ける目的」に限定され、目的外の複製・改変は禁止 — https://webservice.faq.rakuten.net/hc/ja/articles/900001974363
24. 公式FAQ: リクエスト制限は「1つのapplication_idにつき、1秒に1回以下」。制限緩和は受付なし。
    超過の瞬間に停止とはならないが継続的超過で利用停止の場合あり —
    https://webservice.faq.rakuten.net/hc/ja/articles/900001974383 ほか2記事
25. 公式FAQ: 楽天市場系APIはTGアフィリエイトの併用が許可される。API利用の有償ツール提供は第10条4号違反。
    提供元表示を条件に他社ウェブサービス取得商品との併置は可 — https://webservice.faq.rakuten.net/hc/ja/articles/900001970866 ほか2記事
26. 楽天市場ランキングAPI(2022-06-01)の`period`パラメータの公式許容値は「realtime」のみ。
    デイリー・週間を指定する値は記載がなく、period未指定時の集計期間も記載なし。page1〜34で最大約1000位。
    出力にrank・itemCode・shopCode・itemName・itemPrice・availability・reviewCount・reviewAverage・
    lastBuildDate・title・genreId・affiliateRate・画像URL(64px/128px各最大3枚)等 —
    https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking
27. ranking.rakuten.co.jpは「リアルタイム|デイリー|週間|月間」の期間タブを提供。2026-07-15時点の表示で、
    デイリーは「2026年7月15日(水)更新(集計日：7月14日)」、週間は「同日更新(集計日：7月6日～7月12日)」(月〜日の7日間) —
    https://ranking.rakuten.co.jp/daily/100533/ ・ /weekly/100533/
28. ジャンルIDの公式取得手段は楽天ジャンル検索API(2026-07-01)で、genreId=0(ルート)から階層
    (ancestors/genre/children、各genreId・nameJa・level)をたどる。URL構造・ページ見出しから
    100533=「キッズ・ベビー・マタニティ」に対応 — https://webservice.rakuten.co.jp/documentation/ichiba-genre-search
29. ランキングAPIの公式注記: 商品ページが削除された商品は順位がスキップされるため、
    API結果は「ランキング市場」と順位・件数が一部異なる場合がある — 同26のURL
30. ベビージャンルのデイリーで同一製品シリーズ(エアラブ5)が別店舗として別順位(1位と3位)に併存することを観察。
    ランキングは店舗商品(ショップ×商品ページ)単位 — https://ranking.rakuten.co.jp/daily/100533/ (2026-07-15閲覧)
31. ranking.rakuten.co.jpのrobots.txtは`/search*`・`/ranking/*`・`/rss/*`・`/weekly/date=*`・`/monthly/date=*`をDisallow —
    https://ranking.rakuten.co.jp/robots.txt

## Operational Decision(今回の運用決定)

1. 3媒体すべてで自動取得(C)・定期巡回(D)を不採用とする(prohibited_automation)。明示的許可の確認までこの決定を維持する。
2. 記事本文・口コミ本文・画像・比較表・グラフ・ページHTML・スクリーンショットは3媒体すべてで保存しない。
3. 投稿者名・投稿者ID等の投稿者情報は保存しない(IRODORI既存原則の再確認)。
4. 価格.comは当面not_adopted。参照が必要な場合もURL・ページ名・確認日(方式L)のみ記録する。
5. マイベストからの「短い引用」は行わない(規約が法人営利目的の引用を明示的に禁止)。論点・評価軸の自分の言葉での短い構造化のみ。
6. 他媒体順位のIRODORI得点への変換・平均・合算・掲載回数加点は行わない(既存確定原則の再適用)。
7. 本監査では商品口コミの本収集・レビュー本文の大量取得を行っていない(閲覧は規約・ポリシー・調査概要ページ等の少数ページのみ)。

楽天市場ランキング:

8. 楽天市場ランキングを4媒体目として、編集評価とは別の役割
   (`market_demand_signal` / `external_sales_ranking_metadata`)で扱う。楽天順位はIRODORI品質得点へ変換せず、
   楽天1位をIRODORI 1位の根拠にせず、他媒体順位との平均・合算もしない。affiliateRateによる加点・
   reviewAverageの無条件共通得点化も行わない。
9. 楽天のHTMLスクレイピング・定期HTML巡回は不採用(FAIL)。取得はブラウザ閲覧(方式A/B)と、
   法務確認完了後のofficial_api / scheduled_api_snapshotのみを候補とする。
10. 本監査ではAPIキーの入力・APIの本番呼び出し・商品データの大量取得を行っていない(公式仕様書・規約・FAQの閲覧のみ)。
11. 元のAPIレスポンス全体・商品画像ファイルは恒久保存しない。価格・availabilityは24時間、
    その他の楽天由来項目は3ヶ月をキャッシュ上限として扱い、楽天の削除指示には直ちに従う。
    IRODORI内部データ(product_identity_id・identity_match_status・取得日時)はこの制限の対象外。
12. 楽天の店舗商品とIRODORI商品モデルを分離する(楽天側: rakuten_item_code/shop_code/item_name/item_url、
    IRODORI側: product_identity_id/model_year/market/model_number/variant)。identity_match_statusは
    confirmed/probable/unmatched/unverifiedの4値とし、商品名の一致だけで自動的にconfirmedにしない。
13. IRODORIが日次データから作る7日集計(irodori_7day_rank_presence / irodori_7day_average_position /
    irodori_7day_rank_stability)は楽天公式週間ランキング(rakuten_official_weekly_rank)と名称・表示を分離し、混同させない。

## Proposed Default(初期案。規約上の明示的許可と混同しない)

1. 未許諾媒体の標準運用: 少数ページを人またはAIブラウザで確認 / URL・ページ名・確認日を保存 /
   必要な事実と論点だけを短く構造化 / 原文・画像・表・投稿者情報を保存しない / 自動巡回しない /
   得点へ直接変換しない / 公開前に人間確認。
2. 最初に採用検討する第三者媒体: たまひよ。最初の取得方法: 方式B(AIブラウザ少数ページ+出典付き短い構造化要約)。
3. 再確認期限: 2026-10-15(3ヶ月後に規約・robots.txt・API提供状況を再確認)。
4. たまひよの順位は`external_rank_metadata`として内部保存のみ(公開表示は法務確認後)。
5. マイベストは`editorial_evaluation`(論点参考)に限定して試行する。
6. 楽天市場ランキングの初期運用は方式B(AIブラウザ少数ページ)による内部メタデータ化のみ。
   official_api / scheduled_api_snapshotは、規約第10条4号・5号とIRODORI収益構造の法務確認、
   および内部分析専用利用の目的適合性確認が完了してから導入を再判定する(判定条件はrakuten-ichiba-ranking.mdのPASS条件9項)。
7. 楽天ランキングの公開表示(デイリー/週間上位バッジ等)は法務確認完了まで行わない。
   表示する場合もリンク・クレジット・集計日明示・価格情報の更新要件を遵守する。

## Unverified(未確認のまま残す事項)

1. 価格.com Webサービス(API)の現在の提供状況。「2012年6月末に新規受付終了」は第三者ブログ由来の情報であり公式未確認。
2. カカクコムの法人向けデータ提供・提携プログラムの有無。
3. マイベスト・たまひよの公式API/RSS/データ提供の有無(存在を示す公式情報を発見できず)。
4. 各媒体のプライバシーポリシー本文の詳細(URLの存在のみ確認)。
5. マイベスト引用・転載ページ/content_policy、たまひよWEBメディアポリシー/コメント利用規約の制定日・改定日。
6. 検索結果スニペットにのみ現れた記述(例: 価格.comランキングの「同一大量アクセス除外」の詳細文言)は根拠として不採用。
7. ベネッセ全社の著作物利用許諾申請手続き(benesse.co.jp側)。

楽天市場ランキング(UNKNOWN):

8. **APIでデイリーランキングを取得できるか**(period許容値は"realtime"のみ記載。未指定時にどの集計期間が返るかも記載なし)。
9. **APIで楽天公式週間ランキングを取得できるか**(週間API対応=UNKNOWN。IRODORIの7日集計で代替する場合も
   楽天公式週間とは別物として扱う)。
10. ランキングの集計方法の公式説明(注文件数か販売額か、同一購入者の除外、サイズ・色variantの集計方法、
    複数店舗に同一製品がある場合の集計方法)。ランキングページの注記
    「価格や送料は、商品のサイズや色によって異なる場合があります」とAPIのhasPriceRange/itemPriceMin/Maxから
    店舗商品ページ単位の集計構造が観察されるのみ。
11. 過去日付のランキングアーカイブの公式提供の有無(robots.txtに/weekly/date=*のDisallowはあるが未確認)。
12. 3ヶ月のキャッシュ上限を超えるランキング履歴保持の可否。
13. アプリ登録時に申告する想定QPSと実際の制限運用の関係。

## Requires Legal Review(法的判断が必要。断定しない)

1. 各媒体の包括的な複製・転載・保管禁止条項と、著作権法上の権利制限(30条私的複製・32条引用・47条の5等)
   および「事実・データは著作権保護の対象外」という原則との優先関係。
2. ブラウザ閲覧のみで利用規約への同意が成立するか(ブラウズラップ契約の有効性)と、
   価格.com第1編第4条(非営利限定)がIRODORI業務としての閲覧・参照に及ぶ範囲。
3. マイベスト「法人・企業による営利・販売目的での引用は禁じます」条項の効力と、
   適法引用(著作権法32条)を契約で制限できるかという論点。
4. 他媒体の順位・受賞情報を(a)内部保存する行為、(b)公開コンテンツで出典付きで言及する行為の各適法性
   (著作権に加え、商標・不正競争・信用毀損リスクを含む)。
5. 口コミの件数・肯定/否定傾向の集計・要約が「翻案」に該当しない範囲。
6. AIブラウザによる少数ページ閲覧が各規約の「自動化」「過度な負荷」条項に該当しないことの確認。
7. 媒体への利用許諾照会を行う場合の照会文面と交渉方針。

楽天市場ランキング(Requires Legal Review):

8. 規約第10条4号(楽天アフィリエイト以外の方法での収入の禁止)・5号(他社アフィリエイト併用禁止)と、
   IRODORIの収益モデル(既存アフィリエイト構成を含む)の適合性。**official_api導入前の必須確認事項。**
9. 「市場人気・需要の鮮度指標」としての内部分析専用利用(表示・リンクを伴わない保存・集計)が、
   FAQの利用目的「商品を紹介し、かつ当該商品のページにリンクを設ける目的」に適合するか。
10. 順位から作るIRODORI派生集計(irodori_7day_*)の長期保持が、キャッシュ規定(3ヶ月)の対象となる
    「当社の知的財産の格納」に当たるか、それとも事実データの独自集計として扱えるか。
11. 公開コンテンツで「楽天デイリー/週間ランキング◯位」に言及する際の表現・「楽天」商標の使用・
    クレジット表示の要件(規約第9条・第13条・商標ガイドライン)。
12. ランキングページのスクリーンショット・HTML複製の可否(IRODORI方針では不採用のため当面論点にしない)。
