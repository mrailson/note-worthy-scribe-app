export interface ComplexCarePatient {
  id: string;
  rank: number;
  firstName: string;
  lastName: string;
  initials: string;
  age: number;
  dateOfBirth: string;
  nhsNumber: string;
  practice: string;
  assignedGP: string;
  riskScore: number;
  conditions: Condition[];
  clinicalMetrics: ClinicalMetric[];
  engagementStatus: EngagementStatus;
  lastReview?: Date;
  nextAppointment?: Date;
  exempted: boolean;
  exemptionReason?: string;
  exemptionNotes?: string;
  exemptedAt?: Date;
}

export interface Condition {
  code: string;
  name: string;
  displayName: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export interface ClinicalMetric {
  name: string;
  value: string | number;
  unit: string;
  threshold?: {
    type: 'above' | 'below' | 'range';
    value: number | [number, number];
  };
  isAlert: boolean;
  isCritical: boolean;
  lastRecorded?: Date;
}

export interface EngagementStatus {
  status: 'active' | 'pending' | 'declined';
  color: 'green' | 'amber' | 'red';
  message: string;
  lastContact?: Date;
}

export interface ExemptionRecord {
  patientId: string;
  reason: 'multiple-dnas' | 'declined-care' | 'moved-away' | 'deceased' | 'other';
  notes: string;
  exemptedBy: string;
  exemptedAt: Date;
}

export interface InsightCard {
  id: string;
  title: string;
  value: string | number;
  subtitle?: string;
  details?: string[];
  type: 'preventable-admissions' | 'medication-optimization' | 'trending' | 'cqc-indicators' | 'impact-metrics' | 'immediate-actions';
  icon?: string;
}

export interface StatisticData {
  label: string;
  count: number;
  change: string;
  color: 'critical' | 'high' | 'success' | 'primary';
  tooltip: string;
}

export type ConditionFilterType = 'all' | 'diabetes' | 'cvd' | 'respiratory' | 'renal';
