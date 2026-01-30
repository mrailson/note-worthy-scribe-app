export interface NRESUserSettings {
  id: string;
  user_id: string;
  hourly_rate: number | null;
  rate_set_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NRESHoursEntry {
  id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  activity_type: string;
  description: string | null;
  claimant_type: 'gp' | 'pm' | null;
  claimant_name: string | null;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CLAIMANT_TYPES = [
  { value: 'personal', label: 'Personal Rate', rate: null },
  { value: 'gp', label: 'GP (£100/hr)', rate: 100 },
  { value: 'pm', label: 'Practice Manager (£50/hr)', rate: 50 }
] as const;

export type ClaimantType = 'gp' | 'pm' | null;

export function getClaimantRate(claimantType: ClaimantType): number | null {
  if (claimantType === 'gp') return 100;
  if (claimantType === 'pm') return 50;
  return null;
}

export interface NRESExpense {
  id: string;
  user_id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  receipt_reference: string | null;
  created_at: string;
  updated_at: string;
}

export const ACTIVITY_TYPES = [
  'Attending Meeting',
  'Report Preparation',
  'ICB Planning',
  'Clinical Review',
  'Documentation',
  'Training/CPD',
  'Travel',
  'Administration',
  'Other'
] as const;

export const EXPENSE_CATEGORIES = [
  'Indeed Advert',
  'Job Board Advertising',
  'Printing/Materials',
  'Software/Subscriptions',
  'Travel Expenses',
  'Training Costs',
  'Equipment',
  'Other'
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
