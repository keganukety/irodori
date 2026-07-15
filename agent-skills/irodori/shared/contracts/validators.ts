import {
  CLAIM_CLASSES,
  COMMERCIAL_RELATIONS,
  EVIDENCE_STATUSES,
  PUBLICATION_STATUSES,
  SOURCE_TYPES,
  VALIDATION_RESULTS,
  type AxisScoringRule,
  type ContractName,
  type ContractRecord,
  type EvidenceClaim,
  type NormalizedFeature,
  type ProductIdentity,
  type RankingDefinition,
  type RankingExecutionBundle,
  type RankingInput,
  type RankingResult,
  type ReviewReport,
  type ReviewThemeSummary,
  type RunManifest,
  type SourceRecord,
  type ValidationIssue,
  type ValidationReport,
  type ValidationResult,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;
type Allowed = string | number | boolean | null;

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export const DEPRECATED_AXIS_ALIASES = {
  included_items: "included_accessories",
} as const;

export function canonicalizeAxisId(axisId: string): string {
  return DEPRECATED_AXIS_ALIASES[axisId as keyof typeof DEPRECATED_AXIS_ALIASES] ?? axisId;
}

function schemaAtLeast(value: unknown, major: number, minor: number): boolean {
  if (typeof value !== "string" || !SEMVER.test(value)) return false;
  const [actualMajor, actualMinor] = value.split(".").map(Number);
  return actualMajor > major || (actualMajor === major && actualMinor >= minor);
}

class Collector {
  readonly issues: ValidationIssue[] = [];

  fail(path: string, code: string, message: string): void {
    this.issues.push({ path, result: "fail", code, message });
  }

  unknown(path: string, code: string, message: string, needed: string): void {
    this.issues.push({ path, result: "unknown", code, message, needed });
  }

  merge(prefix: string, report: ValidationReport<unknown>): void {
    for (const issue of report.issues) {
      this.issues.push({ ...issue, path: prefix + issue.path });
    }
  }

  report<T>(value?: T): ValidationReport<T> {
    const result: ValidationResult = this.issues.some((issue) => issue.result === "fail")
      ? "fail"
      : this.issues.some((issue) => issue.result === "unknown")
        ? "unknown"
        : "pass";
    return result === "fail"
      ? { result, issues: this.issues }
      : { result, issues: this.issues, value };
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, collector: Collector, path: string): value is UnknownRecord {
  if (!isRecord(value)) {
    collector.fail(path, "type.object", "objectが必要です");
    return false;
  }
  return true;
}

function nonEmptyString(value: unknown, collector: Collector, path: string): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    collector.fail(path, "required.non_empty_string", "空でないstringが必要です");
    return false;
  }
  return true;
}

function nullableString(value: unknown, collector: Collector, path: string): value is string | null {
  if (value !== null && typeof value !== "string") {
    collector.fail(path, "type.nullable_string", "stringまたはnullが必要です");
    return false;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    collector.fail(path, "value.empty_unknown", "不明値を空文字で表現できません。nullを使ってください");
    return false;
  }
  return true;
}

function finiteNumber(value: unknown, collector: Collector, path: string): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    collector.fail(path, "type.finite_number", "有限のnumberが必要です");
    return false;
  }
  return true;
}

function nullableNumber(value: unknown, collector: Collector, path: string): value is number | null {
  return value === null || finiteNumber(value, collector, path);
}

function enumValue<T extends readonly Allowed[]>(
  value: unknown,
  allowed: T,
  collector: Collector,
  path: string,
): value is T[number] {
  if (!allowed.includes(value as T[number])) {
    collector.fail(path, "value.enum", "許容値: " + allowed.join(", "));
    return false;
  }
  return true;
}

function stringArray(
  value: unknown,
  collector: Collector,
  path: string,
  options: { nonEmpty?: boolean; unique?: boolean } = {},
): value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    collector.fail(path, "type.string_array", "空文字を含まないstring[]が必要です");
    return false;
  }
  if (options.nonEmpty && value.length === 0) {
    collector.fail(path, "required.non_empty_array", "1件以上必要です");
  }
  if (options.unique && new Set(value).size !== value.length) {
    collector.fail(path, "value.duplicate", "重複値を含められません");
  }
  return true;
}

function array(value: unknown, collector: Collector, path: string, nonEmpty = false): value is unknown[] {
  if (!Array.isArray(value)) {
    collector.fail(path, "type.array", "arrayが必要です");
    return false;
  }
  if (nonEmpty && value.length === 0) collector.fail(path, "required.non_empty_array", "1件以上必要です");
  return true;
}

function isoDate(value: unknown, collector: Collector, path: string): void {
  if (typeof value !== "string" || !ISO_DATE.test(value) || Number.isNaN(Date.parse(value + "T00:00:00Z"))) {
    collector.fail(path, "format.iso_date", "YYYY-MM-DD形式の実在日が必要です");
  }
}

function nullableIsoDate(value: unknown, collector: Collector, path: string): void {
  if (value !== null) isoDate(value, collector, path);
}

function timestamp(value: unknown, collector: Collector, path: string): void {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
    collector.fail(path, "format.iso_timestamp", "タイムゾーン付きISO 8601 timestampが必要です");
  }
}

function nullableTimestamp(value: unknown, collector: Collector, path: string): void {
  if (value !== null) timestamp(value, collector, path);
}

function url(value: unknown, collector: Collector, path: string, allowNull = false): void {
  if (allowNull && value === null) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    collector.fail(path, "format.url", "http(s) URLが必要です");
    return;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
  } catch {
    collector.fail(path, "format.url", "有効なhttp(s) URLが必要です");
  }
}

function ratio(value: unknown, collector: Collector, path: string): void {
  if (finiteNumber(value, collector, path) && (value < 0 || value > 1)) {
    collector.fail(path, "value.ratio", "0〜1が必要です");
  }
}

function validateBase(value: UnknownRecord, collector: Collector, path = "$"): void {
  if (nonEmptyString(value.schema_version, collector, path + ".schema_version")
    && !SEMVER.test(value.schema_version)) {
    collector.fail(path + ".schema_version", "format.semver", "semver形式が必要です");
  }
  nonEmptyString(value.record_id, collector, path + ".record_id");
  timestamp(value.created_at, collector, path + ".created_at");
  timestamp(value.updated_at, collector, path + ".updated_at");
  if (value.notes !== undefined && typeof value.notes !== "string") {
    collector.fail(path + ".notes", "type.string", "notesはstringです");
  }
  if (value.status_history !== undefined) {
    if (array(value.status_history, collector, path + ".status_history")) {
      value.status_history.forEach((item, index) => {
        const itemPath = path + ".status_history[" + index + "]";
        if (!record(item, collector, itemPath)) return;
        nonEmptyString(item.field, collector, itemPath + ".field");
        nullableString(item.from, collector, itemPath + ".from");
        nullableString(item.to, collector, itemPath + ".to");
        timestamp(item.changed_at, collector, itemPath + ".changed_at");
        nonEmptyString(item.reason, collector, itemPath + ".reason");
      });
    }
  }
}

function validateRecord<T>(
  value: unknown,
  validator: (item: UnknownRecord, collector: Collector) => void,
): ValidationReport<T> {
  const collector = new Collector();
  if (!record(value, collector, "$")) return collector.report<T>();
  validateBase(value, collector);
  validator(value, collector);
  return collector.report(value as T);
}

export function validateRunManifest(value: unknown): ValidationReport<RunManifest> {
  return validateRecord<RunManifest>(value, (item, collector) => {
    nonEmptyString(item.run_id, collector, "$.run_id");
    nonEmptyString(item.purpose, collector, "$.purpose");
    enumValue(item.executed_by, ["claude-code", "codex", "human"] as const, collector, "$.executed_by");
    timestamp(item.started_at, collector, "$.started_at");
    nullableTimestamp(item.finished_at, collector, "$.finished_at");
    stringArray(item.target_products, collector, "$.target_products", { nonEmpty: true, unique: true });
    if (array(item.steps, collector, "$.steps")) {
      item.steps.forEach((step, index) => {
        const path = "$.steps[" + index + "]";
        if (!record(step, collector, path)) return;
        nonEmptyString(step.skill_name, collector, path + ".skill_name");
        timestamp(step.started_at, collector, path + ".started_at");
        nullableTimestamp(step.finished_at, collector, path + ".finished_at");
        enumValue(step.result, VALIDATION_RESULTS, collector, path + ".result");
      });
    }
    if (record(item.config_refs, collector, "$.config_refs")) {
      nullableString(item.config_refs.ranking_definition_id, collector, "$.config_refs.ranking_definition_id");
      nullableString(item.config_refs.ranking_definition_version, collector, "$.config_refs.ranking_definition_version");
      nullableString(item.config_refs.calc_version, collector, "$.config_refs.calc_version");
      nonEmptyString(item.config_refs.terminology_version, collector, "$.config_refs.terminology_version");
      nonEmptyString(item.config_refs.contracts_version, collector, "$.config_refs.contracts_version");
    }
    nullableString(item.stop_reason, collector, "$.stop_reason");
    stringArray(item.artifacts, collector, "$.artifacts", { unique: true });
    const requireEnvironment = schemaAtLeast(item.schema_version, 0, 3);
    if (item.execution_environment === undefined) {
      if (requireEnvironment) {
        collector.fail("$.execution_environment", "environment.required", "0.3.0以降は実行環境情報が必要です");
      }
    } else if (record(item.execution_environment, collector, "$.execution_environment")) {
      const environment = item.execution_environment;
      for (const key of ["node_version", "typescript_version", "os", "platform", "arch"] as const) {
        nullableString(environment[key], collector, "$.execution_environment." + key);
      }
      for (const key of ["typecheck_command", "test_command", "test_isolation"] as const) {
        nullableString(environment[key], collector, "$.execution_environment." + key);
      }
      nullableString(environment.calculation_version, collector, "$.execution_environment.calculation_version");
      nullableString(environment.definition_version, collector, "$.execution_environment.definition_version");
    }
  });
}

export function validateProductIdentity(value: unknown): ValidationReport<ProductIdentity> {
  return validateRecord<ProductIdentity>(value, (item, collector) => {
    nonEmptyString(item.product_identity_id, collector, "$.product_identity_id");
    nonEmptyString(item.official_name, collector, "$.official_name");
    nonEmptyString(item.brand_name, collector, "$.brand_name");
    nullableString(item.manufacturer_name, collector, "$.manufacturer_name");
    nullableString(item.model_number, collector, "$.model_number");
    nullableNumber(item.model_year, collector, "$.model_year");
    if (typeof item.model_year === "number"
      && (!Number.isInteger(item.model_year) || item.model_year < 1900 || item.model_year > 2200)) {
      collector.fail("$.model_year", "value.model_year", "1900〜2200の整数が必要です");
    }
    enumValue(item.market, ["JP", "overseas", "unknown"] as const, collector, "$.market");
    enumValue(item.lifecycle_status, ["current", "discontinued", "unknown"] as const, collector, "$.lifecycle_status");
    nullableString(item.predecessor_of, collector, "$.predecessor_of");
    nullableString(item.successor_of, collector, "$.successor_of");
    nullableString(item.variant_of, collector, "$.variant_of");
    enumValue(item.variant_axis, ["color", "spec", "market", null] as const, collector, "$.variant_axis");
    nonEmptyString(item.category, collector, "$.category");
    url(item.official_url, collector, "$.official_url", true);
    enumValue(item.identification_status, ["identified", "provisional", "unidentified"] as const, collector, "$.identification_status");
    stringArray(item.identification_evidence, collector, "$.identification_evidence", { unique: true });
    stringArray(item.unconfirmed_fields, collector, "$.unconfirmed_fields", { unique: true });
    nullableString(item.site_product_id, collector, "$.site_product_id");
    const requireV03Fields = schemaAtLeast(item.schema_version, 0, 3);
    if (item.site_product_match_status === undefined) {
      if (requireV03Fields) {
        collector.fail("$.site_product_match_status", "site_match.required", "0.3.0以降は関連付け状態が必要です");
      }
    } else {
      enumValue(
        item.site_product_match_status,
        ["confirmed", "probable", "unmatched", "unverified"] as const,
        collector,
        "$.site_product_match_status",
      );
      if (item.site_product_id === null && (item.site_product_match_status === "confirmed" || item.site_product_match_status === "probable")) {
        collector.fail("$.site_product_match_status", "site_match.id_required", "confirmed/probableにはsite_product_idが必要です");
      }
    }
    if (item.variants === undefined) {
      if (requireV03Fields) collector.fail("$.variants", "variant.required", "0.3.0以降はvariants配列が必要です");
    } else if (array(item.variants, collector, "$.variants")) {
      const variantIds: string[] = [];
      const productCodes: string[] = [];
      item.variants.forEach((variant, index) => {
        const path = "$.variants[" + index + "]";
        if (!record(variant, collector, path)) return;
        if (nonEmptyString(variant.variant_id, collector, path + ".variant_id")) variantIds.push(variant.variant_id);
        nullableString(variant.color_name, collector, path + ".color_name");
        if (nullableString(variant.product_code, collector, path + ".product_code") && typeof variant.product_code === "string") {
          productCodes.push(variant.product_code);
        }
        enumValue(
          variant.specification_equivalence_status,
          ["confirmed_same", "confirmed_different", "unverified"] as const,
          collector,
          path + ".specification_equivalence_status",
        );
        stringArray(variant.supporting_claims, collector, path + ".supporting_claims", { nonEmpty: true, unique: true });
        if (variant.notes !== undefined && typeof variant.notes !== "string") {
          collector.fail(path + ".notes", "type.string", "notesはstringです");
        }
        if (variant.product_code !== null && variant.product_code === item.model_number) {
          collector.fail(path + ".product_code", "identity.variant_code_as_model", "variantコードをmodel_numberに重複登録できません");
        }
      });
      if (new Set(variantIds).size !== variantIds.length) collector.fail("$.variants", "variant.duplicate_id", "variant_idは一意です");
      if (new Set(productCodes).size !== productCodes.length) collector.fail("$.variants", "variant.duplicate_code", "product_codeは一意です");
    }

    if (item.identification_status === "identified") {
      if (item.model_number === null || item.model_year === null || item.market === "unknown") {
        collector.fail(
          "$.identification_status",
          "identity.incomplete",
          "identifiedにはブランド・正式商品名・モデル年・対象市場・型番が必要です",
        );
      }
      if (Array.isArray(item.identification_evidence) && item.identification_evidence.length === 0) {
        collector.fail("$.identification_evidence", "identity.missing_evidence", "identifiedには同定根拠が必要です");
      }
    }
    if (Array.isArray(item.unconfirmed_fields)) {
      for (const field of ["model_number", "model_year", "official_url"] as const) {
        if (item[field] === null && !item.unconfirmed_fields.includes(field)) {
          collector.fail("$.unconfirmed_fields", "identity.unconfirmed_missing", field + "がnullなら明記してください");
        }
      }
    }
  });
}

export function validateSourceRecord(value: unknown): ValidationReport<SourceRecord> {
  return validateRecord<SourceRecord>(value, (item, collector) => {
    nonEmptyString(item.source_record_id, collector, "$.source_record_id");
    nonEmptyString(item.media_name, collector, "$.media_name");
    nonEmptyString(item.page_title, collector, "$.page_title");
    url(item.url, collector, "$.url");
    nullableIsoDate(item.published_date, collector, "$.published_date");
    nullableIsoDate(item.updated_date, collector, "$.updated_date");
    isoDate(item.accessed_date, collector, "$.accessed_date");
    nullableString(item.date_kind_note, collector, "$.date_kind_note");
    nullableString(item.target_product, collector, "$.target_product");
    nonEmptyString(item.product_name_as_written, collector, "$.product_name_as_written");
    nullableString(item.model_number_as_written, collector, "$.model_number_as_written");
    if (item.variant_product_code_as_written !== undefined) {
      nullableString(item.variant_product_code_as_written, collector, "$.variant_product_code_as_written");
    }
    nullableString(item.model_year_as_written, collector, "$.model_year_as_written");
    enumValue(item.market_as_written, ["JP", "overseas", "unknown"] as const, collector, "$.market_as_written");
    enumValue(item.match_status, ["matched", "probable", "unmatched"] as const, collector, "$.match_status");
    enumValue(item.source_type, SOURCE_TYPES, collector, "$.source_type");
    enumValue(item.primary_or_secondary, ["primary", "secondary"] as const, collector, "$.primary_or_secondary");
    enumValue(item.commercial_relation, COMMERCIAL_RELATIONS, collector, "$.commercial_relation");
    if (item.external_rank_metadata !== null) {
      if (record(item.external_rank_metadata, collector, "$.external_rank_metadata")) {
        nonEmptyString(item.external_rank_metadata.rank_label, collector, "$.external_rank_metadata.rank_label");
        nullableNumber(item.external_rank_metadata.rank_value, collector, "$.external_rank_metadata.rank_value");
        nonEmptyString(item.external_rank_metadata.scale_note, collector, "$.external_rank_metadata.scale_note");
      }
    }
    enumValue(item.acquisition_status, ["acquired", "partial", "failed", "skipped"] as const, collector, "$.acquisition_status");
    nullableString(item.acquisition_failure_reason, collector, "$.acquisition_failure_reason");
    if (item.discovery_page_url !== undefined) url(item.discovery_page_url, collector, "$.discovery_page_url", true);
    if (item.direct_asset_url !== undefined) url(item.direct_asset_url, collector, "$.direct_asset_url", true);
    if (item.discovered_via_official_page !== undefined
      && item.discovered_via_official_page !== null
      && typeof item.discovered_via_official_page !== "boolean") {
      collector.fail("$.discovered_via_official_page", "type.nullable_boolean", "booleanまたはnullが必要です");
    }
    if ((item.acquisition_status === "failed" || item.acquisition_status === "skipped")
      && (typeof item.acquisition_failure_reason !== "string" || item.acquisition_failure_reason.length === 0)) {
      collector.fail("$.acquisition_failure_reason", "acquisition.reason_required", "failed/skippedには理由が必要です");
    }
    if (item.match_status === "matched" && item.target_product === null) {
      collector.fail("$.target_product", "source.matched_without_product", "matchedにはtarget_productが必要です");
    }
    if (schemaAtLeast(item.schema_version, 0, 3) && item.source_type === "official_manual") {
      if (typeof item.discovery_page_url !== "string") {
        collector.fail("$.discovery_page_url", "manual.discovery_required", "公式到達元ページURLが必要です");
      }
      if (typeof item.direct_asset_url !== "string") {
        collector.fail("$.direct_asset_url", "manual.asset_required", "直接PDF URLが必要です");
      }
      if (item.discovered_via_official_page !== true) {
        collector.fail("$.discovered_via_official_page", "manual.official_route_required", "公式ページからの到達確認が必要です");
      }
    }
  });
}

function normalizedValue(value: unknown, collector: Collector, path: string): void {
  if (typeof value === "number") {
    finiteNumber(value, collector, path);
    return;
  }
  if (typeof value === "string" || typeof value === "boolean") return;
  if (!record(value, collector, path)) return;
  if ("width_mm" in value || "depth_mm" in value || "height_mm" in value) {
    nullableNumber(value.width_mm, collector, path + ".width_mm");
    nullableNumber(value.depth_mm, collector, path + ".depth_mm");
    nullableNumber(value.height_mm, collector, path + ".height_mm");
    return;
  }
  if ("min" in value || "max" in value) {
    nullableNumber(value.min, collector, path + ".min");
    nullableNumber(value.max, collector, path + ".max");
    return;
  }
  collector.fail(path, "value.normalized_shape", "許可された正規化値の形ではありません");
}

export function validateEvidenceClaim(value: unknown): ValidationReport<EvidenceClaim> {
  return validateRecord<EvidenceClaim>(value, (item, collector) => {
    nonEmptyString(item.evidence_claim_id, collector, "$.evidence_claim_id");
    nonEmptyString(item.source_record_id, collector, "$.source_record_id");
    nonEmptyString(item.product_identity_id, collector, "$.product_identity_id");
    enumValue(
      item.claim_kind,
      ["spec", "measurement", "editorial_rating", "review_trend", "safety_note", "other"] as const,
      collector,
      "$.claim_kind",
    );
    nullableString(item.axis_id, collector, "$.axis_id");
    nonEmptyString(item.value_raw, collector, "$.value_raw");
    if (typeof item.quote !== "boolean") collector.fail("$.quote", "type.boolean", "booleanが必要です");
    if (item.value_normalized !== null) normalizedValue(item.value_normalized, collector, "$.value_normalized");
    nullableString(item.unit, collector, "$.unit");
    nullableString(item.measurement_condition, collector, "$.measurement_condition");
    enumValue(item.claim_class, CLAIM_CLASSES, collector, "$.claim_class");
    enumValue(item.fact_or_inference, ["fact", "inference"] as const, collector, "$.fact_or_inference");
    stringArray(item.derived_from, collector, "$.derived_from", { unique: true });
    enumValue(item.evidence_status, EVIDENCE_STATUSES, collector, "$.evidence_status");
    stringArray(item.conflict_with, collector, "$.conflict_with", { unique: true });
    nullableString(item.duplicate_of, collector, "$.duplicate_of");
    stringArray(item.duplicate_candidate_of, collector, "$.duplicate_candidate_of", { unique: true });
    if (record(item.reliability, collector, "$.reliability")) {
      enumValue(item.reliability.level, ["high", "medium", "low"] as const, collector, "$.reliability.level");
      nonEmptyString(item.reliability.reason, collector, "$.reliability.reason");
    }
    if (item.fact_or_inference === "inference"
      && (!Array.isArray(item.derived_from) || item.derived_from.length === 0)) {
      collector.fail("$.derived_from", "inference.missing_derivation", "inferenceには導出元が必要です");
    }
    if (item.claim_class === "irodori_inference" && item.fact_or_inference !== "inference") {
      collector.fail("$.fact_or_inference", "inference.class_mismatch", "irodori_inferenceはinferenceです");
    }
    if (item.fact_or_inference === "inference" && item.evidence_status === "confirmed") {
      collector.fail("$.evidence_status", "inference.cannot_be_confirmed", "推論をconfirmedな事実として扱えません");
    }
    if (item.evidence_status === "conflicting"
      && (!Array.isArray(item.conflict_with) || item.conflict_with.length === 0)) {
      collector.fail("$.conflict_with", "conflict.reference_required", "conflictingには相互参照が必要です");
    }
    if (item.duplicate_of === item.evidence_claim_id) {
      collector.fail("$.duplicate_of", "duplicate.self_reference", "自分自身をduplicateにできません");
    }
  });
}

export function validateNormalizedFeature(value: unknown): ValidationReport<NormalizedFeature> {
  return validateRecord<NormalizedFeature>(value, (item, collector) => {
    nonEmptyString(item.normalized_feature_id, collector, "$.normalized_feature_id");
    nonEmptyString(item.product_identity_id, collector, "$.product_identity_id");
    nonEmptyString(item.axis_id, collector, "$.axis_id");
    if (item.value !== null) normalizedValue(item.value, collector, "$.value");
    nullableString(item.unit, collector, "$.unit");
    enumValue(item.value_kind, ["numeric", "boolean", "ordinal", "text", "dimensions"] as const, collector, "$.value_kind");
    stringArray(item.supporting_claims, collector, "$.supporting_claims", { unique: true });
    enumValue(item.evidence_status, EVIDENCE_STATUSES, collector, "$.evidence_status");
    enumValue(item.fact_or_inference, ["fact", "inference"] as const, collector, "$.fact_or_inference");
    nullableString(item.normalization_notes, collector, "$.normalization_notes");
    const independentSourceCount = item.independent_source_count;
    if (finiteNumber(independentSourceCount, collector, "$.independent_source_count")
      && (!Number.isInteger(independentSourceCount) || independentSourceCount < 0)) {
      collector.fail("$.independent_source_count", "value.non_negative_integer", "0以上の整数が必要です");
    }

    if (item.value === null) {
      if (item.evidence_status === "unconfirmed") {
        if (!Array.isArray(item.supporting_claims)
          || item.supporting_claims.length !== 0
          || independentSourceCount !== 0) {
          collector.fail(
            "$.supporting_claims",
            "missing.must_not_have_evidence",
            "未確認軸はsupporting_claims=[]かつindependent_source_count=0です",
          );
        }
      } else if (item.evidence_status === "conflicting") {
        if (!Array.isArray(item.supporting_claims)
          || item.supporting_claims.length < 2
          || typeof independentSourceCount !== "number"
          || independentSourceCount < 1) {
          collector.fail(
            "$.supporting_claims",
            "conflict.evidence_required",
            "矛盾によりnullの軸は相反claim 2件以上とsource数が必要です",
          );
        }
      } else {
        collector.fail("$.evidence_status", "missing.invalid_status", "null値はunconfirmedまたはconflictingです");
      }
    } else {
      if (!Array.isArray(item.supporting_claims) || item.supporting_claims.length === 0) {
        collector.fail("$.supporting_claims", "feature.evidence_required", "値には根拠claimが必要です");
      }
      if (typeof independentSourceCount !== "number" || independentSourceCount < 1) {
        collector.fail("$.independent_source_count", "feature.source_required", "値には独立ソースが必要です");
      }
    }
    if ((item.value_kind === "numeric" || item.value_kind === "dimensions")
      && item.value !== null && item.unit === null) {
      collector.fail("$.unit", "feature.unit_required", "数値・寸法にはunitが必要です");
    }
    if (item.value_kind === "dimensions" && item.value !== null && item.unit !== "mm") {
      collector.fail("$.unit", "feature.dimensions_unit", "寸法オブジェクトの共通単位はmmです");
    }
  });
}

export function validateReviewThemeSummary(value: unknown): ValidationReport<ReviewThemeSummary> {
  return validateRecord<ReviewThemeSummary>(value, (item, collector) => {
    nonEmptyString(item.review_theme_summary_id, collector, "$.review_theme_summary_id");
    nonEmptyString(item.product_identity_id, collector, "$.product_identity_id");
    nonEmptyString(item.theme, collector, "$.theme");
    if (record(item.sentiment, collector, "$.sentiment")) {
      for (const key of ["positive_count", "negative_count", "neutral_count"] as const) {
        if (nullableNumber(item.sentiment[key], collector, "$.sentiment." + key)
          && typeof item.sentiment[key] === "number"
          && (!Number.isInteger(item.sentiment[key]) || item.sentiment[key] < 0)) {
          collector.fail("$.sentiment." + key, "value.non_negative_integer", "0以上の整数またはnullです");
        }
      }
    }
    nonEmptyString(item.summary_text, collector, "$.summary_text");
    stringArray(item.representative_sources, collector, "$.representative_sources", { nonEmpty: true, unique: true });
    nullableString(item.conditions, collector, "$.conditions");
    enumValue(item.pii_check, VALIDATION_RESULTS, collector, "$.pii_check");
    enumValue(item.evidence_status, EVIDENCE_STATUSES, collector, "$.evidence_status");
    if (item.pii_check !== "pass") {
      collector.fail("$.pii_check", "review.pii_not_passed", "成果物にはpii_check: passが必要です");
    }
  });
}

function scoringRule(value: unknown, collector: Collector, path: string): void {
  if (!record(value, collector, path)) return;
  if (!enumValue(value.kind, ["numeric", "dimensions", "boolean", "ordinal"] as const, collector, path + ".kind")) return;
  if (value.kind === "numeric" || value.kind === "dimensions") {
    enumValue(value.direction, ["lower_better", "higher_better"] as const, collector, path + ".direction");
    finiteNumber(value.best, collector, path + ".best");
    finiteNumber(value.worst, collector, path + ".worst");
    if (value.best === value.worst) collector.fail(path + ".worst", "scoring.zero_range", "bestとworstは異なる値です");
    nonEmptyString(value.unit, collector, path + ".unit");
  }
  if (value.kind === "dimensions") {
    enumValue(
      value.metric,
      ["width_mm", "depth_mm", "height_mm", "volume_mm3", "max_dimension_mm"] as const,
      collector,
      path + ".metric",
    );
  }
  if (value.kind === "boolean" && typeof value.preferred_value !== "boolean") {
    collector.fail(path + ".preferred_value", "type.boolean", "booleanが必要です");
  }
  if (value.kind === "ordinal" && record(value.points, collector, path + ".points")) {
    for (const key of ["very_low", "low", "medium", "high", "very_high"] as const) {
      if (finiteNumber(value.points[key], collector, path + ".points." + key)
        && (value.points[key] < 0 || value.points[key] > 100)) {
        collector.fail(path + ".points." + key, "value.score", "0〜100が必要です");
      }
    }
  }
}

export function validateAxisScoringRule(value: unknown): ValidationReport<AxisScoringRule> {
  const collector = new Collector();
  scoringRule(value, collector, "$");
  return collector.report(value as AxisScoringRule);
}

function containsProposed(value: unknown): boolean {
  return JSON.stringify(value).includes("\"value_status\":\"proposed\"");
}

export function validateRankingDefinition(value: unknown): ValidationReport<RankingDefinition> {
  return validateRecord<RankingDefinition>(value, (item, collector) => {
    nonEmptyString(item.ranking_definition_id, collector, "$.ranking_definition_id");
    if (nonEmptyString(item.definition_version, collector, "$.definition_version")
      && !SEMVER.test(item.definition_version)) {
      collector.fail("$.definition_version", "format.semver", "semver形式が必要です");
    }
    nonEmptyString(item.name, collector, "$.name");
    enumValue(item.scope, ["overall", "scene"] as const, collector, "$.scope");
    nullableString(item.scene_tag, collector, "$.scene_tag");
    if (item.scope === "scene" && (typeof item.scene_tag !== "string" || item.scene_tag.length === 0)) {
      collector.fail("$.scene_tag", "ranking.scene_required", "sceneにはscene_tagが必要です");
    }
    nonEmptyString(item.category, collector, "$.category");

    const axisIds: string[] = [];
    if (array(item.axis_weights, collector, "$.axis_weights", true)) {
      item.axis_weights.forEach((axis, index) => {
        const path = "$.axis_weights[" + index + "]";
        if (!record(axis, collector, path)) return;
        if (nonEmptyString(axis.axis_id, collector, path + ".axis_id")) axisIds.push(canonicalizeAxisId(axis.axis_id));
        if (finiteNumber(axis.weight, collector, path + ".weight") && axis.weight <= 0) {
          collector.fail(path + ".weight", "value.positive", "weightは正数です");
        }
        enumValue(axis.value_status, ["proposed", "confirmed"] as const, collector, path + ".value_status");
        scoringRule(axis.scoring_rule, collector, path + ".scoring_rule");
      });
    }
    if (new Set(axisIds).size !== axisIds.length) {
      collector.fail("$.axis_weights", "ranking.duplicate_axis", "axis_idは一意です");
    }

    if (record(item.required_axes, collector, "$.required_axes")) {
      if (stringArray(item.required_axes.axes, collector, "$.required_axes.axes", { unique: true })) {
        for (const axisId of item.required_axes.axes) {
          if (!axisIds.includes(canonicalizeAxisId(axisId))) {
            collector.fail("$.required_axes.axes", "ranking.unknown_required_axis", axisId + "はaxis_weightsにありません");
          }
        }
      }
      enumValue(
        item.required_axes.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.required_axes.value_status",
      );
    }
    if (record(item.min_data_coverage, collector, "$.min_data_coverage")) {
      ratio(item.min_data_coverage.value, collector, "$.min_data_coverage.value");
      enumValue(
        item.min_data_coverage.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.min_data_coverage.value_status",
      );
    }
    if (item.min_weighted_data_coverage === undefined) {
      if (schemaAtLeast(item.schema_version, 0, 3)) {
        collector.fail("$.min_weighted_data_coverage", "ranking.weighted_coverage_required", "0.3.0以降はweighted coverage閾値が必要です");
      }
    } else if (record(item.min_weighted_data_coverage, collector, "$.min_weighted_data_coverage")) {
      ratio(item.min_weighted_data_coverage.value, collector, "$.min_weighted_data_coverage.value");
      enumValue(
        item.min_weighted_data_coverage.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.min_weighted_data_coverage.value_status",
      );
    }
    if (item.critical_axes === undefined) {
      if (schemaAtLeast(item.schema_version, 0, 3)) {
        collector.fail("$.critical_axes", "ranking.critical_axes_required", "0.3.0以降は重要事項軸の設定が必要です");
      }
    } else if (record(item.critical_axes, collector, "$.critical_axes")) {
      stringArray(item.critical_axes.axes, collector, "$.critical_axes.axes", { unique: true });
      enumValue(item.critical_axes.value_status, ["proposed", "confirmed"] as const, collector, "$.critical_axes.value_status");
    }

    if (array(item.disqualification_rules, collector, "$.disqualification_rules")) {
      item.disqualification_rules.forEach((rule, index) => {
        const path = "$.disqualification_rules[" + index + "]";
        if (!record(rule, collector, path)) return;
        enumValue(
          rule.rule,
          ["require_current_lifecycle", "require_identified_product", "require_market_match"] as const,
          collector,
          path + ".rule",
        );
        if (rule.rule === "require_market_match") {
          enumValue(rule.expected_market, ["JP", "overseas", "unknown"] as const, collector, path + ".expected_market");
        }
        nonEmptyString(rule.reason_template, collector, path + ".reason_template");
        enumValue(rule.value_status, ["proposed", "confirmed"] as const, collector, path + ".value_status");
      });
    }

    if (record(item.tie_breaker_rules, collector, "$.tie_breaker_rules")) {
      const allowed = ["data_coverage_desc", "confidence_desc", "tie_allowed", "product_identity_id_asc"];
      if (!Array.isArray(item.tie_breaker_rules.ordered_rules)
        || item.tie_breaker_rules.ordered_rules.length === 0
        || item.tie_breaker_rules.ordered_rules.some((rule) => !allowed.includes(String(rule)))) {
        collector.fail("$.tie_breaker_rules.ordered_rules", "ranking.tie_rules", "許可された同点規則が必要です");
      }
      enumValue(
        item.tie_breaker_rules.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.tie_breaker_rules.value_status",
      );
    }

    if (record(item.evidence_policy, collector, "$.evidence_policy")) {
      if (array(item.evidence_policy.accepted_statuses, collector, "$.evidence_policy.accepted_statuses", true)) {
        item.evidence_policy.accepted_statuses.forEach((status, index) => {
          if (!EVIDENCE_STATUSES.includes(status as (typeof EVIDENCE_STATUSES)[number])) {
            collector.fail("$.evidence_policy.accepted_statuses[" + index + "]", "value.enum", "未知のevidence_statusです");
          }
        });
      }
      if (isRecord(item.evidence_policy.unresolved_conflict)) {
        enumValue(
          item.evidence_policy.unresolved_conflict.required_axis,
          ["hold"] as const,
          collector,
          "$.evidence_policy.unresolved_conflict.required_axis",
        );
        enumValue(
          item.evidence_policy.unresolved_conflict.non_required_axis,
          ["exclude_axis"] as const,
          collector,
          "$.evidence_policy.unresolved_conflict.non_required_axis",
        );
        enumValue(
          item.evidence_policy.unresolved_conflict.critical_axis,
          ["hold"] as const,
          collector,
          "$.evidence_policy.unresolved_conflict.critical_axis",
        );
      } else {
        enumValue(
          item.evidence_policy.unresolved_conflict,
          ["hold", "exclude_axis"] as const,
          collector,
          "$.evidence_policy.unresolved_conflict",
        );
        if (schemaAtLeast(item.schema_version, 0, 3)) {
          collector.fail(
            "$.evidence_policy.unresolved_conflict",
            "ranking.scoped_conflict_policy_required",
            "0.3.0以降はrequired/non_required/critical別の方針が必要です",
          );
        }
      }
      enumValue(item.evidence_policy.outdated, ["hold", "exclude_axis"] as const, collector, "$.evidence_policy.outdated");
      enumValue(
        item.evidence_policy.duplicate_handling,
        ["representative_only"] as const,
        collector,
        "$.evidence_policy.duplicate_handling",
      );
      enumValue(
        item.evidence_policy.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.evidence_policy.value_status",
      );
    }

    if (record(item.missing_data_policy, collector, "$.missing_data_policy")) {
      enumValue(
        item.missing_data_policy.below_min_coverage,
        ["hold", "reference"] as const,
        collector,
        "$.missing_data_policy.below_min_coverage",
      );
      enumValue(
        item.missing_data_policy.missing_axis,
        ["exclude_from_score"] as const,
        collector,
        "$.missing_data_policy.missing_axis",
      );
      enumValue(
        item.missing_data_policy.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.missing_data_policy.value_status",
      );
    }

    nonEmptyString(item.confidence_formula_ref, collector, "$.confidence_formula_ref");
    if (record(item.confidence_config, collector, "$.confidence_config")) {
      enumValue(
        item.confidence_config.formula_id,
        ["confidence-proposed-v1"] as const,
        collector,
        "$.confidence_config.formula_id",
      );
      const weightKeys = [
        "data_coverage_weight",
        "source_independence_weight",
        "primary_source_weight",
        "reliability_weight",
      ] as const;
      let total = 0;
      for (const key of weightKeys) {
        if (finiteNumber(item.confidence_config[key], collector, "$.confidence_config." + key)) {
          total += item.confidence_config[key];
          if (item.confidence_config[key] < 0 || item.confidence_config[key] > 1) {
            collector.fail("$.confidence_config." + key, "value.ratio", "0〜1が必要です");
          }
        }
      }
      if (Math.abs(total - 1) > 1e-9) {
        collector.fail("$.confidence_config", "confidence.weight_sum", "confidence重みの合計は1です");
      }
      if (finiteNumber(
        item.confidence_config.independent_sources_target_per_axis,
        collector,
        "$.confidence_config.independent_sources_target_per_axis",
      ) && item.confidence_config.independent_sources_target_per_axis <= 0) {
        collector.fail("$.confidence_config.independent_sources_target_per_axis", "value.positive", "正数が必要です");
      }
      enumValue(
        item.confidence_config.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.confidence_config.value_status",
      );
    }

    if (record(item.sensitivity_config, collector, "$.sensitivity_config")) {
      if (nullableNumber(item.sensitivity_config.weight_delta, collector, "$.sensitivity_config.weight_delta")
        && typeof item.sensitivity_config.weight_delta === "number"
        && (item.sensitivity_config.weight_delta <= 0 || item.sensitivity_config.weight_delta >= 1)) {
        collector.fail("$.sensitivity_config.weight_delta", "value.delta", "0より大きく1未満が必要です");
      }
      enumValue(
        item.sensitivity_config.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.sensitivity_config.value_status",
      );
    }

    if (item.freshness_rule !== null && record(item.freshness_rule, collector, "$.freshness_rule")) {
      if (finiteNumber(item.freshness_rule.max_age_days, collector, "$.freshness_rule.max_age_days")
        && (!Number.isInteger(item.freshness_rule.max_age_days) || item.freshness_rule.max_age_days < 1)) {
        collector.fail("$.freshness_rule.max_age_days", "value.positive_integer", "1以上の整数です");
      }
      enumValue(
        item.freshness_rule.value_status,
        ["proposed", "confirmed"] as const,
        collector,
        "$.freshness_rule.value_status",
      );
    }
    nonEmptyString(item.calc_version, collector, "$.calc_version");
    enumValue(item.publication_status, PUBLICATION_STATUSES, collector, "$.publication_status");
    if (containsProposed(item) && item.publication_status !== "draft") {
      collector.fail("$.publication_status", "publication.proposed_definition", "proposed設定を含む定義はdraftです");
    }
  });
}

export function validateRankingInput(value: unknown): ValidationReport<RankingInput> {
  return validateRecord<RankingInput>(value, (item, collector) => {
    nonEmptyString(item.ranking_input_id, collector, "$.ranking_input_id");
    nonEmptyString(item.ranking_definition_id, collector, "$.ranking_definition_id");
    if (nonEmptyString(item.definition_version, collector, "$.definition_version")
      && !SEMVER.test(item.definition_version)) {
      collector.fail("$.definition_version", "format.semver", "semver形式が必要です");
    }
    nonEmptyString(item.run_id, collector, "$.run_id");
    isoDate(item.snapshot_date, collector, "$.snapshot_date");
    const candidateIds: string[] = [];
    if (array(item.candidates, collector, "$.candidates", true)) {
      item.candidates.forEach((candidate, index) => {
        const path = "$.candidates[" + index + "]";
        if (!record(candidate, collector, path)) return;
        if (nonEmptyString(candidate.product_identity_id, collector, path + ".product_identity_id")) {
          candidateIds.push(candidate.product_identity_id);
        }
        stringArray(candidate.feature_refs, collector, path + ".feature_refs", { unique: true });
        stringArray(candidate.review_refs, collector, path + ".review_refs", { unique: true });
        if (candidate.data_coverage !== null) ratio(candidate.data_coverage, collector, path + ".data_coverage");
        if (candidate.weighted_data_coverage !== undefined && candidate.weighted_data_coverage !== null) {
          ratio(candidate.weighted_data_coverage, collector, path + ".weighted_data_coverage");
        }
      });
    }
    if (new Set(candidateIds).size !== candidateIds.length) {
      collector.fail("$.candidates", "ranking.duplicate_candidate", "候補identityは一意です");
    }
    if (array(item.excluded, collector, "$.excluded")) {
      item.excluded.forEach((excluded, index) => {
        const path = "$.excluded[" + index + "]";
        if (!record(excluded, collector, path)) return;
        nonEmptyString(excluded.product_identity_id, collector, path + ".product_identity_id");
        nonEmptyString(excluded.exclusion_reason, collector, path + ".exclusion_reason");
      });
    }
    nullableString(item.input_hash, collector, "$.input_hash");
    if (item.input_hash_algorithm !== undefined) {
      enumValue(item.input_hash_algorithm, ["sha256", null] as const, collector, "$.input_hash_algorithm");
    }
    if (typeof item.input_hash === "string") {
      if (!SHA256_HEX.test(item.input_hash)) collector.fail("$.input_hash", "hash.sha256", "64文字の小文字SHA-256 hexが必要です");
      if (item.input_hash_algorithm !== "sha256") {
        collector.fail("$.input_hash_algorithm", "hash.algorithm_required", "input_hashにはsha256指定が必要です");
      }
    }
  });
}

export function validateRankingResult(value: unknown): ValidationReport<RankingResult> {
  return validateRecord<RankingResult>(value, (item, collector) => {
    for (const key of [
      "ranking_result_id",
      "ranking_input_id",
      "ranking_definition_id",
      "definition_version",
      "calc_version",
      "run_id",
    ] as const) {
      nonEmptyString(item[key], collector, "$." + key);
    }
    timestamp(item.generated_at, collector, "$.generated_at");
    if (array(item.entries, collector, "$.entries")) {
      item.entries.forEach((entry, index) => {
        const path = "$.entries[" + index + "]";
        if (!record(entry, collector, path)) return;
        if (finiteNumber(entry.rank, collector, path + ".rank")
          && (!Number.isInteger(entry.rank) || entry.rank < 1)) {
          collector.fail(path + ".rank", "value.positive_integer", "1以上の整数です");
        }
        nonEmptyString(entry.product_identity_id, collector, path + ".product_identity_id");
        const observedScore = entry.observed_score ?? entry.score;
        if (finiteNumber(observedScore, collector, path + ".observed_score") && (observedScore < 0 || observedScore > 100)) {
          collector.fail(path + ".observed_score", "value.score", "0〜100です");
        }
        if (entry.score !== undefined) {
          if (finiteNumber(entry.score, collector, path + ".score") && entry.score !== observedScore) {
            collector.fail(path + ".score", "ranking.score_alias_mismatch", "score aliasはobserved_scoreと同値です");
          }
        }
        if (schemaAtLeast(item.schema_version, 0, 3) && entry.observed_score === undefined) {
          collector.fail(path + ".observed_score", "ranking.observed_score_required", "0.3.0以降はobserved_scoreが必要です");
        }
        ratio(entry.data_coverage, collector, path + ".data_coverage");
        if (entry.weighted_data_coverage === undefined) {
          if (schemaAtLeast(item.schema_version, 0, 3)) {
            collector.fail(path + ".weighted_data_coverage", "ranking.weighted_coverage_required", "0.3.0以降はweighted_data_coverageが必要です");
          }
        } else {
          ratio(entry.weighted_data_coverage, collector, path + ".weighted_data_coverage");
        }
        ratio(entry.confidence, collector, path + ".confidence");
        if (array(entry.per_axis_breakdown, collector, path + ".per_axis_breakdown", true)) {
          entry.per_axis_breakdown.forEach((axis, axisIndex) => {
            const axisPath = path + ".per_axis_breakdown[" + axisIndex + "]";
            if (!record(axis, collector, axisPath)) return;
            nonEmptyString(axis.axis_id, collector, axisPath + ".axis_id");
            nonEmptyString(axis.normalized_feature_id, collector, axisPath + ".normalized_feature_id");
            normalizedValue(axis.value, collector, axisPath + ".value");
            finiteNumber(axis.raw_axis_score, collector, axisPath + ".raw_axis_score");
            finiteNumber(axis.normalized_weight, collector, axisPath + ".normalized_weight");
            finiteNumber(axis.weighted_score, collector, axisPath + ".weighted_score");
            enumValue(axis.evidence_status, EVIDENCE_STATUSES, collector, axisPath + ".evidence_status");
            stringArray(axis.evidence_claim_ids, collector, axisPath + ".evidence_claim_ids", { nonEmpty: true, unique: true });
            stringArray(axis.source_record_ids, collector, axisPath + ".source_record_ids", { nonEmpty: true, unique: true });
          });
        }
        nonEmptyString(entry.reason_text, collector, path + ".reason_text");
        stringArray(entry.strengths, collector, path + ".strengths", { unique: true });
        stringArray(entry.cautions, collector, path + ".cautions", { unique: true });
        stringArray(entry.unconfirmed_axes, collector, path + ".unconfirmed_axes", { unique: true });
        nullableString(entry.tie_note, collector, path + ".tie_note");
      });
    }
    for (const key of ["on_hold", "excluded"] as const) {
      if (array(item[key], collector, "$." + key)) {
        item[key].forEach((disposition, index) => {
          const path = "$." + key + "[" + index + "]";
          if (!record(disposition, collector, path)) return;
          nonEmptyString(disposition.product_identity_id, collector, path + ".product_identity_id");
          nonEmptyString(disposition.reason, collector, path + ".reason");
          nonEmptyString(disposition.reason_code, collector, path + ".reason_code");
          if (disposition.data_coverage !== null) ratio(disposition.data_coverage, collector, path + ".data_coverage");
          if (disposition.weighted_data_coverage !== undefined && disposition.weighted_data_coverage !== null) {
            ratio(disposition.weighted_data_coverage, collector, path + ".weighted_data_coverage");
          } else if (disposition.weighted_data_coverage === undefined && schemaAtLeast(item.schema_version, 0, 3)) {
            collector.fail(path + ".weighted_data_coverage", "ranking.weighted_coverage_required", "0.3.0以降はweighted_data_coverageが必要です");
          }
          if (disposition.confidence !== null) ratio(disposition.confidence, collector, path + ".confidence");
        });
      }
    }
    if (array(item.sensitivity_notes, collector, "$.sensitivity_notes")) {
      item.sensitivity_notes.forEach((note, index) => {
        const path = "$.sensitivity_notes[" + index + "]";
        if (!record(note, collector, path)) return;
        for (const key of ["product_a", "product_b", "axis_id", "baseline_order", "varied_order"] as const) {
          nonEmptyString(note[key], collector, path + "." + key);
        }
        finiteNumber(note.weight_delta, collector, path + ".weight_delta");
        enumValue(note.direction, ["increase", "decrease"] as const, collector, path + ".direction");
      });
    }
    if (schemaAtLeast(item.schema_version, 0, 3)) {
      nonEmptyString(item.input_hash, collector, "$.input_hash");
      if (typeof item.input_hash === "string" && !SHA256_HEX.test(item.input_hash)) {
        collector.fail("$.input_hash", "hash.sha256", "64文字の小文字SHA-256 hexが必要です");
      }
      enumValue(item.input_hash_algorithm, ["sha256"] as const, collector, "$.input_hash_algorithm");
    }
    enumValue(item.publication_status, PUBLICATION_STATUSES, collector, "$.publication_status");
    if (item.publication_status !== "draft") {
      collector.fail("$.publication_status", "publication.prototype", "試作結果はdraftです");
    }
  });
}

export function validateReviewReport(value: unknown): ValidationReport<ReviewReport> {
  return validateRecord<ReviewReport>(value, (item, collector) => {
    nonEmptyString(item.review_report_id, collector, "$.review_report_id");
    nonEmptyString(item.run_id, collector, "$.run_id");
    nonEmptyString(item.summary, collector, "$.summary");
    if (array(item.product_summaries, collector, "$.product_summaries", true)) {
      item.product_summaries.forEach((summary, index) => {
        const path = "$.product_summaries[" + index + "]";
        if (!record(summary, collector, path)) return;
        nonEmptyString(summary.product_identity_id, collector, path + ".product_identity_id");
        enumValue(
          summary.identification_status,
          ["identified", "provisional", "unidentified"] as const,
          collector,
          path + ".identification_status",
        );
        for (const key of ["source_count", "claim_count", "conflicts"] as const) {
          if (finiteNumber(summary[key], collector, path + "." + key)
            && (!Number.isInteger(summary[key]) || summary[key] < 0)) {
            collector.fail(path + "." + key, "value.non_negative_integer", "0以上の整数です");
          }
        }
        stringArray(summary.unconfirmed_axes, collector, path + ".unconfirmed_axes", { unique: true });
      });
    }
    if (array(item.validation_summary, collector, "$.validation_summary", true)) {
      item.validation_summary.forEach((summary, index) => {
        const path = "$.validation_summary[" + index + "]";
        if (!record(summary, collector, path)) return;
        nonEmptyString(summary.check_name, collector, path + ".check_name");
        enumValue(summary.result, VALIDATION_RESULTS, collector, path + ".result");
        nonEmptyString(summary.detail, collector, path + ".detail");
      });
    }
    stringArray(item.open_questions, collector, "$.open_questions");
    stringArray(item.recommended_next_actions, collector, "$.recommended_next_actions");
    if (item.editorial_notes !== undefined && array(item.editorial_notes, collector, "$.editorial_notes")) {
      item.editorial_notes.forEach((note, index) => {
        const path = "$.editorial_notes[" + index + "]";
        if (!record(note, collector, path)) return;
        nonEmptyString(note.topic, collector, path + ".topic");
        nonEmptyString(note.text, collector, path + ".text");
        enumValue(note.evidence_status, EVIDENCE_STATUSES, collector, path + ".evidence_status");
        stringArray(note.supporting_claims, collector, path + ".supporting_claims", { nonEmpty: true, unique: true });
      });
    }
    enumValue(item.publication_status, PUBLICATION_STATUSES, collector, "$.publication_status");
  });
}

export function validateContract(name: ContractName, value: unknown): ValidationReport<ContractRecord> {
  switch (name) {
    case "run_manifest": return validateRunManifest(value);
    case "product_identity": return validateProductIdentity(value);
    case "source_record": return validateSourceRecord(value);
    case "evidence_claim": return validateEvidenceClaim(value);
    case "normalized_feature": return validateNormalizedFeature(value);
    case "review_theme_summary": return validateReviewThemeSummary(value);
    case "ranking_definition": return validateRankingDefinition(value);
    case "ranking_input": return validateRankingInput(value);
    case "ranking_result": return validateRankingResult(value);
    case "review_report": return validateReviewReport(value);
  }
}

function uniqueMap<T>(
  values: T[],
  getId: (value: T) => string,
  path: string,
  collector: Collector,
): Map<string, T> {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    const id = getId(value);
    if (result.has(id)) collector.fail(path + "[" + index + "]", "reference.duplicate_id", "重複ID: " + id);
    else result.set(id, value);
  });
  return result;
}

export function validateRankingExecutionBundle(value: unknown): ValidationReport<RankingExecutionBundle> {
  const collector = new Collector();
  if (!record(value, collector, "$")) return collector.report();
  const bundle = value as unknown as RankingExecutionBundle;

  collector.merge("$.definition", validateRankingDefinition(bundle.definition));
  collector.merge("$.input", validateRankingInput(bundle.input));

  const collections: Array<{
    key: "product_identities" | "source_records" | "evidence_claims" | "normalized_features" | "review_theme_summaries";
    validate: (entry: unknown) => ValidationReport<unknown>;
  }> = [
    { key: "product_identities", validate: validateProductIdentity },
    { key: "source_records", validate: validateSourceRecord },
    { key: "evidence_claims", validate: validateEvidenceClaim },
    { key: "normalized_features", validate: validateNormalizedFeature },
    { key: "review_theme_summaries", validate: validateReviewThemeSummary },
  ];
  for (const collection of collections) {
    const entries = bundle[collection.key];
    if (!Array.isArray(entries)) {
      collector.fail("$." + collection.key, "type.array", "arrayが必要です");
      continue;
    }
    entries.forEach((entry, index) => {
      collector.merge("$." + collection.key + "[" + index + "]", collection.validate(entry));
    });
  }

  if (!bundle.definition || !bundle.input
    || !Array.isArray(bundle.product_identities)
    || !Array.isArray(bundle.source_records)
    || !Array.isArray(bundle.evidence_claims)
    || !Array.isArray(bundle.normalized_features)
    || !Array.isArray(bundle.review_theme_summaries)) {
    return collector.report();
  }

  if (bundle.input.ranking_definition_id !== bundle.definition.ranking_definition_id
    || bundle.input.definition_version !== bundle.definition.definition_version) {
    collector.fail("$.input", "reference.definition_mismatch", "ranking_inputとdefinitionのID・版が一致しません");
  }

  const products = uniqueMap(
    bundle.product_identities,
    (entry) => entry.product_identity_id,
    "$.product_identities",
    collector,
  );
  const sources = uniqueMap(bundle.source_records, (entry) => entry.source_record_id, "$.source_records", collector);
  const claims = uniqueMap(bundle.evidence_claims, (entry) => entry.evidence_claim_id, "$.evidence_claims", collector);
  const features = uniqueMap(
    bundle.normalized_features,
    (entry) => entry.normalized_feature_id,
    "$.normalized_features",
    collector,
  );
  const reviews = uniqueMap(
    bundle.review_theme_summaries,
    (entry) => entry.review_theme_summary_id,
    "$.review_theme_summaries",
    collector,
  );

  for (const product of bundle.product_identities) {
    if (product.variant_of !== null && !products.has(product.variant_of)) {
      collector.fail(
        "$.product_identities." + product.product_identity_id + ".variant_of",
        "reference.missing_product",
        product.variant_of,
      );
    }
    for (const sourceId of product.identification_evidence) {
      if (!sources.has(sourceId)) {
        collector.fail(
          "$.product_identities." + product.product_identity_id + ".identification_evidence",
          "reference.missing_source",
          "不存在source: " + sourceId,
        );
      }
    }
    for (const variant of product.variants ?? []) {
      for (const claimId of variant.supporting_claims) {
        const claim = claims.get(claimId);
        if (!claim) {
          collector.fail(
            "$.product_identities." + product.product_identity_id + ".variants." + variant.variant_id + ".supporting_claims",
            "reference.missing_claim",
            claimId,
          );
        } else if (claim.product_identity_id !== product.product_identity_id) {
          collector.fail(
            "$.product_identities." + product.product_identity_id + ".variants." + variant.variant_id + ".supporting_claims",
            "identity.cross_product_claim",
            claimId,
          );
        }
      }
    }
  }
  for (const source of bundle.source_records) {
    if (source.target_product !== null && !products.has(source.target_product)) {
      collector.fail(
        "$.source_records." + source.source_record_id + ".target_product",
        "reference.missing_product",
        "不存在product: " + source.target_product,
      );
    }
  }
  for (const claim of bundle.evidence_claims) {
    const claimSource = sources.get(claim.source_record_id);
    if (!claimSource) {
      collector.fail(
        "$.evidence_claims." + claim.evidence_claim_id + ".source_record_id",
        "reference.missing_source",
        "不存在source: " + claim.source_record_id,
      );
    } else if (claimSource.target_product !== claim.product_identity_id) {
      collector.fail(
        "$.evidence_claims." + claim.evidence_claim_id + ".source_record_id",
        "identity.cross_product_source",
        "sourceの対象identityとclaimが一致しません",
      );
    }
    if (!products.has(claim.product_identity_id)) {
      collector.fail(
        "$.evidence_claims." + claim.evidence_claim_id + ".product_identity_id",
        "reference.missing_product",
        "不存在product: " + claim.product_identity_id,
      );
    }
    for (const claimId of claim.derived_from) {
      if (!claims.has(claimId)) {
        collector.fail("$.evidence_claims." + claim.evidence_claim_id + ".derived_from", "reference.missing_claim", claimId);
      }
    }
    for (const claimId of claim.conflict_with) {
      const other = claims.get(claimId);
      if (!other) {
        collector.fail("$.evidence_claims." + claim.evidence_claim_id + ".conflict_with", "reference.missing_claim", claimId);
      } else if (!other.conflict_with.includes(claim.evidence_claim_id)) {
        collector.fail(
          "$.evidence_claims." + claim.evidence_claim_id + ".conflict_with",
          "conflict.not_reciprocal",
          claimId + "から相互参照されていません",
        );
      }
    }
    if (claim.duplicate_of !== null && !claims.has(claim.duplicate_of)) {
      collector.fail(
        "$.evidence_claims." + claim.evidence_claim_id + ".duplicate_of",
        "reference.missing_claim",
        claim.duplicate_of,
      );
    }
  }
  for (const feature of bundle.normalized_features) {
    if (!products.has(feature.product_identity_id)) {
      collector.fail(
        "$.normalized_features." + feature.normalized_feature_id + ".product_identity_id",
        "reference.missing_product",
        feature.product_identity_id,
      );
    }
    for (const claimId of feature.supporting_claims) {
      const claim = claims.get(claimId);
      if (!claim) {
        collector.fail(
          "$.normalized_features." + feature.normalized_feature_id + ".supporting_claims",
          "reference.missing_claim",
          claimId,
        );
      } else {
        if (claim.product_identity_id !== feature.product_identity_id) {
          collector.fail(
            "$.normalized_features." + feature.normalized_feature_id + ".supporting_claims",
            "identity.cross_product_claim",
            claimId + "は別identityです",
          );
        }
        if (claim.axis_id !== null && canonicalizeAxisId(claim.axis_id) !== canonicalizeAxisId(feature.axis_id)) {
          collector.fail(
            "$.normalized_features." + feature.normalized_feature_id + ".supporting_claims",
            "reference.axis_mismatch",
            claimId + "は別axisです",
          );
        }
      }
    }
  }
  for (const review of bundle.review_theme_summaries) {
    if (!products.has(review.product_identity_id)) {
      collector.fail(
        "$.review_theme_summaries." + review.review_theme_summary_id + ".product_identity_id",
        "reference.missing_product",
        review.product_identity_id,
      );
    }
    for (const sourceId of review.representative_sources) {
      if (!sources.has(sourceId)) {
        collector.fail(
          "$.review_theme_summaries." + review.review_theme_summary_id + ".representative_sources",
          "reference.missing_source",
          sourceId,
        );
      }
    }
  }
  for (const candidate of bundle.input.candidates) {
    if (!products.has(candidate.product_identity_id)) {
      collector.fail(
        "$.input.candidates." + candidate.product_identity_id,
        "reference.missing_product",
        "候補identityが存在しません",
      );
    }
    const candidateAxes = new Set<string>();
    for (const featureId of candidate.feature_refs) {
      const feature = features.get(featureId);
      if (!feature) {
        collector.fail(
          "$.input.candidates." + candidate.product_identity_id + ".feature_refs",
          "reference.missing_feature",
          featureId,
        );
      } else if (feature.product_identity_id !== candidate.product_identity_id) {
        collector.fail(
          "$.input.candidates." + candidate.product_identity_id + ".feature_refs",
          "identity.cross_product_feature",
          featureId + "は別identityです",
        );
      } else if (candidateAxes.has(canonicalizeAxisId(feature.axis_id))) {
        collector.fail(
          "$.input.candidates." + candidate.product_identity_id + ".feature_refs",
          "reference.duplicate_axis_feature",
          canonicalizeAxisId(feature.axis_id) + "のfeatureが複数あります",
        );
      } else {
        candidateAxes.add(canonicalizeAxisId(feature.axis_id));
      }
    }
    for (const reviewId of candidate.review_refs) {
      const review = reviews.get(reviewId);
      if (!review) {
        collector.fail(
          "$.input.candidates." + candidate.product_identity_id + ".review_refs",
          "reference.missing_review",
          reviewId,
        );
      } else if (review.product_identity_id !== candidate.product_identity_id) {
        collector.fail(
          "$.input.candidates." + candidate.product_identity_id + ".review_refs",
          "identity.cross_product_review",
          reviewId + "は別identityです",
        );
      }
    }
  }

  return collector.report(bundle);
}

export function assertValidRankingExecutionBundle(value: unknown): asserts value is RankingExecutionBundle {
  const report = validateRankingExecutionBundle(value);
  if (report.result === "fail") {
    const detail = report.issues.map((issue) => issue.path + ": " + issue.message).join("\n");
    throw new Error("ranking input validation failed\n" + detail);
  }
}
