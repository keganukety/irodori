# data-contracts — データ契約のフィールド案とJSON例(正本)

**この文書が全契約の正本。** 4スキルは契約を再定義せず、この文書を参照する。
第2段階では、本書を人間向けの正本として維持しながら、TypeScript型と明示的バリデーターを
`../contracts/` に実装した。決定論的な試作計算と架空fixtureは
`../../irodori-ranking-engine/` 配下を機械処理上の実装とする。

区分ラベル(各フィールドの「区分」列): **C = Confirmed Principle 由来で確定 / P = Proposed Default(初期案・変更されうる)**
契約の**構造そのもの**(12契約が存在し、分離されていること)は Confirmed。個々のフィールド名・許容値の多くは Proposed。

## 0. 共通事項

### 0-1. 全契約共通フィールド [P]

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `schema_version` | string | 必須 | この契約の版(semver。現在 `"0.4.0"`) | 省略不可 | C(存在) |
| `record_id` | string | 必須 | レコードの一意ID。`<契約名の略>-<連番またはハッシュ>`(例 `src-0001`) | 省略不可 | P |
| `created_at` / `updated_at` | string | 必須 | ISO 8601(JST オフセット付き。例 `"2026-07-15T10:00:00+09:00"`) | 省略不可 | P |
| `notes` | string | 任意 | 自由記述の補足。**確定値をここに書かない**(構造化フィールドが正) | 空文字可 | P |
| `status_history` | array | 任意 | 状態変更の履歴 `{field, from, to, changed_at, reason}` | 空配列可 | P |

### 0-2. バージョン管理の方法 [P]

- 各契約は独立に semver でバージョン管理する(`schema_version`)。
  - **major**: フィールドの削除・意味変更・必須化(互換性が壊れる変更)
  - **minor**: 任意フィールドの追加・許容値の追加
  - **patch**: 説明文の修正のみ
- 変更はこのファイル末尾の「変更履歴」に記録する。旧版で作られたJSONは
  `schema_version` から解釈できる状態を保つ。
- 本書を人間向けの正本、`shared/contracts/types.ts` を機械処理用の型、
  `shared/contracts/validators.ts` を実行時検証の正本として同期する。

### 0-3. 「不明時の扱い」の共通規則 [C]

- 値が確認できない場合: 値フィールドは `null`、対応する状態フィールド
  (`evidence_status` 等)を `unconfirmed` にする。**推測値・0・空文字で埋めない。**
- enumで判定不能の場合: その enum に `unknown` があればそれを使う。なければ `null` + notes。

---

## 1. `run_manifest` — 実行記録(作成者: irodori-product-intelligence)

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `run_id` | string | 必須 | 実行ID。`run-YYYYMMDD-<連番>` | 省略不可 | C(存在)/P(形式) |
| `purpose` | string | 必須 | この実行の目的(1〜2文。完了判定可能な表現) | 省略不可 | P |
| `executed_by` | string | 必須 | `claude-code` / `codex` / `human` | `human` 扱い不可、明記 | P |
| `started_at` / `finished_at` | string | 必須/任意 | ISO 8601。中断時 `finished_at` は null | null可(実行中) | P |
| `target_products` | string[] | 必須 | 対象 `product_identity_id` の配列 | 空配列不可 | C |
| `steps` | object[] | 必須 | `{skill_name, started_at, finished_at, result}`。result は validation_result 値 | 未実行は含めない | C(記録義務)/P(形式) |
| `config_refs` | object | 必須 | 使用した設定の参照 `{ranking_definition_id?, ranking_definition_version?, calc_version?, terminology_version, contracts_version}` | 該当なしは null | C |
| `stop_reason` | string | 任意 | 途中停止した場合の理由(停止条件は intelligence の SKILL.md に定義) | 正常終了なら null | C(記録義務) |
| `artifacts` | string[] | 必須 | 生成した成果物ファイルのパス一覧 | 空配列可(失敗時) | P |
| `execution_environment` | object | 0.3.0以降必須 | `{node_version, typescript_version, os, platform, arch, typecheck_command, test_command, test_isolation, calculation_version, definition_version}`。実測できない値はnull | nullで推測しない | C(記録)/P(形式) |

```json
{
  "schema_version": "0.4.0",
  "record_id": "runm-0001",
  "run_id": "run-20260715-001",
  "purpose": "パイロット商品1件の調査から正規化までを実行し、レビュー報告を作る",
  "executed_by": "claude-code",
  "started_at": "2026-07-15T10:00:00+09:00",
  "finished_at": null,
  "target_products": ["pid-0001"],
  "steps": [
    { "skill_name": "irodori-product-research", "started_at": "2026-07-15T10:01:00+09:00", "finished_at": "2026-07-15T11:20:00+09:00", "result": "pass" },
    { "skill_name": "irodori-product-evidence-normalizer", "started_at": "2026-07-15T11:30:00+09:00", "finished_at": null, "result": "unknown" }
  ],
  "config_refs": { "ranking_definition_id": null, "ranking_definition_version": null, "calc_version": null, "terminology_version": "0.4.0", "contracts_version": "0.4.0" },
  "stop_reason": null,
  "artifacts": ["outputs/run-20260715-001/source-records.json"],
  "execution_environment": {
    "node_version": "v24.16.0",
    "typescript_version": "5.9.3",
    "os": "Windows 11 Pro",
    "platform": "win32",
    "arch": "x64",
    "typecheck_command": "tsc -p agent-skills/irodori/tsconfig.json --pretty false",
    "test_command": "node --test --test-isolation=none agent-skills/irodori/irodori-ranking-engine/tests/ranking-engine.test.mjs",
    "test_isolation": "none",
    "calculation_version": null,
    "definition_version": null
  },
  "created_at": "2026-07-15T10:00:00+09:00",
  "updated_at": "2026-07-15T11:30:00+09:00"
}
```

---

## 2. `product_identity` — 商品同定(作成者: irodori-product-research)

ルールの正本は `product-identity-rules.md`。

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `product_identity_id` | string | 必須 | `pid-<連番>` | 省略不可 | C |
| `official_name` | string | 必須 | メーカー公式表記の正式商品名 | 確定前は暫定名 + `identification_status: provisional` | C |
| `brand_name` | string | 必須 | ブランド名 | `null` 不可(不明なら provisional) | C |
| `manufacturer_name` | string | 任意 | 製造元(ブランドと異なる場合) | null | P |
| `model_number` | string \| null | 任意 | 型番(公式表記) | null + `unconfirmed_fields` に記載 | C |
| `model_year` | number \| null | 任意 | モデル年(西暦) | null + `unconfirmed_fields` に記載。**推測しない** | C |
| `generation_code` | string \| null | 任意 | 国内世代記号。`model_year` / `model_number` へ自動昇格しない | null | C |
| `market` | string | 必須 | `JP` / `overseas` / `unknown` | `unknown` | C |
| `lifecycle_status` | string | 必須 | `current` / `discontinued` / `unknown` | `unknown` | C |
| `predecessor_of` / `successor_of` | string \| null | 任意 | 新旧関係にある `product_identity_id` | null | C |
| `variant_of` | string \| null | 任意 | 仕様差がある派生identityの参照。色だけで仕様同一なら同一identity内variant | null | C |
| `variant_axis` | string \| null | 任意 | `color` / `spec` / `market` | null | P |
| `category` | string | 必須 | 例 `ベビーカー`(slug管理は Open Decision #4) | 省略不可 | P |
| `official_url` | string \| null | 必須 | メーカー公式URL | null + `unconfirmed_fields` | C |
| `identification_status` | string | 必須 | `identified` / `provisional` / `unidentified` | `unidentified` | C |
| `identification_evidence` | string[] | 必須 | 同定根拠の `source_record_id` 配列 | identified なら1件以上必須 | C |
| `unconfirmed_fields` | string[] | 必須 | 未確認フィールド名の一覧(明示) | 空配列可 | C |
| `site_product_id` | string \| null | 任意 | 既存サイト `products.id` との対応(書き込みはしない) | null | P |
| `site_product_match_status` | string | 0.3.0以降必須 | `confirmed` / `probable` / `unmatched` / `unverified`。site_product_idと同一性確定を分離 | `unverified` | C |
| `variants` | object[] | 0.3.0以降必須 | `{variant_id, color_name, product_code, specification_equivalence_status, supporting_claims}`。商品コードはvariant単位 | 空配列可 | C(分離)/P(形式) |

`identification_status: identified` には、ブランド・正式商品名・モデル年・対象市場・型番の
5要素が必要 [C]。いずれかが確認できない場合は `provisional` または `unidentified` とし、
不足フィールドを `unconfirmed_fields` に列挙する。

```json
{
  "schema_version": "0.4.0",
  "record_id": "pid-0001",
  "product_identity_id": "pid-0001",
  "official_name": "（正式商品名）",
  "brand_name": "（ブランド名）",
  "manufacturer_name": null,
  "model_number": null,
  "model_year": null,
  "market": "JP",
  "lifecycle_status": "unknown",
  "predecessor_of": null,
  "successor_of": null,
  "variant_of": null,
  "variant_axis": null,
  "category": "ベビーカー",
  "official_url": null,
  "identification_status": "provisional",
  "identification_evidence": [],
  "unconfirmed_fields": ["model_number", "model_year", "official_url", "lifecycle_status"],
  "site_product_id": null,
  "site_product_match_status": "unverified",
  "variants": [],
  "created_at": "2026-07-15T10:05:00+09:00",
  "updated_at": "2026-07-15T10:05:00+09:00"
}
```

---

## 3. `source_record` — 情報源(作成者: irodori-product-research)

分類の正本は `source-policy.md`。

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `source_record_id` | string | 必須 | `src-<連番>` | 省略不可 | C |
| `media_name` | string | 必須 | 媒体名(例: マイベスト) | 省略不可 | C |
| `page_title` | string | 必須 | ページ名・記事名 | 取得不能時は URL のまま + notes | C |
| `url` | string | 必須 | URL(出典へ戻るための必須項目) | **URLなしのレコードは作らない** | C |
| `published_date` | string \| null | 任意 | 公開日(ISO 8601 日付) | null(「公開日として不明」) | C |
| `updated_date` | string \| null | 任意 | 更新日 | null | C |
| `accessed_date` | string | 必須 | IRODORIの調査日 | 省略不可 | C |
| `date_kind_note` | string \| null | 任意 | 日付表記がどの種類か不明な場合の注記 | null | P |
| `target_product` | string \| null | 必須 | 対象 `product_identity_id`。同定不能なら null + `match_status: unmatched` | null可(隔離扱い) | C |
| `product_name_as_written` | string | 必須 | 記事中の商品名表記(原文どおり・短句) | 省略不可 | P |
| `model_number_as_written` | string \| null | 任意 | 記事中の型番表記 | null | C |
| `variant_product_code_as_written` | string \| null | 任意 | 色・SKU等のvariant商品コード。model_numberへ入れない | null | C |
| `model_year_as_written` | string \| null | 任意 | 記事中のモデル年表記 | null | C |
| `market_as_written` | string | 必須 | `JP` / `overseas` / `unknown` | `unknown` | C |
| `match_status` | string | 必須 | `matched` / `probable` / `unmatched`(→ product-identity-rules.md §3) | `unmatched` | C |
| `source_type` | string | 必須 | `source-policy.md` §1 の許容値 | `other` + notes | C |
| `primary_or_secondary` | string | 必須 | `primary` / `secondary` | source_type の既定値に従う | C |
| `commercial_relation` | string | 必須 | `source-policy.md` §3 の許容値 | `unknown` | C |
| `external_rank_metadata` | object \| null | 任意 | 他媒体の順位・星の**参考メタデータ**(得点化禁止)。`{rank_label, rank_value, scale_note}` | null | C(禁止則)/P(形式) |
| `acquisition_status` | string | 必須 | `acquired` / `partial` / `failed` / `skipped` | 省略不可 | C |
| `acquisition_failure_reason` | string \| null | 条件付き必須 | `failed` / `skipped` の場合必須 | — | C |
| `manual_gate_status` | string | 任意 | `skipped_terms_acceptance_required` / `human_download_required` / `user_provided_manual_pending`。AIは同意操作で状態を進めない | — | C |
| `discovery_page_url` | string \| null | official_manualで0.3.0以降必須 | 直接資産へ到達した公式親ページ | null | C |
| `direct_asset_url` | string \| null | official_manualで0.3.0以降必須 | PDF等の直接URL | null | C |
| `discovered_via_official_page` | boolean \| null | official_manualで0.3.0以降必須 | 公式ページから直接到達した確認。trueでなければ公式資料扱いしない | null | C |
| `source_usage_audit_id` | string \| null | 0.4.0以降必須 | 第三者媒体は対応する `SourceUsageAudit.audit_id` が必須。メーカー公式はnull可 | 第三者媒体でnull不可 | C |
| `acquisition_method` | string | 0.4.0以降必須 | `manual_browser` / `ai_browser_assisted` / `official_api` / `licensed_feed` / `automated_html` / `user_provided` / `not_acquired` | 省略不可 | C |
| `content_capture_policy` | string | 0.4.0以降必須 | `metadata_only` / `structured_facts_only` / `structured_themes_only` / `market_demand_metadata_only` / `minimal_quote_allowed` / `no_content_storage` | 省略不可 | C |
| `quote_policy` | string | 0.4.0以降必須 | `prohibited` / `pending_review` / `minimal_with_review` / `permitted_by_license` | 省略不可 | C |
| `pii_policy` | string | 0.4.0以降必須 | `reject_all` / `redact_before_storage` / `not_applicable` | 省略不可 | C |
| `automation_used` | boolean | 0.4.0以降必須 | 実際に自動取得を使ったか。取得方式と一致させる | 省略不可 | C |
| `human_review_required` | boolean | 0.4.0以降必須 | 公開・利用前の人間確認要否 | 省略不可 | C |
| `human_review_status` | string | 0.4.0以降必須 | `not_required` / `pending` / `completed` / `rejected` | 省略不可 | C |
| `legal_review_status` | string | 0.4.0以降必須 | §11の法務確認状態 | 省略不可 | C |
| `source_role` | string | 0.4.0以降必須 | 情報源の用途。需要シグナルは `market_demand_signal` / `external_sales_ranking_metadata` | 省略不可 | C |

```json
{
  "schema_version": "0.4.0",
  "record_id": "src-0001",
  "source_record_id": "src-0001",
  "media_name": "（媒体名）",
  "page_title": "（記事名）",
  "url": "https://example.com/article",
  "published_date": "2026-04-01",
  "updated_date": null,
  "accessed_date": "2026-07-15",
  "date_kind_note": null,
  "target_product": "pid-0001",
  "product_name_as_written": "（記事中の商品名表記）",
  "model_number_as_written": null,
  "variant_product_code_as_written": null,
  "model_year_as_written": "2026年モデル",
  "market_as_written": "JP",
  "match_status": "probable",
  "source_type": "editorial_test_media",
  "primary_or_secondary": "secondary",
  "commercial_relation": "affiliate",
  "external_rank_metadata": { "rank_label": "（媒体名）ベビーカー部門", "rank_value": 3, "scale_note": "媒体独自基準。IRODORI得点へ変換しない" },
  "acquisition_status": "acquired",
  "acquisition_failure_reason": null,
  "discovery_page_url": null,
  "direct_asset_url": null,
  "discovered_via_official_page": null,
  "source_usage_audit_id": "source-audit-example-editorial",
  "acquisition_method": "manual_browser",
  "content_capture_policy": "structured_themes_only",
  "quote_policy": "prohibited",
  "pii_policy": "reject_all",
  "automation_used": false,
  "human_review_required": true,
  "human_review_status": "completed",
  "legal_review_status": "completed",
  "source_role": "editorial_evaluation",
  "created_at": "2026-07-15T10:10:00+09:00",
  "updated_at": "2026-07-15T10:10:00+09:00"
}
```

---

## 4. `evidence_claim` — 抽出した主張(作成者: research が下書き、normalizer が確定)

概念の正本は `evidence-model.md`。1つの `source_record` から複数作れる。

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `evidence_claim_id` | string | 必須 | `clm-<連番>` | 省略不可 | C |
| `source_record_id` | string | 必須 | 元となる情報源(1件のみ。複数ソースは claim を分ける) | 省略不可 | C |
| `product_identity_id` | string | 必須 | 対象商品 | 同定不能な claim は作らない(source側で隔離) | C |
| `claim_kind` | string | 必須 | `spec` / `measurement` / `editorial_rating` / `review_trend` / `safety_note` / `other` | `other` + notes | P |
| `axis_id` | string \| null | 必須 | 評価軸(→ terminology.md §5)。軸に該当しない場合 null + `claim_kind: other` | null可 | P |
| `value_raw` | string | 必須 | 原文の値(最小限の語句。転載禁止 → copyright-policy §1) | 省略不可 | C(制限)/P(形式) |
| `quote` | boolean | 必須 | value_raw が直接引用か(true なら出典明示の対象) | false | P |
| `value_normalized` | mixed \| null | 任意 | 正規化後の値(normalizer が設定。research 段階は null) | null | C |
| `unit` | string \| null | 任意 | 正規化後の単位(SI・共通単位) | null | P |
| `measurement_condition` | string \| null | 任意 | 測定条件。実測なのに不明なら `"条件記載なし"` | null | C |
| `claim_class` | string | 必須 | terminology.md §2 の許容値 | `unknown` | C |
| `fact_or_inference` | string | 必須 | `fact` / `inference`。`irodori_inference` は必ず `inference` | 省略不可 | C |
| `derived_from` | string[] | 条件付き必須 | inference の導出元 claim ID(inference なら1件以上必須) | — | C |
| `evidence_status` | string | 必須 | status-model.md §1 の許容値 | `unconfirmed` | C |
| `conflict_with` | string[] | 任意 | 矛盾する claim ID(conflicting なら1件以上) | 空配列 | C |
| `duplicate_of` | string \| null | 任意 | 転載元と確定した claim ID(候補段階は `duplicate_candidate_of`) | null | C(原則)/P(形式) |
| `duplicate_candidate_of` | string[] | 任意 | AI が提示した転載候補(確定は決定論的処理/人間) | 空配列 | P |
| `reliability` | object | 必須 | `{level: "high"\|"medium"\|"low", reason: string}`。理由なしの level 禁止 | `{level:"low", reason:"未評価"}` | P |

```json
{
  "schema_version": "0.4.0",
  "record_id": "clm-0001",
  "evidence_claim_id": "clm-0001",
  "source_record_id": "src-0001",
  "product_identity_id": "pid-0001",
  "claim_kind": "measurement",
  "axis_id": "weight_body",
  "value_raw": "実測 5.1kg（カゴ含む）",
  "quote": false,
  "value_normalized": null,
  "unit": null,
  "measurement_condition": "編集部測定・バスケット装着状態",
  "claim_class": "third_party_measured",
  "fact_or_inference": "fact",
  "derived_from": [],
  "evidence_status": "unconfirmed",
  "conflict_with": [],
  "duplicate_of": null,
  "duplicate_candidate_of": [],
  "reliability": { "level": "medium", "reason": "実測だが単独ソース。公式値との照合前" },
  "created_at": "2026-07-15T10:15:00+09:00",
  "updated_at": "2026-07-15T10:15:00+09:00"
}
```

---

## 5. `normalized_feature` — 正規化値(作成者: irodori-product-evidence-normalizer)

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `normalized_feature_id` | string | 必須 | `nf-<連番>` | 省略不可 | C |
| `product_identity_id` | string | 必須 | 対象商品 | 省略不可 | C |
| `axis_id` | string | 必須 | terminology.md §5 の軸ID | 省略不可 | C |
| `value` | mixed \| null | 必須 | 正規化値。型は軸定義に従う(number / boolean / ordinal / text / 構造化寸法) | null + `evidence_status: unconfirmed` | C |
| `unit` | string \| null | 条件付き必須 | number の場合必須(kg / mm / 円 / L など) | — | C |
| `value_kind` | string | 必須 | `numeric` / `boolean` / `ordinal` / `text` / `dimensions` | 省略不可 | P |
| `supporting_claims` | string[] | 必須 | 依拠する `evidence_claim_id`。値がある場合は1件以上。転載確定分は代表1件のみ数える | 明示的な未確認軸だけ空配列 | C |
| `evidence_status` | string | 必須 | status-model.md §1。supporting_claims が矛盾中なら `conflicting` | `unconfirmed` | C |
| `fact_or_inference` | string | 必須 | `fact` / `inference`(シーン適性の導出などは inference) | 省略不可 | C |
| `normalization_notes` | string \| null | 任意 | 適用した変換(単位換算・表記統一)の記録 | null | P |
| `independent_source_count` | number | 必須 | 独立ソース数(転載除外後)。値がある場合は1以上 | 未確認軸は0 | P |

明示的な未確認軸は、`value: null` / `evidence_status: unconfirmed` /
`supporting_claims: []` / `independent_source_count: 0` の組み合わせに限る [C]。
ただし未解決矛盾により値を確定できない軸は、`value: null` /
`evidence_status: conflicting` / 相反する `supporting_claims` 2件以上 /
`independent_source_count >= 1` として、単純な未確認と分離する [C]。

```json
{
  "schema_version": "0.4.0",
  "record_id": "nf-0001",
  "normalized_feature_id": "nf-0001",
  "product_identity_id": "pid-0001",
  "axis_id": "weight_body",
  "value": 5.1,
  "unit": "kg",
  "value_kind": "numeric",
  "supporting_claims": ["clm-0001"],
  "evidence_status": "unconfirmed",
  "fact_or_inference": "fact",
  "normalization_notes": "原文表記kgのまま。公式値未照合",
  "independent_source_count": 1,
  "created_at": "2026-07-15T12:00:00+09:00",
  "updated_at": "2026-07-15T12:00:00+09:00"
}
```

---

## 6. `review_theme_summary` — 口コミテーマ別要約(作成者: irodori-product-evidence-normalizer)

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `review_theme_summary_id` | string | 必須 | `rts-<連番>` | 省略不可 | C |
| `product_identity_id` | string | 必須 | 対象商品 | 省略不可 | C |
| `source_record_ids` | string[] | 必須 | 根拠 `source_record_id`(1件以上) | 空配列不可 | C |
| `theme_id` | string | 必須 | テーマの安定ID(axis_idまたはシーンタグに対応) | 省略不可 | P |
| `sentiment` | string | 必須 | `positive` / `negative` / `mixed` / `neutral` / `not_applicable` | 推測せず`not_applicable` | C |
| `observed_item_count` | number \| null | 必須 | 観測件数。件数不明はnull | **0へ変換しない** | C |
| `deduplicated_item_count` | number \| null | 必須 | 重複除外後件数。観測件数以下 | **0へ変換しない** | C |
| `sample_size_status` | string | 必須 | `known_small` / `known_moderate` / `known_large` / `unknown` | 件数不明は`unknown` | C |
| `summary` | string | 必須 | IRODORIの言葉による短い構造化要約。本文転載不可 | 省略不可 | C |
| `limitations` | string[] | 必須 | 件数・代表性・取得制約等 | 1件以上 | C |
| `evidence_status` | string | 必須 | status-model.md §1 | `unconfirmed` | C |
| `human_review_status` | string | 必須 | `not_required` / `pending` / `completed` / `rejected` | 省略不可 | C |
| `contains_quote` | boolean | 必須 | 引用を含むか。sourceのquote_policyと照合 | 省略不可 | C |
| `contains_pii` | boolean | 必須 | PIIを含むか。成果物はfalseのみ | 省略不可 | C |
| `ranking_score_impact` | string | 必須 | 現段階は必ず`none` | 他値は禁止 | C |

件数不明時は `observed_item_count: null` / `deduplicated_item_count: null` /
`sample_size_status: unknown` の3点を揃える。旧 `theme` / `summary_text` /
`representative_sources` / `pii_check` は0.3.xの読み取り互換aliasであり、新規成果物では使わない。

```json
{
  "schema_version": "0.4.0",
  "record_id": "rts-0001",
  "review_theme_summary_id": "rts-0001",
  "product_identity_id": "pid-0001",
  "source_record_ids": ["src-0002"],
  "theme_id": "folding_ease",
  "sentiment": "mixed",
  "observed_item_count": 19,
  "deduplicated_item_count": 17,
  "sample_size_status": "known_moderate",
  "summary": "片手操作への肯定的記述と、ロック操作に慣れが必要という記述が確認された。",
  "limitations": ["媒体掲載分だけの集約", "母集団の代表性は未確認"],
  "evidence_status": "unconfirmed",
  "human_review_status": "completed",
  "contains_quote": false,
  "contains_pii": false,
  "ranking_score_impact": "none",
  "created_at": "2026-07-15T12:30:00+09:00",
  "updated_at": "2026-07-15T12:30:00+09:00"
}
```

---

## 7. `ranking_definition` — ランキング定義(作成者: irodori-ranking-engine)

原則の正本は `ranking-principles.md`。**値には `value_status: proposed | confirmed` を必ず付ける。**

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `ranking_definition_id` | string | 必須 | `rdef-<slug>` | 省略不可 | C |
| `definition_version` | string | 必須 | この定義の版(semver) | 省略不可 | C |
| `name` | string | 必須 | 表示名(例: ベビーカー総合 / 電車移動向け) | 省略不可 | C |
| `scope` | string | 必須 | `overall` / `scene` | 省略不可 | C |
| `scene_tag` | string \| null | 条件付き必須 | scope=scene の場合、terminology.md §5 のシーンタグ | — | P |
| `category` | string | 必須 | 対象カテゴリ | 省略不可 | C |
| `axis_weights` | object[] | 必須 | `{axis_id, weight, value_status, scoring_rule}`。`scoring_rule` は numeric / dimensions / boolean / ordinal | **weight未確定は value_status: proposed** | C(構造)/O(値) |
| `required_axes` | object | 必須 | `{axes: string[], value_status}` — これが unconfirmed の商品は評価保留 | 未確定は proposed | C(構造)/O(値) |
| `min_data_coverage` | object | 必須 | `{value: number(0-1), value_status}` | 未確定は proposed | C(構造)/O(値) |
| `min_weighted_data_coverage` | object | 0.3.0以降必須 | `{value: number(0-1), value_status}`。weight重要度を考慮した参加閾値 | 未確定は proposed | C(構造)/O(値) |
| `critical_axes` | object | 0.3.0以降必須 | `{axes: string[], value_status}`。安全・適合・対象年齢等、矛盾時に常にholdする軸 | 未確定は proposed | C(構造)/O(値) |
| `disqualification_rules` | object[] | 任意 | 失格条件 `{rule, reason_template, value_status}`。ruleは実装済みIDのみ | 空配列可 | C(構造) |
| `tie_breaker_rules` | object | 必須 | `{ordered_rules: string[], value_status}`(候補: data_coverage / confidence / 同順位併記) | proposed | C(構造)/O(規則) |
| `evidence_policy` | object | 必須 | accepted status / 未解決矛盾(`required_axis: hold`, `non_required_axis: exclude_axis`, `critical_axis: hold`) / outdated / duplicate の決定論的扱い | proposed | C(構造)/O(値) |
| `missing_data_policy` | object | 必須 | 充足率不足と欠損軸の扱い。欠損軸はscore計算から除外 | proposed | C(構造)/O(値) |
| `confidence_formula_ref` | string | 必須 | confidence 式ID。第2段階の試験式は `confidence-proposed-v1` | 省略不可 | P |
| `confidence_config` | object | 必須 | coverage / 独立ソース / 一次情報 / reliability の試験重み。合計1 | proposed | P |
| `sensitivity_config` | object | 必須 | `{weight_delta: number\|null, value_status}` — 変動幅未確定なら null | proposed | O |
| `freshness_rule` | object \| null | 任意 | outdated 判定基準(→ evidence-model.md §6) | null | O |
| `calc_version` | string | 必須 | 対応する決定論的計算実装の版 | 省略不可 | C |
| `publication_status` | string | 必須 | proposed を含む試験定義とその結果は `draft` | `draft` | C |

```json
{
  "schema_version": "0.4.0",
  "record_id": "rdef-stroller-train",
  "ranking_definition_id": "rdef-stroller-train",
  "definition_version": "0.4.0",
  "name": "ベビーカー 電車移動向け（初期案）",
  "scope": "scene",
  "scene_tag": "train_commute",
  "category": "ベビーカー",
  "axis_weights": [
    {
      "axis_id": "weight_body",
      "weight": 1,
      "value_status": "proposed",
      "scoring_rule": {
        "kind": "numeric",
        "direction": "lower_better",
        "best": 4,
        "worst": 10,
        "unit": "kg"
      }
    }
  ],
  "required_axes": { "axes": ["weight_body"], "value_status": "proposed" },
  "min_data_coverage": { "value": 0.7, "value_status": "proposed" },
  "min_weighted_data_coverage": { "value": 0.75, "value_status": "proposed" },
  "critical_axes": { "axes": ["target_age", "newborn_ready", "max_load", "caution"], "value_status": "proposed" },
  "disqualification_rules": [
    { "rule": "require_current_lifecycle", "reason_template": "現行品ではないため対象外", "value_status": "confirmed" }
  ],
  "tie_breaker_rules": {
    "ordered_rules": ["tie_allowed", "product_identity_id_asc"],
    "value_status": "proposed"
  },
  "evidence_policy": {
    "accepted_statuses": ["confirmed"],
    "unresolved_conflict": {
      "required_axis": "hold",
      "non_required_axis": "exclude_axis",
      "critical_axis": "hold"
    },
    "outdated": "exclude_axis",
    "duplicate_handling": "representative_only",
    "value_status": "proposed"
  },
  "missing_data_policy": {
    "below_min_coverage": "hold",
    "missing_axis": "exclude_from_score",
    "value_status": "proposed"
  },
  "confidence_formula_ref": "confidence-proposed-v1",
  "confidence_config": {
    "formula_id": "confidence-proposed-v1",
    "data_coverage_weight": 0.4,
    "source_independence_weight": 0.25,
    "primary_source_weight": 0.2,
    "reliability_weight": 0.15,
    "independent_sources_target_per_axis": 2,
    "value_status": "proposed"
  },
  "sensitivity_config": { "weight_delta": 0.05, "value_status": "proposed" },
  "freshness_rule": null,
  "calc_version": "calc-train-prototype-0.2.0",
  "publication_status": "draft",
  "created_at": "2026-07-15T13:00:00+09:00",
  "updated_at": "2026-07-15T13:00:00+09:00"
}
```

※ 上記JSONは構造を示す短縮例。電車移動向けの全10軸のproposed設定は
`irodori-ranking-engine/fixtures/fictional-train-commute.ts` を参照する。

---

## 8. `ranking_input` — ランキング計算への入力スナップショット(作成者: irodori-ranking-engine)

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `ranking_input_id` | string | 必須 | `rin-<連番>` | 省略不可 | C |
| `ranking_definition_id` / `definition_version` | string | 必須 | 使用する定義とその版 | 省略不可 | C |
| `run_id` | string | 必須 | 対応する実行 | 省略不可 | C |
| `snapshot_date` | string | 必須 | 入力を固定した日 | 省略不可 | C |
| `candidates` | object[] | 必須 | `{product_identity_id, feature_refs, review_refs, data_coverage, weighted_data_coverage}` — coverageは決定論的処理が計算(手前ではnull) | 空配列不可 | C |
| `excluded` | object[] | 必須 | `{product_identity_id, exclusion_reason}` — 除外理由は disqualification_rules の適用結果 | 空配列可 | C |
| `input_hash` | string \| null | 任意 | canonical入力の64文字小文字SHA-256 hex | null | C |
| `input_hash_algorithm` | string \| null | 任意 | `"sha256"`。hash未計算でも使用予定アルゴリズムを記録可 | null | C |

```json
{
  "schema_version": "0.4.0",
  "record_id": "rin-0001",
  "ranking_input_id": "rin-0001",
  "ranking_definition_id": "rdef-stroller-train",
  "definition_version": "0.4.0",
  "run_id": "run-20260715-001",
  "snapshot_date": "2026-07-15",
  "candidates": [
    { "product_identity_id": "pid-0001", "feature_refs": ["nf-0001"], "review_refs": ["rts-0001"], "data_coverage": null, "weighted_data_coverage": null }
  ],
  "excluded": [
    { "product_identity_id": "pid-0002", "exclusion_reason": "lifecycle_status: discontinued（現行品ではない）" }
  ],
  "input_hash": null,
  "input_hash_algorithm": "sha256",
  "created_at": "2026-07-15T13:10:00+09:00",
  "updated_at": "2026-07-15T13:10:00+09:00"
}
```

---

## 9. `ranking_result` — ランキング結果(作成者: 決定論的処理)

第2段階では架空fixtureの `ranking_result` だけを生成する。実在商品の結果は作らない。

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `ranking_result_id` | string | 必須 | `rres-<連番>` | 省略不可 | C |
| `ranking_input_id` / `ranking_definition_id` / `definition_version` / `calc_version` / `run_id` | string | 必須 | 再現に必要な参照一式 | 省略不可 | C |
| `generated_at` | string | 必須 | 生成日時 | 省略不可 | C |
| `input_hash` / `input_hash_algorithm` | string | 必須 | canonical入力のSHA-256と固定値`sha256` | 省略不可 | C |
| `entries` | object[] | 必須 | 下記エントリ構造の配列(順位順) | 空配列可 | C |
| `entries[].rank` | number | 必須 | 順位(同点規則適用後) | — | C |
| `entries[].product_identity_id` | string | 必須 | 商品 | — | C |
| `entries[].observed_score` | number | 必須 | 確認済みかつscore可能な軸だけで再正規化した得点 | — | C |
| `entries[].score` | number | 任意 | `observed_score`と同値のdeprecated alias | 省略推奨 | C(互換) |
| `entries[].data_coverage` | number | 必須 | 軸数ベース充足率 | — | C |
| `entries[].weighted_data_coverage` | number | 必須 | weightベース充足率 | — | C |
| `entries[].confidence` | number | 必須 | 0〜1。試験式の結果。observed_scoreとは分離 | — | C(分離)/P(式) |
| `entries[].per_axis_breakdown` | object[] | 必須 | 軸値、raw score、正規化重み、寄与点、nf ID、claim IDs、source IDs | — | C |
| `entries[].reason_text` | string | 必須 | 順位の理由(重み上位の軸と値。短文) | — | C |
| `entries[].strengths` / `entries[].cautions` | string[] | 必須 | 得意な条件 / 苦手な条件・注意点 | 空配列可 | C |
| `entries[].unconfirmed_axes` | string[] | 必須 | 未確認軸の明示 | 空配列可 | C |
| `entries[].tie_note` | string \| null | 任意 | 同点処理の適用記録 | null | C |
| `on_hold` | object[] | 必須 | 評価保留 `{product_identity_id, reason, reason_code, data_coverage, weighted_data_coverage, confidence}`。**下位表示ではなく分離** | 空配列可 | C |
| `excluded` | object[] | 必須 | 失格。on_holdと同じ形で、計算前ならcoverage/confidenceはnull | 空配列可 | C |
| `sensitivity_notes` | object[] | 必須 | 感度分析の結果(順位が入れ替わりうるペアと条件)。設定未確定なら空+notes | 空配列可 | C(構造)/O(幅) |
| `publication_status` | string | 必須 | 初期値は必ず `draft` | `draft` | C |

(JSON例は entries 1件の骨格のみ)

```json
{
  "schema_version": "0.4.0",
  "record_id": "rres-0001",
  "ranking_result_id": "rres-0001",
  "ranking_input_id": "rin-0001",
  "ranking_definition_id": "rdef-stroller-train",
  "definition_version": "0.4.0",
  "calc_version": "calc-train-prototype-0.2.0",
  "run_id": "run-20260715-001",
  "generated_at": "2026-07-15T14:00:00+09:00",
  "input_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "input_hash_algorithm": "sha256",
  "entries": [
    {
      "rank": 1,
      "product_identity_id": "pid-0001",
      "observed_score": 81.666667,
      "score": 81.666667,
      "data_coverage": 1,
      "weighted_data_coverage": 1,
      "confidence": 0.78,
      "per_axis_breakdown": [
        {
          "axis_id": "weight_body",
          "normalized_feature_id": "nf-0001",
          "value": 5.1,
          "raw_axis_score": 81.666667,
          "normalized_weight": 1,
          "weighted_score": 81.666667,
          "evidence_status": "confirmed",
          "evidence_claim_ids": ["clm-0001"],
          "source_record_ids": ["src-0001"]
        }
      ],
      "reason_text": "試験設定では weight_body の寄与が大きい結果です。",
      "strengths": ["weight_body"],
      "cautions": [],
      "unconfirmed_axes": [],
      "tie_note": null
    }
  ],
  "on_hold": [],
  "excluded": [],
  "sensitivity_notes": [],
  "publication_status": "draft",
  "created_at": "2026-07-15T14:00:00+09:00",
  "updated_at": "2026-07-15T14:00:00+09:00"
}
```

---

## 10. `review_report` — 最終レビュー用報告(作成者: irodori-product-intelligence)

| フィールド | 型 | 必須 | 説明 / 許容値 | 不明時 | 区分 |
|---|---|---|---|---|---|
| `review_report_id` | string | 必須 | `rrep-<連番>` | 省略不可 | C |
| `run_id` | string | 必須 | 対象実行 | 省略不可 | C |
| `summary` | string | 必須 | 何をどこまで実行したか(1〜3文) | 省略不可 | C |
| `product_summaries` | object[] | 必須 | 商品ごとの `{product_identity_id, identification_status, source_count, claim_count, unconfirmed_axes, conflicts}` | 空配列不可 | C |
| `validation_summary` | object[] | 必須 | 検証項目ごとの `{check_name, result(validation_result), detail}`。**fail / unknown を隠さない** | 省略不可 | C |
| `open_questions` | string[] | 必須 | ユーザー判断が必要な事項(Open Decisions への参照含む) | 空配列可 | C |
| `recommended_next_actions` | string[] | 必須 | 次の作業の提案(実行はしない) | 空配列可 | C |
| `editorial_notes` | object[] | 任意 | `{topic, text, evidence_status, supporting_claims}`。安全側の人間向け要約等を確定仕様値と分離 | 空配列可 | C |
| `publication_status` | string | 必須 | 初期値 `review_required` | — | C |

```json
{
  "schema_version": "0.4.0",
  "record_id": "rrep-0001",
  "review_report_id": "rrep-0001",
  "run_id": "run-20260715-001",
  "summary": "パイロット商品1件について調査と正規化を実行した。identity未確定のため実在商品のランキング計算は未実施。",
  "product_summaries": [
    { "product_identity_id": "pid-0001", "identification_status": "identified", "source_count": 6, "claim_count": 18, "unconfirmed_axes": ["train_fitness", "basket_capacity"], "conflicts": 1 }
  ],
  "validation_summary": [
    { "check_name": "all_sources_have_url", "result": "pass", "detail": "6/6" },
    { "check_name": "model_number_match", "result": "unknown", "detail": "src-0004 は型番記載なし。公式仕様表の再確認で判定可能" }
  ],
  "open_questions": ["試験重みとconfidence式を確定するか"],
  "recommended_next_actions": ["矛盾 clm-0009 / clm-0012 の一次情報照合"],
  "editorial_notes": [],
  "publication_status": "review_required",
  "created_at": "2026-07-15T15:00:00+09:00",
  "updated_at": "2026-07-15T15:00:00+09:00"
}
```

---

## 11. `source_usage_audit` — 第三者媒体の利用方針監査(作成者: 人間レビュー担当)

第三者媒体を `source_record` に登録する前提契約。媒体別のMarkdown監査を人間向け正本、
`source-audits/2026-07-15/source-usage-audits.json` を機械可読表現とする。
`audit_result: pass` はIRODORI内部基準への適合だけを表し、法的許可・規約上の明示許諾・
自動取得許可を意味しない。

状態は必ず分離する [C]:

- `terms_permission_status`: `explicitly_permitted` / `explicitly_prohibited` / `not_found` / `ambiguous` / `not_applicable`
- `operational_decision`: `allowed_with_conditions` / `prohibited` / `pending_review` / `not_adopted`
- `legal_review_status`: `not_required` / `recommended` / `required` / `completed` / `unresolved`
- `audit_result`: `pass` / `fail` / `unknown` / `not_applicable`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `audit_id` / `schema_version` | string | 必須 | 安定IDと契約版 |
| `medium_id` / `medium_name` / `operator_name` | string | 必須 | 媒体ID・表示名・運営主体 |
| `official_domains` | string[] | 必須 | 監査対象の公式ドメイン |
| `audited_at` / `audit_version` | string | 必須 | 監査日時・監査版 |
| `terms_urls` / `copyright_policy_urls` / `community_guideline_urls` | string[] | 必須 | 確認した公式ポリシーURL |
| `robots_url` | string \| null | 必須 | robots.txt。単独で許諾判断に使わない |
| `effective_dates` | object[] | 必須 | `{policy_id, effective_date, note}`。日付不明はnull |
| `checked_operations` | `SourceUsageOperation[]` | 必須 | 操作単位の判定。安定IDと4状態を保持 |
| `permitted_roles` / `prohibited_roles` | string[] | 必須 | この媒体を利用できる/できない用途 |
| `storage_policy` | `StoragePolicy` | 必須 | 許可capture、禁止内容、PII、保持注記と構造化`retention_rules` |
| `citation_policy` | `CitationPolicy` | 必須 | 引用方針、帰属表示、人間レビュー |
| `automation_policy` | `AutomationPolicy` | 必須 | 許可/禁止operation。両方への重複は禁止 |
| `terms_permission_status` / `operational_decision` / `legal_review_status` | string | 必須 | 媒体全体の状態。操作別状態を上書きしない |
| `legal_review_requirement` | object | 必須 | 状態、確認前に実行できない操作、未解決論点 |
| `unresolved_questions` | string[] | 必須 | 推測で埋めない未解決事項 |
| `review_due_at` | string | 必須 | 再監査日(ISO日付) |
| `evidence_references` | string[] | 必須 | 判断根拠の公式URL |

`SourceUsageOperation.operation_id` の許容値 [C]:
`manual_read_and_structure`, `browser_assisted_summary`, `automated_html_acquisition`,
`scheduled_html_monitoring`, `official_api`, `scheduled_api_snapshot`, `spec_cross_check`,
`editorial_theme_extraction`, `individual_review_storage`, `aggregate_review_summary`,
`external_ranking_metadata`, `market_demand_snapshot`, `minimal_quote`, `metadata_only`。

各operationは `audit_result`, `terms_permission_status`, `operational_decision`, `conditions`,
`prohibited_actions`, `evidence_references`, `legal_review_status` を必須とする。

---

## 12. `rakuten_ranking_snapshot` — 楽天市場ランキング需要シグナル

楽天店舗商品listingとIRODORIの商品モデルを分離した時点スナップショット。
これは `market_demand_signal` / `external_sales_ranking_metadata` であり、品質評価ではない。

| フィールド | 型 | 必須 | 説明 / 制約 |
|---|---|---|---|
| `snapshot_id` / `schema_version` | string | 必須 | 安定IDと契約版 |
| `source_usage_audit_id` | string | 必須 | 楽天監査ID |
| `ranking_source` | string | 必須 | 下記の公式/派生名称 |
| `ranking_period` | string | 必須 | `realtime` / `official_daily` / `official_weekly` / `irodori_7day_derived` |
| `acquisition_method` | string | 必須 | `official_api`で有効化済みなのは`realtime`だけ。daily/weeklyをAPI取得と推測しない |
| `genre_id` / `genre_name` | string | 必須 | ランキングジャンル |
| `rank` | number \| null | 必須 | 順位。不明を0にしない |
| `last_build_date` | string \| null | 必須 | 配信元の更新日時 |
| `fetched_at` / `captured_at` | string | 必須 | 取得・保持開始日時 |
| `rakuten_item_code` / `shop_code` / `item_name` / `item_url` | string | 必須 | 楽天店舗listing。shopを跨いで統合しない |
| `price` / `availability` / `review_count` / `review_average` | number \| null | 必須 | 不明はnull。品質scoreに接続しない |
| `product_identity_id` | string \| null | 必須 | IRODORI商品モデル。未名寄せはnull |
| `model_year` / `market` / `model_number` / `variant_id` | 値またはnull | 必須 | 同一性確認項目。色・年式・市場を無視しない |
| `identity_match_status` | string | 必須 | `confirmed` / `probable` / `unmatched` / `unverified` |
| `match_evidence` | object[] | 必須 | `{evidence_type, value}`。商品名だけのconfirmedは禁止 |
| `data_expiry` | object | 必須 | `price_expires_at`, `availability_expires_at`, `metadata_expires_at` |
| `retention_policy` | object | 必須 | 価格/availability 24時間、その他3か月、派生3か月超は`unresolved`、方針の参照元 |
| `retention_status` | string | 必須 | `current` / `expired` / `pending_refresh` / `prohibited_retention` / `unknown` |
| `display_requirements` | string[] | 必須 | クレジット・リンク・更新日時等の表示条件 |
| `legal_review_status` / `publication_status` | string | 必須 | 法務未完了・期限切れcurrentの公開を拒否 |
| `source_role` | string | 必須 | `market_demand_signal` / `external_sales_ranking_metadata` |
| `ranking_score_impact` | string | 必須 | 必ず`none` |
| `quality_score_input_fields` | string[] | 必須 | 必ず空配列。rank・星・件数・affiliate等の接続要求を拒否 |

`ranking_source` の許容値 [C]: `rakuten_official_realtime_rank`,
`rakuten_official_daily_rank`, `rakuten_official_weekly_rank`, `irodori_7day_rank_presence`,
`irodori_7day_average_position`, `irodori_7day_rank_stability`。
`official_daily` / `official_weekly` は公式Webページの区分として保持できるが、API対応はUNKNOWN。
`irodori_7day_derived` を楽天公式週間順位と表記してはならない。

confirmed名寄せは、少なくともbrand・marketと、model_year / model_number /
一意識別子のいずれかを含む複数根拠が必要。商品名だけ、shop_codeだけ、楽天rankだけでは
confirmedにできない。variantを関連付ける場合はvariant根拠も必要。

---

## 変更履歴

| 日付 | contracts_version | 変更 |
|---|---|---|
| 2026-07-15 | 0.1.0 | 初版(10契約のフィールド案とJSON例) |
| 2026-07-15 | 0.2.0 | TypeScript型・実行時検証・決定論的架空fixture試作に合わせて条件付き契約を具体化 |
| 2026-07-15 | 0.3.0 | variant/site関連付け/PDF到達経路、observed_score・weighted_data_coverage・矛盾軸参加規則、SHA-256・実行環境記録を追加。score/included_itemsはdeprecated alias化 |
| 2026-07-15 | 0.4.0 | SourceUsageAudit、第三者SourceRecord利用制約、ReviewThemeSummaryの件数/PII/引用/score非接続、RakutenRankingSnapshot・TTL・名寄せ・需要シグナル分離を追加 |
