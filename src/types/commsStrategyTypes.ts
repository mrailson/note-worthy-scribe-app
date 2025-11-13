export interface CommsPlan {
  id: string;
  planName: string;
  description: string;
  targetAudience: string;
  communicationChannels: string[];
  owner: string;
  practice: string;
  startDate: Date;
  targetCompletionDate: Date;
  currentStatus: 'on-track' | 'at-risk' | 'off-track';
  createdAt: Date;
  updatedAt: Date;
}

export interface CommsEvent {
  id: string;
  planId: string;
  eventType: 'email-sent' | 'meeting-held' | 'feedback-received' | 'call-made' | 'letter-sent' | 'sms-sent' | 'follow-up-scheduled' | 'content-drafted' | 'review-completed' | 'approval-obtained' | 'complaint-logged' | 'issue-resolved' | 'other';
  eventDescription: string;
  eventDate: Date;
  createdBy: string;
  createdAt: Date;
}

export interface RAGHistory {
  id: string;
  planId: string;
  previousStatus: 'on-track' | 'at-risk' | 'off-track';
  newStatus: 'on-track' | 'at-risk' | 'off-track';
  reason: string;
  changedAt: Date;
  changedBy: string;
}

export interface CommsMetrics {
  totalActivePlans: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  onTrackChange: number;
  atRiskChange: number;
  offTrackChange: number;
}
