import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, name), "utf8"));

export const axisClassification = load("axis-classification.json");
export const scenarioEligibility = load("scenario-eligibility.json");
export const normalizationRules = load("normalization-rules.json");
export const trainCommuteRubric = load("train-commute-rubric-proposal.json");
export const fictionalFixtureSet = load(join("fixtures", "fictional-strollers.json"));

const OBJECTIVE_CLAIM_CLASSES = new Set(["official_spec", "manual_safety", "third_party_measured"]);
const UNKNOWN_SCOPES = new Set(["unknown"]);

function deepMerge(base, override) {
  if (Array.isArray(override)) return structuredClone(override);
  if (override === null || typeof override !== "object") return override;
  const output = base !== null && typeof base === "object" && !Array.isArray(base)
    ? structuredClone(base)
    : {};
  for (const [key, value] of Object.entries(override)) {
    output[key] = value !== null && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(output[key], value)
      : structuredClone(value);
  }
  return output;
}

export function materializeFixtureCase(caseId) {
  const fixtureCase = fictionalFixtureSet.cases.find((entry) => entry.case_id === caseId);
  if (!fixtureCase) throw new Error(`unknown fictional fixture case: ${caseId}`);
  const candidate = deepMerge(fictionalFixtureSet.base_candidate, fixtureCase.overrides ?? {});
  candidate.fixture_id = fixtureCase.case_id;
  candidate.product_name = fixtureCase.product_name;
  candidate.official_url = fixtureCase.official_url;
  return { candidate, fixture_case: structuredClone(fixtureCase) };
}

function fact(candidate, factId) {
  return candidate?.raw_facts?.[factId] ?? null;
}

function factIsUsable(candidate, factId) {
  const item = fact(candidate, factId);
  return item !== null
    && item.value !== null
    && item.value !== undefined
    && item.evidence_status === "confirmed"
    && item.conflict !== true
    && OBJECTIVE_CLAIM_CLASSES.has(item.claim_class);
}

function usableValue(candidate, factId) {
  return factIsUsable(candidate, factId) ? fact(candidate, factId).value : null;
}

function scenarioById(scenarioOrId) {
  if (typeof scenarioOrId === "object" && scenarioOrId !== null) return scenarioOrId;
  return scenarioEligibility.scenarios.find((entry) => entry.scenario_id === scenarioOrId) ?? null;
}

function eligibilityResult(status, reasons, missingRequired = []) {
  const disposition = status === "eligible"
    ? "candidate_without_rank"
    : status === "unknown"
      ? "on_hold"
      : status === "ineligible"
        ? "exclude_without_zero_or_last_place"
        : "exclude_without_evaluation";
  const participationStatus = status === "eligible"
    ? "candidate"
    : status === "unknown"
      ? "on_hold"
      : status === "ineligible"
        ? "excluded"
        : "not_applicable";
  return { status, disposition, participation_status: participationStatus, reasons, missing_required_inputs: missingRequired };
}

export function evaluateScenarioEligibility(candidate, scenarioOrId) {
  const scenario = scenarioById(scenarioOrId);
  if (!scenario || candidate?.category !== "stroller") return eligibilityResult("not_applicable", ["scenario_or_category_not_applicable"]);

  const minAge = usableValue(candidate, "target_age_min_months");
  if (minAge === null) return eligibilityResult("unknown", ["target_age_minimum_unknown"], ["target_age_min_months"]);
  if (minAge > scenario.maximum_start_age_months) return eligibilityResult("ineligible", ["target_age_minimum_not_covered"]);

  const maxAge = usableValue(candidate, "target_age_max_months");
  const maxWeight = usableValue(candidate, "max_child_weight_kg");
  const ageCovers = typeof maxAge === "number" && maxAge >= scenario.minimum_end_age_months;
  const weightCovers = typeof maxWeight === "number" && maxWeight >= scenario.alternative_minimum_child_weight_kg;
  if (!ageCovers && !weightCovers) {
    if (maxAge === null || maxWeight === null) {
      return eligibilityResult("unknown", ["upper_coverage_unknown"], ["target_age_max_months_or_max_child_weight_kg"]);
    }
    return eligibilityResult("ineligible", ["upper_coverage_not_met"]);
  }

  const directRequired = scenario.participation_required_inputs.filter((input) => input !== "target_age_max_months_or_max_child_weight_kg");
  const missing = directRequired.filter((input) => !factIsUsable(candidate, input));
  if (missing.length > 0) return eligibilityResult("unknown", ["required_input_missing_or_conflicting"], missing);
  return eligibilityResult("eligible", []);
}

function triStateBoolean(candidate, factId) {
  const value = usableValue(candidate, factId);
  return typeof value === "boolean" ? value : "unknown";
}

export function deriveIndicators(candidate) {
  const width = usableValue(candidate, "folded_width_mm");
  const depth = usableValue(candidate, "folded_depth_mm");
  const height = usableValue(candidate, "folded_height_mm");
  const orientation = usableValue(candidate, "folded_dimension_orientation");
  const allDimensions = [width, depth, height].every((value) => typeof value === "number");
  const fold = triStateBoolean(candidate, "one_hand_fold_explicit");
  const unfold = triStateBoolean(candidate, "one_hand_unfold_explicit");
  const twoHands = triStateBoolean(candidate, "requires_two_hands");
  const verifiedOneHand = fold === "unknown" || unfold === "unknown" || twoHands === "unknown"
    ? "unknown"
    : fold === true && unfold === true && twoHands === false;
  const handle = triStateBoolean(candidate, "carry_handle");
  const strap = triStateBoolean(candidate, "carry_strap");
  const carryAssistance = handle === "unknown" || strap === "unknown"
    ? "unknown"
    : handle && strap
      ? "both"
      : handle
        ? "handle_only"
        : strap
          ? "strap_only"
          : "none_explicit";
  const stepCount = usableValue(candidate, "fold_step_count");

  return {
    folded_bounding_box_volume_l: {
      value: allDimensions ? (width * depth * height) / 1_000_000 : null,
      unit: "L",
      label: "axis-aligned folded bounding-box volume reference",
      is_actual_occupied_volume: false,
    },
    folded_floor_footprint_cm2: {
      value: orientation === "standing_width_depth_base" && typeof width === "number" && typeof depth === "number"
        ? (width * depth) / 100
        : null,
      unit: "cm2",
      orientation_required: true,
    },
    verified_one_hand_operation: verifiedOneHand,
    verified_self_standing: triStateBoolean(candidate, "self_standing_explicit"),
    carry_assistance_level: carryAssistance,
    required_fold_actions: Number.isInteger(stepCount) && stepCount >= 1
      ? {
          fold_step_count: stepCount,
          fold_step_band: stepCount >= 4 ? "4_or_more" : String(stepCount),
          summed_with_other_flags: false,
        }
      : null,
    maneuverability_evidence: {
      status: "unscored",
      manufacturer_claim_excluded: fact(candidate, "manufacturer_maneuverability_claim")?.claim_class === "manufacturer_claim",
      third_party_measurement_required: true,
    },
  };
}

function measurementScope(candidate) {
  return usableValue(candidate, "measurement_scope") ?? usableValue(candidate, "weight_measurement_scope");
}

function approximationStatus(candidate) {
  return usableValue(candidate, "approximation_status")
    ?? fact(candidate, "body_weight_kg")?.approximation_status
    ?? "unknown";
}

function measurementCondition(candidate) {
  return usableValue(candidate, "measurement_condition")
    ?? fact(candidate, "body_weight_kg")?.measurement_condition
    ?? "unknown";
}

export function compareMeasurementScope(candidateA, candidateB) {
  if (candidateA?.category !== "stroller" || candidateB?.category !== "stroller") return "not_applicable";
  const scopeA = measurementScope(candidateA);
  const scopeB = measurementScope(candidateB);
  if (scopeA === null || scopeB === null || UNKNOWN_SCOPES.has(scopeA) || UNKNOWN_SCOPES.has(scopeB)) return "unknown";
  if (scopeA === "manufacturer_stated_unspecified" && scopeB === "manufacturer_stated_unspecified") return "partial";
  if (scopeA === "manufacturer_stated_unspecified" || scopeB === "manufacturer_stated_unspecified") return "unknown";

  const incompatibleScopes = new Set([scopeA, scopeB]);
  if (incompatibleScopes.has("including_standard_accessories") && incompatibleScopes.has("excluding_accessories")) {
    return "not_comparable";
  }
  const configA = usableValue(candidateA, "weight_configuration");
  const configB = usableValue(candidateB, "weight_configuration");
  if (new Set([configA, configB]).has("lightest") && new Set([configA, configB]).has("standard")) return "not_comparable";

  const approximate = [approximationStatus(candidateA), approximationStatus(candidateB)].some((value) => value === "approximate");
  const sameCondition = measurementCondition(candidateA) !== "unknown"
    && measurementCondition(candidateA) === measurementCondition(candidateB);
  if (scopeA === scopeB || sameCondition) return approximate ? "partial" : "full";
  return "partial";
}

const UNIT_FACTORS = new Map([
  ["g:kg", 0.001], ["kg:g", 1000], ["cm:mm", 10], ["mm:cm", 0.1], ["mm2:cm2", 0.01],
]);

export function convertUnit(value, fromUnit, toUnit) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (fromUnit === toUnit) return value;
  const factor = UNIT_FACTORS.get(`${fromUnit}:${toUnit}`);
  return factor === undefined ? null : value * factor;
}

export function validateBasketSeparation(candidate) {
  const mass = fact(candidate, "basket_max_load_kg");
  const volume = fact(candidate, "basket_volume_l");
  const issues = [];
  if (mass?.value !== null && mass?.value !== undefined && mass.unit !== "kg") issues.push("basket_mass_unit_must_be_kg");
  if (volume?.value !== null && volume?.value !== undefined && volume.unit !== "L") issues.push("basket_volume_unit_must_be_L");
  if (candidate?.basket_capacity_score !== undefined) issues.push("single_basket_capacity_score_forbidden");
  return {
    result: issues.length === 0 ? "pass" : "fail",
    issues,
    mass_kg: mass?.value ?? null,
    volume_l: volume?.value ?? null,
    cross_unit_conversion: null,
    single_score_allowed: false,
  };
}

export function evaluateApproximateBoundary(value, candidateValues, status = "exact") {
  if (typeof value !== "number" || !Number.isFinite(value)) return { status: "unknown", candidate_band_indexes: [] };
  const thresholds = candidateValues.filter((item) => typeof item === "number").sort((a, b) => a - b);
  const bandIndex = (number) => thresholds.filter((threshold) => number > threshold).length;
  if (status !== "approximate") {
    return { status: "single_band", candidate_band_indexes: [bandIndex(value)], provisional_interval: null };
  }
  const percent = normalizationRules.approximate_boundary_rule.provisional_hold_percent / 100;
  const interval = [value * (1 - percent), value * (1 + percent)];
  const firstBand = bandIndex(interval[0]);
  const lastBand = bandIndex(interval[1]);
  const bands = Array.from({ length: lastBand - firstBand + 1 }, (_, index) => firstBand + index);
  return {
    status: bands.length > 1 ? "boundary_hold_adjacent_bands" : "single_band",
    candidate_band_indexes: bands,
    provisional_interval: interval,
    interval_is_measurement_error_or_tolerance: false,
    permanent_rule: false,
    human_approval_required: true,
  };
}

export function validateFoldStepObservation(candidate) {
  const item = fact(candidate, "fold_step_count");
  if (!item || item.value === null) {
    return {
      result: item?.evidence_status === "unconfirmed" ? "pass" : "fail",
      availability: "unconfirmed",
      fold_step_count: null,
    };
  }
  const valid = item.evidence_status === "confirmed" && Number.isInteger(item.value) && item.value >= 1;
  return {
    result: valid ? "pass" : "fail",
    availability: valid ? "confirmed" : "invalid",
    fold_step_count: valid ? item.value : null,
    fold_step_band: valid ? (item.value >= 4 ? "4_or_more" : String(item.value)) : null,
  };
}

export function detectDoubleCounting(rubric = trainCommuteRubric) {
  const contract = rubric?.raw_fact_contribution_contract ?? [];
  const byFact = new Map();
  for (const item of contract) {
    const current = byFact.get(item.raw_fact_id) ?? [];
    current.push(item);
    byFact.set(item.raw_fact_id, current);
  }
  const violations = [];
  for (const [rawFactId, entries] of byFact) {
    const positiveAxes = new Set(entries.map((entry) => entry.positive_contribution_axis).filter(Boolean));
    const maximum = Math.min(...entries.map((entry) => entry.maximum_positive_contribution_axes ?? 1));
    if (positiveAxes.size > maximum) violations.push({ raw_fact_id: rawFactId, positive_axes: [...positiveAxes].sort() });
  }
  const byId = new Map(contract.map((item) => [item.raw_fact_id, item]));
  for (const item of contract.filter((entry) => entry.semantic_alias_of)) {
    const target = byId.get(item.semantic_alias_of);
    if (!target
      || item.contribution_group !== target.contribution_group
      || item.positive_contribution_axis !== target.positive_contribution_axis) {
      violations.push({ raw_fact_id: item.raw_fact_id, semantic_alias_mismatch: item.semantic_alias_of });
    }
  }
  if (byId.get("body_weight_kg")?.positive_contribution_axis !== "transport_burden") {
    violations.push({ raw_fact_id: "body_weight_kg", reason: "body_weight_must_only_contribute_to_transport_burden" });
  }
  if (rubric.editorial_composite_outputs.some((item) => item.independent_positive_contribution !== false)) {
    violations.push({ raw_fact_id: "editorial_composite_output", reason: "independent_positive_contribution_forbidden" });
  }
  return { result: violations.length === 0 ? "pass" : "fail", violations };
}

function parentAxisCoverage(candidate) {
  return Object.fromEntries(trainCommuteRubric.comparison_axes.map((axis) => {
    const rawInputs = axis.primary_inputs.filter((input) => !["folded_floor_footprint_cm2", "carry_assistance_level"].includes(input));
    const confirmed = rawInputs.filter((input) => factIsUsable(candidate, input));
    const status = confirmed.length === 0
      ? "unavailable"
      : confirmed.length === rawInputs.length
        ? "available_complete"
        : "available_partial";
    return [axis.axis_id, { status, confirmed_input_count: confirmed.length, input_count: rawInputs.length }];
  }));
}

export function evaluateFictionalCandidate(candidate, scenarioOrId) {
  if (candidate?.fixture_only !== true || new URL(candidate.official_url).hostname !== "example.invalid") {
    throw new Error("real product evaluation is prohibited");
  }
  const eligibility = evaluateScenarioEligibility(candidate, scenarioOrId);
  const base = {
    fixture_id: candidate.fixture_id,
    fixture_only: true,
    eligibility,
    ranking_generated: false,
    ordinal_output_generated: false,
    point_allocation_applied: false,
    boundary_candidates_applied: false,
  };
  if (eligibility.status !== "eligible") {
    return {
      ...base,
      evaluation_status: eligibility.status === "unknown" ? "on_hold" : "not_evaluated",
      excluded_without_zero_or_last_place: true,
    };
  }
  return {
    ...base,
    evaluation_status: "descriptive_axes_only",
    parent_axis_coverage: parentAxisCoverage(candidate),
    derived_indicators: deriveIndicators(candidate),
    basket: validateBasketSeparation(candidate),
    excluded_inputs: trainCommuteRubric.initial_score_exclusions,
    double_counting_violations: detectDoubleCounting().violations,
  };
}

export function validateFixtureIsolation() {
  const issues = [];
  for (const fixtureCase of fictionalFixtureSet.cases) {
    const { candidate } = materializeFixtureCase(fixtureCase.case_id);
    if (!candidate.product_name.startsWith("架空")) issues.push(`${fixtureCase.case_id}:name`);
    if (new URL(candidate.official_url).hostname !== "example.invalid") issues.push(`${fixtureCase.case_id}:domain`);
    if (candidate.fixture_only !== true) issues.push(`${fixtureCase.case_id}:fixture_only`);
  }
  const serialized = JSON.stringify(fictionalFixtureSet).toLowerCase();
  for (const token of ["cybex", "aprica", "combi", "pigeon", "libelle", "melio", "runfee", "sugocal"]) {
    if (serialized.includes(token)) issues.push(`real_product_token:${token}`);
  }
  return { result: issues.length === 0 ? "pass" : "fail", issues };
}

function walkFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(path));
    else output.push(path);
  }
  return output;
}

function collectForbiddenKeys(value, path = "$", output = []) {
  const forbidden = new Set([
    "ranking_input", "ranking_input_id", "ranking_result", "ranking_result_id", "observed_score", "score",
    "rank", "rank_no", "ordinal_score", "stars", "winner", "recommendation_badge", "sensitivity_analysis_result",
  ]);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, `${path}[${index}]`, output));
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (forbidden.has(key)) output.push(`${path}.${key}`);
      collectForbiddenKeys(item, `${path}.${key}`, output);
    }
  }
  return output;
}

export function validateNoRealScoringArtifacts() {
  const irodoriRoot = resolve(here, "../../..");
  const repoRoot = resolve(irodoriRoot, "../..");
  const benchmarkRoot = resolve(here, "..");
  const manifest = JSON.parse(readFileSync(join(benchmarkRoot, "benchmark-manifest.json"), "utf8"));
  const files = manifest.products.flatMap((product) => walkFiles(resolve(repoRoot, product.run_dir)))
    .concat(walkFiles(benchmarkRoot).filter((file) => !file.includes(`${join("rubric-proposal", "fixtures")}`)));
  const issues = [];
  for (const file of files) {
    const basename = file.split(/[\\/]/).at(-1).toLowerCase();
    if (/^ranking[-_](input|result)\./.test(basename)) issues.push(`forbidden_file:${file}`);
    if (!file.endsWith(".json")) continue;
    const value = JSON.parse(readFileSync(file, "utf8"));
    for (const keyPath of collectForbiddenKeys(value)) issues.push(`${file}:${keyPath}`);
  }
  return { result: issues.length === 0 ? "pass" : "fail", issues, inspected_file_count: files.length };
}

export function validateNoHighConfidenceSecrets() {
  const irodoriRoot = resolve(here, "../../..");
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /sk-[A-Za-z0-9_-]{30,}/,
  ];
  const issues = [];
  for (const file of walkFiles(irodoriRoot)) {
    if (!/\.(?:json|md|mjs|ts)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(text))) issues.push(file);
  }
  return { result: issues.length === 0 ? "pass" : "fail", issues };
}

export function validateProposalBundle() {
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, result: ok ? "pass" : "fail", detail });
  add("proposal_status", [axisClassification, scenarioEligibility, normalizationRules, trainCommuteRubric]
    .every((item) => item.status === "proposed" && item.human_approval_status === "provisional_approved"));
  add("real_product_application_disabled", trainCommuteRubric.applies_to_real_products === false);

  const expectedClassifications = new Map([
    ["portability", "split_into_subaxes"],
    ["train_fitness", "editorial_composite_output"],
    ["maneuverability", "requires_third_party_measurement"],
    ["one_operator_fitness", "editorial_composite_output"],
  ]);
  const actualClassifications = new Map(axisClassification.subjective_axis_classification.map((item) => [item.axis_id, item.classification]));
  add("four_subjective_axes_classified", expectedClassifications.size === actualClassifications.size
    && [...expectedClassifications].every(([id, classification]) => actualClassifications.get(id) === classification));
  add("one_operator_no_weight_reuse", axisClassification.subjective_axis_classification
    .find((item) => item.axis_id === "one_operator_fitness")?.body_weight_reuse_allowed === false);

  const expectedScenarios = new Map([
    ["primary_from_1_month", [1, 36]],
    ["primary_from_6_months", [6, 36]],
    ["second_stroller_from_7_months", [7, 36]],
    ["compact_travel_from_7_months", [7, 36]],
  ]);
  add("four_scenarios", scenarioEligibility.scenarios.length === 4
    && scenarioEligibility.scenarios.every((item) => JSON.stringify(item.target_use_window_months) === JSON.stringify(expectedScenarios.get(item.scenario_id))
      && item.newborn_use_required === false
      && item.status === "proposed"
      && item.human_approval_status === "provisional_approved"));
  add("compact_travel_no_airline_inference", scenarioEligibility.scenarios
    .find((item) => item.scenario_id === "compact_travel_from_7_months")?.airline_carry_on_inference_allowed === false);

  const expectedBoundaryGrid = new Map([
    ["body_weight_kg", [4, 5, 6, 7]],
    ["unfolded_width_mm", [460, 480, 500, 530]],
    ["folded_floor_footprint_cm2", [800, 1200, 1600, 2200]],
  ]);
  add("boundary_grid_values", trainCommuteRubric.boundary_grid.length === 4
    && [...expectedBoundaryGrid].every(([id, values]) => JSON.stringify(trainCommuteRubric.boundary_grid.find((item) => item.boundary_id === id)?.candidate_values) === JSON.stringify(values))
    && JSON.stringify(trainCommuteRubric.boundary_grid.find((item) => item.boundary_id === "fold_step_count")?.candidate_values) === JSON.stringify([1,2,3,{minimum:4,label:"4_or_more"}]));
  add("boundary_metadata", trainCommuteRubric.boundary_grid.every((item) => item.status === "proposed"
    && item.permanent_threshold === false
    && item.sensitivity_test_required === true
    && item.human_approval_status === "provisional_approved"
    && item.supporting_dataset === "five_product_official_benchmark"
    && item.limitation === "5商品だけでは恒久境界を決定できない"));

  const approximateRule = normalizationRules.approximate_boundary_rule;
  add("approximate_plus_minus_five_percent", approximateRule.status === "proposed"
    && approximateRule.human_approval_status === "provisional_approved"
    && approximateRule.provisional_hold_percent === 5
    && approximateRule.permanent_rule === false
    && approximateRule.source_value_rewrite_allowed === false);
  const foldDefinition = normalizationRules.fold_step_definition;
  add("fold_step_proposed_definition", foldDefinition.status === "proposed_definition"
    && foldDefinition.human_approval_status === "provisional_approved"
    && foldDefinition.excluded_actions.length === 5
    && foldDefinition.unclear_rule.fold_step_count === null
    && foldDefinition.unclear_rule.evidence_status === "unconfirmed");
  add("weight_scope_rules", normalizationRules.weight_rules.pairwise_rules.some((item) => item.result === "not_comparable")
    && normalizationRules.weight_rules.automatic_partial_to_full_promotion === false);
  add("optional_missing_rules", normalizationRules.optional_missing_rules.missing_optional_is_zero === false
    && normalizationRules.optional_missing_rules.missing_optional_is_false === false
    && normalizationRules.optional_missing_rules.all_parent_subaxes_missing === "parent_axis_unavailable");

  const protocol = normalizationRules.claim_rules.future_third_party_protocol_candidates;
  add("maneuverability_future_protocol", protocol.length === 8
    && normalizationRules.claim_rules.maneuverability_status_until_protocol_approved === "unscored");
  add("basket_mass_volume_separate", normalizationRules.basket_rules.single_capacity_score_allowed === false
    && convertUnit(1, "kg", "L") === null
    && convertUnit(1, "L", "kg") === null);
  add("allocation_not_defined", trainCommuteRubric.allocation_status.status === "not_defined"
    && trainCommuteRubric.allocation_status.point_allocation_finalized === false
    && trainCommuteRubric.allocation_status.sensitivity_analysis_completed === false);
  add("double_counting", detectDoubleCounting().result === "pass");

  const irodoriRoot = resolve(here, "../../..");
  const generationCases = [
    ["runs/2026-07-16-aprica-karoon-air-mesh-ac-official/product-identity.json", "AC"],
    ["runs/2026-07-16-combi-sugocal-eggshock-la-official/product-identity.json", "LA"],
    ["runs/2026-07-16-pigeon-runfee-rb5-official/product-identity.json", "RB5"],
  ];
  add("generation_codes_not_promoted", generationCases.every(([path, code]) => {
    const identity = JSON.parse(readFileSync(join(irodoriRoot, path), "utf8"));
    return identity.generation_code === code && identity.model_year === null && identity.model_number === null && identity.official_name.includes(code);
  }));
  add("manual_consent_gate", normalizationRules.manual_consent_gate.ai_terms_acceptance_allowed === false
    && normalizationRules.manual_consent_gate.pull_request_blocking === false
    && normalizationRules.manual_consent_gate.allowed_states.length === 3);
  const independentAudit = readFileSync(join(here, "..", "independent-audit.md"), "utf8");
  add("baseline_and_final_audit_separated", independentAudit.includes("## baseline_audit")
    && independentAudit.includes("## final_audit")
    && independentAudit.includes("PASS 18 / FAIL 2 / UNKNOWN 0")
    && independentAudit.includes("PASS 19 / FAIL 0 / UNKNOWN 1"));
  add("fixture_isolation", validateFixtureIsolation().result === "pass");
  add("no_real_scoring_artifacts", validateNoRealScoringArtifacts().result === "pass");
  add("no_high_confidence_secrets", validateNoHighConfidenceSecrets().result === "pass");
  return { result: checks.every((check) => check.result === "pass") ? "pass" : "fail", checks };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const report = validateProposalBundle();
  for (const check of report.checks) console.log(`${check.result === "pass" ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  console.log(report.result === "pass" ? "\nALL RUBRIC PROPOSAL CHECKS PASSED" : "\nRUBRIC PROPOSAL CHECKS FAILED");
  process.exit(report.result === "pass" ? 0 : 1);
}
