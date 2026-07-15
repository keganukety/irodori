import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  cloneFixture,
  fictionalDemandAudit,
  fictionalEditorialAudit,
  fictionalExternalSourceBundle,
  fictionalIrodoriDerivedSnapshot,
  fictionalMetadataOnlySource,
  fictionalOfficialWeeklyWebSnapshot,
  fictionalPendingDemandAudit,
  fictionalPendingPublicationSnapshot,
  fictionalSecondShopSnapshot,
  fictionalSmallCountTheme,
  fictionalStructuredThemeSource,
  fictionalUnknownCountTheme,
  fictionalValidApiSnapshot,
} from "../fixtures/fictional-external-sources.ts";
import {
  validateExternalSourceBundle,
  validateRakutenRankingSnapshot,
  validateReviewThemeSummary,
  validateSourceRecord,
  validateSourceUsageAudit,
} from "../../shared/contracts/validators.ts";
import { calculateRankingResult } from "../scripts/ranking-engine.ts";
import { fictionalRankingBundle } from "../fixtures/fictional-train-commute.ts";

const auditJsonUrl = new URL("../../source-audits/2026-07-15/source-usage-audits.json", import.meta.url);
const officialSourcesUrl = new URL("../../runs/2026-07-15-cybex-melio-carbon-2026-official/sources.json", import.meta.url);
const auditedMedia = JSON.parse(readFileSync(auditJsonUrl, "utf8"));
const officialPilotSources = JSON.parse(readFileSync(officialSourcesUrl, "utf8"));

function issueCodes(report) {
  return report.issues.map((issue) => issue.code);
}

function assertPass(report) {
  assert.equal(report.result, "pass", JSON.stringify(report.issues, null, 2));
}

function assertFail(report, code) {
  assert.equal(report.result, "fail", JSON.stringify(report.issues, null, 2));
  assert.ok(issueCodes(report).includes(code), `missing ${code}: ${JSON.stringify(report.issues)}`);
}

test("SourceUsageAudit accepts a complete fictional policy record", () => {
  assertPass(validateSourceUsageAudit(fictionalEditorialAudit));
});

test("audit_result pass remains independent from explicit terms permission", () => {
  const myBest = auditedMedia.find((audit) => audit.medium_id === "my-best");
  const operation = myBest.checked_operations.find((entry) => entry.operation_id === "manual_read_and_structure");
  assert.equal(operation.audit_result, "pass");
  assert.equal(operation.terms_permission_status, "ambiguous");
  assertPass(validateSourceUsageAudit(myBest));
});

test("schema 0.4 third-party SourceRecord requires source_usage_audit_id", () => {
  const source = cloneFixture(fictionalMetadataOnlySource);
  delete source.source_usage_audit_id;
  assertFail(validateSourceRecord(source), "source_policy.audit_id_required");
});

test("schema 0.3 manufacturer official SourceRecords remain backward compatible", () => {
  assert.ok(officialPilotSources.length > 0);
  for (const source of officialPilotSources) assertPass(validateSourceRecord(source));
});

test("an audited prohibited automation method is rejected", () => {
  const bundle = cloneFixture(fictionalExternalSourceBundle);
  bundle.source_records[0].acquisition_method = "automated_html";
  bundle.source_records[0].automation_used = true;
  assertFail(validateExternalSourceBundle(bundle), "source_policy.automation_prohibited");
});

test("minimal quote is rejected when the source quote policy prohibits it", () => {
  const bundle = cloneFixture(fictionalExternalSourceBundle);
  bundle.review_theme_summaries[0].contains_quote = true;
  assertFail(validateExternalSourceBundle(bundle), "source_policy.quote_prohibited");
});

test("PII flags and author identifiers are rejected", () => {
  const review = cloneFixture(fictionalUnknownCountTheme);
  review.contains_pii = true;
  assertFail(validateReviewThemeSummary(review), "source_policy.pii_prohibited");
  const source = cloneFixture(fictionalMetadataOnlySource);
  source.author_id = "fictional-author-id";
  assertFail(validateSourceRecord(source), "source_policy.content_storage_prohibited");
});

test("article body storage is rejected", () => {
  const source = cloneFixture(fictionalMetadataOnlySource);
  source.article_body = "架空記事本文";
  assertFail(validateSourceRecord(source), "source_policy.content_storage_prohibited");
});

test("individual review body storage is rejected", () => {
  const source = cloneFixture(fictionalStructuredThemeSource);
  source.review_body = "架空口コミ本文";
  assertFail(validateSourceRecord(source), "source_policy.content_storage_prohibited");
});

test("metadata_only source passes its audited storage policy", () => {
  assertPass(validateSourceRecord(fictionalMetadataOnlySource));
  assertPass(validateExternalSourceBundle(fictionalExternalSourceBundle));
});

test("structured_themes_only source and short theme summary pass", () => {
  assertPass(validateSourceRecord(fictionalStructuredThemeSource));
  assertPass(validateReviewThemeSummary(fictionalSmallCountTheme));
});

test("unknown review counts remain null rather than zero", () => {
  assert.equal(fictionalUnknownCountTheme.observed_item_count, null);
  assert.equal(fictionalUnknownCountTheme.deduplicated_item_count, null);
  assert.equal(fictionalUnknownCountTheme.sample_size_status, "unknown");
  assertPass(validateReviewThemeSummary(fictionalUnknownCountTheme));
});

test("unsupported generalizations are rejected for unknown or small samples", () => {
  const phrases = [
    "多くの口コミ", "多数の利用者", "よく言われている", "圧倒的に好評", "口コミで人気",
    "高評価が多い", "売れ筋", "大人気", "今一番売れている",
  ];
  for (const phrase of phrases) {
    const review = cloneFixture(fictionalSmallCountTheme);
    review.summary = phrase + "という架空表現";
    assertFail(validateReviewThemeSummary(review), "review.unsupported_generalization");
  }
});

test("ReviewThemeSummary ranking_score_impact must be none", () => {
  const review = cloneFixture(fictionalSmallCountTheme);
  review.ranking_score_impact = "sentiment";
  assertFail(validateReviewThemeSummary(review), "value.enum");
});

test("review sentiment and item counts do not alter quality ranking entries", () => {
  const baselineBundle = cloneFixture(fictionalRankingBundle);
  const changedBundle = cloneFixture(fictionalRankingBundle);
  changedBundle.review_theme_summaries[0].sentiment = "negative";
  changedBundle.review_theme_summaries[0].observed_item_count = 70;
  changedBundle.review_theme_summaries[0].deduplicated_item_count = 60;
  changedBundle.review_theme_summaries[0].sample_size_status = "known_large";
  const baseline = calculateRankingResult(baselineBundle);
  const changed = calculateRankingResult(changedBundle);
  assert.deepEqual(changed.entries, baseline.entries);
});

test("all four Markdown-derived SourceUsageAudit records validate", () => {
  assert.deepEqual(auditedMedia.map((audit) => audit.medium_id), [
    "my-best", "kakaku-com", "tamahiyo", "rakuten-ichiba-ranking",
  ]);
  for (const audit of auditedMedia) assertPass(validateSourceUsageAudit(audit));
});

test("the four machine-readable audits preserve each medium's distinct operating policy", () => {
  const byId = Object.fromEntries(auditedMedia.map((audit) => [audit.medium_id, audit]));
  for (const audit of auditedMedia) assert.equal(audit.checked_operations.length, 14);
  const decision = (medium, operationId) => byId[medium].checked_operations
    .find((entry) => entry.operation_id === operationId).operational_decision;
  assert.equal(decision("my-best", "manual_read_and_structure"), "allowed_with_conditions");
  assert.equal(decision("my-best", "minimal_quote"), "prohibited");
  assert.equal(decision("my-best", "external_ranking_metadata"), "pending_review");
  assert.equal(byId["kakaku-com"].operational_decision, "not_adopted");
  assert.equal(decision("kakaku-com", "manual_read_and_structure"), "pending_review");
  assert.equal(byId.tamahiyo.operational_decision, "allowed_with_conditions");
  assert.notEqual(byId.tamahiyo.terms_permission_status, "explicitly_permitted");
  assert.equal(decision("tamahiyo", "editorial_theme_extraction"), "allowed_with_conditions");
  assert.equal(byId["rakuten-ichiba-ranking"].operational_decision, "pending_review");
  assert.equal(decision("rakuten-ichiba-ranking", "automated_html_acquisition"), "prohibited");
  assert.equal(decision("rakuten-ichiba-ranking", "official_api"), "pending_review");
  assert.deepEqual(byId["rakuten-ichiba-ranking"].permitted_roles, [
    "market_demand_signal", "external_sales_ranking_metadata",
  ]);
  const retention = Object.fromEntries(byId["rakuten-ichiba-ranking"].storage_policy.retention_rules
    .map((rule) => [rule.applies_to, rule]));
  assert.deepEqual([retention.price.duration_value, retention.price.duration_unit], [24, "hours"]);
  assert.deepEqual([retention.availability.duration_value, retention.availability.duration_unit], [24, "hours"]);
  assert.deepEqual([retention.metadata.duration_value, retention.metadata.duration_unit], [3, "months"]);
  assert.equal(retention.derived_aggregate_over_three_months.status, "unresolved");
});

test("a conditional fictional official API snapshot validates", () => {
  assertPass(validateRakutenRankingSnapshot(fictionalValidApiSnapshot, { asOf: "2026-07-15T12:00:00Z" }));
});

test("pending API adoption cannot be published", () => {
  const bundle = cloneFixture(fictionalExternalSourceBundle);
  bundle.rakuten_ranking_snapshots = [cloneFixture(fictionalPendingPublicationSnapshot)];
  assertFail(validateExternalSourceBundle(bundle), "source_policy.operation_not_allowed");
  assertFail(
    validateRakutenRankingSnapshot(fictionalPendingPublicationSnapshot, { asOf: "2026-07-15T12:00:00Z" }),
    "source_policy.legal_review_incomplete",
  );
});

test("price TTL cannot exceed the source-policy 24-hour value", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.data_expiry.price_expires_at = "2026-07-16T00:00:01Z";
  assertFail(validateRakutenRankingSnapshot(snapshot), "retention.price_ttl_exceeded");
});

test("availability TTL cannot exceed the source-policy 24-hour value", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.data_expiry.availability_expires_at = "2026-07-16T00:00:01Z";
  assertFail(validateRakutenRankingSnapshot(snapshot), "retention.availability_ttl_exceeded");
});

test("metadata TTL cannot exceed three calendar months", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.data_expiry.metadata_expires_at = "2026-10-15T00:00:01Z";
  assertFail(validateRakutenRankingSnapshot(snapshot), "retention.metadata_ttl_exceeded");
});

test("expired price, availability, and metadata cannot remain current", () => {
  const price = cloneFixture(fictionalValidApiSnapshot);
  price.availability = null;
  assertFail(
    validateRakutenRankingSnapshot(price, { asOf: "2026-07-16T00:00:01Z" }),
    "retention.expired_marked_current",
  );
  const availability = cloneFixture(fictionalValidApiSnapshot);
  availability.price = null;
  assertFail(
    validateRakutenRankingSnapshot(availability, { asOf: "2026-07-16T00:00:01Z" }),
    "retention.expired_marked_current",
  );
  const metadata = cloneFixture(fictionalValidApiSnapshot);
  metadata.price = null;
  metadata.availability = null;
  assertFail(
    validateRakutenRankingSnapshot(metadata, { asOf: "2026-10-15T00:00:01Z" }),
    "retention.expired_marked_current",
  );
});

test("product-name-only confirmed identity matching is rejected", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.match_evidence = [{ evidence_type: "normalized_product_name", value: snapshot.item_name }];
  assertFail(validateRakutenRankingSnapshot(snapshot), "identity.confirmed_evidence_insufficient");
});

test("the same product candidate from multiple shops remains separate listings", () => {
  const bundle = cloneFixture(fictionalExternalSourceBundle);
  bundle.rakuten_ranking_snapshots = [
    cloneFixture(fictionalValidApiSnapshot),
    cloneFixture(fictionalSecondShopSnapshot),
  ];
  assertPass(validateExternalSourceBundle(bundle));
  assert.equal(new Set(bundle.rakuten_ranking_snapshots.map((entry) => entry.shop_code)).size, 2);
  assert.equal(new Set(bundle.rakuten_ranking_snapshots.map((entry) => entry.rakuten_item_code)).size, 2);
  assert.equal(new Set(bundle.rakuten_ranking_snapshots.map((entry) => entry.product_identity_id)).size, 1);
});

test("official weekly rank and IRODORI seven-day derivation remain distinct", () => {
  assertPass(validateRakutenRankingSnapshot(fictionalOfficialWeeklyWebSnapshot));
  assertPass(validateRakutenRankingSnapshot(fictionalIrodoriDerivedSnapshot));
  const apiWeekly = cloneFixture(fictionalOfficialWeeklyWebSnapshot);
  apiWeekly.acquisition_method = "official_api";
  assertFail(validateRakutenRankingSnapshot(apiWeekly), "rakuten.api_period_not_verified");
  const disguisedDerived = cloneFixture(fictionalIrodoriDerivedSnapshot);
  disguisedDerived.ranking_source = "rakuten_official_weekly_rank";
  assertFail(validateRakutenRankingSnapshot(disguisedDerived), "rakuten.derived_source_mismatch");
});

test("Rakuten rank cannot be wired to quality score", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.quality_score_input_fields = ["rakuten_rank"];
  assertFail(validateRakutenRankingSnapshot(snapshot), "ranking.external_signal_prohibited");
});

test("Rakuten review_average cannot be wired to quality score", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.quality_score_input_fields = ["review_average"];
  assertFail(validateRakutenRankingSnapshot(snapshot), "ranking.external_signal_prohibited");
});

test("Rakuten review_count cannot be wired to quality score", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.quality_score_input_fields = ["review_count"];
  assertFail(validateRakutenRankingSnapshot(snapshot), "ranking.external_signal_prohibited");
});

test("affiliate rate cannot be wired to quality score", () => {
  const snapshot = cloneFixture(fictionalValidApiSnapshot);
  snapshot.quality_score_input_fields = ["affiliate_rate"];
  assertFail(validateRakutenRankingSnapshot(snapshot), "ranking.external_signal_prohibited");
});

test("fictional fixture contains no real media domains or real Rakuten listings", () => {
  const serialized = JSON.stringify(fictionalExternalSourceBundle);
  for (const realDomain of ["my-best.com", "kakaku.com", "st.benesse.ne.jp", "rakuten.co.jp"]) {
    assert.equal(serialized.includes(realDomain), false, realDomain);
  }
  for (const audit of fictionalExternalSourceBundle.source_usage_audits) {
    assert.deepEqual(audit.official_domains, ["example.invalid"]);
  }
  for (const source of fictionalExternalSourceBundle.source_records) {
    assert.equal(new URL(source.url).hostname, "example.invalid");
    assert.match(source.media_name, /^架空/);
  }
  for (const snapshot of fictionalExternalSourceBundle.rakuten_ranking_snapshots) {
    assert.equal(new URL(snapshot.item_url).hostname, "example.invalid");
    assert.match(snapshot.item_name, /^架空/);
  }
});

test("fixture audits keep prohibited HTML automation explicit", () => {
  for (const audit of [fictionalEditorialAudit, fictionalDemandAudit, fictionalPendingDemandAudit]) {
    assert.ok(audit.automation_policy.prohibited_operations.includes("automated_html_acquisition"));
    assert.ok(audit.automation_policy.prohibited_operations.includes("scheduled_html_monitoring"));
  }
});
