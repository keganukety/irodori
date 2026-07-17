import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateCoverageConfiguration } from "./coverage-contract.ts";
import { buildAnalysis } from "../private-analysis/2026-07-17-stroller-official-5-sensitivity/run-sensitivity-analysis.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(here, "..");
const repoRoot = resolve(engineRoot, "../../..");
const analysisRoot = join(engineRoot, "private-analysis/2026-07-17-stroller-official-5-sensitivity");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256CanonicalTextFile(path) {
  const canonicalText = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(canonicalText, "utf8").digest("hex");
}

function check(checks, checkId, condition, detail) {
  checks.push({ check_id: checkId, result: condition ? "pass" : "fail", detail });
}

export function validateCoverageArtifacts() {
  const contractPath = join(engineRoot, "config/coverage-contract.proposed.json");
  const profilesPath = join(engineRoot, "config/coverage-profiles.proposed.json");
  const schemaPath = join(engineRoot, "contracts/coverage-contract.schema.json");
  const analysisConfigPath = join(analysisRoot, "analysis-config.json");
  const resultPath = join(analysisRoot, "analysis-result.json");
  const contract = readJson(contractPath);
  const profiles = readJson(profilesPath);
  const schema = readJson(schemaPath);
  const analysisConfig = readJson(analysisConfigPath);
  const committed = readJson(resultPath);
  const rebuilt = buildAnalysis();
  const configuration = validateCoverageConfiguration(contract, profiles);
  const checks = [];

  check(checks, "configuration", configuration.result === "pass", configuration.issues);
  check(checks, "schema_draft", schema.$schema === "https://json-schema.org/draft/2020-12/schema", schema.$schema);
  check(checks, "schema_not_migration", schema.description.includes("not a migration"), schema.description);
  check(checks, "three_profiles", profiles.profiles.length === 3
    && ["lenient", "balanced", "strict"].every((id) => profiles.profiles.some((profile) => profile.profile_id === id)),
  profiles.profiles.map((profile) => profile.profile_id));
  check(checks, "profiles_proposed", profiles.profiles.every((profile) => profile.value_status === "proposed")
    && profiles.status === "proposed" && profiles.publication_status === "draft", profiles.status);
  check(checks, "contract_hash", committed.coverage_contract?.contract_sha256 === sha256CanonicalTextFile(contractPath), committed.coverage_contract?.contract_sha256);
  check(checks, "profiles_hash", committed.coverage_contract?.profiles_sha256 === sha256CanonicalTextFile(profilesPath), committed.coverage_contract?.profiles_sha256);
  check(checks, "schema_hash", committed.coverage_contract?.schema_sha256 === sha256CanonicalTextFile(schemaPath), committed.coverage_contract?.schema_sha256);
  check(checks, "deterministic_result", JSON.stringify(rebuilt) === JSON.stringify(committed), "rebuilt analysis matches committed analysis-result.json");
  check(checks, "snapshot_verified", committed.snapshot_verification?.result === "pass", committed.snapshot_verification?.result);
  check(checks, "snapshot_hash_preserved", committed.snapshot_sha256 === "dc825f9d70b2236851f34bf41f09869ad51acf78dd1ac48f3bed4c89c001f493",
  committed.snapshot_sha256);

  const results = committed.coverage_analysis?.results ?? [];
  check(checks, "all_product_scenarios", results.length === 15, `${results.length}/15`);
  check(checks, "three_coverages_separate", results.filter((item) => item.scenario_eligibility === "eligible").every((item) =>
    item.criterion_coverage !== null && item.parent_axis_coverage !== null && item.weighted_coverage !== null),
  "eligible rows carry criterion, parent-axis, and weighted coverage");
  check(checks, "public_total_not_generated", results.every((item) => item.total_quality_score === null
    && item.total_quality_score_displayed === false), "all total_quality_score values remain null");
  check(checks, "partial_score_named", committed.pattern_results.every((pattern) => pattern.entries.every((entry) =>
    Object.hasOwn(entry, "partial_observed_score") && !Object.hasOwn(entry, "total_score"))),
  "legacy sensitivity entries use partial_observed_score only");
  check(checks, "ranking_not_generated", committed.coverage_analysis?.ranking_generated === false
    && committed.coverage_analysis?.scenario_profile_summary.every((item) => item.ranking_generated === false),
  "coverage profiles gate eligibility without emitting ranks");
  check(checks, "one_criterion_guard", results.filter((item) => item.criterion_coverage?.scoreable_criterion_count === 1).every((item) =>
    item.profile_assessments.every((assessment) => assessment.score_display_eligibility === false)),
  "one-criterion rows fail all score-display profiles");
  check(checks, "unknown_not_zero", results.filter((item) => item.scenario_eligibility === "unknown").every((item) =>
    item.criterion_coverage === null && item.partial_observed_score === null),
  "unknown eligibility stays null");
  check(checks, "ineligible_not_zero", results.filter((item) => item.score_state === "ineligible_for_scenario").every((item) =>
    item.partial_observed_score === null && item.total_quality_score === null),
  "ineligible rows stay null");
  check(checks, "conflict_preserved", results.some((item) => item.score_state === "eligible_with_unresolved_conflict"
    && item.unresolved_conflict_count > 0), "unresolved conflict count retained");
  check(checks, "measurement_scope_blocker", results.some((item) => item.criterion_observations.some((criterion) =>
    criterion.evidence_state === "not_comparable"
      && criterion.reason_codes.includes("measurement_scope_not_comparable_in_scenario"))),
  "mixed measurement scope is not scoreable");

  const prohibited = new Set(contract.prohibited_quality_inputs);
  check(checks, "prohibited_coverage_inputs", analysisConfig.criteria.every((criterion) => !prohibited.has(criterion.raw_fact_id)),
  "popularity, commerce, basket, and maneuverability remain disconnected");
  const scenarioSegments = analysisConfig.analysis_scenarios.map((scenario) => {
    const segments = new Set(results
      .filter((item) => item.scenario_id === scenario.scenario_id && item.scenario_eligibility === "eligible")
      .map((item) => item.benchmark_segment));
    return { scenario_id: scenario.scenario_id, segments: [...segments] };
  });
  check(checks, "scenario_segments_isolated", scenarioSegments.every((item) => item.segments.length <= 1), scenarioSegments);
  check(checks, "analysis_refs_exist", [
    analysisConfig.coverage_contract_ref,
    analysisConfig.coverage_profiles_ref,
    analysisConfig.coverage_schema_ref,
  ].every((path) => {
    try {
      readFileSync(resolve(repoRoot, path));
      return true;
    } catch {
      return false;
    }
  }), "coverage contract/profile/schema refs resolve from repository root");

  return {
    validator: "irodori-ranking-coverage-validator-0.1.0",
    result: checks.every((item) => item.result === "pass") ? "pass" : "fail",
    checks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = validateCoverageArtifacts();
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== "pass") process.exitCode = 1;
}
