# ベビーカー5商品公式情報ベンチマーク 独立監査

監査日: 2026-07-17

対象commit: `6bf90ce Add five-product official stroller benchmark`

監査範囲: 保存済みのメーカー日本公式source、claim、normalized feature、5商品matrix、生成・検証スクリプト。外部Web再調査は行っていない。
判定集計: **PASS 18 / FAIL 2 / UNKNOWN 0 / NOT_APPLICABLE 0**

この監査は事実・参照・比較可能性を検査する。実在商品の得点、順位、星、勝者、おすすめ認定は作成しない。FAILは元データを推測修正せず、比較ルーブリック側で保留・除外する。

## 監査結果

| # | 監査項目 | 判定 | 結論と根拠 |
|---:|---|---|---|
| 1 | 5商品のidentityが分離されている | PASS | 5つの`product_identity_id`とrunが一意。`benchmark-manifest.json`と各`product-identity.json`が対応する。 |
| 2 | 旧モデル・海外仕様が混在していない | PASS | 保存sourceの対象市場はJPで、別年・海外仕様のclaim混入は検出されなかった。 |
| 3 | model_year不明を推測で埋めていない | PASS | 国内3商品は`model_year: null`。CYBEX 2商品だけが2026表記の公式根拠を持つ。 |
| 4 | カラーコードがvariant側にある | PASS | 確認された9カラーコードは`variants[].product_code`にあり、モデル共通型番と分離される。 |
| 5 | 国内世代記号が勝手にmodel_year化されていない | PASS | AC / LA / RB5を西暦年へ変換していない。ただしRB5は`model_number`へ置かれており、今後は`generation_code`候補として保持する必要がある。 |
| 6 | sourceからclaimへ追跡可能 | PASS | 全87 claimの`source_record_id`が各runの`sources.json`に実在する。 |
| 7 | claimからnormalized featureへ追跡可能 | PASS | 値を持つfeatureはclaimを参照し、matrixの参照もrunと一致する。 |
| 8 | manufacturer claimと客観仕様が分離されている | PASS | `manufacturer_claim`と`official_spec`は区別され、メーカー訴求だけを客観値へ昇格していない。例: `clm-sgcla-010`（機構）と`clm-sgcla-011`（訴求）。 |
| 9 | 不明値がnullである | PASS | 未確認featureは`value: null`、`supporting_claims: []`、`independent_source_count: 0`を保持する。 |
| 10 | 公式情報内の矛盾が保持されている | PASS | Melioの対象月齢等の矛盾を`clm-melio26-004,012,014,025,026`と`conflicting`で保持する。 |
| 11 | 単位が正しく保存されている | PASS | kg / L / mm / months等を原単位の意味のまま保持し、basketのkgとLを換算していない。 |
| 12 | 異なる測定条件を同じ値として比較していない | **FAIL** | matrixは重量の付属品除外差、開寸法の背面・対面・可変範囲差を`comparability_status`なしで同一軸のconfirmed値として並べる。根拠: `clm-sgcla-001`、`clm-rnf5-001,014`、`clm-melio26-002`、`clm-sgcla-002`、`clm-rnf5-002,003`。 |
| 13 | coverage計算が再現可能 | PASS | `build-feature-matrix.mjs`と`validate-benchmark.mjs`による独立再計算が保存matrixと一致する。 |
| 14 | weighted coverageが試験値と明示されている | PASS | `value_status: proposed`であり、得点ではなく試験的な充足率と明記される。新ルーブリックの有効性根拠には使わない。 |
| 15 | 実在商品のscore・順位がない | PASS | 5 runとbenchmarkに`ranking_input` / `ranking_result`、実在商品の得点・順位・星・勝者がない。 |
| 16 | 第三者媒体・楽天データが混ざっていない | PASS | sourceはメーカー公式ドメインとメーカー発信のみ。第三者媒体、EC、楽天参照はない。 |
| 17 | 既存CYBEX runが不必要に変更されていない | PASS | commit `6bf90ce`は既存Melio runを変更せず参照している。 |
| 18 | 実在商品の優劣を断定していない | **FAIL** | `selection-report.md` / `benchmark-manifest.json`に、タイヤ・サスペンションという機構事実から「走行安定性」役を示唆する表現と「優位」の語が残る。実走性能の断定には第三者の標準化実測が必要。 |
| 19 | ローカル商品IDがconfirmedへ過剰昇格していない | PASS | site matchはprobable以下、Runfeeはunmatched。ローカル差異は`identity-review.md`に未解決のまま保持される。 |
| 20 | 5商品matrixの参照整合性がある | PASS | 70行（5商品×14軸）のproduct / feature / claim / source / value / unit / status参照が整合する。 |

上表はcommit `6bf90ce`を独立監査した時点の判定を固定している。この変更では項目18の実在商品表現を機構fact中心へ中立化した。項目12は元runの測定条件を推測変更せず、提案ルーブリックで`partial` / `unknown`として保留するため、監査FAILを解消済みと偽装しない。

## 比較不能・未確認として保持する事項

- 重量: Combiはダッコシート除外、Runfeeはハグットシート除外、他3商品は包含範囲不明。異なる既知scope同士は`partial`、不明scopeを含む比較は`unknown`とする。
- 寸法: Runfeeの背面位採用、対面・可変範囲、折りたたみ床置き方向が未統一。向きが確定しない床占有面積は算出しない。
- バスケット: `clm-melio26-006`、`clm-krnac-006`、`clm-sgcla-014`、`clm-rnf5-009`、`clm-lib26-006`はkg / Lが混在する。単一容量軸へ統合しない。
- 折りたたみ: `clm-melio26-007`、`clm-rnf5-011`、`clm-sgcla-024`等の明示範囲を超えて片手展開、手数、屈曲、シート脱着を推測しない。
- 走行性: タイヤ数・径・サスペンション・オート4輪・メーカーの押しやすさ訴求は保存できるが、小回り、段差、直進性の得点根拠にはしない。
- 対象月齢: 「約」表記を精密な境界として扱わず、境界付近は精度状態と人間確認を要求する。

## 同意ゲートとローカル差異

アップリカ `src-krnac-003`、ピジョン `src-rnf5-005`について、AIは利用規約同意操作を行っていない。状態は`skipped_terms_acceptance_required`として提案ルーブリックに保持し、人間が正式取得して提供するまでは取説由来の未確認値を埋めない。

次の差異はDB工程へ送らず、`identity-review.md`の既存問題として保持する。

- スゴカルLAのローカル価格差
- Libelleのローカル重量差
- Runfeeのローカル商品未登録
- `site_product_id`の変更候補

## 独立監査の最終判断

参照整合性、公式source限定、coverage再現性、実在商品の得点・順位不存在は確認できた。一方、測定条件の比較可能性と、機構事実から性能を示唆する表現は修正前提である。したがって、この5商品matrixをそのまま電車移動向け得点へ入力することは**不可**。利用できるのはraw fact候補、欠損・矛盾、比較可能性、scenario eligibility候補までである。
