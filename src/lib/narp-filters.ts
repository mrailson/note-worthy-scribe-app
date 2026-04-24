/**
 * NRES Population Risk — named filter library (single source of truth).
 *
 * Every clickable count on the Population Risk dashboard references a
 * filter by `key`. The drawer composes filters by INTERSECTING their
 * predicates (so opening "high_risk" then chipping in "smr_eligible"
 * narrows the list to patients who satisfy BOTH).
 *
 * Predicates are pure functions of a NarpRow. Keep the row shape
 * minimal here so the file stays portable when filters move into
 * Supabase views in Phase 2 (the SQL `WHERE` clauses will mirror
 * these predicates 1:1).
 */

export type NarpFrailty = "Fit" | "Mild" | "Moderate" | "Severe" | "Unknown";

/** Minimal row contract used by every filter predicate. */
export interface NarpFilterableRow {
  fkPatientLinkId: string;
  age: number | null;
  frailty: NarpFrailty;
  drugCount: number;
  inpatientAdmissions: number;
  poA: number | null;
}

export type AgeBandKey = "0-17" | "18-39" | "40-64" | "65-74" | "75-84" | "85+";
export type RiskTierKey = "very_high" | "high" | "moderate" | "rising" | "low" | "unknown";

const AGE_BAND_TESTS: Record<AgeBandKey, (a: number) => boolean> = {
  "0-17":  (a) => a <= 17,
  "18-39": (a) => a >= 18 && a <= 39,
  "40-64": (a) => a >= 40 && a <= 64,
  "65-74": (a) => a >= 65 && a <= 74,
  "75-84": (a) => a >= 75 && a <= 84,
  "85+":   (a) => a >= 85,
};

const RISK_TIER_TESTS: Record<RiskTierKey, (poA: number | null) => boolean> = {
  very_high: (p) => p !== null && p > 50,
  high:      (p) => p !== null && p >= 20 && p <= 50,
  moderate:  (p) => p !== null && p >= 10 && p < 20,
  rising:    (p) => p !== null && p >= 5  && p < 10,
  low:       (p) => p !== null && p < 5,
  unknown:   (p) => p === null,
};

const RISK_TIER_LABEL: Record<RiskTierKey, string> = {
  very_high: "Very high",
  high: "High",
  moderate: "Moderate",
  rising: "Rising",
  low: "Low",
  unknown: "Unknown",
};

const RISK_TIER_BAND: Record<RiskTierKey, string> = {
  very_high: "PoA > 50%",
  high: "PoA 20–50%",
  moderate: "PoA 10–20%",
  rising: "PoA 5–10%",
  low: "PoA < 5%",
  unknown: "PoA not available",
};

export interface NarpFilter {
  key: string;
  label: string;
  subtitle: string;
  /** Optional grouping for drawer chips and breadcrumbs */
  group?: "kpi" | "tier" | "frailty" | "polypharmacy" | "age_x_risk" | "over65" | "cohort";
  predicate: (row: NarpFilterableRow) => boolean;
}

const f = (
  key: string,
  label: string,
  subtitle: string,
  predicate: (r: NarpFilterableRow) => boolean,
  group?: NarpFilter["group"],
): NarpFilter => ({ key, label, subtitle, predicate, group });

// ── Static filters ────────────────────────────────────────────────────────
const STATIC_FILTERS: NarpFilter[] = [
  // KPI-level
  f("all", "All patients", "Full registered list", () => true, "kpi"),
  f("high_risk", "High-risk patients", "PoA ≥ 20%", (r) => r.poA !== null && r.poA >= 20, "kpi"),
  f("rising_risk", "Rising-risk patients", "PoA 5–10%", (r) => r.poA !== null && r.poA >= 5 && r.poA < 10, "kpi"),
  f("mod_sev_frailty", "Moderate or severe frailty", "eFI Moderate + Severe", (r) => r.frailty === "Moderate" || r.frailty === "Severe", "kpi"),

  // Risk pyramid tiers
  f("tier_very_high", "Very-high risk", "PoA > 50%", (r) => RISK_TIER_TESTS.very_high(r.poA), "tier"),
  f("tier_high", "High risk", "PoA 20–50%", (r) => RISK_TIER_TESTS.high(r.poA), "tier"),
  f("tier_moderate", "Moderate risk", "PoA 10–20%", (r) => RISK_TIER_TESTS.moderate(r.poA), "tier"),
  f("tier_rising", "Rising risk", "PoA 5–10%", (r) => RISK_TIER_TESTS.rising(r.poA), "tier"),
  f("tier_low", "Low risk", "PoA < 5%", (r) => RISK_TIER_TESTS.low(r.poA), "tier"),
  f("tier_unknown", "Risk unknown", "No PoA available", (r) => RISK_TIER_TESTS.unknown(r.poA), "tier"),

  // Frailty
  f("frailty_fit", "Fit (eFI)", "Frailty: Fit", (r) => r.frailty === "Fit", "frailty"),
  f("frailty_mild", "Mild frailty", "Frailty: Mild", (r) => r.frailty === "Mild", "frailty"),
  f("frailty_moderate", "Moderate frailty", "Frailty: Moderate", (r) => r.frailty === "Moderate", "frailty"),
  f("frailty_severe", "Severe frailty", "Frailty: Severe", (r) => r.frailty === "Severe", "frailty"),

  // Polypharmacy
  f("drugs_10_plus", "10+ repeat medications", "Primary SMR cohort", (r) => r.drugCount >= 10, "polypharmacy"),
  f("drugs_15_plus", "15+ repeat medications", "Complex polypharmacy", (r) => r.drugCount >= 15, "polypharmacy"),
  f("drugs_20_plus", "20+ repeat medications", "Very complex polypharmacy", (r) => r.drugCount >= 20, "polypharmacy"),

  // 65+ frailty donut
  f("over65_fit", "Fit (65+)", "Aged 65+ · Frailty Fit", (r) => (r.age ?? 0) >= 65 && r.frailty === "Fit", "over65"),
  f("over65_mild", "Mild frailty (65+)", "Aged 65+ · Frailty Mild", (r) => (r.age ?? 0) >= 65 && r.frailty === "Mild", "over65"),
  f("over65_moderate", "Moderate frailty (65+)", "Aged 65+ · Frailty Moderate", (r) => (r.age ?? 0) >= 65 && r.frailty === "Moderate", "over65"),
  f("over65_severe", "Severe frailty (65+)", "Aged 65+ · Frailty Severe", (r) => (r.age ?? 0) >= 65 && r.frailty === "Severe", "over65"),

  // NRES action cohorts
  f("mdt_intensive", "Intensive MDT caseload", "Very high + high risk (PoA ≥ 20%)", (r) => (r.poA ?? 0) >= 20, "cohort"),
  f("ltc_anchor", "LTC anchor cohort", "Aged 65+ with Moderate/Severe frailty", (r) => (r.age ?? 0) >= 65 && (r.frailty === "Moderate" || r.frailty === "Severe"), "cohort"),
  f("smr_eligible", "SMR-eligible (polypharmacy)", "10+ repeat medications", (r) => r.drugCount >= 10, "cohort"),
  f("rising_prevention", "Rising-risk prevention", "PoA 5–10% — pre-frailty / emerging LTC", (r) => r.poA !== null && r.poA >= 5 && r.poA < 10, "cohort"),
  f("admission_avoidance", "Admission avoidance", "2+ inpatient admissions in year", (r) => r.inpatientAdmissions >= 2, "cohort"),
  f("falls_risk", "Falls-risk cohort", "Severe frailty (all ages)", (r) => r.frailty === "Severe", "cohort"),
  f("frailty_review", "Frailty review backlog", "Moderate + Severe eFI", (r) => r.frailty === "Moderate" || r.frailty === "Severe", "cohort"),
];

const STATIC_BY_KEY: Record<string, NarpFilter> =
  STATIC_FILTERS.reduce((acc, ff) => { acc[ff.key] = ff; return acc; }, {} as Record<string, NarpFilter>);

/**
 * Resolve a filter key to its definition. Supports the dynamic
 * `age_{band}_tier_{tier}` keys generated by the heatmap.
 */
export const getFilter = (key: string): NarpFilter | null => {
  if (STATIC_BY_KEY[key]) return STATIC_BY_KEY[key];

  if (key.startsWith("patient_")) {
    const patientId = decodeURIComponent(key.replace("patient_", ""));
    if (!patientId) return null;
    return {
      key,
      label: `Patient ${patientId}`,
      subtitle: "Opened from a clinical worklist",
      predicate: (r) => r.fkPatientLinkId === patientId,
    };
  }

  // age_{band}_tier_{tier} — band has hyphens (e.g. "0-17") so split carefully
  if (key.startsWith("age_") && key.includes("_tier_")) {
    const [, rest] = key.split("age_");
    const [bandKey, tierKey] = rest.split("_tier_") as [AgeBandKey, RiskTierKey];
    const ageTest = AGE_BAND_TESTS[bandKey];
    const tierTest = RISK_TIER_TESTS[tierKey];
    if (!ageTest || !tierTest) return null;
    return {
      key,
      label: `Age ${bandKey} · ${RISK_TIER_LABEL[tierKey]} risk`,
      subtitle: `${RISK_TIER_BAND[tierKey]} · age ${bandKey}`,
      group: "age_x_risk",
      predicate: (r) => r.age !== null && ageTest(r.age) && tierTest(r.poA),
    };
  }
  return null;
};

export const ageRiskFilterKey = (band: AgeBandKey, tier: RiskTierKey): string =>
  `age_${band}_tier_${tier}`;

export const patientFilterKey = (fkPatientLinkId: string): string =>
  `patient_${encodeURIComponent(fkPatientLinkId)}`;

/** Apply one or more filters as an intersection. */
export const applyFilters = <T extends NarpFilterableRow>(rows: T[], keys: string[]): T[] => {
  if (!keys.length) return rows;
  const preds = keys.map(getFilter).filter((f): f is NarpFilter => f !== null).map((f) => f.predicate);
  if (!preds.length) return rows;
  return rows.filter((row) => preds.every((p) => p(row)));
};

/** All filters that have at least one row in common with `rows`, except those already applied. */
export const overlappingFilters = <T extends NarpFilterableRow>(
  rows: T[],
  appliedKeys: string[],
): Array<{ filter: NarpFilter; overlap: number }> => {
  const applied = new Set(appliedKeys);
  const groupsToOffer: NarpFilter["group"][] = ["cohort", "frailty", "polypharmacy", "tier"];
  const candidates = STATIC_FILTERS.filter((ff) => ff.group && groupsToOffer.includes(ff.group) && !applied.has(ff.key));
  return candidates
    .map((filter) => ({ filter, overlap: rows.reduce((n, r) => n + (filter.predicate(r) ? 1 : 0), 0) }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 8);
};

export const ALL_FILTERS = STATIC_FILTERS;
