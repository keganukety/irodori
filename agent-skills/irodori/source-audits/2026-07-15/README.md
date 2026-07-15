# 情報源利用方針監査 (2026-07-15) — マイベスト / 価格.com / たまひよ

第三者媒体を正式採用する前の「情報源利用方針監査」の成果物。
商品レビュー・口コミの収集そのものは行っていない。

- 調査日時: 2026-07-15 20:52〜21:05 JST(ページごとの確認時刻は各媒体ファイルに記載)
- 実施: claude-code(AIブラウザ・WebFetch・curlによる少数ページの通常閲覧のみ。自動巡回・大量取得なし)
- 位置づけ: **本監査は法的助言ではない。** IRODORIの安全な運用設計のための技術・運用上の調査であり、
  法的判断はすべて「Requires Legal Review」として保留する。

## ファイル構成

| ファイル | 内容 |
|---|---|
| [my-best.md](my-best.md) | マイベスト(my-best.com)の監査 |
| [kakaku-com.md](kakaku-com.md) | 価格.com(kakaku.com)の監査 |
| [tamahiyo.md](tamahiyo.md) | たまひよ(st.benesse.ne.jp)の監査 |
| [source-adoption-matrix.md](source-adoption-matrix.md) | 3媒体の横断比較(利用方式A〜L・保存項目・役割) |
| [decision-log.md](decision-log.md) | Confirmed Fact / Operational Decision / Proposed Default / Unverified / Requires Legal Review |

## 監査の前提(全媒体共通)

1. 過去の記憶・チャットにある規約を現在の事実として扱わず、2026-07-15時点の公開ページを直接確認した。
2. 検索エンジンは公式ページの発見にのみ使用し、検索結果スニペットを根拠にしていない。
   スニペット由来の情報は各ファイルで「Unverified」と明記した。
3. robots.txtだけで著作権・利用許諾を判断しない。robots.txtは自動クローラー向けの技術的表明であり、
   規約上の許諾とは別物として記録した。
4. 明示的な許可が確認できない自動取得方式(C: HTML自動取得 / D: 定期巡回 / E: API)は、推測でPASSにしていない。
5. 確認できない事項はUNKNOWNまたはUnverifiedのまま残した。

## 判定記号

- **PASS** … 公開規約・公式説明の範囲で、記載の条件付きなら実施可能と判断(運用判断であり法的判断ではない)
- **FAIL** … 公開規約に明示的な禁止・制限があり、承諾なしには実施しない
- **UNKNOWN** … 判断材料不足。実施しない(保留)
- **NOT_APPLICABLE** … その媒体に該当する機能・コンテンツがない

## 結論の要約

| 媒体 | 運用区分 | 自動化 | 当面の役割 |
|---|---|---|---|
| マイベスト | browser_assisted_review + manual_reference_only(公開利用はunknown_pending_review) | prohibited_automation | editorial_evaluation(論点参考・保留付き) |
| 価格.com | unknown_pending_review(閲覧を超える利用は保留) | prohibited_automation | not_adopted(当面) |
| たまひよ | manual_reference_only + browser_assisted_review | prohibited_automation | review_theme_source / external_ranking_metadata(内部) 候補 |

- 推奨する最初の第三者媒体: **たまひよ**(理由はsource-adoption-matrix.md)
- 推奨する最初の取得方法: **方式B**(AIブラウザで少数ページを読み、出典URL付きの短い構造化要約を作成。
  原文本文・画像・表の保存なし、公開前に人間確認)
- 再確認期限(Proposed Default): **2026-10-15**(3ヶ月後。規約改定・API提供状況・robots.txtを再確認)
