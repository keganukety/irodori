# Migration前 Decision Matrix（2026-07-17 本番schema監査版）

第1検証フェーズ監査（`../2026-07-17-supabase-gap/README.md` §19）の意思決定事項を、
本番schema read-only監査の結果を踏まえて15項目へ整理し、推奨・代替案・判断根拠を付けたもの。

- 本書は**設計判断資料**であり、migration・DDL・DMLは一切含まない・実行していない。
- 表現区分: **[C] Confirmed** / **[P] Proposed（提案）** / **[O] Open Decision** / **[U] Unverified（未確認）**。
- 本番実測の根拠は `production-probe-results.md`、未実測分の確認手段は `read-only-audit.sql`（未実行）。

各項目の共通評価軸: 推奨 / 代替案 / backward compatibility（BC） / 既存データ移行 / rankingへの影響 /
管理画面への影響 / 公開UIへの影響 / 未決事項。

---

## D-1. products.id の正規型

- **本番実測 [C]**: `products.id` は **bigint・PK・NOT NULL**（service OpenAPIで確定）。uuidではない。
  採番方式（identity / sequence default）は未確認 [U]（`read-only-audit.sql` [1][14]で確認可能）。
- **推奨 [P]**: 既存 `products.id` の実型をそのまま「site側の表示用ID」として凍結し、正規のidentity keyには使わない。
  ランキング系の正規キーは新設 `research_product_identity.product_identity_id`（text, `pid-<slug>`、正本契約と同一値）とし、
  site側との対応は match テーブル（D-4/D-6参照）の `site_product_id` 列に既存id実型で保持する。
- **代替案**: (a) products.idをuuidへ型変更して統一 — 全FK・フロントの動的id処理・affiliate系の書き換えが必要で高リスク。
  (b) products.idを正規キーとして採用 — Runfee（site行が無い可能性）のようなunmatched商品を表現できず不可。
- **BC**: 推奨案は既存products無変更で完全後方互換。
- **既存データ移行**: 不要（matchテーブルに対応行を追加するのみ）。
- **ranking影響**: score対象の同定がpid基準になり、site idの型・欠損に依存しない。
- **管理画面影響**: なし（現行UIはproducts.idのまま動作）。
- **公開UI影響**: なし。
- **未決事項**: matchテーブルの `site_product_id` は実測型bigintで持つのが素直（FK可能）だが、
  正本契約側は string（"4"等）のため投入時に変換規則が要る。bigint固定 vs text保持は実装時に確定。

## D-2. products を公開表示用として凍結するか

- **推奨 [P]**: **凍結（editorial+commerce表示専用として維持）**。仕様の正はランキング系新テーブルに移し、
  productsへの新規カラム追加・意味変更を原則停止する。既存カラムの値更新（表示文言等）は継続可。
- **代替案**: productsを拡張して正データも持たせる — proposed-schema-comparison.md 案Aのとおり、
  scope/unit/evidence_status/複数sourceを1行に持てず P0群を解決できないため非推奨。
- **BC**: 完全互換（select('*')を使う全ページがそのまま動く）。
- **既存データ移行**: 不要。ただしmemo/caution_notesのeditorial純化（D-7）は運用是正として別途実施。
- **ranking影響**: productsはranking入力に使わない、が明確化される（誤接続の防止）。
- **管理画面影響**: 現行UIは無変更。将来「表示用products編集」と「evidence review」を別UI化（既存監査§18-6）。
- **公開UI影響**: 当面なし。将来は表示値を新系統からの同期値へ段階切替（D-6の単方向同期）。
- **未決事項**: 凍結の例外規則（例: 表示専用の派生列を将来追加してよいか）。

## D-3. ranking/evidence を別系統テーブルにするか

- **推奨 [P]**: **別系統テーブル群として新設**（proposed-schema-comparison.md 案B）。
  identity / variant / source / claim / feature / match / ranking系を `research_` / `ranking_` prefixで分離し、
  既存productsとは match テーブル経由の疎結合のみ。
- **代替案**: 案A（productsへカラム追加）— 比較表のとおり不採用推奨。
- **BC**: 完全additive。既存テーブル・既存クエリ無変更。
- **既存データ移行**: 初期投入は正本runs/のJSON（schema 0.4.0）をそのまま流し込む形。products側からの逆移行はしない
  （products値は出典・scope情報を持たないため、evidenceとしては採用不能）。
- **ranking影響**: RankingExecutionBundleの材料をDBから再構成可能になる（現行productsからは不可能 [C]）。
- **管理画面影響**: evidence review UIの新設対象がこの系統に閉じる。
- **公開UI影響**: なし（公開はview/RPC境界を通す。D-15）。
- **未決事項**: runs/のJSON成果物とDBのどちらを正本とするか（提案: 当面JSONが正本、DBは検索・接続用の写し）。

## D-4. identity と variant の保存単位

- **推奨 [P]**: 正本契約どおり2テーブル分離。
  `research_product_identity` = brand + 正式商品名 + model_year + market + model_number で1行（`pid-<slug>` PK）。
  `research_product_variant` = identity配下の色・product_code・specification_equivalence_status で1行。
  既存 `product_colors`（表示用）はそのまま残し、同期・照合はしない（表示専用と正本variantの役割分離）。
- **代替案**: product_colorsへ product_code / equivalence_status 列を追加 — 表示用テーブルへ正本概念が混入し、
  既存監査P0-6の「未検証variantの同一score扱い」をUI側の運用で防ぐ形になり脆い。
- **BC**: 既存product_colors無変更で互換。
- **既存データ移行**: 正本runs/のvariants[]を投入。product_colorsからの移行はしない（同等性情報が無いため）。
- **ranking影響**: variant単位のclaim帰属（supporting_claims）が保持でき、色違い仕様差の検出が可能になる。
- **管理画面影響**: variant承認（equivalence_statusの更新）はreview UI側の将来機能。
- **公開UI影響**: なし。
- **未決事項**: variant_id採番規則（正本は `var-<slug>`）とproduct_colorsの表示順との対応を持つか。

## D-5. model year と market の保存方法

- **推奨 [P]**: `research_product_identity` の専用カラム `model_year int null` / `market text check in ('JP','overseas','unknown')`。
  null=未確認（推測禁止）を許容し、`unconfirmed_fields text[]` で欠損を明示列挙（正本validators準拠）。
  products.name の「2026」埋め込みは表示文言として残すが、正データとしては参照しない。
- **代替案**: products側にmodel_year列追加 — 凍結方針(D-2)に反し、name由来の推測値混入を誘発。
- **BC**: 互換（products無変更）。
- **既存データ移行**: 不要。identity投入時に正本値をそのまま採用。
- **ranking影響**: 年式違い（2026/2027）を別identityとして別score対象にできる。
- **管理画面影響**: identity編集はreview UI側。
- **公開UI影響**: 将来「2026年モデル」表記を構造化値から生成可能。
- **未決事項**: generation_code（AC/LA/RB5）を専用列にするか（提案: `generation_code text null` を持つ）。
  market='unknown' の商品を公開rankingへ載せてよいかのpublication gate。

## D-6. source / evidence / feature のリレーション

- **推奨 [P]**: 正本契約の参照構造をそのままFK化する。
  `research_source (source_id PK)` ← `research_evidence_claim (claim_id PK, source_id FK, product_identity_id FK, variant_id FK null)`
  ← `research_normalized_feature (product_identity_id + axis_id unique, supporting_claim_ids text[])`。
  site対応は `site_product_match (product_identity_id FK, site_product_id, match_status)`。
  supporting_claim_ids は当面text[]（正本JSONと同形）とし、参照整合はvalidator/CHECKで担保。
- **代替案**: feature↔claimを中間テーブル（正規形）にする — 参照整合はDBで強くなるが、正本JSONとの相互変換が煩雑化。
  投入初期はtext[]で始め、review UI実装時に中間テーブル化を再検討（段階案）。
- **BC**: 既存テーブルと無関係のため互換。
- **既存データ移行**: runs/のsources.json / evidence-claims.json / normalized-features.jsonを1:1投入。
- **ranking影響**: 順位→feature→claim→sourceの遡及（ranking-principles §6）がDB上で成立する。
- **管理画面影響**: review UIのデータ源になる。
- **公開UI影響**: 出典表示（P3-1）の供給源になる。
- **未決事項**: claim本文系フィールドの転載禁止（validators準拠）をDB CHECKでも表現するか。
  取説由来sourceの取得手続きメタデータ（acquisition_method/human_review）の必須化タイミング。

## D-7. raw / derived / editorial の保存境界

- **推奨 [P]**: 3層を物理的に分離する。
  raw = research_source + research_evidence_claim（value_raw）。
  derived = research_normalized_feature（value_normalized, unit, scope）と ranking_* 系（score, coverage）。
  editorial = 既存products（catch_copy, summary, caution_notes, rank_no）+ 将来のreview注記列。
  **products.memo は「管理メモ」専用と定義し、公開経路から外す**。
  本番実測 [C]: memoは**anonキーで全70行読み取り可能・70/70件が非null**であり、対象5商品のmemoは
  いずれも内部語「未確認」を含む（露出は現実の事象。詳細は `production-probe-results.md` Probe 3）。
  さらにDB上のカラムコメント自体が「memoは管理用、caution_notesは公開用」と定義済み [C] であり、
  現状はその定義に反して公開到達している。**product.ts:539のmemoフォールバック廃止と、
  brand.ts:356-366の無フィルタmemoフォールバック除去を、接続前の是正対象として確定推奨**
  （本監査ではUI変更は行わない。是正は別作業）。
- **代替案**: 現状維持（memo/caution_notesの混在容認）— raw系譜情報が公開文言に混ざり続け、P0-5未解決。
- **BC**: memoを公開候補から外すコード変更は表示に影響し得る（memoにしか注意書きが無い商品は注意事項非表示化）。
- **既存データ移行**: seed由来のsource_note/spec_noteをmemo/caution_notesからsource側へ移す是正が必要（内容個別確認、今回は対象外）。
- **ranking影響**: editorial値がevidenceへ混入する経路を遮断。
- **管理画面影響**: memo編集は管理専用画面に限定（現状入力UI自体が無い）。
- **公開UI影響**: 注意事項の表示元をcaution_notes（純化後）に一本化。
- **未決事項**: caution_notes内の既存調査メモの移送先と是正手順。

## D-8. measurement scope の表現

- **推奨 [P]**: normalized_feature行に `measurement_scope_code text null`（統制語彙: 例 excludes_accessory /
  rear_facing / forward_facing / max_of_range / with_canopy 等）+ `scope_note text null`（自由文）を併置する二段構え。
  claim側は正本どおり `measurement_condition`（自由文）を保持。統制語彙は正本側extension提案として先に確定させ、DBは追従。
- **代替案**: 自由文のみ（正本現状のまま）— 「ダッコシート除く4.6kg」等のscope違い比較を機械検出できない。
  完全enum化 — 未知scopeが表現できず推測命名を誘発。
- **BC**: 新テーブル内の話で互換問題なし。
- **既存データ移行**: runs/のnormalization_notesから初期コード付けは人手レビューで実施（自動変換しない）。
- **ranking影響**: scope不一致の重量・寸法を同列比較する事故（P0-2）をquery段階で防げる。
- **管理画面影響**: review UIでscope未設定を警告可能。
- **公開UI影響**: 「※シート除く」等の注記自動表示が可能になる（P3-2）。
- **未決事項**: 統制語彙の初版リストと管理主体（正本terminology.mdに置く提案）。

## D-9. unknown / false / 0 の表現

- **推奨 [P]**: normalized_feature行を「value + evidence_status + supporting_claims + independent_source_count」の組で保存し、
  **NULL単独に意味を持たせない**。unknown = value null + status 'unconfirmed'、確認済み非対応 = value false/0 + status 'confirmed'、
  矛盾 = value null + status 'conflicting'（claims≥2）。boolean軸も同構造（3状態が常に判別可能）。
  publication境界（view/RPC）はstatusを必ず併出しし、表示側で「不明」「非対応」「—」を出し分ける。
- **代替案**: products流のnullable単一列 — P0-3の再生産であり不可。
- **BC**: 新系統内のため互換。
- **既存データ移行**: runs/の表現（value:null+unconfirmed等）と同形のため無損失投入可。
- **ranking影響**: unknown→0点化の絶対条件違反を構造的に防止。未確認軸除外＋重み再正規化の入力が保存できる。
- **管理画面影響**: 欠損理由・矛盾の警告表示（P2-3）の基盤。
- **公開UI影響**: 「データなし」と「非該当」の区別表示（P3-2）が可能になる。
- **未決事項**: missing reasonのenum化要否（正本はnotes自由文。既存監査§19-5のOpen Decision継続）。

## D-10. basket kg / L の分離

- **推奨 [P]**: 軸を2本に分離: `basket_max_load`（kg・耐荷重）と `basket_capacity`（L・容量）。
  1商品が片方のみ持つ状態を正とし、**換算・相互補完を禁止**（CHECKで unit固定）。
  公開比較UIでは2行に分けるか、1行表示なら単位を必ず値に併記。
  既存products.basket_capacity（text）は表示用として凍結。
  本番実測 [C]: basket_capacityカラムは適用済みで、値が入るのは5商品中メリオ カーボンの「約38L」のみ。
  バスケット耐荷重は別カラムload_capacity（「ショッピングバスケット5kgまで」等）に文字列で入っており、
  **本番は既にkg系とL系が別カラムへ分かれ始めているが、正本のMelio basket=5kg(耐荷重)に対し
  本番38L(容量)は出典不明の値**（evidence遡及不能の実例）。2軸分離はこの実態とも整合する。
- **代替案**: 単一軸+unit種別列 — 比較query側でunit混同するリスクが残る（compare.tsの同列表示事故の再生産）。
- **BC**: products無変更で互換。
- **既存データ移行**: runs/のnf-*-basket_capacity（unit=kg 4商品 / L 1商品）を2軸へ振り分け投入。
- **ranking影響**: rubricの軸定義変更（basket 1軸→2軸）が必要。data_coverageの分母が変わる点はCodex感度分析
  （既存監査§20-5(c)）と整合させる。
- **管理画面影響**: review UIで軸別入力。
- **公開UI影響**: 比較表のバスケット行を単位明示へ（P3-4）。
- **未決事項**: rubric上の重み配分（2軸に割るか、親軸1つ+子軸2つのcoverage扱いにするか）→ Codex coverage契約と要整合。

## D-11. rank_no と quality ranking の並走方針

- **推奨 [P]**: `products.rank_no` は**editorial手動順位として当面変更禁止のまま並走**（既存Open Decision #15維持）。
  quality rankingは `ranking_result` 系（別系統）に保存し、公開時は「編集部おすすめ順（rank_no）」と
  「品質スコア順（ranking_result）」をラベル分離して別導線で表示。切替・置換はrankingが公開品質に達した後の別判断。
- **代替案**: (a) rank_noへquality結果を書き込む — 3系統（quality/popularity/editorial）混同の確定でP1-6違反。
  (b) rank_no即廃止 — 公開UI（「ランキング1位」表示）の即時改修が必要になり今回scope外。
- **BC**: 完全互換。
- **既存データ移行**: 不要。
- **ranking影響**: quality scoreの保存先が独立し、editorial順位と干渉しない。
- **管理画面影響**: rank_no編集運用は現状維持。
- **公開UI影響**: 将来、順位表示に系統ラベル（編集部/品質/売れ筋）を付ける改修が必要（P3-3）。
- **未決事項**: 両順位が併存した際のSEO・ページ構成（quality順位の掲載開始条件はpublication gate側で定義）。

## D-12. coverage / confidence / conflict の保存方法

- **推奨 [P]**:
  - coverage/confidence = **runの計算結果**として `ranking_result`（商品×run: observed_score, data_coverage,
    weighted_data_coverage, confidence, rank, eligibility判定）と `ranking_criterion_result`（商品×run×軸:
    raw値参照, score or null, criterion_coverage, score_state）に保存。生データ側には持たせない（再計算可能な派生値のため）。
  - conflict = **データの状態**として research_normalized_feature.evidence_status='conflicting' +
    research_evidence_claim.conflict_with[] に保存（run非依存）。
  - Codex coverage契約（criterion coverage / parent coverage / weighted coverage / score state / ranking eligibility）を
    そのまま格納できる列余地を ranking_criterion_result / ranking_result に確保（proposed-schema-comparison.md参照）。
- **代替案**: coverageをfeature側に持つ — rubric（軸集合・重み）依存の値なのでfeatureに置くとversion不整合を起こす。
- **BC**: 新系統のため互換。
- **既存データ移行**: 実在商品のrun結果は現状存在しない（設計どおり）。投入は将来のrun実行時。
- **ranking影響**: 閾値0.7/0.75判定・圏外理由の再現が可能。
- **管理画面影響**: review UIでconflict未解決一覧・coverage不足警告を出せる。
- **公開UI影響**: confidence/coverageの開示形式は別途設計（P3）。
- **未決事項**: Codex契約のフィールド名確定待ち（契約成果物が未着。列名は仮置きにしない — jsonb受け皿で開始する案あり、D-14参照）。

## D-13. scenario eligibility の保存 or 再計算方針

- **推奨 [P]**: **定義は保存、判定は再計算**。
  `ranking_scenario`（scenario_id, 名称, scope定義: 対象カテゴリ・A形/B形等の適合条件を構造化）+
  `ranking_rubric_version`（scenario×version: 軸・重み・境界値、proposedフラグ）を保存し、
  商品ごとのeligibility判定結果は `ranking_result.eligibility`（eligible/ineligible/unknown + 理由コード）として
  **run時に評価して結果側へ記録**する（定義変更に自動追従、過去runは当時判定を保持）。
  不適合商品は0点化ではなく**対象外**（絶対条件）をenumで明示。
- **代替案**: 商品×scenarioの適合表を静的保存 — 定義変更のたびに手動更新が必要でズレる。
- **BC**: 新系統のため互換。stroller-guideのハードコードscenarioは当面併存。
- **既存データ移行**: 不要。
- **ranking影響**: A形/B形分離の再現性が確保される。ただし**A形/B形の構造化軸が正本に無い**（既存監査P1-3）ため、
  正本側のclassification軸追加（claim裏付け必須）が先行条件。
  なお本番実測 [C] で `products.product_type` に「A型・両対面」「AB型寄り・両対面」「B型・コンパクト」等の
  **フリーテキストA/B分類が既に存在**することが判明（出典・裏付けなし）。scenario eligibilityの入力には
  このtext値を使わず、claim裏付け付きclassification軸から判定する（text値は表示用として凍結）。
- **管理画面影響**: scenario定義の閲覧UI（当面は不要、SQL/JSON管理）。
- **公開UI影響**: scenario別ページ生成の基盤。
- **未決事項**: eligibility='unknown'（分類未確認）の商品を公開rankingでどう扱うか（提案: 掲載しない）。

## D-14. snapshot / version / hash の保存方法

- **推奨 [P]**: `ranking_run`（run_id, scenario_id, rubric_version, calculation_version, contract_schema_version,
  executed_at, input_hash(SHA-256), 実行者/手段）+ `ranking_run_input_snapshot`（run_id PK/FK,
  input_bundle jsonb — RankingExecutionBundle全体または正規化縮約, snapshot_hash）。
  **入力はjsonbスナップショットで丸ごと保存**し、行参照（feature行のFK）ではなくhash+jsonbで再現性を担保する
  （後からfeature行が更新されてもrunの再現性が壊れない）。Codex coverage契約の未確定フィールドも
  このjsonb内とranking_criterion_result.details jsonbで先行受け入れ可能。
- **代替案**: 全入力を行FKで参照 — feature更新でrun再現が壊れるため、行にimmutable version番号を導入する必要があり複雑。
  初期はjsonbスナップショット、行数が問題になったら差分保存へ移行が現実的。
- **BC**: 新系統のため互換。
- **既存データ移行**: 不要。
- **ranking影響**: input_hash遡及（正本設計）と同一の再現性がDBでも成立。
- **管理画面影響**: run履歴閲覧が可能になる。
- **公開UI影響**: 「この順位の算出時点・入力」の開示基盤（P3-1）。
- **未決事項**: snapshotのサイズ管理（保持期間・圧縮）、runの正本をDBとJSONのどちらに置くか（D-3と同方針: 当面JSON正本）。

## D-15. 公開RPC と内部review RPC の分離

- **推奨 [P]**: 3層に分離する。
  1. **公開読み取り**: 公開列だけのview（例 `products_public`）または `security invoker` の読み取りRPCを新設し、
     anonのgrantはそのview/RPCのみに限定する方向へ段階移行。現行の `select('*')` 直読みは、
     本番実測でmemo露出が**確定**（anonで全70行・全件非null取得可）したため、**廃止方向を推奨**
     （公開view/列grant整備とフロント改修をセットで別フェーズ実施）。
  2. **内部review**: research_* / ranking_* 系はanon/authenticatedへgrantしない（service role/管理経路のみ）。
     review操作RPC（claim承認・conflict解決）は認証必須で新設（将来）。
  3. **管理書き込み**: 既存 `update_product_affiliate_urls` 等は現状維持（affiliate専用のまま）。
- **代替案**: select('*')継続+RLS列制御 — PostgreSQL RLSは**行**単位であり列露出は防げない（列grantかview分離が必要）。
  現行構造のままでは列制限が効かない点が本監査で確認対象。
- **BC**: view導入は追加のみで互換。select('*')廃止はフロント改修を伴う（別フェーズ）。
- **既存データ移行**: 不要。
- **ranking影響**: 内部評価途中データ（proposed score等）の公開事故を構造的に防ぐ。
- **管理画面影響**: 管理画面はservice/認証経路のRPCへ寄せる（将来）。
- **公開UI影響**: 公開viewの列確定が必要（memo/spec_source_url等の扱い）。
- **未決事項**: authenticatedロールの位置付け（現在の管理画面の認証方式に依存）、view vs RPCの選択。

---

## 先行条件の依存関係（要約）

```text
本番実測（本監査）
  → D-1 id型確定 ─┬→ D-3/D-6 別系統テーブル設計（match FK型）
                   └→ D-15 公開view設計（memo露出実測が入力）
正本側extension（別作業・提案）
  → A形/B形 classification軸 → D-13 scenario eligibility
  → measurement scope統制語彙 → D-8
  → missing reason enum要否 → D-9
Codex coverage契約（未着）
  → D-10 basket 2軸のcoverage扱い / D-12 列名確定 / D-14 jsonb受け皿の縮約形
```
