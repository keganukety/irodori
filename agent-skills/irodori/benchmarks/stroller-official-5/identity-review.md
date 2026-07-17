# stroller-official-5 — identityレビュー(ローカルproductsとの関連含む)

- 作成日: 2026-07-16
- 全5商品のidentification_statusは**provisional**(いずれもモデル年またはモデル共通型番のどちらかが未確認のため、契約上identifiedにできない)
- ローカルproducts値は`src/data/fallback-products.ts`を読み取り専用で参照。**ローカル値は公式根拠として使用していない**

## 1. 商品別identity要約

| 商品 | brand | generation_code | model_number | model_year | market | lifecycle | variant数 | identity確度 |
|---|---|---|---|---|---|---|---|---|
| Melio Carbon | CYBEX | null | null(未確認) | 2026 | JP | current | 1(Cinnamon Yellow 526000803) | provisional |
| カルーンエアー メッシュ AC | アップリカ | **AC** | null(色別品番のみ) | null | JP | current | 2(BE 2206924 / GR 2206925) | provisional |
| スゴカル エッグショック LA | コンビ | **LA** | null(未確認) | null | JP | current | 3(119376/119377/119767) | provisional |
| Runfee RB5 | ピジョン | **RB5** | null(未確認) | null | JP | current | 2(1042807/1042808) | provisional |
| Libelle | CYBEX | null | null(未確認) | 2026 | JP | current | 1(Cinnamon Yellow 526001009) | provisional |

### model_numberとvariantの扱い(方針の確認)

- カラー別の品番/商品コードはすべて`variants[].product_code`へ分離し、`model_number`に入れていない(バリデーターで機械検証)
- 国内3商品のAC / LA / RB5は公式商品名に含まれる`generation_code`として保持し、`model_year` / `model_number`へ昇格させない
- コンビの『型式: LA』(取説DLページ表記)は、モデル共通型番かグレード記号かの公式定義が未確認のためsource/claimへの保持に留めた(人間判断事項)
- 全variantの色間仕様同一性は`specification_equivalence_status: unverified`(色別仕様表が存在しないため)

## 2. ローカルproductsとの関連(site_product_match)

| 商品 | site_product_id | match_status | 一致点 | 不一致点・人間レビューが必要な点 |
|---|---|---|---|---|
| Melio Carbon 2026 | 4「メリオ カーボン 2026」 | probable | 名称・ブランド・重量5.9kg・モデル年・税込74,800円(公式価格は未確認のため照合不能) | モデル共通型番が両側で未確認。公式ページに価格表示がなくローカル価格の由来確認が必要 |
| カルーンエアー メッシュ AC | 5「カルーンエアー メッシュ AC」 | probable | 名称完全一致・ブランド・重量3.9kg・税込37,400円 | ローカルに型番情報がなく型番照合不能。名称+仕様一致のみでconfirmedにはしない |
| スゴカル エッグショック LA | 3「スゴカル エッグショック LA」 | probable | 名称完全一致・ブランド・重量4.6kg・対象月齢 | **価格不一致: ローカル32,000円 vs 公式ストア48,000円**。ローカル値の由来(セール価格・旧価格・別チャネル)の確認が必要 |
| Runfee RB5 | なし | **unmatched** | — | ローカルproductsにランフィ系の登録がない。サイトで扱う場合は新規登録判断が必要 |
| Libelle 2026 | 7「リベル 2026」 | probable | 名称・ブランド・B型・対象月齢(6ヵ月〜4歳・22kg) | **重量不一致: ローカル6.3kg vs 公式仕様6kg**。ローカル価格29,975円は公式ページで確認不能。ローカル値の測定条件/出所の確認が必要 |

- match_statusは「商品名一致だけでconfirmedにしない」規則(product-identity-rules.md §6)に従い、全件probable以下とした。
- confirmedへの昇格には、モデル共通型番の照合または人間レビューによる同一性確定が必要。

## 3. identity分離の検証結果(ベンチマーク目的1・2への回答)

- **同名ブランド内の分離**: CYBEXでMelio Carbon(2026)/Melio Carbon(2025)/Libelle(2026)/Libelle(2025)を別identityとして分離できた(公式一覧の併載とダウンロードセンターの年式表記が根拠)
- **モデル年 vs 世代記号**: CYBEXは年式(2026)、国内3社は公式商品名に含まれるAC / LA / RB5を`generation_code`として保持する。これらを`model_year` / `model_number`へ自動昇格しない
- **market**: 5商品ともJP専用ページ・日本語資料・円建て(または日本語取説)で確認。海外仕様の混入なし
- **variant**: 5商品とも色別コードをvariantへ分離できた(計9variant)
