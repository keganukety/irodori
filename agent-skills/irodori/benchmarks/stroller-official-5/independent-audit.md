# ベビーカー5商品公式情報ベンチマーク 独立監査

監査日: 2026-07-17

監査範囲: 保存済みメーカー日本公式source、claim、normalized feature、5商品matrix、提案ルーブリック、生成・validator・テスト。外部Web再調査、実在商品の得点・順位・感度分析は行っていない。

## baseline_audit

対象commit: `6bf90ce Add five-product official stroller benchmark`

集計: **PASS 18 / FAIL 2 / UNKNOWN 0**

| # | 監査項目 | 判定 | baseline結論 |
|---:|---|---|---|
| 1 | 5商品のidentity分離 | PASS | 5つの一意なproduct identityとrunを確認。 |
| 2 | 旧モデル・海外仕様混入なし | PASS | JP公式sourceのみ。 |
| 3 | model_year不明を推測しない | PASS | 国内3商品はnull。 |
| 4 | variant code分離 | PASS | カラーコードはvariant側。 |
| 5 | 国内世代記号を年式へ変換しない | PASS | AC / LA / RB5を西暦年へ変換していない。 |
| 6 | source→claim追跡 | PASS | claim参照がsourceに実在。 |
| 7 | claim→normalized feature追跡 | PASS | supporting claim参照が整合。 |
| 8 | manufacturer claim分離 | PASS | claim classを区別。 |
| 9 | 不明値null保持 | PASS | 未確認を0/falseにしない。 |
| 10 | 公式情報内矛盾保持 | PASS | Melioの対象月齢矛盾をconflictingで保持。 |
| 11 | 原単位保持 | PASS | kg / L等を換算しない。 |
| 12 | 測定条件差の構造化 | **FAIL** | matrixに`measurement_scope`、`measurement_condition`、`approximation_status`、`comparability_status`、`comparability_reason`がなく、validatorも欠落を検出しない。 |
| 13 | matrix再現性 | PASS | generator再計算と一致。 |
| 14 | coverageは得点ではない | PASS | データ充足率として分離。 |
| 15 | 実在score・順位なし | PASS | ranking成果物なし。 |
| 16 | 第三者・楽天混入なし | PASS | メーカー公式のみ。 |
| 17 | 既存CYBEX run保全 | PASS | 不必要な変更なし。 |
| 18 | 機構factから実走性能を示唆しない | **FAIL** | タイヤ/サスペンション機構と「段差乗り越えに優れた」訴求が`clm-rnf5-008`のofficial spec/factへ混在し、選定文にも性能を示唆する表現が残る。 |
| 19 | local product紐付けを過剰昇格しない | PASS | probable以下、Runfeeはunmatched。 |
| 20 | 70行matrix参照整合 | PASS | product / feature / claim / sourceが整合。 |

## final_audit

対象: 今回の変更後worktree（commit前最終成果物）

集計: **PASS 19 / FAIL 0 / UNKNOWN 1**

| # | 監査項目 | 判定 | final結論と根拠 |
|---:|---|---|---|
| 1 | 5商品のidentity・variant分離 | PASS | `benchmark-manifest.json`、各`product-identity.json`、全5 `validate-run.mjs`が整合。 |
| 2 | 旧モデル・海外仕様・第三者データ混入なし | PASS | `validate-benchmark.mjs`が公式host・メーカー発信・第三者/楽天不存在を検証。 |
| 3 | generation_codeを年式・型番へ昇格しない | PASS | AC / LA / RB5を`generation_code`へ置き、`model_year` / `model_number`はnull。各runとrubric validatorで検証。 |
| 4 | source→claim→feature→matrix参照整合 | PASS | 全5 runと70行matrixの参照・値・単位・statusがvalidatorを通過。 |
| 5 | 不明・矛盾を推測補完しない | PASS | null/unconfirmed/conflictingを維持し、unknownを0/falseにしない。 |
| 6 | measurement metadata 5項目 | PASS | `official-feature-matrix.json`の数値7軸×5商品=35件に5項目を構造化。`validate-benchmark.mjs`が必須・enum・reason・件数を検証。 |
| 7 | 不明weight scopeをunknown保持 | PASS | scope非明示は`manufacturer_stated_unspecified` + condition/comparability unknown。除外付属品明示値はcondition保持 + partial。 |
| 8 | weight scope pairwise規則 | PASS | same known/full、unspecified同士・approximate/partial、included対excluded・lightest対standard/not_comparable、判別不能/unknownをfixtureで検証。partial→full自動昇格なし。 |
| 9 | 4つの主観軸分類 | PASS | `axis-classification.json`、README、decision logが4軸すべて同じ分類。validatorが完全一致を検査。 |
| 10 | 4scenario eligibility | PASS | 1/6/7/7か月開始、36か月または15kg上限、newborn/seat非必須、compactの重量・折りたたみ寸法必須を検証。ineligible非0点、unknown/on_hold。 |
| 11 | Proposed boundary grid | PASS | 指定4 gridをproposed / provisional_approved / non-permanent / sensitivity requiredで保持。配点未定義。 |
| 12 | 約表記の暫定±5% | PASS | 元値非書換え、境界跨ぎは隣接band候補、誤差・公差でないことをvalidator/testで確認。 |
| 13 | Fold step暫定定義 | PASS | 明示された機構状態変更操作、除外5操作、同時/順次規則、不明null/unconfirmedを構造化し検証。 |
| 14 | Optional欠損 | PASS | 0/falseにせずcoverageを下げ、全subaxis欠損はparent unavailable。required欠損はon_hold。coverage閾値未採用。 |
| 15 | kg/L非換算とbounding-box意味制限 | PASS | basket単位変換を拒否し、外接直方体を実占有体積としない。 |
| 16 | 二重加点防止 | PASS | body weightは`transport_burden`のみ。carry fact、seat-removal semantic alias、editorial compositeの再加点をvalidator/testで防止。 |
| 17 | 機構factとメーカー訴求の分離 | PASS | `clm-rnf5-008`は機構fact、`clm-rnf5-020`はmanufacturer claim。選定理由もmanufacturer positioning / claimとして明示。maneuverabilityはunscored。 |
| 18 | Maneuverability将来試験候補 | PASS | 180度旋回、スラローム、段差、直進偏位、荷重、路面、タイヤ、操作者/手順を構造化。条件確定までunscored。 |
| 19 | 実在商品score・順位・感度分析結果不存在 | PASS | 禁止key/成果物名を全実在run・benchmarkで走査。実在商品のscore、rank、ordinal、星、勝者、おすすめ認定、感度分析結果なし。 |
| 20 | 同意gate先の取説由来情報 | **UNKNOWN** | アップリカ・ピジョンは`manual_gate_status: skipped_terms_acceptance_required`。AIは同意せず、取説由来値は人間取得まで確認不能。Known limitationでありPR blockingではない。 |

## 前回FAIL 2件の処理

1. **測定条件差**: generatorが数値比較行へ5 metadataを決定論的に生成し、matrixに35件を保存。validatorが欠落・enum・参照・unknown保持をFAIL可能にした。`selection-report.md`の「5商品中最軽量」断定も削除した。
2. **走行性能表現**: Runfeeの機構factと段差訴求を別claimへ分離。benchmark / rubric文書ではタイヤ、サスペンション、オート4輪等を実走性能へ昇格せず、manufacturer claimまたはselection rationaleとして明示した。

## 最終判断

最終20項目は**FAIL 0**。実在5商品はraw fact、比較可能性、measurement scope、scenario eligibility候補まで利用できる。score・順位・感度分析へは未進行で、配点、coverage閾値、第三者走行試験の具体条件、取説同意gate先の情報は未確定のまま残す。
