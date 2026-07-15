# 楽天市場ランキング (ranking.rakuten.co.jp / 楽天ウェブサービス) — 情報源利用方針監査

- 媒体名: 楽天市場ランキング(デイリー・週間ほか)/ 楽天ウェブサービス(楽天市場ランキングAPI)
- 運営主体: 楽天グループ株式会社(楽天ウェブサービス規約 第1条で確認)
- 調査日時: 2026-07-15 12:10〜12:45 JST
- 公式性の確認方法: ranking.rakuten.co.jp・webservice.rakuten.co.jp・webservice.faq.rakuten.net の
  公式ページをAIブラウザ・WebFetchで直接閲覧し原文確認(検索エンジンは公式ページの発見にのみ使用)
- 位置づけ: **本監査は法的助言ではない。** audit_resultのPASSは法的許諾を意味しない。
- 役割の前提: 楽天市場ランキングは編集評価(マイベスト・価格.com・たまひよ)とは異なる
  **市場人気・需要の鮮度指標**として扱う。source_role候補は
  `market_demand_signal` / `external_sales_ranking_metadata`。
  楽天順位はIRODORIの品質得点へ変換しない。楽天1位をIRODORI1位の根拠にしない。他媒体順位との平均・合算もしない。

## 確認した公式URL

| ページ | URL | 公開日/更新日 | 確認方法・時刻(JST) |
|---|---|---|---|
| ランキングトップ(デイリー総合) | https://ranking.rakuten.co.jp/ | 「2026年7月15日(水)更新」表示 | AIブラウザで閲覧 12:15 |
| 週間ランキング(総合) | https://ranking.rakuten.co.jp/weekly/ | 「2026年7月15日(水)更新 (集計日：7月6日～7月12日)」 | AIブラウザで閲覧 12:17 |
| デイリー(キッズ・ベビー・マタニティ) | https://ranking.rakuten.co.jp/daily/100533/ | 「2026年7月15日(水)更新 (集計日：7月14日)」 | AIブラウザで閲覧 12:19 |
| 週間(キッズ・ベビー・マタニティ) | https://ranking.rakuten.co.jp/weekly/100533/ | 「2026年7月15日(水)更新 (集計日：7月6日～7月12日)」 | AIブラウザで閲覧 12:40 |
| 楽天市場ランキングAPI仕様(2022-06-01) | https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking | version: 2022-06-01 | AIブラウザ+WebFetchで全文確認 12:30 |
| 楽天ジャンル検索API仕様(2026-07-01) | https://webservice.rakuten.co.jp/documentation/ichiba-genre-search | version: 2026-07-01 | AIブラウザで閲覧 12:38 |
| 楽天ウェブサービス規約 | https://webservice.rakuten.co.jp/guide/rule | **制定2006-12-14 / 最終改定2012-06-28** | AIブラウザで日本語原文全文確認 12:36 |
| クレジット表示方法と注意 | https://webservice.rakuten.co.jp/guide/credit | 記載なし | WebFetchで確認 12:22 |
| ご利用ガイド | https://webservice.rakuten.co.jp/guide | 記載なし | WebFetchで確認 12:21 |
| FAQ: データ表示の更新頻度・キャッシュ | https://webservice.faq.rakuten.net/hc/ja/articles/900001974343 | 「2年前 更新」表示 | AIブラウザで全文確認 12:25 |
| FAQ: API取得情報の利用目的 | https://webservice.faq.rakuten.net/hc/ja/articles/900001974363 | 「6年前 更新」表示 | AIブラウザで全文確認 12:26 |
| FAQ: 各APIの利用制限 | https://webservice.faq.rakuten.net/hc/ja/articles/900001974383 | 「2年前 更新」表示 | AIブラウザで全文確認 12:27 |
| FAQ: リクエスト制限緩和 | https://webservice.faq.rakuten.net/hc/ja/articles/900001974403 | — | AIブラウザで全文確認 12:29 |
| FAQ: 制限超過時の扱い | https://webservice.faq.rakuten.net/hc/ja/articles/900001970766 | — | AIブラウザで全文確認 12:28 |
| FAQ: 楽天アフィリエイト以外のアフィリエイト | https://webservice.faq.rakuten.net/hc/ja/articles/900001970866 | — | AIブラウザで全文確認 12:28 |
| FAQ: 他社ウェブサービス商品との併置 | https://webservice.faq.rakuten.net/hc/ja/articles/900001970786 | — | AIブラウザで全文確認 12:29 |
| robots.txt(ランキングサイト) | https://ranking.rakuten.co.jp/robots.txt | — | AIブラウザで確認 12:41 |

## サイト上のランキング(一次確認済みの事実)

1. ranking.rakuten.co.jp には期間タブ「**リアルタイム | デイリー | 週間 | 月間**」があり、
   総合・ジャンル別・性別・年代別のランキングを提供する。
2. **デイリー**: 「2026年7月15日(水)更新 (集計日：7月14日)」— 前日1日分の集計を毎日更新(2026-07-15時点の表示)。
3. **週間**: 「2026年7月15日(水)更新 (集計日：7月6日～7月12日)」— 月曜〜日曜の7日間集計(同上)。
4. ジャンル別ランキングはURL構造 `/daily/100533/`・`/weekly/100533/` で提供され、
   100533は「キッズ・ベビー・マタニティ」に対応(URLとページ見出しで確認)。
5. ページには「価格や送料は、商品のサイズや色によって異なる場合があります。」の注記がある。
   **集計方法(何を数えて順位化するか)の公式説明はランキングページ上で確認できなかった。**
6. 上位表示はページ送り形式(総合週間は300位まで、ベビージャンルは400位までのページャを確認)。
7. 観察事実: ベビージャンルのデイリーで、同一製品シリーズ(エアラブ5)が別店舗
   (Colulu / emo's store・エアラブ公式店)として**別順位(1位と3位)に併存**していた。
   ランキングは店舗商品(ショップ×商品ページ)単位である構造が観察される。
8. robots.txt: `User-agent: *` で `/search*`・`/ranking/*`・`/rss/*`・`/weekly/date=*`・`/monthly/date=*` をDisallow。
   (注意: robots.txtは自動クローラー向けの技術的表明であり、規約上の許諾とは別物)

## 楽天市場ランキングAPI(2022-06-01)仕様の要点(一次確認済み)

- エンドポイント: `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601`
- 説明: 「楽天市場ランキングの情報を取得できる。ジャンル・性別・年代別の売上データを取得可能。最大1000位まで」
- 認証: `applicationId` + `accessKey` が必須(accessKeyはヘッダーまたはクエリ)。`affiliateId` は任意。
- 主な入力パラメータ:
  - `genreId`(long): ジャンル指定。**年代(age)・性別(sex)とは同時使用不可**
  - `age`(int): 10/20/30/40/50、`sex`(int): 0=男性/1=女性
  - `page`(int): 1〜34(30位以下の順位も取得可能=最大約1000位)
  - `carrier`(int): 0=PC/1=モバイル
  - **`period`(string): 公式記載の許容値は「realtime: retrieve data in real time」のみ。**
    デイリー・週間を指定する値は**記載なし**。period未指定時にどの集計期間のランキングが返るかも**記載なし**。
  - エラー例に「must set age parameter in 20,30,40 when set period parameter」
    (genreId未指定でperiod指定時はageが20/30/40に制限される)という制約が記載されている。
- 主な出力項目: `title`(ランキングタイトル)、`lastBuildDate`(最終更新日時)、`rank`(順位)、
  `itemName`、`catchcopy`、`itemCode`、`itemPrice`(+`itemPriceMin/Max1-3`・`hasPriceRange`)、
  `itemCaption`、`itemUrl`、`affiliateUrl`(affiliateId指定時)、`imageFlag`、
  `smallImageUrls`(64px角・最大3枚)、`mediumImageUrls`(128px角・最大3枚)、
  `availability`(0=売切/1=販売可能)、`taxFlag`、`postageFlag`、`creditCardFlag`、
  `shopOfTheYearFlag`、`shipOverseasFlag/Area`、`affiliateRate`、`startTime/endTime`、
  **`reviewCount`、`reviewAverage`**、`pointRate`系、`shopName`、**`shopCode`**、`shopUrl`、`genreId`
- 「取得データはランキング市場と同一だが、商品ページが削除された商品は順位がスキップされるため、
  順位・件数が『ランキング市場』と一部異なる場合がある」との公式注記あり。
- ジャンルIDの取得: 楽天ジャンル検索API(IchibaGenre/Search/20260701)で `genreId=0`(ルート)から
  階層(`ancestors`/`genre`/`children`、各`genreId`・`nameJa`・`level`)をたどるのが公式手段。
- **本監査ではAPIの本番呼び出し・APIキー入力・商品データ取得は行っていない**(仕様書の閲覧のみ)。

## 楽天ウェブサービス規約・FAQの要点(一次確認済み)

1. **規約(制定2006-12-14・最終改定2012-06-28)**。日本法準拠、東京地方裁判所を第一審の専属的合意管轄(第20条)。
2. **第3条(アフィリエイト)**: アフィリエイト報酬を得る目的での使用、または楽天アフィリエイト対象商品への
   リンク掲載時は、**「楽天アフィリエイト」を利用してリンクを作成する**ものとする。
3. **第6条(知的財産権)**: ウェブサービス(商品情報を含む)にかかる知的財産権は楽天またはライセンサーに帰属。
4. **第7条3項**: 楽天は「アクセス回数、アクセス時間、**情報更新の頻度**、アクセスに関する表示、
   送信データの容量および特定の情報の記載」等の制約を別途定めることができる。
5. **第8条4項(リンク要件)**: アプリケーション制作にあたり**楽天サイトへのリンクを設置しなければならない**。
   また「アプリケーション上のウェブサービスを使用した部分においては、楽天サイト以外のウェブサイトへの
   リンクを設置してはならない」。
6. **第10条(禁止行為)** 主要号:
   - (3) 提供プログラムの複製・改変・逆アセンブル等
   - (4) **ウェブサービスの使用によって楽天アフィリエイト以外の方法で収入を得ること**(明示的許可を除く)
   - (5) 楽天アフィリエイト成果対象の商品について**他社アフィリエイトプログラムを利用すること**(明示的許可を除く)
   - (6) 楽天と競合(のおそれ含む)するサービスの提供
   - (7) 取得情報を**「当社が別途定める目的以外に使用」または目的外の複製・改変**をすること
   - (9) **不特定または多数人と情報を共有可能な場所に取得情報を保管すること**
   - (10) 特定の人のみがアクセスできる環境での使用(明示的許可を除く)
7. **第13条(クレジット表示)**: 商品情報が楽天グループ提供であることを楽天の定めに従い表示する。
   クレジット表示ガイド: バナー(221×21px / 311×30px)またはテキスト**「Supported by Rakuten Developers」**を表示。
   「提供HTMLの改変不可・画像の改変不可」。違反時は「APIへのアクセスが無効化される場合がある」。
8. **FAQ(キャッシュ・更新頻度)** — 原文確認済み:
   - キャッシュ可能期間: **「商品の価格情報、および販売可能情報：24時間」「その他の情報：3か月間」**。
     楽天はいつでも知的財産の削除を指示でき、デベロッパーは直ちに従う。
   - 表示更新: 価格・販売可能情報を表示する場合、**少なくとも1週間に1回**、APIから新たに取得した情報に刷新。
   - **1時間に1回以上更新しない場合**は、価格・在庫等の情報に隣接して**更新時刻・日時を記載**し、
     所定の**免責文言**(「…購入時に楽天市場店舗に表示されている価格が、その商品の販売に適用されます。」)を
     隣接掲載またはハイパーリンク等で掲載しなければならない。
9. **FAQ(利用目的)**: 「利用者ソフトウェア上で当社の商品を紹介し、かつ当社内の当該商品のページにリンクを
   設ける目的でご利用いただけます。また、APIから取得した情報をこの目的以外で複製または改変することは禁止します。」
10. **FAQ(リクエスト制限)**: 「1つのapplication_idにつき、1秒に1回以下のリクエスト」。**制限緩和は受け付けていない**。
    制限超過の瞬間に停止にはならないが、継続的な超過で利用停止の場合がある。
11. **FAQ(アフィリエイト例外)**: 楽天市場系APIは**TGアフィリエイト**の併用が許可されている
    (楽天トラベル系はリンクシェア)。有償ツール提供は第10条4号により規約違反。
12. **FAQ(他社サービスとの併置)**: 提供元を表示すれば他社ウェブサービス取得商品との並存は問題ない。
    ただし楽天取得情報で他社アフィリエイトリンクを作ることは第10条5号違反。

## 名称定義(公式ランキングとIRODORI派生集計の分離)

| 名称 | 定義 | 由来 |
|---|---|---|
| `rakuten_official_daily_rank` | 楽天が自ら公表するデイリーランキングの順位 | ranking.rakuten.co.jp(サイト表示)。**API上の取得可否はUNKNOWN** |
| `rakuten_official_weekly_rank` | 楽天が自ら公表する週間ランキングの順位(月〜日集計) | ranking.rakuten.co.jp(サイト表示)。**API対応はUNKNOWN** |
| `irodori_7day_rank_presence` | IRODORIが日次データから作る「直近7日のランクイン日数」 | IRODORI派生集計(採用時)。楽天公式週間と**混同しない** |
| `irodori_7day_average_position` | IRODORIが日次データから作る7日平均順位 | 同上 |
| `irodori_7day_rank_stability` | IRODORIが日次データから作る順位安定性 | 同上 |

- IRODORI派生集計(`irodori_7day_*`)を表示・言及する場合は「楽天週間ランキング」と表記してはならず、
  IRODORI独自集計であることを明示する。

## 取得方法ごとの判定

判定4区分を分離する: `terms_permission_status`(規約上の許諾状態) / `operational_decision`(IRODORIの運用決定) /
`legal_review_status`(法務確認の要否) / `audit_result`(本監査の技術・運用判定)。
**audit_resultのPASSは法的許諾を意味しない。**

| 取得方法 | terms_permission_status | operational_decision | legal_review_status | audit_result |
|---|---|---|---|---|
| manual_browser(人がブラウザで閲覧) | 通常閲覧への明示的制限は確認されず | adopt(少数ページ・短い構造化メモ) | 公開利用時に要確認 | **PASS(条件付き)** |
| ai_browser_assisted(AIブラウザ少数ページ) | 明示的規定なし(通常閲覧に準ずる範囲で実施) | adopt(少数ページ・大量取得なし・公開前人間確認) | 公開利用時に要確認 | **PASS(条件付き)** |
| official_api(楽天ウェブサービス) | **明示的に提供・許諾(条件多数)**: アプリ登録、クレジット表示、楽天サイトへのリンク義務、キャッシュ期間(価格24h/他3ヶ月)、1秒1回、楽天アフィリエイト条項、目的制限(紹介+リンク) | 第一候補として採用方針。**本監査では未使用**(仕様書閲覧のみ)。法務確認完了までは本番導入しない | **required**(第10条4号とIRODORI収益構造 / 内部分析専用利用の目的適合性 / 履歴保持) | **PASS(条件付き)** |
| automated_html(HTMLスクレイピング) | 明示的許可なし。robots.txtが`/ranking/*`等をDisallow。公式APIが存在 | 不採用(prohibited) | —(不採用のため対象外) | **FAIL** |
| scheduled_api_snapshot(定期API取得) | APIの通常利用形態の範囲(1秒1回以内)。定期実行を禁止する明示的条項は確認されず。ただし目的制限・キャッシュ期間の枠内に限る | **当面不採用**。official_apiの法務確認完了後に、少数ジャンル・低頻度(例: 1日1回・ベビー関連ジャンルのみ)で再判定 | **required**(official_apiと同じ論点+snapshot保持期間) | **PASS(条件付き)**(導入はoperational_decisionとlegal_review完了に従属) |
| scheduled_html_monitoring(定期HTML巡回) | 明示的許可なし(automated_htmlと同じ) | 不採用(prohibited) | — | **FAIL** |

official_api / scheduled_api_snapshot のPASS条件(すべて満たすこと):

1. アプリ登録・applicationId/accessKey管理(キーはコミットしない)
2. 1 application_idにつき1秒1回以下。リトライも含めて超過させない
3. クレジット表示(「Supported by Rakuten Developers」等、HTML無改変)
4. ウェブサービス使用部分では楽天サイトへのリンクを設置し、楽天サイト以外へのリンクを置かない
5. 価格・availabilityのキャッシュは24時間以内、その他の項目は3ヶ月以内。楽天の削除指示に直ちに従う
6. 価格・availabilityを表示する場合は少なくとも週1回刷新。1時間毎以上更新しない場合は取得日時+免責文言を隣接表示
7. 楽天アフィリエイト対象商品へのリンクは楽天アフィリエイト(またはFAQで許可されたTGアフィリエイト)で作成
8. 取得情報を不特定多数と共有可能な場所(公開リポジトリ等)に保管しない
9. アフィリエイト報酬率(affiliateRate)をIRODORI得点に反映しない

## 利用方式A〜Lの判定(既存3媒体との横断比較用)

| 方式 | 判定 | 根拠 |
|---|---|---|
| A 人がブラウザで読み手動構造化 | **PASS(条件付き)** | 通常閲覧+事実(順位・更新日・集計日)の短い内部メモ。原文・画像を保存しない |
| B AIブラウザで少数ページ→出典付き短い要約 | **PASS(条件付き)** | 少数ページの閲覧はAと同等。大量取得・定期巡回をしない |
| C HTML自動取得・構造化 | **FAIL** | 明示的許可なし+robots.txt Disallow+公式APIが存在するため不採用 |
| D 定期巡回による更新検知(HTML) | **FAIL** | 同上 |
| E 公式API・RSS・データ提供 | **PASS(条件付き)** | 4媒体で唯一、公式APIが存在し利用が明示的に許諾される(条件は上記9項)。内部分析専用利用の目的適合性はRequires Legal Review |
| F 客観的商品仕様だけ確認 | PASS(条件付き) | 商品ページの仕様は確認・照合用途のみ。IRODORIの仕様根拠は公式一次情報を優先 |
| G 編集部評価のテーマ・論点構造化 | **NOT_APPLICABLE** | 楽天ランキングは売上集計であり編集評価ではない(editorial_evaluationの対象外) |
| H 口コミ1投稿単位の保存 | **FAIL** | IRODORI方針。なおランキングAPIはレビュー本文を返さない(reviewCount/reviewAverageのみ) |
| I 件数・肯定/否定傾向のみ保存 | **PASS(条件付き)** | reviewCount・reviewAverageはAPIの正式な出力項目。キャッシュ期間(3ヶ月)内で保存。無条件の共通得点化は禁止 |
| J 他媒体順位の参考メタデータ保存 | **PASS(条件付き)** | 順位(rank)はAPIの正式な出力項目。内部保存はキャッシュ規定の範囲内。公開表示は「紹介+リンク」目的に合致し得るが、リンク・クレジット・更新要件の遵守が前提。「楽天1位」等の訴求表現・商標利用はRequires Legal Review |
| K 短い引用の保存 | **NOT_APPLICABLE** | ランキングに引用対象となる記事本文がない(catchcopy等の販促文はitem情報でありK対象外。保存する場合はキャッシュ規定に従う) |
| L URL・ページ名・確認日のみ保存 | **PASS** | 出典メタデータのみ |

## 保存項目ごとの判定

前提: **元のAPIレスポンス全体や商品画像を恒久保存できると推測しない。**
FAQの明文は「価格・販売可能情報24時間 / その他3ヶ月」のキャッシュ許諾であり、
これを超える保持の可否は楽天が明示していない(=恒久保存の根拠はない)。

| 項目 | 保存可否 | 保存期間 | 公開可否 | 更新要件 |
|---|---|---|---|---|
| 媒体名・ランキング名・ページ名・URL・確認日 | PASS | IRODORI内部データとして恒久可 | 可(出典表記) | なし |
| ランキング期間(daily/weekly区分・集計日) | PASS | 事実メタデータ。キャッシュ規定上は「その他の情報」=3ヶ月を上限として扱う | 条件付き可 | 表示時は集計日・更新日を明記 |
| ジャンルID・ジャンル名 | PASS | 同上(3ヶ月扱い。ID自体の再取得は容易) | 条件付き可 | GenreSearch APIで定期再確認 |
| 順位(rank) | PASS(条件付き) | 「その他の情報」= **3ヶ月以内**。それを超える履歴保持はUNKNOWN | 条件付き可(リンク・クレジット・出典/日付明示が前提。「楽天1位」訴求はRequires Legal Review) | 表示時はどの日/週のランキングかを明示 |
| API上の更新日時(lastBuildDate) | PASS | 3ヶ月以内 | 条件付き可 | — |
| 取得日時(IRODORI側) | PASS | IRODORI内部データとして恒久可 | 可 | — |
| itemCode / shopCode | PASS | 3ヶ月以内(識別子としての再取得は容易) | 条件付き可 | — |
| 商品名(itemName) | PASS(条件付き) | 3ヶ月以内 | 条件付き可 | — |
| 商品URL(itemUrl / affiliateUrl) | PASS | 3ヶ月以内(リンク設置はむしろ義務) | 可(楽天サイトへのリンクとして) | リンク切れ時は削除・再取得 |
| 価格(itemPrice等) | PASS(条件付き) | **24時間以内** | 条件付き可 | 表示する場合: 週1回以上刷新。1時間毎以上更新しないなら取得日時+免責文言を隣接表示 |
| availability | PASS(条件付き) | **24時間以内** | 条件付き可 | 同上 |
| reviewCount / reviewAverage | PASS(条件付き) | 3ヶ月以内 | 条件付き可 | 無条件の共通得点化は禁止(IRODORI確定原則) |
| product_identity_id / identity_match_status | PASS | IRODORI内部データとして恒久可(楽天の知財を含まない) | 内部のみ | 名寄せ再判定時に更新 |
| 元のAPIレスポンス(raw JSON) | PASS(条件付き・内部のみ) | **恒久保存不可と扱う**。価格・availabilityを含むため実務上は24時間、監査用でも3ヶ月を上限とし、期限後に削除または楽天知財項目を除去 | **不可**(公開リポジトリ保存は第10条9号に抵触し得る) | 楽天の削除指示に直ちに従う |
| 商品画像(smallImageUrls/mediumImageUrls) | 画像ファイルの複製保存は**不採用**(URL文字列の保存のみ・3ヶ月以内) | — | 表示は楽天配信URLからの都度表示+リンク+クレジットを条件に検討(Requires Legal Review) | — |
| ランキング履歴(日次snapshotの蓄積) | PASS(条件付き・内部のみ) | **3ヶ月以内**(キャッシュ規定の明文上限)。3ヶ月を超える履歴・アーカイブはUNKNOWN。順位から作るIRODORI派生集計(irodori_7day_*)の長期保持が「キャッシュ」を超える利用に当たるかはRequires Legal Review | 履歴そのものの公開は不採用(当面) | — |

## 商品identity(楽天店舗商品とIRODORI商品モデルの分離)

- 楽天のランキングエントリは**店舗商品(shop × item page)単位**。同一製品が複数店舗から
  別エントリとして同時ランクインする(ベビージャンルのデイリーで実例を確認)。
  サイズ・色・数量のvariantは1つの商品ページに包含され価格幅(hasPriceRange・itemPriceMin/Max)で
  表現される構造が観察されるが、**variantや複数店舗の売上をどう集計して順位化するかの公式説明は未確認(UNKNOWN)**。
- 楽天側キー: `rakuten_item_code`(itemCode) / `shop_code`(shopCode) / `item_name`(itemName) / `item_url`(itemUrl)
- IRODORI側キー: `product_identity_id` / `model_year` / `market` / `model_number` / `variant`
- 対応付けは `identity_match_status` で管理: `confirmed` / `probable` / `unmatched` / `unverified`
- **商品名の一致だけで自動的にconfirmedにしない。** confirmedには型番・モデル年・公式情報との照合など
  複数根拠を要する(product-identity-rules.mdの既存原則に従う)。
- 1つの`product_identity_id`に複数の楽天店舗商品(itemCode)がぶら下がる1:N構造を正とする。
  IRODORI側で「その製品の最高順位」を示す場合は、複数店舗エントリの存在と集計方法を明示する。

## ランキングへの接続(IRODORI側の確定原則の再適用)

初期段階では楽天順位をIRODORI scoreへ入れない。

使用可能な用途候補(すべて得点化しない・出典と期間を明示する):

- 最新の人気傾向表示(market_demand_signal)
- デイリー上位バッジ / 週間上位バッジ(公開表示はリンク・クレジット・法務確認が前提)
- ランクイン継続日数(irodori_7day_rank_presence)
- 急上昇候補の検出 / 人気安定性(irodori_7day_rank_stability)
- 商品調査の優先順位決定 / データ更新対象の優先順位決定(内部運用)

使用禁止:

- 品質点への直接変換
- 総合得点への無条件加算
- 楽天順位だけによるおすすめ認定
- 他媒体順位(マイベスト・価格.com・たまひよ)との平均・合算
- アフィリエイト報酬率(affiliateRate)による加点
- レビュー平均点(reviewAverage)の無条件共通得点化

## 禁止事項(IRODORI側の自主ルール)

HTMLスクレイピング・定期HTML巡回・APIキーのリポジトリ保存・1秒1回超のリクエスト・
rawレスポンスの恒久保存/公開・商品画像ファイルの複製保存・楽天知財の公開リポジトリ格納・
「楽天1位」をIRODORI評価として流用すること・順位の得点化・affiliateRateによる優遇

## 必要な人間確認

1. IRODORIの収益モデル(既存アフィリエイト構成)と規約第10条4号・5号(楽天アフィリエイト以外の収入・
   他社アフィリエイト併用禁止)の適合確認 — **導入前必須**
2. 「市場人気・需要の鮮度指標」としての内部分析専用利用が、FAQの利用目的
   (商品を紹介しリンクする目的)に適合するかの法務確認
3. 公開コンテンツで「楽天デイリー/週間ランキング◯位」に言及する場合の表現・商標(「楽天」)・クレジット表示の確認
4. アプリ登録時の登録情報(用途・想定QPS)の記載内容の確認

## 未確認事項(UNKNOWN)

- **APIでデイリーランキングを取得できるか**(period許容値は"realtime"のみ記載。未指定時の集計期間も記載なし)
- **APIで楽天公式週間ランキングを取得できるか**(週間API対応=**UNKNOWN**)
- APIの`title`・`lastBuildDate`が示すランキングの正確な集計期間
- ランキングの集計方法(注文件数か販売額か、同一購入者の除外、variant・複数店舗の集計方法)の公式説明
- 過去日付のランキングアーカイブの公式提供(robots.txtに`/weekly/date=*`のDisallowがあるが、
  アーカイブページの存在・利用可否は未確認)
- 3ヶ月キャッシュ期限を超えるランキング履歴保持の可否
- 想定QPS申告値と実際の利用制限の関係
- TGアフィリエイト併用FAQの最新性(規約本文は2012年改定のまま)

## 推奨する初期運用(Proposed Default — 規約上の明示的許可と混同しない)

1. 当面は方式B(AIブラウザで少数ページ閲覧)により、ベビー関連ジャンルのデイリー・週間の
   上位商品名・順位・集計日をURL・確認日付きで短く構造化(`external_sales_ranking_metadata`・内部のみ)。
2. official_api採用の前提条件(法務確認1・2)を解消後、アプリ登録→少数ジャンル・1日1回以内の
   scheduled_api_snapshotを再判定。導入時もrawレスポンスは3ヶ月以内で削除し、価格・availabilityは24時間で失効させる。
3. 楽天順位は得点化せず、`market_demand_signal`(内部の調査優先度・鮮度指標)として使う。
4. 公開表示(バッジ等)は法務確認完了まで行わない。

## 自動化採否

**conditional_api_only**(C・D・HTML系は prohibited_automation。
official_api / scheduled_api_snapshot のみ、法務確認完了とPASS条件9項の遵守を前提に採用可能。
本監査時点ではAPI未使用・未導入)

## 再確認期限

2026-10-15(既存3媒体と同じ。規約・FAQ・API仕様(特にperiod許容値)・robots.txtを再確認)

## 根拠一覧

1. https://webservice.rakuten.co.jp/guide/rule (楽天ウェブサービス規約、制定2006-12-14・最終改定2012-06-28) — 2026-07-15 12:36 JST日本語原文確認
2. https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking (楽天市場ランキングAPI 2022-06-01仕様) — 2026-07-15 12:30 JST確認
3. https://webservice.rakuten.co.jp/documentation/ichiba-genre-search (楽天ジャンル検索API 2026-07-01仕様) — 2026-07-15 12:38 JST確認
4. https://webservice.rakuten.co.jp/guide/credit (クレジット表示方法と注意) — 2026-07-15 12:22 JST確認
5. https://webservice.faq.rakuten.net/hc/ja/articles/900001974343 (キャッシュ期間・表示更新頻度・免責文言) — 2026-07-15 12:25 JST原文確認
6. https://webservice.faq.rakuten.net/hc/ja/articles/900001974363 (利用目的の限定) — 2026-07-15 12:26 JST原文確認
7. https://webservice.faq.rakuten.net/hc/ja/articles/900001974383 (1秒1回制限) / 900001974403 (緩和不可) / 900001970766 (超過時) — 2026-07-15 12:27〜12:29 JST原文確認
8. https://webservice.faq.rakuten.net/hc/ja/articles/900001970866 (TGアフィリエイト併用可) / 900001970826 (有償ツール不可) / 900001970786 (他社サービス併置) — 2026-07-15 12:28〜12:29 JST原文確認
9. https://ranking.rakuten.co.jp/ ・ /weekly/ ・ /daily/100533/ ・ /weekly/100533/ (期間タブ・更新日・集計日表示) — 2026-07-15 12:15〜12:40 JST閲覧
10. https://ranking.rakuten.co.jp/robots.txt — 2026-07-15 12:41 JST確認
