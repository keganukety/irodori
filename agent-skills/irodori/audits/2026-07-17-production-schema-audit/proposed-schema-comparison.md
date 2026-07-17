# Proposed Schema Comparison（概念〜疑似DDLレベル・2026-07-17）

migrationコードは作成しない。本書は**設計比較資料**であり、疑似DDLは型・関係の意図を示すための擬似表記
（実際のmigrationはこの表記のままでは使わない）。表現区分: [P] Proposed / [O] Open Decision。

比較対象:

- **案A**: 既存 `products` へランキング関連カラムを大量追加する
- **案B**: 別系統テーブル群（research_* / ranking_*）を新設し、products とは match テーブルで疎結合 [P 推奨]

---

## 1. 案A: products へカラム追加

### 概念

products 1行に identity・仕様正値・evidence要約・score類を全て持たせる。
例（追加が必要になる列の一部）: `model_year`, `market`, `weight_body_kg`, `weight_scope`, `weight_status`,
`basket_max_load_kg`, `basket_capacity_l`, `basket_status`, `source_urls text[]`, `data_coverage`, `confidence`, …

### 評価

| 観点 | 評価 |
|---|---|
| 1商品n出典 | **不可**（1行に収まらない。text[]化は日付・種別・取得手続きメタデータを失う） |
| 1軸nクレーム・conflict保持 | **不可**（軸ごとに値1個。conflictingを「両値保持のまま未解決」にできない） |
| unknown/false/0の区別 | 軸ごとに status列を追加すれば可能だが、**軸数×3列**（value/unit/status）が際限なく増える |
| measurement scope | 軸ごとにscope列追加で肥大化 |
| variant同等性 | 行構造上持てない（products 1行=1商品） |
| model year別identity | 行を分けると表示用一覧に年式重複が出て、公開UI改修が必須になる |
| 既存UIへの影響 | select('*')に新列が全て乗る＝**内部評価途中データが即公開経路に乗る**（列grant整備が前提化） |
| rank_no併走 | 同一行にeditorial順位とquality scoreが並び、混同リスク増 |
| backward compatibility | 列追加自体は互換だが、意味の異なる値（raw/derived/editorial）が同一行に同居し、P0-5を悪化 |
| 段階移行 | 後戻り困難（列を消す変更は破壊的） |

**結論: 不採用推奨。** 既存監査P0-1〜P0-6のうちP0-1/2/3/4/6を構造的に解決できない。

---

## 2. 案B: 別系統テーブル群 [P 推奨]

### 全体図

```text
[research系: run非依存の事実データ]                     [既存: 公開表示用（凍結）]
research_product_identity ──< research_product_variant    products / brands /
      │  │                                                product_colors / affiliate系
      │  └────────< site_product_match >──────────────────┘（疎結合・唯一の接点）
      │
research_source ──< research_evidence_claim >── (identity/variant帰属)
      │                        │ supporting_claim_ids
      └────（出典遡及）────  research_normalized_feature（identity×axis 1行）

[ranking系: run依存の派生データ]
ranking_scenario ──< ranking_rubric_version
      │                        │
      └──────< ranking_run >───┘  ── ranking_run_input_snapshot（jsonb+hash）
                    │
                    ├──< ranking_result（商品×run）
                    └──< ranking_criterion_result（商品×run×軸）
```

### 疑似DDL（概念レベル）

```text
-- 事実系（run非依存）。名称は既存規則（snake_case複数形）に合わせて最終決定 [O]

research_product_identities
  product_identity_id   text PK            -- 'pid-<slug>'（正本契約と同値）
  brand_name            text not null
  official_name         text not null
  manufacturer_name     text null
  model_number          text null          -- variantのproduct_codeと分離（正本validators準拠）
  model_year            int  null          -- null=未確認（推測禁止）
  generation_code       text null          -- AC / LA / RB5 等
  market                text not null default 'unknown'   -- JP / overseas / unknown
  lifecycle_status      text not null default 'unknown'
  identification_status text not null      -- identified / provisional / unidentified
  unconfirmed_fields    text[] not null default '{}'
  contract_schema_version text not null    -- 投入元契約version（0.4.0〜）

research_product_variants
  variant_id            text PK            -- 'var-<slug>'
  product_identity_id   text FK -> identities
  color_name            text null
  product_code          text null          -- 例 526000803（model_numberへ混入させない）
  specification_equivalence_status text not null   -- equivalent / unverified / differs
  supporting_claim_ids  text[] not null default '{}'

site_product_matches
  product_identity_id   text FK PK(part)
  site_product_id       text null          -- products.id の実型に合わせる [O: D-1]
  match_status          text not null      -- matched / probable / unmatched / conflict
  note                  text null
  -- Runfee のような「site行なし」= site_product_id null + unmatched を正値として表現

research_sources
  source_id             text PK            -- 'src-…'
  product_identity_id   text FK null       -- null=隔離（target不明ソース）
  url                   text not null
  source_type           text not null      -- official_spec 〜 unknown（12値）
  commercial_relation   text not null
  published_date / updated_date / accessed_date : date null ×3
  date_kind_note        text null
  acquisition_method    text null          -- 取説の同意ページ経由等の手続きメタデータ
  human_review          boolean null
  reliability           text null
  -- 本文転載フィールドは持たない（正本validators準拠・保存禁止）

research_evidence_claims
  claim_id              text PK
  source_id             text FK -> sources
  product_identity_id   text FK -> identities
  variant_id            text FK null -> variants
  axis_id               text not null      -- canonicalizeAxisId後の正規軸ID
  value_raw             text null
  value_normalized      jsonb null         -- number / boolean / 構造化寸法 / Range
  unit                  text null
  measurement_condition text null          -- 自由文（正本のまま）
  claim_class           text not null
  fact_or_inference     text not null      -- inference は derived_from 必須
  derived_from          text[] not null default '{}'
  evidence_status       text not null
  conflict_with         text[] not null default '{}'
  duplicate_of          text null
  reliability           text null

research_normalized_features
  product_identity_id   text FK
  axis_id               text not null
  UNIQUE (product_identity_id, axis_id)
  value                 jsonb null         -- null=未確認/矛盾（statusで判別）
  unit                  text null          -- 数値軸は必須・寸法mm固定（CHECK）
  value_kind            text not null
  measurement_scope_code text null         -- 統制語彙 [O: D-8。正本extension先行]
  scope_note            text null
  evidence_status       text not null      -- confirmed / unconfirmed / conflicting / not_applicable
  supporting_claim_ids  text[] not null default '{}'
  independent_source_count int not null default 0
  normalization_notes   text null
  -- 制約例: unconfirmed → value null AND claims空 AND count=0
  --         conflicting → value null AND claims 2件以上
  -- basket は basket_max_load(kg) と basket_capacity(L) の2軸に分離（換算・補完禁止）[D-10]

-- ranking系（run依存の派生データ）

ranking_scenarios
  scenario_id           text PK            -- 例 'train-commute'
  name                  text not null
  scope_definition      jsonb not null     -- 対象カテゴリ・A形/B形適合条件（構造化）[D-13]

ranking_rubric_versions
  rubric_version_id     text PK
  scenario_id           text FK
  status                text not null      -- proposed / approved（境界値・重みはproposedのまま保存可）
  definition            jsonb not null     -- 軸・重み・境界値・coverage閾値
  created_at            timestamptz

ranking_runs
  run_id                text PK
  scenario_id           text FK
  rubric_version_id     text FK
  calculation_version   text not null      -- 'calc-…'
  contract_schema_version text not null
  input_hash            text not null      -- SHA-256（正本設計と同一）
  executed_at           timestamptz not null
  executed_by           text null

ranking_run_input_snapshots
  run_id                text PK FK
  input_bundle          jsonb not null     -- RankingExecutionBundle（または正規化縮約）[D-14]
  snapshot_hash         text not null

ranking_results
  run_id                text FK
  product_identity_id   text FK
  UNIQUE (run_id, product_identity_id)
  eligibility           text not null      -- eligible / ineligible / unknown（0点化しない）[D-13]
  eligibility_reason    text null
  observed_score        numeric null       -- 未確認軸除外+重み再正規化後
  data_coverage         numeric null       -- 軸数ベース 0-1
  weighted_data_coverage numeric null      -- 重みベース 0-1
  parent_coverage       jsonb null         -- ★Codex契約: 親軸単位coverage受け皿
  confidence            numeric null
  score_state           text null          -- ★Codex契約: scored / excluded / below_threshold 等
  rank                  int null           -- 同run内順位（editorial rank_noとは別系統 [D-11]）
  details               jsonb null         -- ★Codex契約: 未確定フィールドの先行受け皿

ranking_criterion_results
  run_id + product_identity_id + criterion_id PK
  criterion_id          text not null      -- rubricの軸ID（axis_idと対応）
  score                 numeric null       -- null=評価除外（0と区別）
  criterion_coverage    numeric null       -- ★Codex契約: 軸単位coverage
  score_state           text not null      -- scored / unconfirmed_excluded / conflicting_excluded / not_applicable…
  used_claim_ids        text[] not null default '{}'
  details               jsonb null         -- ★Codex契約受け皿
```

### Codex coverage契約との接続余地（★印）

Codex側で策定中のcoverage契約（criterion coverage / parent coverage / weighted coverage /
score state / ranking eligibility）は未着のため、**列名を確定させず**次の方針で受ける [P]:

1. 確定済み概念（data_coverage / weighted_data_coverage / eligibility / score_state / criterion_coverage）は専用列。
2. 未確定・拡張フィールドは `parent_coverage jsonb` / `details jsonb` で先行受け入れし、
   契約確定後に必要なら専用列へ昇格（additive変更のみで対応可能）。
3. run単位のsnapshot（jsonb+hash）が契約変更前後の互換検証材料になる。

### 評価

| 観点 | 評価 |
|---|---|
| 1商品n出典・出典遡及 | 可（sources/claims分離。ranking-principles §6成立） |
| conflict未解決保持 | 可（status='conflicting' + 両claim保持） |
| unknown/false/0 | 可（value+status+claims+countの組） |
| measurement scope | 可（scope_code+note） |
| variant同等性 | 可（equivalence_status） |
| 既存products/UI | **無変更**（完全additive・BC維持） |
| Runfee(unmatched) | 可（site_product_id null） |
| 段階移行 | 可（正本runs/ JSONの1:1投入から開始） |
| コスト | テーブル数が多い（12前後）。ただし正本契約と同形のため設計コストは低い |
| リスク | products表示値と research系正値の二重管理（→ 単方向同期の運用規則が必要 [O]） |

---

## 3. 比較まとめ

| | 案A（products拡張） | 案B（別系統） |
|---|---|---|
| P0-1 basket kg/L混在 | 解決不能（単一行構造） | 解決（2軸分離） |
| P0-2 scope保存 | 列爆発 | 解決 |
| P0-3 unknown/false/0 | 部分的（列爆発） | 解決 |
| P0-4 出典遡及 | 解決不能 | 解決 |
| P0-5 raw/editorial分離 | 悪化 | 解決（物理分離） |
| P0-6 variant | 解決不能 | 解決 |
| 公開事故リスク | select('*')に内部データが乗る | research系はanon非公開で開始 |
| BC / 段階移行 | 列追加は互換だが後戻り困難 | 完全additive・後戻り容易 |

**推奨: 案B。** 詳細な意思決定は `decision-matrix.md` D-1〜D-15参照。
