/**
 * DPIA Risk Matrix Utilities
 * Provides risk calculation, prioritisation, and analysis functions
 */

export type LikelihoodLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'very_high';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Risk {
  id: string;
  title: string;
  description: string;
  inherentLikelihood: LikelihoodLevel;
  inherentSeverity: SeverityLevel;
  residualLikelihood: LikelihoodLevel;
  residualSeverity: SeverityLevel;
  controls: string[];
  additionalMeasures: string[];
  responsibility: string;
  timeline: string;
}

// Likelihood scoring
const likelihoodScores: Record<LikelihoodLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

// Severity scoring
const severityScores: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 4,
  very_high: 5,
};

/**
 * Calculate risk score from likelihood and severity
 */
export function calculateRiskScore(
  likelihood: LikelihoodLevel,
  severity: SeverityLevel
): number {
  return likelihoodScores[likelihood] * severityScores[severity];
}

/**
 * Determine risk level from score
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

/**
 * Calculate both inherent and residual risk scores
 */
export function calculateRiskScores(risk: Risk) {
  const inherentScore = calculateRiskScore(
    risk.inherentLikelihood,
    risk.inherentSeverity
  );
  const residualScore = calculateRiskScore(
    risk.residualLikelihood,
    risk.residualSeverity
  );

  return {
    inherentScore,
    inherentLevel: getRiskLevel(inherentScore),
    residualScore,
    residualLevel: getRiskLevel(residualScore),
    riskReduction: inherentScore - residualScore,
  };
}

/**
 * Sort risks by residual score (highest first)
 */
export function prioritiseRisks(risks: Risk[]): Risk[] {
  return [...risks].sort((a, b) => {
    const scoreA = calculateRiskScore(a.residualLikelihood, a.residualSeverity);
    const scoreB = calculateRiskScore(b.residualLikelihood, b.residualSeverity);
    return scoreB - scoreA;
  });
}

/**
 * Calculate risk statistics
 */
export function calculateRiskStatistics(risks: Risk[]) {
  const residualScores = risks.map(r =>
    calculateRiskScore(r.residualLikelihood, r.residualSeverity)
  );

  const riskLevelCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  residualScores.forEach(score => {
    const level = getRiskLevel(score);
    riskLevelCounts[level]++;
  });

  const totalRisks = risks.length;
  const averageResidualScore =
    residualScores.reduce((sum, score) => sum + score, 0) / totalRisks;

  const inherentScores = risks.map(r =>
    calculateRiskScore(r.inherentLikelihood, r.inherentSeverity)
  );
  const averageInherentScore =
    inherentScores.reduce((sum, score) => sum + score, 0) / totalRisks;

  const totalRiskReduction = averageInherentScore - averageResidualScore;
  const riskReductionPercentage =
    ((totalRiskReduction / averageInherentScore) * 100);

  return {
    totalRisks,
    riskLevelCounts,
    percentages: {
      critical: (riskLevelCounts.critical / totalRisks) * 100,
      high: (riskLevelCounts.high / totalRisks) * 100,
      medium: (riskLevelCounts.medium / totalRisks) * 100,
      low: (riskLevelCounts.low / totalRisks) * 100,
    },
    averageInherentScore,
    averageResidualScore,
    totalRiskReduction,
    riskReductionPercentage,
  };
}

/**
 * Get colour coding for risk levels
 */
export function getRiskColour(level: RiskLevel): string {
  const colours = {
    critical: 'hsl(var(--destructive))',
    high: 'hsl(var(--orange))',
    medium: 'hsl(var(--warning))',
    low: 'hsl(var(--success))',
  };
  return colours[level];
}

/**
 * Get colour for likelihood level
 */
export function getLikelihoodColour(likelihood: LikelihoodLevel): string {
  const colours = {
    very_low: 'hsl(var(--success))',
    low: 'hsl(var(--success-light))',
    medium: 'hsl(var(--warning))',
    high: 'hsl(var(--orange))',
    very_high: 'hsl(var(--destructive))',
  };
  return colours[likelihood];
}

/**
 * Get colour for severity level
 */
export function getSeverityColour(severity: SeverityLevel): string {
  const colours = {
    low: 'hsl(var(--success))',
    medium: 'hsl(var(--warning))',
    high: 'hsl(var(--orange))',
    very_high: 'hsl(var(--destructive))',
  };
  return colours[severity];
}

/**
 * Format likelihood for display
 */
export function formatLikelihood(likelihood: LikelihoodLevel): string {
  return likelihood
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format severity for display
 */
export function formatSeverity(severity: SeverityLevel): string {
  return severity
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get controls effectiveness percentage
 */
export function getControlsEffectiveness(risk: Risk): number {
  const inherentScore = calculateRiskScore(
    risk.inherentLikelihood,
    risk.inherentSeverity
  );
  const residualScore = calculateRiskScore(
    risk.residualLikelihood,
    risk.residualSeverity
  );

  if (inherentScore === 0) return 0;

  return ((inherentScore - residualScore) / inherentScore) * 100;
}

/**
 * Filter risks by level
 */
export function filterRisksByLevel(
  risks: Risk[],
  level: RiskLevel
): Risk[] {
  return risks.filter(risk => {
    const score = calculateRiskScore(
      risk.residualLikelihood,
      risk.residualSeverity
    );
    return getRiskLevel(score) === level;
  });
}

/**
 * Get risks requiring immediate action (high or critical)
 */
export function getHighPriorityRisks(risks: Risk[]): Risk[] {
  return risks.filter(risk => {
    const score = calculateRiskScore(
      risk.residualLikelihood,
      risk.residualSeverity
    );
    const level = getRiskLevel(score);
    return level === 'high' || level === 'critical';
  });
}

/**
 * Calculate risk trend (for future implementation with historical data)
 */
export function calculateRiskTrend(
  currentRisks: Risk[],
  previousRisks: Risk[]
): {
  improved: number;
  worsened: number;
  unchanged: number;
} {
  let improved = 0;
  let worsened = 0;
  let unchanged = 0;

  currentRisks.forEach(currentRisk => {
    const previousRisk = previousRisks.find(r => r.id === currentRisk.id);
    if (!previousRisk) return;

    const currentScore = calculateRiskScore(
      currentRisk.residualLikelihood,
      currentRisk.residualSeverity
    );
    const previousScore = calculateRiskScore(
      previousRisk.residualLikelihood,
      previousRisk.residualSeverity
    );

    if (currentScore < previousScore) improved++;
    else if (currentScore > previousScore) worsened++;
    else unchanged++;
  });

  return { improved, worsened, unchanged };
}
