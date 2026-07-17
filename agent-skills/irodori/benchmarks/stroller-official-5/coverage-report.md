# stroller-official-5 — データ充足率(coverage)報告

- 作成日: 2026-07-16
- 数値の出所: `official-feature-matrix.json`(`build-feature-matrix.mjs`で決定論的に生成。`validate-benchmark.mjs`が独立再計算で一致を検証)
- **本報告はデータ充足率のみを扱う。score・observed_score・順位・優劣は一切含まない。**
- 旧10軸のweighted coverageはbaseline再現用の診断値であり、今回の4親軸ルーブリック、配点、coverage閾値として採用していない。

## 1. 商品別の通常data coverage(ベンチマーク14軸ベース)

confirmedのみを充足とみなす(conflicting / unconfirmedは不算入)。

| 商品 | confirmed軸数 | data coverage(14軸) |
|---|---|---|
| コンビ スゴカル エッグショック LA | 13/14 | **0.9286** |
| アップリカ カルーンエアー メッシュ AC | 11/14 | 0.7857 |
| CYBEX Libelle 2026 | 11/14 | 0.7857 |
| CYBEX Melio Carbon 2026 | 11/14 | 0.7857 |
| ピジョン Runfee RB5 | 9/14 | **0.6429** |

## 2. 商品別のweighted data coverage候補(電車移動向け・試験値)

電車移動向けランキング定義案の10軸(weight_body 0.17 / size_open 0.13 / size_folded 0.12 / folding_ease 0.13 / self_standing 0.08 / portability 0.10 / train_fitness 0.10 / maneuverability 0.06 / basket_capacity 0.05 / one_operator_fitness 0.06 — **すべて試験値(proposed)**)に対する充足。

| 商品 | 定義10軸中confirmed | data coverage(10軸) | weighted data coverage候補 |
|---|---|---|---|
| CYBEX Melio Carbon 2026 | 6 | 0.60 | **0.68** |
| ピジョン Runfee RB5 | 5 | 0.50 | 0.60 |
| コンビ スゴカル エッグショック LA | 5 | 0.50 | 0.55 |
| アップリカ カルーンエアー メッシュ AC | 4 | 0.40 | 0.47 |
| CYBEX Libelle 2026 | 4 | 0.40 | 0.47 |

## 3. 軸別の確認可能商品数(5商品中)

| axis_id | confirmed | 内訳 | 観測単位 |
|---|---|---|---|
| weight_body | **5/5** | 全商品confirmed | kg |
| size_open | **5/5** | 全商品confirmed | mm |
| size_folded | **5/5** | 全商品confirmed | mm |
| basket_capacity | **5/5** | 全商品confirmed | **kg×4 / L×1(定義不一致)** |
| care_ease | **5/5** | 全商品confirmed | — |
| target_age | 4/5 | Melioがconflicting(新生児表記矛盾) | month |
| max_load | 4/5 | Pigeonがunconfirmed(公式ページに体重上限なし) | kg |
| warranty | 4/5 | Pigeonがunconfirmed(取説未取得) | — |
| caution | 4/5 | Pigeonがunconfirmed(取説未取得) | — |
| newborn_ready | 4/5 | Melioがconflicting | — |
| included_accessories | 3/5 | Aprica・Pigeonがunconfirmed(取説未取得) | — |
| price | 3/5 | CYBEX2商品がunconfirmed(公式ページに価格非表示) | 円(税込)※表記種別が3通り |
| folding_ease | **2/5** | Melio・Pigeonのみconfirmed | — |
| self_standing | **2/5** | Melio・Combiのみconfirmed | — |

## 4. 5商品すべてで確認できる軸

`weight_body` / `size_open` / `size_folded` / `basket_capacity` / `care_ease` の5軸。
ただしbasket_capacityは単位定義が分裂(下記6節)しており、そのままでは横比較できない。

## 5. 一部商品でしか確認できない軸

- `folding_ease`(2/5)・`self_standing`(2/5): 公式が機構として明記する場合しか取れない。取説を取得できれば改善する見込み(Combiは取説で自立を確認できた)
- `included_accessories`(3/5)・`warranty`(4/5)・`caution`(4/5): 主に取扱説明書由来。取説が同意ゲートで未取得のメーカー(アップリカ・ピジョン)で欠落
- `price`(3/5): CYBEXは日本公式ページに価格を表示しない
- `max_load`(4/5): ピジョンは公式ページに体重上限を明記しない(安全基準A形からの推定は行っていない)

## 6. 公式情報では取得困難な軸

電車移動向け定義10軸のうち、次の4軸は**5商品全てで取得不能**だった:

- `portability`(持ち運びやすさ) / `train_fitness`(電車移動適性) / `maneuverability`(走行性・小回り) / `one_operator_fitness`(ワンオペ適性)

これらはordinal(評価傾向)軸であり、公式情報は「持ちカルグリップ搭載」「シングルタイヤ」等の**機構事実**までしか提供しない。主観評価への変換は固定ルーブリック承認または第三者実測が必要。宣伝表現(『階段、電車、バスでも便利』『機内持ち込み対応設計』等)はmanufacturer_claimとして分離済みで、客観仕様として保存していない。

## 7. メーカー間で定義が異なる軸

| 軸 | 定義差 |
|---|---|
| `basket_capacity` | CYBEX×2・アップリカ・コンビは**耐荷重(kg)**、ピジョンは**容量(L)**を公表。相互換算せず、初期scoreから除外して説明用に限る |
| `weight_body` | コンビは「ダッコシート除く」、ピジョンは「ハグットシート除く」の条件付き。CYBEX・アップリカは条件表記なし。付属シート込み/抜きの条件を跨いだ比較には条件正規化ルールが必要 |
| `size_open` | アップリカ・CYBEXは単一値、コンビは奥行/高さが可変範囲、ピジョンは背面位/対面位の2状態。現状は「最大値・背面位」への正規化を各runのnotesに明記 |
| `price` | メーカー希望小売価格(アップリカ)/公式ストア税込価格(コンビ)/税込価格(ピジョン)と表記種別が異なり、CYBEXは非表示 |
| `target_age` | 上限表現が「36カ月」「約3年」「約4年」「22kgに達するまで」と月齢/体重で分かれる |

## 8. ランキングへ使う前にルーブリック(または契約整備)が必要な軸

1. `portability` / `train_fitness` / `maneuverability` / `one_operator_fitness` — 公式機構事実→ordinal変換の固定ルーブリック承認が必須(現状0/5)
2. `basket_capacity` — kg/L単位混在の解消ルール(単位別サブ軸化 or 換算禁止の明文化)が必須
3. `weight_body` — 付属品込み/抜き条件の正規化ルール
4. `folding_ease` — boolean(片手可)の判定基準(『ワンタッチ開閉』を片手可とみなすか等)の明文化
5. terminology未定義の候補軸 — リクライニング角度・タイヤ/ホイール仕様・安全基準・シート向き(seat_direction)・ハンドル高さ調節・携行補助(carry_assistance)・トラベルシステム互換・折りたたみ手順数(fold_steps)・バスケットアクセス。現在はaxis_id: nullのclaimとして保持しており、比較軸に昇格するにはdata-contracts.mdのバージョン管理に従う語彙追加が必要

## 9. Baseline coverage閾値診断(不採用)

以下は基準時点の再現用履歴であり、現在のoperational decisionではない。coverage閾値は未採用である。

**(a) ベンチマーク14軸のdata coverageに min_data_coverage 0.7(proposed)を当てた場合**

- 通過: コンビ(0.93)・アップリカ(0.79)・Libelle(0.79)・Melio(0.79)
- 未達: **ピジョン Runfee RB5(0.64)** → 取説未取得の4軸(max_load/warranty/caution/included)が主因。取説を取得できれば0.7超の見込み

**(b) 電車移動向け定義(10軸)に min_data_coverage 0.7 / min_weighted_data_coverage 0.75(いずれもproposed)を当てた場合**

- **5商品すべて未達**(data coverage最大0.60・weighted最大0.68)
- 主因はordinal4軸(weight合計0.32)が公式情報のみでは全商品0であること
- さらにbasket_capacity(weight 0.05)はkg値4商品がscoring rule(単位L)と不整合のため、実質的なscore可能weightはさらに低い
- 結論: **公式情報だけでは電車移動向けランキングの入力要件を満たせない**。ルーブリック承認+取説取得+第三者実測のいずれかで軸を埋める必要がある

※ 本報告のcoverageはランキング参加可否の機械判定を試算したものであり、商品の優劣を示すものではない。
