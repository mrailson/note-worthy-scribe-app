// Edge Function Audit — Governance Type Definitions

export type InvocationPathType =
  | 'UI-triggered'
  | 'Edge-to-Edge'
  | 'Webhook (external)'
  | 'Cron / background'
  | 'One-off seed / migration'
  | 'Unknown';

export type LastInvocationBucket =
  | '<7 days'
  | '7-30 days'
  | '31-90 days'
  | '>90 days'
  | 'Never / Unknown';

export type DataSensitivity =
  | 'PHI'
  | 'Operational'
  | 'Public'
  | 'Demo / Test'
  | 'Unknown';

export type LifecycleStatus =
  | 'ACTIVE'
  | 'DORMANT (retained)'
  | 'DEPRECATED'
  | 'DEPRECATED (still in use)'
  | 'ARCHIVED';

export type DeletionMode =
  | 'Retain'
  | 'Archive (disable deploy)'
  | 'Remove after confirmation';

/**
 * Base function entry as stored in the registry before enrichment.
 * Manual override fields are optional and take precedence over inferred values.
 */
export interface BaseEdgeFunction {
  name: string;
  purpose: string;
  referencedInClient: boolean;
  referencedInOtherFunctions: boolean;
  hasConfigEntry: boolean;
  calledFrom: string;
  status: 'active' | 'archived';

  // Manual overrides (optional — set per-function in registry)
  replacementExists?: boolean;
  replacementReference?: string | null;
  dataSensitivityOverride?: DataSensitivity;
}

/**
 * Fully enriched edge function with all computed governance fields.
 */
export interface EdgeFunction extends BaseEdgeFunction {
  // Dynamic fields (updated after log fetch)
  lastLogDates?: string[];
  logStatus?: 'idle' | 'loading' | 'loaded' | 'error';

  // Computed governance fields
  invocationPathType: InvocationPathType;
  lastInvocationBucket: LastInvocationBucket;
  dataSensitivity: DataSensitivity;
  lifecycleStatus: LifecycleStatus;
  deletionMode: DeletionMode;
  archiveConfidenceScore: number;
  archiveRationale: string;
}

export type ReferenceFilterType = 'all' | 'referenced' | 'unreferenced' | 'no-client-ref' | 'no-function-ref';

export interface AuditFilterState {
  searchQuery: string;
  referenceFilter: ReferenceFilterType;
  lifecycleFilter: LifecycleStatus | 'all';
  pathTypeFilter: InvocationPathType | 'all';
  sensitivityFilter: DataSensitivity | 'all';
  confidenceThreshold: number;
}

export const DEFAULT_FILTERS: AuditFilterState = {
  searchQuery: '',
  referenceFilter: 'all',
  lifecycleFilter: 'all',
  pathTypeFilter: 'all',
  sensitivityFilter: 'all',
  confidenceThreshold: 0,
};
