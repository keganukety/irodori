# product-identity-rules — 商品同定ルール(正本)

区分ラベル: **[C] = Confirmed Principle / [P] = Proposed Default / [O] = Open Decision / [U] = Unverified**

## 1. 原則 [C]

- 商品同定は全工程の**最初**に行う。同定前に収集した情報を現行商品の根拠へ混ぜない。
- 同定できない情報は捨てずに隔離する(`identification_status: unidentified` のまま保持し、
  ランキング・比較の入力から除外する)。

## 2. 同定で区別する要素 [C]

商品モデルの基本identityは、**ブランド + 正式商品名 + モデル年 + 対象市場 + 型番**の
組み合わせとする。同定済み(`identified`)にするには5要素すべての根拠が必要。

| 要素 | フィールド(→ data-contracts.md) | 備考 |
|---|---|---|
| 正式商品名 | `official_name` | メーカー公式表記を正とする |
| ブランド・メーカー | `brand_name` / `manufacturer_name` | ブランドと製造元が異なる場合は両方 |
| 型番 | `model_number` | 公式表記。複数体系がある場合は列挙 |
| モデル年 | `model_year` | 「2026年モデル」等。不明なら null + unconfirmed |
| 国内仕様・海外仕様 | `market` | `JP` / `overseas` / `unknown` |
| 現行品・販売終了品 | `lifecycle_status` | `current` / `discontinued` / `unknown` |
| 旧モデル・後継モデル | `predecessor_of` / `successor_of` | product_identity間の参照 |
| 色違い・仕様違い | `variant_of` + `variant_axis` | 仕様同一の色違いは同一identity。仕様差は別identity候補 |
| メーカー公式URL | `official_url` | 同定の基準点 |

## 3. 同定手順 [C](手順) / [P](細部)

1. メーカー公式サイトで正式商品名・型番・発売時期を確認し、`product_identity` を作る。
2. 公式で確認できた要素には同定根拠(`identification_evidence` = source_record ID)を付ける。
3. 以降に収集する全 `source_record` で、記事中の商品名・型番表記(`model_number_as_written`)を
   `product_identity` と照合する。
4. 照合結果を3値で記録する:
   - `matched` … 型番または公式名で一致を確認
   - `probable` … 名称は一致するが型番・年式を確認できない(根拠をnotesに書く)
   - `unmatched` … 別商品・別モデル年・別市場仕様の可能性がある
5. `unmatched` および旧モデル・海外仕様と判明した情報は、現行 `product_identity` の
   evidence として使わない。該当する別の `product_identity`(旧モデル等)を作るか、隔離する。

## 4. 新旧モデルの混同防止 [C]

- 記事の公開日がモデルの発売時期より古い場合、その記事は旧モデルを扱っている可能性を
  必ず検討し、判断根拠を記録する。
- 「同名だがリニューアルで仕様変更された商品」は、モデル年または型番が異なれば
  別 `product_identity` として扱う。
- 発売日・リニューアル情報は `official_news` 等の一次情報で確認する。確認できない場合、
  `model_year` は `unconfirmed` のままにする(推測で埋めない)。

## 5. 色違い・仕様違いの扱い [C]

- 色のみが異なり仕様が同一なら、同じ `product_identity` のvariantとして扱う。
- 重量・素材・付属品・機能・対象月齢などに差がある場合は別identity候補とし、
  確認できた差を根拠に `variant_of` で関連付ける。
- 差の有無を確認できない場合は統合せず、`provisional` の別identity候補として隔離する。

## 6. 既存サイトデータとの対応 [U](実データ) / [P](対応方針)

- 既存 `products` テーブルには `model_number`(品番)・`brand_id`・`category`(テキスト)が
  存在するが、`model_year`・市場仕様のカラムは存在しない(2026-07-15 の読み取り監査時点)。
- 実データの充足状況は Unverified(`docs/product-diagnosis-plan.md` にも未確認と明記がある)。
- 本スキル群の `product_identity` は既存 `products.id` と別のID体系とし、
  対応付けフィールド(`site_product_id`)で任意リンクする [P]。既存テーブルへの
  書き込み・変更はこの段階では行わない [C]。
