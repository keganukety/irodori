export const CRITERION_EVIDENCE_STATES = [
  "scoreable",
  "unknown",
  "unresolved_conflict",
  "not_comparable",
  "analysis_error",
] as const;

export type CriterionEvidenceState = (typeof CRITERION_EVIDENCE_STATES)[number];

export const COVERAGE_SCORE_STATES = [
  "scoreable",
  "eligible_but_insufficient_evidence",
  "eligible_with_unresolved_conflict",
  "ineligible_for_scenario",
  "not_comparable",
  "analysis_error",
] as const;

export type CoverageScoreState = (typeof COVERAGE_SCORE_STATES)[number];

export const PARENT_AXIS_COVERAGE_STATES = [
  "scoreable",
  "partially_scoreable",
  "unassessed",
  "not_applicable",
] as const;

export type ParentAxisCoverageState = (typeof PARENT_AXIS_COVERAGE_STATES)[number];
export type CriterionApplicability = "applicable" | "not_applicable";
export type ScenarioEligibility = "eligible" | "unknown" | "ineligible" | "not_applicable" | "analysis_error";

export interface CriterionCoverageObservation {
  criterion_id: string;
  parent_axis_id: string;
  weight: number;
  applicability: CriterionApplicability;
  evidence_state: CriterionEvidenceState;
  reason_codes: string[];
}

export interface ParentAxisRequirement {
  parent_axis_id: string;
  minimum_scoreable_criterion_count: number;
  value_status: "proposed";
}

export interface CoverageContractConfig {
  schema_version: string;
  contract_id: string;
  status: "proposed";
  publication_status: "draft";
  value_status: "proposed";
  reference_profile_id: string;
  criterion_handling: Record<string, unknown>;
  parent_axes: ParentAxisRequirement[];
  state_precedence: CoverageScoreState[];
  score_contract: {
    internal_partial_field: "partial_observed_score";
    public_total_field: "total_quality_score";
    partial_score_may_be_calculated_below_coverage: boolean;
    public_total_requires_confirmed_profile: boolean;
    profile_changes_score_calculation: boolean;
    profile_changes_display_and_ranking_eligibility_only: boolean;
  };
  scenario_contract: {
    mix_benchmark_segments: boolean;
    ineligible_score: null;
    not_comparable_score: null;
    minimum_candidates_for_ranking: number;
    ranking_generation_in_private_analysis: boolean;
  };
  prohibited_quality_inputs: string[];
}

export interface ScoreDisplayConditions {
  require_scenario_eligible: boolean;
  require_partial_observed_score: boolean;
  require_all_coverage_thresholds: boolean;
  require_all_required_criteria: boolean;
  require_conflict_policy_pass: boolean;
}

export interface RankingConditions {
  require_score_display_eligibility: boolean;
  require_no_comparison_blockers: boolean;
  require_same_scenario_and_segment: boolean;
  minimum_eligible_candidate_count: number;
}

export interface CoverageProfile {
  profile_id: string;
  label: string;
  value_status: "proposed";
  minimum_criterion_coverage: number;
  minimum_parent_axis_coverage: number;
  minimum_represented_parent_count: number;
  minimum_weighted_coverage: number;
  allow_unresolved_conflicts: boolean;
  required_criterion_ids: string[];
  score_display_conditions: ScoreDisplayConditions;
  ranking_conditions: RankingConditions;
}

export interface CoverageProfileSet {
  schema_version: string;
  profile_set_id: string;
  status: "proposed";
  publication_status: "draft";
  notice: string;
  profiles: CoverageProfile[];
}

export interface CoverageCandidateInput {
  candidate_id: string;
  scenario_id: string;
  benchmark_segment: string;
  scenario_eligibility: ScenarioEligibility;
  scenario_reason_codes: string[];
  eligibility_unresolved_conflict_count: number;
  partial_observed_score: number | null;
  criteria: CriterionCoverageObservation[];
}

export interface CriterionCoverageMetric {
  scoreable_criterion_count: number;
  applicable_criterion_count: number;
  value: number;
}

export interface WeightedCoverageMetric {
  scoreable_weight: number;
  applicable_weight: number;
  value: number;
  value_status: "proposed";
}

export interface ParentAxisCoverageMetric {
  parent_axis_id: string;
  state: ParentAxisCoverageState;
  scoreable_criterion_count: number;
  applicable_criterion_count: number;
  minimum_scoreable_criterion_count: number;
  coverage_ratio: number | null;
  reason_codes: string[];
}

export interface CoverageMetrics {
  criterion_coverage: CriterionCoverageMetric;
  parent_axis_coverage: {
    value: number;
    represented_parent_count: number;
    fully_scoreable_parent_count: number;
    applicable_parent_count: number;
    axes: ParentAxisCoverageMetric[];
  };
  weighted_coverage: WeightedCoverageMetric;
  unresolved_conflict_count: number;
  not_comparable_criterion_count: number;
  comparison_blockers: string[];
}

export interface CoverageGateResults {
  scenario_eligible: boolean;
  partial_observed_score_present: boolean;
  criterion_coverage: boolean;
  parent_axis_coverage: boolean;
  represented_parent_count: boolean;
  weighted_coverage: boolean;
  required_criteria: boolean;
  conflict_policy: boolean;
}

export interface CoverageProfileAssessment {
  profile_id: string;
  value_status: "proposed";
  score_state: CoverageScoreState;
  gate_results: CoverageGateResults;
  missing_required_criterion_ids: string[];
  score_display_eligibility: boolean;
  ranking_candidate_eligibility: boolean;
  ranking_eligibility: boolean;
  reason_codes: string[];
}

export interface CandidateCoverageAssessment {
  candidate_id: string;
  scenario_id: string;
  benchmark_segment: string;
  criterion_observations: CriterionCoverageObservation[];
  metrics: CoverageMetrics | null;
  partial_observed_score: number | null;
  total_quality_score: null;
  total_quality_score_displayed: false;
  analysis_errors: string[];
  profile_assessments: CoverageProfileAssessment[];
}

export interface CoverageValidationIssue {
  path: string;
  message: string;
}

export interface CoverageValidationReport {
  result: "pass" | "fail";
  issues: CoverageValidationIssue[];
}

export interface ScenarioRankingCandidate {
  candidate_id: string;
  scenario_id: string;
  benchmark_segment: string;
  profile_assessment: CoverageProfileAssessment;
}

export interface ScenarioRankingEligibilityResult {
  profile_id: string;
  scenario_id: string | null;
  benchmark_segment: string | null;
  eligible_candidate_count: number;
  minimum_eligible_candidate_count: number;
  ranking_generation_eligible: boolean;
  ranking_generated: false;
  reason_codes: string[];
  candidate_results: Array<{
    candidate_id: string;
    ranking_eligibility: boolean;
    reason_codes: string[];
  }>;
}

const ROUND_DIGITS = 6;

function round(value: number, digits = ROUND_DIGITS): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareString);
}

function isFraction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function addIssue(issues: CoverageValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

export function validateCoverageConfiguration(
  contract: CoverageContractConfig,
  profileSet: CoverageProfileSet,
): CoverageValidationReport {
  const issues: CoverageValidationIssue[] = [];
  if (contract.schema_version !== "0.1.0") addIssue(issues, "contract.schema_version", "must be 0.1.0");
  if (contract.status !== "proposed" || contract.value_status !== "proposed") {
    addIssue(issues, "contract.status", "coverage contract must remain proposed");
  }
  if (contract.publication_status !== "draft") addIssue(issues, "contract.publication_status", "must remain draft");
  if (contract.score_contract.internal_partial_field !== "partial_observed_score") {
    addIssue(issues, "contract.score_contract.internal_partial_field", "must not use a public total-score name");
  }
  if (contract.score_contract.public_total_field !== "total_quality_score") {
    addIssue(issues, "contract.score_contract.public_total_field", "unexpected public total field");
  }
  if (contract.score_contract.profile_changes_score_calculation !== false
    || contract.score_contract.profile_changes_display_and_ranking_eligibility_only !== true) {
    addIssue(issues, "contract.score_contract", "profiles may change eligibility only");
  }
  if (contract.scenario_contract.mix_benchmark_segments !== false) {
    addIssue(issues, "contract.scenario_contract.mix_benchmark_segments", "scenario segments must remain isolated");
  }
  if (contract.scenario_contract.ineligible_score !== null || contract.scenario_contract.not_comparable_score !== null) {
    addIssue(issues, "contract.scenario_contract", "ineligible and not-comparable scores must be null");
  }
  const parentIds = contract.parent_axes.map((axis) => axis.parent_axis_id);
  if (new Set(parentIds).size !== parentIds.length) addIssue(issues, "contract.parent_axes", "duplicate parent_axis_id");
  for (const [index, axis] of contract.parent_axes.entries()) {
    if (!axis.parent_axis_id) addIssue(issues, `contract.parent_axes[${index}].parent_axis_id`, "must be non-empty");
    if (!Number.isInteger(axis.minimum_scoreable_criterion_count) || axis.minimum_scoreable_criterion_count < 2) {
      addIssue(issues, `contract.parent_axes[${index}].minimum_scoreable_criterion_count`, "must be an integer >= 2");
    }
    if (axis.value_status !== "proposed") addIssue(issues, `contract.parent_axes[${index}].value_status`, "must remain proposed");
  }
  if (profileSet.schema_version !== "0.1.0") addIssue(issues, "profile_set.schema_version", "must be 0.1.0");
  if (profileSet.status !== "proposed" || profileSet.publication_status !== "draft") {
    addIssue(issues, "profile_set.status", "profile set must remain proposed and draft");
  }
  const profileIds = profileSet.profiles.map((profile) => profile.profile_id);
  if (new Set(profileIds).size !== profileIds.length) addIssue(issues, "profile_set.profiles", "duplicate profile_id");
  for (const requiredId of ["lenient", "balanced", "strict"]) {
    if (!profileIds.includes(requiredId)) addIssue(issues, "profile_set.profiles", `missing ${requiredId} profile`);
  }
  if (!profileIds.includes(contract.reference_profile_id)) {
    addIssue(issues, "contract.reference_profile_id", "must reference an existing profile");
  }
  for (const [index, profile] of profileSet.profiles.entries()) {
    const path = `profile_set.profiles[${index}]`;
    if (profile.value_status !== "proposed") addIssue(issues, `${path}.value_status`, "must remain proposed");
    for (const [name, value] of [
      ["minimum_criterion_coverage", profile.minimum_criterion_coverage],
      ["minimum_parent_axis_coverage", profile.minimum_parent_axis_coverage],
      ["minimum_weighted_coverage", profile.minimum_weighted_coverage],
    ] as const) {
      if (!isFraction(value)) addIssue(issues, `${path}.${name}`, "must be a finite 0..1 fraction");
    }
    if (!Number.isInteger(profile.minimum_represented_parent_count)
      || profile.minimum_represented_parent_count < 1
      || profile.minimum_represented_parent_count > contract.parent_axes.length) {
      addIssue(issues, `${path}.minimum_represented_parent_count`, "must fit configured parent count");
    }
    if (new Set(profile.required_criterion_ids).size !== profile.required_criterion_ids.length) {
      addIssue(issues, `${path}.required_criterion_ids`, "must be unique");
    }
    if (!Number.isInteger(profile.ranking_conditions.minimum_eligible_candidate_count)
      || profile.ranking_conditions.minimum_eligible_candidate_count < contract.scenario_contract.minimum_candidates_for_ranking) {
      addIssue(issues, `${path}.ranking_conditions.minimum_eligible_candidate_count`, "must preserve the contract minimum");
    }
  }
  return { result: issues.length === 0 ? "pass" : "fail", issues };
}

function validateCandidateInput(
  input: CoverageCandidateInput,
  contract: CoverageContractConfig,
): CoverageValidationIssue[] {
  const issues: CoverageValidationIssue[] = [];
  if (!input.candidate_id) addIssue(issues, "candidate_id", "must be non-empty");
  if (!input.scenario_id) addIssue(issues, "scenario_id", "must be non-empty");
  if (!input.benchmark_segment) addIssue(issues, "benchmark_segment", "must be non-empty");
  if (!Number.isInteger(input.eligibility_unresolved_conflict_count)
    || input.eligibility_unresolved_conflict_count < 0) {
    addIssue(issues, "eligibility_unresolved_conflict_count", "must be a non-negative integer");
  }
  if (input.partial_observed_score !== null
    && (!Number.isFinite(input.partial_observed_score)
      || input.partial_observed_score < 0
      || input.partial_observed_score > 100)) {
    addIssue(issues, "partial_observed_score", "must be null or a finite 0..100 score");
  }
  const parentIds = new Set(contract.parent_axes.map((axis) => axis.parent_axis_id));
  const criterionIds = input.criteria.map((criterion) => criterion.criterion_id);
  if (new Set(criterionIds).size !== criterionIds.length) addIssue(issues, "criteria", "duplicate criterion_id");
  for (const [index, criterion] of input.criteria.entries()) {
    const path = `criteria[${index}]`;
    if (!criterion.criterion_id) addIssue(issues, `${path}.criterion_id`, "must be non-empty");
    if (!parentIds.has(criterion.parent_axis_id)) addIssue(issues, `${path}.parent_axis_id`, "unknown parent axis");
    if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) addIssue(issues, `${path}.weight`, "must be finite and > 0");
    if (criterion.applicability === "not_applicable" && criterion.evidence_state === "scoreable") {
      addIssue(issues, `${path}.evidence_state`, "not_applicable criterion cannot be scoreable");
    }
  }
  return issues;
}

export function calculateCoverageMetrics(
  criteria: CriterionCoverageObservation[],
  parentRequirements: ParentAxisRequirement[],
  eligibilityConflictCount = 0,
): CoverageMetrics {
  const applicable = criteria.filter((criterion) => criterion.applicability === "applicable");
  if (applicable.length === 0) throw new Error("no applicable criteria");
  if (applicable.some((criterion) => criterion.evidence_state === "analysis_error")) {
    throw new Error("criterion analysis_error");
  }
  const scoreable = applicable.filter((criterion) => criterion.evidence_state === "scoreable");
  const applicableWeight = applicable.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (!Number.isFinite(applicableWeight) || applicableWeight <= 0) throw new Error("applicable criterion weight must be positive");
  const scoreableWeight = scoreable.reduce((sum, criterion) => sum + criterion.weight, 0);
  const axes = [...parentRequirements]
    .sort((left, right) => compareString(left.parent_axis_id, right.parent_axis_id))
    .map((requirement): ParentAxisCoverageMetric => {
      const parentApplicable = applicable.filter((criterion) => criterion.parent_axis_id === requirement.parent_axis_id);
      const parentScoreable = parentApplicable.filter((criterion) => criterion.evidence_state === "scoreable");
      if (parentApplicable.length === 0) {
        return {
          parent_axis_id: requirement.parent_axis_id,
          state: "not_applicable",
          scoreable_criterion_count: 0,
          applicable_criterion_count: 0,
          minimum_scoreable_criterion_count: requirement.minimum_scoreable_criterion_count,
          coverage_ratio: null,
          reason_codes: ["parent_axis_not_applicable"],
        };
      }
      const denominator = Math.max(parentApplicable.length, requirement.minimum_scoreable_criterion_count);
      const ratio = round(parentScoreable.length / denominator);
      const state: ParentAxisCoverageState = parentScoreable.length === 0
        ? "unassessed"
        : ratio === 1
          ? "scoreable"
          : "partially_scoreable";
      const reasons: string[] = [];
      if (parentApplicable.length < requirement.minimum_scoreable_criterion_count) {
        reasons.push("parent_definition_below_minimum_evidence_breadth");
      }
      if (parentScoreable.length < parentApplicable.length) reasons.push("parent_has_unscoreable_applicable_criteria");
      if (state === "unassessed") reasons.push("parent_has_no_scoreable_criteria");
      return {
        parent_axis_id: requirement.parent_axis_id,
        state,
        scoreable_criterion_count: parentScoreable.length,
        applicable_criterion_count: parentApplicable.length,
        minimum_scoreable_criterion_count: requirement.minimum_scoreable_criterion_count,
        coverage_ratio: ratio,
        reason_codes: uniqueSorted(reasons),
      };
    });
  const applicableAxes = axes.filter((axis) => axis.coverage_ratio !== null);
  const comparisonBlockers = uniqueSorted(applicable
    .filter((criterion) => criterion.evidence_state === "not_comparable")
    .flatMap((criterion) => criterion.reason_codes.map((reason) => `${criterion.criterion_id}:${reason}`)));
  return {
    criterion_coverage: {
      scoreable_criterion_count: scoreable.length,
      applicable_criterion_count: applicable.length,
      value: round(scoreable.length / applicable.length),
    },
    parent_axis_coverage: {
      value: round(applicableAxes.reduce((sum, axis) => sum + axis.coverage_ratio!, 0) / applicableAxes.length),
      represented_parent_count: applicableAxes.filter((axis) => axis.scoreable_criterion_count > 0).length,
      fully_scoreable_parent_count: applicableAxes.filter((axis) => axis.state === "scoreable").length,
      applicable_parent_count: applicableAxes.length,
      axes,
    },
    weighted_coverage: {
      scoreable_weight: round(scoreableWeight, 12),
      applicable_weight: round(applicableWeight, 12),
      value: round(scoreableWeight / applicableWeight),
      value_status: "proposed",
    },
    unresolved_conflict_count: eligibilityConflictCount
      + applicable.filter((criterion) => criterion.evidence_state === "unresolved_conflict").length,
    not_comparable_criterion_count: applicable.filter((criterion) => criterion.evidence_state === "not_comparable").length,
    comparison_blockers: comparisonBlockers,
  };
}

function falseGateResults(): CoverageGateResults {
  return {
    scenario_eligible: false,
    partial_observed_score_present: false,
    criterion_coverage: false,
    parent_axis_coverage: false,
    represented_parent_count: false,
    weighted_coverage: false,
    required_criteria: false,
    conflict_policy: false,
  };
}

function profileAssessmentForError(profile: CoverageProfile, reasonCodes: string[]): CoverageProfileAssessment {
  return {
    profile_id: profile.profile_id,
    value_status: "proposed",
    score_state: "analysis_error",
    gate_results: falseGateResults(),
    missing_required_criterion_ids: [...profile.required_criterion_ids].sort(compareString),
    score_display_eligibility: false,
    ranking_candidate_eligibility: false,
    ranking_eligibility: false,
    reason_codes: uniqueSorted(reasonCodes),
  };
}

export function evaluateCoverageProfile(
  input: CoverageCandidateInput,
  metrics: CoverageMetrics | null,
  profile: CoverageProfile,
): CoverageProfileAssessment {
  if (input.scenario_eligibility === "analysis_error") {
    return profileAssessmentForError(profile, ["scenario_analysis_error"]);
  }
  const scoreableCriterionIds = new Set(input.criteria
    .filter((criterion) => criterion.applicability === "applicable" && criterion.evidence_state === "scoreable")
    .map((criterion) => criterion.criterion_id));
  const missingRequired = profile.required_criterion_ids
    .filter((criterionId) => !scoreableCriterionIds.has(criterionId))
    .sort(compareString);
  const gates: CoverageGateResults = metrics === null
    ? falseGateResults()
    : {
        scenario_eligible: input.scenario_eligibility === "eligible",
        partial_observed_score_present: input.partial_observed_score !== null,
        criterion_coverage: metrics.criterion_coverage.value >= profile.minimum_criterion_coverage,
        parent_axis_coverage: metrics.parent_axis_coverage.value >= profile.minimum_parent_axis_coverage,
        represented_parent_count: metrics.parent_axis_coverage.represented_parent_count >= profile.minimum_represented_parent_count,
        weighted_coverage: metrics.weighted_coverage.value >= profile.minimum_weighted_coverage,
        required_criteria: missingRequired.length === 0,
        conflict_policy: profile.allow_unresolved_conflicts || metrics.unresolved_conflict_count === 0,
      };
  const displayChecks = [
    !profile.score_display_conditions.require_scenario_eligible || gates.scenario_eligible,
    !profile.score_display_conditions.require_partial_observed_score || gates.partial_observed_score_present,
    !profile.score_display_conditions.require_all_coverage_thresholds
      || (gates.criterion_coverage && gates.parent_axis_coverage && gates.represented_parent_count && gates.weighted_coverage),
    !profile.score_display_conditions.require_all_required_criteria || gates.required_criteria,
    !profile.score_display_conditions.require_conflict_policy_pass || gates.conflict_policy,
  ];
  const scoreDisplayEligible = metrics !== null && displayChecks.every(Boolean);
  const rankingCandidateChecks = [
    !profile.ranking_conditions.require_score_display_eligibility || scoreDisplayEligible,
    !profile.ranking_conditions.require_no_comparison_blockers || metrics?.comparison_blockers.length === 0,
  ];
  const rankingCandidateEligible = metrics !== null && rankingCandidateChecks.every(Boolean);
  const reasons: string[] = [];
  if (!gates.scenario_eligible) reasons.push("scenario_not_eligible");
  if (!gates.partial_observed_score_present) reasons.push("partial_observed_score_missing");
  if (!gates.criterion_coverage) reasons.push("criterion_coverage_below_profile_minimum");
  if (!gates.parent_axis_coverage) reasons.push("parent_axis_coverage_below_profile_minimum");
  if (!gates.represented_parent_count) reasons.push("represented_parent_count_below_profile_minimum");
  if (!gates.weighted_coverage) reasons.push("weighted_coverage_below_profile_minimum");
  reasons.push(...missingRequired.map((criterionId) => `required_criterion_not_scoreable:${criterionId}`));
  if (!gates.conflict_policy) reasons.push("unresolved_conflict_not_allowed");
  if (profile.ranking_conditions.require_no_comparison_blockers) {
    reasons.push(...(metrics?.comparison_blockers ?? []).map((reason) => `comparison_blocker:${reason}`));
  }
  let scoreState: CoverageScoreState;
  if (input.scenario_eligibility === "ineligible" || input.scenario_eligibility === "not_applicable") {
    scoreState = "ineligible_for_scenario";
  } else if ((metrics?.unresolved_conflict_count ?? input.eligibility_unresolved_conflict_count) > 0) {
    scoreState = "eligible_with_unresolved_conflict";
  } else if (input.scenario_eligibility === "eligible"
    && metrics !== null
    && metrics.criterion_coverage.scoreable_criterion_count === 0
    && metrics.not_comparable_criterion_count > 0) {
    scoreState = "not_comparable";
  } else if (scoreDisplayEligible) {
    scoreState = "scoreable";
  } else {
    scoreState = "eligible_but_insufficient_evidence";
  }
  return {
    profile_id: profile.profile_id,
    value_status: "proposed",
    score_state: scoreState,
    gate_results: gates,
    missing_required_criterion_ids: missingRequired,
    score_display_eligibility: scoreDisplayEligible,
    ranking_candidate_eligibility: rankingCandidateEligible,
    ranking_eligibility: false,
    reason_codes: uniqueSorted([...input.scenario_reason_codes, ...reasons]),
  };
}

export function evaluateCandidateCoverage(
  input: CoverageCandidateInput,
  contract: CoverageContractConfig,
  profileSet: CoverageProfileSet,
): CandidateCoverageAssessment {
  const inputIssues = validateCandidateInput(input, contract);
  let metrics: CoverageMetrics | null = null;
  const errors = inputIssues.map((issue) => `${issue.path}:${issue.message}`);
  if (errors.length === 0 && input.scenario_eligibility === "eligible") {
    try {
      metrics = calculateCoverageMetrics(input.criteria, contract.parent_axes, input.eligibility_unresolved_conflict_count);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const assessmentInput: CoverageCandidateInput = errors.length === 0
    ? input
    : { ...input, scenario_eligibility: "analysis_error" };
  const profileAssessments = profileSet.profiles
    .map((profile) => errors.length === 0
      ? evaluateCoverageProfile(assessmentInput, metrics, profile)
      : profileAssessmentForError(profile, errors))
    .sort((left, right) => compareString(left.profile_id, right.profile_id));
  return {
    candidate_id: input.candidate_id,
    scenario_id: input.scenario_id,
    benchmark_segment: input.benchmark_segment,
    criterion_observations: [...input.criteria].sort((left, right) => compareString(left.criterion_id, right.criterion_id)),
    metrics,
    partial_observed_score: input.partial_observed_score,
    total_quality_score: null,
    total_quality_score_displayed: false,
    analysis_errors: uniqueSorted(errors),
    profile_assessments: profileAssessments,
  };
}

export function finalizeScenarioRankingEligibility(
  candidates: ScenarioRankingCandidate[],
  profile: CoverageProfile,
): ScenarioRankingEligibilityResult {
  const scenarioIds = uniqueSorted(candidates.map((candidate) => candidate.scenario_id));
  const segments = uniqueSorted(candidates.map((candidate) => candidate.benchmark_segment));
  const mixed = profile.ranking_conditions.require_same_scenario_and_segment
    && (scenarioIds.length !== 1 || segments.length !== 1);
  const eligibleCandidateCount = candidates.filter((candidate) => candidate.profile_assessment.ranking_candidate_eligibility).length;
  const enoughCandidates = eligibleCandidateCount >= profile.ranking_conditions.minimum_eligible_candidate_count;
  const generationEligible = !mixed && enoughCandidates;
  const globalReasons: string[] = [];
  if (mixed) globalReasons.push("mixed_scenario_or_benchmark_segment");
  if (!enoughCandidates) globalReasons.push("insufficient_eligible_candidate_count");
  return {
    profile_id: profile.profile_id,
    scenario_id: scenarioIds.length === 1 ? scenarioIds[0] : null,
    benchmark_segment: segments.length === 1 ? segments[0] : null,
    eligible_candidate_count: eligibleCandidateCount,
    minimum_eligible_candidate_count: profile.ranking_conditions.minimum_eligible_candidate_count,
    ranking_generation_eligible: generationEligible,
    ranking_generated: false,
    reason_codes: uniqueSorted(globalReasons),
    candidate_results: [...candidates]
      .sort((left, right) => compareString(left.candidate_id, right.candidate_id))
      .map((candidate) => ({
        candidate_id: candidate.candidate_id,
        ranking_eligibility: candidate.profile_assessment.ranking_candidate_eligibility && generationEligible,
        reason_codes: candidate.profile_assessment.ranking_candidate_eligibility && generationEligible
          ? []
          : uniqueSorted([
              ...candidate.profile_assessment.reason_codes,
              ...globalReasons,
            ]),
      })),
  };
}
