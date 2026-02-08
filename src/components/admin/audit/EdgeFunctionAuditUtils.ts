// Edge Function Audit — Governance Inference & Computation Utilities

import type {
  BaseEdgeFunction,
  EdgeFunction,
  InvocationPathType,
  DataSensitivity,
  LifecycleStatus,
  DeletionMode,
  LastInvocationBucket,
} from './EdgeFunctionAuditTypes';

// ── Invocation Path Type ────────────────────────────────────────────────

export function inferInvocationPathType(fn: BaseEdgeFunction): InvocationPathType {
  const cf = fn.calledFrom;
  const name = fn.name.toLowerCase();

  // 1. Route path → UI-triggered
  if (cf.includes('/')) return 'UI-triggered';

  // 2. Known UI contexts without route paths
  if (/AuthContext|Settings|Admin|SystemAdmin|PracticeAdmin/i.test(cf)) return 'UI-triggered';

  // 3. Webhook / external triggers
  if (/webhook|inbound|resend|email|external/i.test(cf)) return 'Webhook (external)';

  // 4. Cron / background jobs
  if (/auto-|cron|cleanup|purge|monitor/.test(name)) return 'Cron / background';

  // 5. One-off seed / migration (only if not client-referenced)
  if (/import-|seed|migration/.test(name) && !fn.referencedInClient) return 'One-off seed / migration';

  // 6. Edge-to-Edge (called by other functions only)
  if (fn.referencedInOtherFunctions && !fn.referencedInClient) return 'Edge-to-Edge';

  // 7. Fallback
  return 'Unknown';
}

// ── Data Sensitivity ────────────────────────────────────────────────────

const PHI_PATTERNS = /complaint|consultation|transcript|patient|clinical|lg-|referral|medical|scribe|meeting|capture|survey|evidence|inspection/i;
const OPERATIONAL_PATTERNS = /admin|monitoring|cleanup|purge|security|rate-limit|log-|system-|api-test|challenge/i;
const DEMO_PATTERNS = /demo|showcase|test|example|staff-demo/i;
const PUBLIC_PATTERNS = /^(fetch-gp-news|nhs-gp-news|bp-calculator|get-client-info|news)$/i;

export function inferDataSensitivity(fn: BaseEdgeFunction): DataSensitivity {
  // Manual override takes precedence
  if (fn.dataSensitivityOverride) return fn.dataSensitivityOverride;

  const combined = `${fn.name} ${fn.purpose}`.toLowerCase();

  // PHI first (conservative — capture routes are PHI even if public-token access)
  if (PHI_PATTERNS.test(combined)) return 'PHI';

  // Operational
  if (OPERATIONAL_PATTERNS.test(combined)) return 'Operational';

  // Demo / Test
  if (DEMO_PATTERNS.test(combined)) return 'Demo / Test';

  // Public (only clearly non-clinical)
  if (PUBLIC_PATTERNS.test(fn.name)) return 'Public';

  return 'Unknown';
}

// ── Lifecycle Status ────────────────────────────────────────────────────

export function inferLifecycleStatus(fn: BaseEdgeFunction & { invocationPathType: InvocationPathType }): LifecycleStatus {
  // 1. Already archived
  if (fn.status === 'archived') return 'ARCHIVED';

  const hasReferences = fn.referencedInClient || fn.referencedInOtherFunctions;

  // 2. Replaced but still referenced → DEPRECATED (still in use)
  if (fn.replacementExists && hasReferences) return 'DEPRECATED (still in use)';

  // 3. Replaced with no references → DEPRECATED
  if (fn.replacementExists && !hasReferences) return 'DEPRECATED';

  // 4. Has references → ACTIVE
  if (hasReferences) return 'ACTIVE';

  // 5. No references, external/cron/unknown → DORMANT
  if (['Webhook (external)', 'Cron / background', 'Unknown'].includes(fn.invocationPathType)) {
    return 'DORMANT (retained)';
  }

  // 6. Fallback
  return 'ACTIVE';
}

// ── Deletion Mode ───────────────────────────────────────────────────────

export function inferDeletionMode(
  fn: BaseEdgeFunction & { lifecycleStatus: LifecycleStatus; invocationPathType: InvocationPathType }
): DeletionMode {
  const hasReferences = fn.referencedInClient || fn.referencedInOtherFunctions;

  // DEPRECATED → Archive
  if (fn.lifecycleStatus === 'DEPRECATED' || fn.lifecycleStatus === 'DEPRECATED (still in use)') {
    return 'Archive (disable deploy)';
  }

  // One-off seed with no references → Archive
  if (fn.invocationPathType === 'One-off seed / migration' && !hasReferences) {
    return 'Archive (disable deploy)';
  }

  // Webhook with no references → Remove after confirmation
  if (fn.invocationPathType === 'Webhook (external)' && !hasReferences) {
    return 'Remove after confirmation';
  }

  return 'Retain';
}

// ── Archive Confidence Score ────────────────────────────────────────────

export function calculateArchiveConfidence(
  fn: BaseEdgeFunction & {
    dataSensitivity: DataSensitivity;
    invocationPathType: InvocationPathType;
    lastInvocationBucket: LastInvocationBucket;
  }
): number {
  let score = 50;

  // Penalties
  if (fn.dataSensitivity === 'PHI') score -= 40;
  if (['Webhook (external)', 'Cron / background'].includes(fn.invocationPathType)) score -= 30;
  if (fn.invocationPathType === 'Unknown') score -= 20;

  // Unknown activity + external/cron/unknown path → extra penalty
  if (
    fn.lastInvocationBucket === 'Never / Unknown' &&
    ['Webhook (external)', 'Cron / background', 'Unknown'].includes(fn.invocationPathType)
  ) {
    score -= 25;
  }

  // Bonuses
  if (fn.invocationPathType === 'One-off seed / migration') score += 30;
  if (fn.replacementExists) score += 30;
  if (!fn.referencedInClient && !fn.referencedInOtherFunctions) score += 20;

  return Math.max(0, Math.min(100, score));
}

// ── Archive Rationale ───────────────────────────────────────────────────

export function generateArchiveRationale(
  fn: BaseEdgeFunction & {
    dataSensitivity: DataSensitivity;
    invocationPathType: InvocationPathType;
    lifecycleStatus: LifecycleStatus;
    lastInvocationBucket: LastInvocationBucket;
    archiveConfidenceScore: number;
  }
): string {
  const parts: string[] = [];
  const hasReferences = fn.referencedInClient || fn.referencedInOtherFunctions;

  if (fn.lifecycleStatus === 'ARCHIVED') {
    return 'This function is already archived and no longer deployed.';
  }

  // Replacement info
  if (fn.replacementExists) {
    const ref = (fn as any).replacementReference;
    if (hasReferences) {
      parts.push(`This function is superseded by \`${ref || 'a newer function'}\` but still has active references. Migration should be completed before archiving.`);
    } else {
      parts.push(`This function is superseded by \`${ref || 'a newer function'}\` and has no active references.`);
    }
  }

  // Seed / migration
  if (fn.invocationPathType === 'One-off seed / migration') {
    parts.push('This appears to be a one-off seed/migration script. No replacement is required.');
  }

  // PHI warning
  if (fn.dataSensitivity === 'PHI') {
    parts.push('This function processes PHI (protected health information) — extra caution required.');
  }

  // Webhook / cron with unknown activity
  if (
    ['Webhook (external)', 'Cron / background'].includes(fn.invocationPathType) &&
    fn.lastInvocationBucket === 'Never / Unknown'
  ) {
    parts.push('No recent invocation data is available. However, it may receive external traffic — manual verification required before archiving.');
  }

  // Active and referenced
  if (fn.lifecycleStatus === 'ACTIVE' && hasReferences) {
    parts.push('This function is actively referenced and should not be archived.');
  }

  // No references and unreferenced
  if (!hasReferences && !fn.replacementExists && fn.invocationPathType !== 'One-off seed / migration') {
    if (['Webhook (external)', 'Cron / background'].includes(fn.invocationPathType)) {
      parts.push('No client or edge references found, but the function may be triggered externally.');
    } else {
      parts.push('No client or edge references found. Suitable for archival review.');
    }
  }

  // Confidence summary
  if (fn.archiveConfidenceScore >= 70) {
    parts.push('Confidence: suitable for archival.');
  } else if (fn.archiveConfidenceScore >= 30) {
    parts.push('Confidence: moderate — review recommended before action.');
  } else {
    parts.push('Confidence: low — not suitable for archival without thorough review.');
  }

  return parts.join(' ') || 'No specific rationale could be determined.';
}

// ── Last Invocation Bucket ──────────────────────────────────────────────

export function computeLastInvocationBucket(logDates?: string[]): LastInvocationBucket {
  if (!logDates || logDates.length === 0) return 'Never / Unknown';

  // Parse the most recent date (format: "DD Mon YY HH:MM")
  const now = new Date();
  for (const dateStr of logDates) {
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        const diffMs = now.getTime() - parsed.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) return '<7 days';
        if (diffDays <= 30) return '7-30 days';
        if (diffDays <= 90) return '31-90 days';
        return '>90 days';
      }
    } catch {
      // Skip unparseable dates
    }
  }

  return 'Never / Unknown';
}

// ── Enrichment Functions ────────────────────────────────────────────────

/**
 * Enriches a base function entry with all computed governance fields.
 * Called once during initial data setup.
 */
export function enrichFunction(base: Omit<BaseEdgeFunction, 'status'> & { status?: 'active' | 'archived' }): EdgeFunction {
  const fn: BaseEdgeFunction = {
    ...base,
    status: base.status || 'active',
    replacementExists: base.replacementExists ?? false,
    replacementReference: base.replacementReference ?? null,
  };

  const invocationPathType = inferInvocationPathType(fn);
  const dataSensitivity = inferDataSensitivity(fn);
  const lastInvocationBucket: LastInvocationBucket = 'Never / Unknown';

  const withPathType = { ...fn, invocationPathType };
  const lifecycleStatus = inferLifecycleStatus(withPathType);

  const withLifecycle = { ...withPathType, lifecycleStatus };
  const deletionMode = inferDeletionMode(withLifecycle);

  const withSensitivity = { ...withLifecycle, dataSensitivity, lastInvocationBucket };
  const archiveConfidenceScore = calculateArchiveConfidence(withSensitivity);

  const withScore = { ...withSensitivity, archiveConfidenceScore };
  const archiveRationale = generateArchiveRationale(withScore);

  return {
    ...fn,
    lastLogDates: undefined,
    logStatus: 'idle',
    invocationPathType,
    lastInvocationBucket,
    dataSensitivity,
    lifecycleStatus,
    deletionMode,
    archiveConfidenceScore,
    archiveRationale,
  };
}

/**
 * Recomputes dynamic fields after log fetch.
 * Only updates: lastInvocationBucket, archiveConfidenceScore, archiveRationale.
 */
export function recomputeDynamicFields(fn: EdgeFunction): EdgeFunction {
  const lastInvocationBucket = computeLastInvocationBucket(fn.lastLogDates);

  const archiveConfidenceScore = calculateArchiveConfidence({
    ...fn,
    lastInvocationBucket,
  });

  const archiveRationale = generateArchiveRationale({
    ...fn,
    lastInvocationBucket,
    archiveConfidenceScore,
  });

  return {
    ...fn,
    lastInvocationBucket,
    archiveConfidenceScore,
    archiveRationale,
  };
}
