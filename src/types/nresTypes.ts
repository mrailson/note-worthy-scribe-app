export interface HubConsultation {
  id: string;
  patientInitials: string;
  patientDOB: string;
  homePractice: string;
  hubPractice: string;
  clinician: string;
  testType: string;
  receivedAt: Date;
  status: 'pending' | 'reviewed' | 'overdue' | 'critical';
  assignedGP: string;
  hoursElapsed: number;
  safetyNetting?: string;
  escalationHistory: EscalationEvent[];
}

export interface EscalationEvent {
  id: string;
  timestamp: Date;
  type: 'auto-assigned' | 'reminder-48hr' | 'reminder-72hr' | 'escalated-96hr' | 'reviewed';
  message: string;
  actor?: string;
}

export interface MetricData {
  outstanding: number;
  overdue: number;
  onTimePercentage: number;
  zeroLostDays: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PracticePerformance {
  practice: string;
  averageReviewTime: number;
  onTimePercentage: number;
  outstanding: number;
}

export interface PriorityAction {
  id: string;
  urgency: 'critical' | 'urgent' | 'due-soon';
  consultation: HubConsultation;
}
