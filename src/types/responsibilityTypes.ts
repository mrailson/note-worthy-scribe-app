// Responsibility Tracker Types

export type FrequencyType = 'annual' | 'monthly' | 'quarterly' | 'weekly' | 'one-off' | 'custom';
export type InstanceStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'not_applicable';

export interface ResponsibilityCategory {
  id: string;
  name: string;
  description: string | null;
  practice_id: string;
  colour: string;
  created_at: string;
}

export interface Responsibility {
  id: string;
  practice_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  frequency_type: FrequencyType;
  frequency_value: number | null;
  typical_due_month: number | null;
  typical_due_day: number | null;
  is_mandatory: boolean;
  reference_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Joined data
  category?: ResponsibilityCategory;
}

export interface ResponsibilityAssignment {
  id: string;
  responsibility_id: string;
  assigned_to_user_id: string | null;
  assigned_to_role: string | null;
  assigned_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  responsibility?: Responsibility;
  assigned_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export interface ResponsibilityInstance {
  id: string;
  responsibility_id: string;
  assignment_id: string | null;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  status: InstanceStatus;
  evidence_notes: string | null;
  evidence_url: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  responsibility?: Responsibility;
  assignment?: ResponsibilityAssignment;
}

export interface ResponsibilityFormData {
  title: string;
  description: string;
  category_id: string | null;
  frequency_type: FrequencyType;
  frequency_value: number | null;
  typical_due_month: number | null;
  typical_due_day: number | null;
  is_mandatory: boolean;
  reference_url: string;
}

export interface AssignmentFormData {
  responsibility_id: string;
  assigned_to_user_id: string | null;
  assigned_to_role: string | null;
  notes: string;
  start_date: string;
  custom_due_date: string | null;
  create_instances: boolean;
}

export interface CategoryFormData {
  name: string;
  description: string;
  colour: string;
}

// Pre-defined roles for assignment
export const PRACTICE_ROLES = [
  'Practice Manager',
  'Assistant Practice Manager',
  'Reception Manager',
  'Nurse Manager',
  'IT Lead',
  'HR Lead',
  'Finance Lead',
  'Clinical Lead',
  'Quality Lead',
  'Complaints Lead',
  'H&S Officer',
  'IG Lead',
] as const;

export type PracticeRole = typeof PRACTICE_ROLES[number];

// Category colours
export const CATEGORY_COLOURS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
] as const;

// Default templates based on user request
export const DEFAULT_RESPONSIBILITY_TEMPLATES = [
  {
    title: 'Type 2 Pension Forms',
    description: 'Complete and submit Type 2 pension forms for staff',
    category: 'HR',
    frequency_type: 'annual' as FrequencyType,
    typical_due_month: 2,
    is_mandatory: true,
  },
  {
    title: 'EDEC Submission',
    description: 'Complete and submit EDEC (Electronic Declaration of Compliance)',
    category: 'Contracts/Quality',
    frequency_type: 'annual' as FrequencyType,
    typical_due_month: 11,
    is_mandatory: true,
  },
  {
    title: 'KOB14 Complaints Submission',
    description: 'Submit annual complaints data via KOB14',
    category: 'Contracts/Quality',
    frequency_type: 'annual' as FrequencyType,
    typical_due_month: 10,
    is_mandatory: true,
  },
  {
    title: 'IT Governance Training (DSP Toolkit)',
    description: 'Complete annual IT governance training for DSP Toolkit submission',
    category: 'IT/Facilities',
    frequency_type: 'annual' as FrequencyType,
    typical_due_month: null,
    is_mandatory: true,
  },
  {
    title: 'CQRS Declaration',
    description: 'Complete periodic CQRS declarations as required',
    category: 'Contracts/Quality',
    frequency_type: 'quarterly' as FrequencyType,
    typical_due_month: null,
    is_mandatory: true,
  },
  {
    title: 'QoF Achievement Check',
    description: 'Review and verify QoF achievement on clinical system before year end',
    category: 'Contracts/Quality',
    frequency_type: 'annual' as FrequencyType,
    typical_due_month: 3,
    typical_due_day: 31,
    is_mandatory: true,
  },
];
