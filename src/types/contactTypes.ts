export interface Contact {
  id: number;
  user_id: string;
  name: string;
  initials: string;
  org: string;
  default_role: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingGroup {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  contact_ids: number[];
  additional_members: AdditionalMember[];
  created_at: string;
  updated_at: string;
}

export interface AdditionalMember {
  name: string;
  initials: string;
  org: string;
  role: string;
}

export interface MeetingAttendee {
  id: number | string;
  name: string;
  initials: string;
  role: string;
  org: string;
  status: 'present' | 'apologies' | 'absent';
  contact_id?: number;
}

export const ATTENDEE_ROLES = [
  'Chair',
  'Minute Taker',
  'Clinical Lead',
  'GP Partner',
  'Presenter',
  'Practice Manager',
  'PCN Manager',
  'Neighbourhood Manager',
  'Manager',
  'Observer',
  'Guest',
] as const;

export type AttendeeRole = typeof ATTENDEE_ROLES[number];

export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Chair':                  { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  'Minute Taker':           { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  'Clinical Lead':          { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  'GP Partner':             { bg: '#ECFDF5', text: '#047857', border: '#34D399' },
  'Presenter':              { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
  'Practice Manager':       { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  'PCN Manager':            { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' },
  'Neighbourhood Manager':  { bg: '#F0FDFA', text: '#115E59', border: '#14B8A6' },
  'Manager':                { bg: '#FFE4E6', text: '#9F1239', border: '#FB7185' },
  'Observer':               { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' },
  'Guest':                  { bg: '#FFF7ED', text: '#9A3412', border: '#F97316' },
};

export const SPEAKER_COLORS = [
  '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6',
  '#EF4444', '#F97316', '#EC4899', '#06B6D4',
];

export const SUGGESTED_ORGANISATIONS = [
  'Brackley Medical Centre',
  'Towcester Medical Centre',
  'Saxon Spires Practice',
  'Springfield Surgery',
  'The Parks Medical Practice',
  'Bugbrooke Surgery',
  'Brook Health Centre',
  'Denton Village Practice',
  'Park Avenue Surgery',
  'PML (SNO)',
  'ICB Northamptonshire',
  'PCN Services Ltd',
  'External / Other',
];

export const GROUP_ICONS = [
  '🏥', '🔵', '🌿', '💻', '❤️', '📋', '🎯', '⚡',
  '🏛️', '🩺', '📊', '🤝', '🌍', '💼', '🔬',
];

export const GROUP_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#F97316', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6',
];

export function generateInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
