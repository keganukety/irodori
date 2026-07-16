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
const UNKNOWN_SCOPES = new Set(["manufacturer_stated_unspecified", "unknown"]);
const OPTIONAL_FACTS = [
  "carry_handle",
  "carry_strap",
  "self_standing_explicit",
  "requires_bending",
  "requires_seat_removal",
  "folded_lock",
  "fold_with_seat_attached",
];

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
  if (!fixtureCase) throw new Error("unknown fictional fixture case: " + caseId);
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

function result(status, reasons, missingRequired = []) {
  const disposition = status === "eligible"
    ? "candidate_without_rank"
    : status === "unknown"
      ? "on_hold"
      : status === "ineligible"
        ? "exclude_without_zero_or_last_place"
        : "exclude_without_evaluation";
  return { status, disposition, reasons, missing_required_axes: missingRequired };
}

export function evaluateScenarioEligibility(candidate, scenarioOrId) {
  const scenario = scenarioById(scenarioOrId);
  if (!scenario) return result("not_applicable", ["unknown_scenario"]);
  if (candidate?.category !== "stroller") return result("not_applicable", ["category_not_stroller"]);

  const minAge = usableValue(candidate, "target_age_min_months");
  const maxAge = usableValue(candidate, "target_age_max_months");
  if (minAge === null || maxAge === null) {
    return result("unknown", ["target_age_unknown"], [
      ...(minAge === null ? ["target_age_min_months"] : []),
      ...(maxAge === null ? ["target_age_max_months"] : []),
    ]);
  }
  const failures = [];
  if (minAge > scenario.minimum_child_age_months) failures.push("target_age_minimum_not_covered");
  if (maxAge < scenario.maximum_child_age_months) failures.push("target_age_maximum_not_covered");
  if (scenario.newborn_use_required) {
    const newborn = usableValue(candidate, "newborn_use_explicit");
    if (newborn === null) return result("unknown", ["newborn_use_unknown"], ["newborn_use_explicit"]);
    if (newborn !== true) failures.push("newborn_use_requirement_not_met");
  }
  if (scenario.seat_direction_requirement !== "any") {
    const direction = usableValue(candidate, "seat_direction");
    if (direction === null) return result("unknown", ["seat_direction_unknown"], ["seat_direction"]);
    const accepted = scenario.seat_direction_requirement === "parent_facing_or_reversible"
      ? ["parent_facing", "reversible"]
      : ["world_facing", "reversible"];
    if (!accepted.includes(direction)) failures.push("seat_direction_requirement_not_met");
  }
  if (failures.length > 0) return result("ineligible", failures);

  const missing = scenario.required_axes.filter((axisId) => !factIsUsable(candidate, axisId));
  if (missing.length > 0) return result("unknown", ["required_axis_missing_or_conflicting"], missing);
  return result("eligible", []);
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
  const allFoldedDimensions = [width, depth, height].every((value) => typeof value === "number");
  const fold = triStateBoolean(candidate, "one_hand_fold_explicit");
  const unfold = triStateBoolean(candidate, "one_hand_unfold_explicit");
  const twoHands = triStateBoolean(candidate, "requires_two_hands");
  const verifiedOneHand = fold === "unknown" || unfold === "unknown"
    ? "unknown"
    : fold === true && unfold === true && twoHands !== true;
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
  const requiredCount = scenarioEligibility.scenarios[0].required_axes.length;
  const confirmedCount = scenarioEligibility.scenarios[0].required_axes
    .filter((axisId) => factIsUsable(candidate, axisId)).length;

  return {
    folded_bounding_box_volume_l: {
      value: allFoldedDimensions ? (width * depth * height) / 1_000_000 : null,
      unit: "L",
      label: "axis-aligned folded bounding-box volume proxy",
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
    required_fold_actions: typeof stepCount === "number"
      ? {
          manufacturer_stated_step_count: stepCount,
          requires_two_hands: twoHands,
          requires_bending: triStateBoolean(candidate, "requires_bending"),
          requires_seat_removal: triStateBoolean(candidate, "requires_seat_removal"),
          summed_action_count: null,
        }
      : null,
    specification_completeness: requiredCount === 0 ? null : confirmedCount / requiredCount,
    basket_facts: {
      basket_max_load_kg: usableValue(candidate, "basket_max_load_kg"),
      basket_volume_l: usableValue(candidate, "basket_volume_l"),
      converted_between_mass_and_volume: false,
    },
    maneuverability_evidence: {
      status: "unscorable_with_current_evidence",
      manufacturer_claim_excluded: fact(candidate, "manufacturer_maneuverability_claim")?.claim_class === "manufacturer_claim",
      third_party_measurement_required: true,
    },
  };
}

export function compareMeasurementScope(candidateA, candidateB) {
  if (candidateA?.category !== "stroller" || candidateB?.category !== "stroller") return "not_applicable";
  const scopeA = usableValue(candidateA, "weight_measurement_scope");
  const scopeB = usableValue(candidateB, "weight_measurement_scope");
  if (scopeA === null || scopeB === null || UNKNOWN_SCOPES.has(scopeA) || UNKNOWN_SCOPES.has(scopeB)) return "unknown";
  return scopeA === scopeB ? "full" : "partial";
}

const UNIT_FACTORS = new Map([
  ["g:kg", 0.001], ["kg:g", 1000], ["cm:mm", 10], ["mm:cm", 0.1], ["mL:L", 0.001], ["L:mL", 1000],
]);

export function convertUnit(value, fromUnit, toUnit) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (fromUnit === toUnit) return value;
  const factor = UNIT_FACTORS.get(fromUnit + ":" + toUnit);
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

export function detectDoubleCounting(rubric = trainCommuteRubric) {
  const allocations = rubric?.scoring_rules?.raw_fact_allocations ?? [];
  const byFact = new Map();
  for (const allocation of allocations) {
    const current = byFact.get(allocation.raw_fact_id) ?? [];
    current.push(allocation);
    byFact.set(allocation.raw_fact_id, current);
  }
  const violations = [];
  for (const [rawFactId, entries] of byFact) {
    const effective = entries.filter((entry) => entry.maximum_points > 0);
    const maximumAllowed = Math.min(...entries.map((entry) => entry.max_contribution_count ?? 1));
    const sceneAxes = new Set(effective.map((entry) => entry.scene_axis_id));
    if (effective.length > maximumAllowed || sceneAxes.size > 1) {
      violations.push({ raw_fact_id: rawFactId, effective_contribution_count: effective.length, scene_axes: [...sceneAxes].sort() });
    }
  }
  return { result: violations.length === 0 ? "pass" : "fail", violations };
}

function bandPoints(value, firstBoundary, secondBoundary, points) {
  if (value <= firstBoundary) return points[0];
  if (value <= secondBoundary) return points[1];
  return points[2];
}

function booleanSupportPoints(state, maximum, preferred) {
  if (state === "unknown") return null;
  return state === preferred ? maximum : 0;
}

export function calculateFictionalPoints(candidate) {
  const derived = deriveIndicators(candidate);
  const weight = usableValue(candidate, "body_weight_kg");
  const openWidth = usableValue(candidate, "unfolded_width_mm");
  const stepCount = usableValue(candidate, "fold_step_count");
  const carryPoints = derived.carry_assistance_level === "unknown"
    ? null
    : derived.carry_assistance_level === "both"
      ? 10
      : derived.carry_assistance_level === "handle_only" || derived.carry_assistance_level === "strap_only"
        ? 7
        : 0;
  const groups = {
    carry_weight: typeof weight === "number" ? bandPoints(weight, 5.5, 7.5, [20, 12, 4]) : null,
    carry_assistance: carryPoints,
    open_width: typeof openWidth === "number" ? bandPoints(openWidth, 480, 520, [10, 6, 2]) : null,
    folded_footprint: typeof derived.folded_floor_footprint_cm2.value === "number"
      ? bandPoints(derived.folded_floor_footprint_cm2.value, 1600, 2400, [15, 9, 3])
      : null,
    one_hand_operation: derived.verified_one_hand_operation === "unknown"
      ? null
      : derived.verified_one_hand_operation ? 14 : 0,
    fold_actions: typeof stepCount === "number" ? bandPoints(stepCount, 1, 2, [10, 6, 2]) : null,
    self_standing: booleanSupportPoints(derived.verified_self_standing, 6, true),
    bending: booleanSupportPoints(triStateBoolean(candidate, "requires_bending"), 4, false),
    seat_removal: booleanSupportPoints(triStateBoolean(candidate, "requires_seat_removal"), 4, false),
    folded_lock: booleanSupportPoints(triStateBoolean(candidate, "folded_lock"), 4, true),
    seat_attached: booleanSupportPoints(triStateBoolean(candidate, "fold_with_seat_attached"), 3, true),
  };
  const maximumByGroup = {carry_weight:20,carry_assistance:10,open_width:10,folded_footprint:15,one_hand_operation:14,fold_actions:10,self_standing:6,bending:4,seat_removal:4,folded_lock:4,seat_attached:3};
  const knownGroups = Object.entries(groups).filter(([, value]) => typeof value === "number");
  return {
    total_points: knownGroups.reduce((sum, [, value]) => sum + value, 0),
    maximum_observed_points: knownGroups.reduce((sum, [key]) => sum + maximumByGroup[key], 0),
    component_points: groups,
    output_kind: "fictional_fixture_points_only",
  };
}

export function evaluateFictionalCandidate(candidate, scenarioOrId, rubric = trainCommuteRubric) {
  if (candidate?.fixture_only !== true || new URL(candidate.official_url).hostname !== "example.invalid") {
    throw new Error("real product evaluation is prohibited");
  }
  const eligibility = evaluateScenarioEligibility(candidate, scenarioOrId);
  const base = {
    fixture_id: candidate.fixture_id,
    product_name: candidate.product_name,
    fixture_only: true,
    eligibility,
    rank_generated: false,
    ordinal_output_generated: false,
    human_approval_required: rubric.human_approval_required,
  };
  if (eligibility.status === "ineligible" || eligibility.status === "not_applicable") {
    return {...base, calculation_status:"not_calculated", total_points:null, component_points:{}, excluded_without_zero:true};
  }
  if (eligibility.status === "unknown") {
    return {...base, calculation_status:"on_hold", total_points:null, component_points:{}, excluded_without_zero:true};
  }
  const doubleCounting = detectDoubleCounting(rubric);
  if (doubleCounting.result === "fail") {
    return {...base, calculation_status:"on_hold", total_points:null, component_points:{}, double_counting_violations:doubleCounting.violations};
  }
  const points = calculateFictionalPoints(candidate);
  const missingOptional = OPTIONAL_FACTS.filter((factId) => !factIsUsable(candidate, factId));
  return {
    ...base,
    calculation_status: missingOptional.length > 0 ? "calculated_partial" : "calculated",
    ...points,
    missing_optional_axes: missingOptional,
    basket: validateBasketSeparation(candidate),
    excluded_inputs: ["manufacturer_maneuverability_claim", "basket_capacity_single_score"],
    double_counting_violations: [],
  };
}

export function validateFixtureIsolation() {
  const issues = [];
  for (const fixtureCase of fictionalFixtureSet.cases) {
    const { candidate } = materializeFixtureCase(fixtureCase.case_id);
    if (!candidate.product_name.startsWith("架空")) issues.push(fixtureCase.case_id + ":name");
    if (new URL(candidate.official_url).hostname !== "example.invalid") issues.push(fixtureCase.case_id + ":domain");
    if (candidate.fixture_only !== true) issues.push(fixtureCase.case_id + ":fixture_only");
  }
  const serialized = JSON.stringify(fictionalFixtureSet).toLowerCase();
  for (const token of ["cybex", "aprica", "combi", "pigeon", "libelle", "melio", "runfee", "sugocal"]) {
    if (serialized.includes(token)) issues.push("real_product_token:" + token);
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
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, path + "[" + index + "]", output));
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["ranking_input_id", "ranking_result_id", "observed_score", "score", "rank", "ordinal_score", "rank_no"].includes(key)) {
        output.push(path + "." + key);
      }
      collectForbiddenKeys(item, path + "." + key, output);
    }
  }
  return output;
}

export function validateNoRealScoringArtifacts() {
  const irodoriRoot = resolve(here, "../../..");
  const repoRoot = resolve(irodoriRoot, "../..");
  const manifest = JSON.parse(readFileSync(join(here, "..", "benchmark-manifest.json"), "utf8"));
  const files = manifest.products.flatMap((product) => walkFiles(resolve(repoRoot, product.run_dir)));
  files.push(join(here, "..", "official-feature-matrix.json"));
  const issues = [];
  for (const file of files) {
    const basename = file.split(/[\\/]/).at(-1).toLowerCase();
    if (/^ranking[-_](input|result)\./.test(basename)) issues.push("forbidden_file:" + file);
    if (!file.endsWith(".json")) continue;
    const value = JSON.parse(readFileSync(file, "utf8"));
    for (const keyPath of collectForbiddenKeys(value)) issues.push(file + ":" + keyPath);
  }
  return { result: issues.length === 0 ? "pass" : "fail", issues, inspected_file_count: files.length };
}

export function validateNoHighConfidenceSecrets() {
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /sk-[A-Za-z0-9_-]{30,}/,
  ];
  const issues = [];
  for (const file of walkFiles(here)) {
    if (!/\.(?:json|md|mjs)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(text))) issues.push(file);
  }
  return { result: issues.length === 0 ? "pass" : "fail", issues };
}

export function validateProposalBundle() {
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, result: ok ? "pass" : "fail", detail });
  add("rubric_status_proposed", trainCommuteRubric.status === "proposed");
  add("real_product_application_disabled", trainCommuteRubric.applies_to_real_products === false);
  add("human_approval_required", trainCommuteRubric.human_approval_required === true);
  add("four_scenarios", scenarioEligibility.scenarios.length === 4 && scenarioEligibility.scenarios.every((item) => item.status === "proposed"));
  add("four_eligibility_states", ["eligible","ineligible","unknown","not_applicable"].every((state) => scenarioEligibility.eligibility_states.includes(state)));
  add("basket_mass_volume_separate", normalizationRules.basket_rules.single_capacity_score_allowed === false && normalizationRules.basket_rules.cross_unit_ranking_allowed === false);
  add("kg_l_conversion_forbidden", convertUnit(1, "kg", "L") === null && convertUnit(1, "L", "kg") === null);
  add("folding_ease_deprecated", axisClassification.legacy_axis_classification.some((axis) => axis.axis_id === "folding_ease" && axis.classification === "deprecate"));
  add("maneuverability_requires_third_party", axisClassification.legacy_axis_classification.some((axis) => axis.axis_id === "maneuverability" && axis.classification === "requires_third_party_measurement"));
  add("bounding_box_not_actual_volume", trainCommuteRubric.derived_indicators.some((item) => item.indicator_id === "folded_bounding_box_volume_l" && item.semantic_limit.includes("never actual occupied volume")));
  const requiredBoundaryFields = ["proposed_boundary","rationale","supporting_dataset","sensitivity_concern","human_approval_status","affected_scenarios"];
  add("boundary_metadata_complete", trainCommuteRubric.scoring_rules.boundaries.every((boundary) => requiredBoundaryFields.every((field) => Object.hasOwn(boundary, field)) && boundary.human_approval_status === "pending"));
  add("boundaries_not_from_five_product_distribution", trainCommuteRubric.scoring_rules.boundaries.every((boundary) => /fictional|scenario_design/.test(boundary.supporting_dataset)));
  add("double_counting", detectDoubleCounting().result === "pass");
  add("fixture_isolation", validateFixtureIsolation().result === "pass");
  add("no_real_scoring_artifacts", validateNoRealScoringArtifacts().result === "pass");
  add("no_high_confidence_secrets", validateNoHighConfidenceSecrets().result === "pass");
  return { result: checks.every((check) => check.result === "pass") ? "pass" : "fail", checks };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const report = validateProposalBundle();
  for (const check of report.checks) console.log(`${check.result === "pass" ? "PASS" : "FAIL"}  ${check.name}${check.detail ? " — " + check.detail : ""}`);
  console.log(report.result === "pass" ? "\nALL RUBRIC PROPOSAL CHECKS PASSED" : "\nRUBRIC PROPOSAL CHECKS FAILED");
  process.exit(report.result === "pass" ? 0 : 1);
}
