import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface KO41bSummary {
  totalBroughtForward: number;
  totalNew: number;
  numberUpheld: number;
  numberPartiallyUpheld: number;
  numberNotUpheld: number;
  totalResolved: number;
  totalCarriedForward: number;
}

interface KO41bAgeBand {
  label: string;
  count: number;
}

interface KO41bComplainantStatus {
  patient: number;
  relativeCarer: number;
  otherRepresentative: number;
  unknown: number;
}

interface KO41bSubjectArea {
  label: string;
  count: number;
}

interface KO41bStaffGroup {
  label: string;
  count: number;
}

export interface KO41bData {
  summary: KO41bSummary;
  ageBands: KO41bAgeBand[];
  complainantStatus: KO41bComplainantStatus;
  subjectAreas: KO41bSubjectArea[];
  staffGroups: KO41bStaffGroup[];
}

const AGE_BAND_LABELS = [
  'Under 1', '1-4', '5-14', '15-24', '25-34', '35-44',
  '45-54', '55-64', '65-74', '75-84', '85+', 'Age Unknown'
];

const SUBJECT_AREA_LABELS = [
  'Clinical treatment',
  'Communication, attitude, conduct',
  'Premises',
  'Administration incl. appointments',
  'Prescribing',
  'Referrals',
  'Confidentiality',
  'Other'
];

const STAFF_GROUP_LABELS = [
  'Practitioner (GP)',
  'Nursing',
  'Administration / Reception',
  'Other / No staff involved'
];

const CATEGORY_TO_SUBJECT: Record<string, string> = {
  'clinical_care': 'Clinical treatment',
  'Clinical Care & Treatment': 'Clinical treatment',
  'Test Results & Follow-Up': 'Clinical treatment',
  'communication': 'Communication, attitude, conduct',
  'Communication Issues': 'Communication, attitude, conduct',
  'staff_attitude': 'Communication, attitude, conduct',
  'Staff Attitude & Behaviour': 'Communication, attitude, conduct',
  'facilities': 'Premises',
  'Facilities & Environment': 'Premises',
  'appointment_system': 'Administration incl. appointments',
  'Appointments & Access': 'Administration incl. appointments',
  'Administration': 'Administration incl. appointments',
  'waiting_times': 'Administration incl. appointments',
  'medication': 'Prescribing',
  'Prescriptions': 'Prescribing',
  'referrals': 'Referrals',
  'Confidentiality & Data': 'Confidentiality',
  'billing': 'Other',
  'Digital Services': 'Other',
  'other': 'Other',
};

function getAgeBandIndex(dob: string | null, referenceDate: Date): number {
  if (!dob) return 11; // Age Unknown
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 11;

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 1) return 0;
  if (age <= 4) return 1;
  if (age <= 14) return 2;
  if (age <= 24) return 3;
  if (age <= 34) return 4;
  if (age <= 44) return 5;
  if (age <= 54) return 6;
  if (age <= 64) return 7;
  if (age <= 74) return 8;
  if (age <= 84) return 9;
  return 10; // 85+
}

function inferStaffGroup(staffName: string): string {
  const lower = staffName.toLowerCase();
  if (lower.includes('dr') || lower.includes('gp') || lower.includes('doctor')) return 'Practitioner (GP)';
  if (lower.includes('nurse') || lower.includes('hca') || lower.includes('health care assistant')) return 'Nursing';
  if (lower.includes('receptionist') || lower.includes('admin') || lower.includes('manager') || lower.includes('secretary')) return 'Administration / Reception';
  return 'Other / No staff involved';
}

export function useKO41bData(financialYear: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<KO41bData | null>(null);

  // Parse financial year e.g. "2024-25" -> start 2024-04-01, end 2025-03-31
  const { startDate, endDate } = useMemo(() => {
    const parts = financialYear.split('-');
    const startYear = parseInt(parts[0]);
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${startYear + 1}-03-31`,
    };
  }, [financialYear]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all complaints for this user
        const { data: allComplaints, error: complaintsError } = await supabase
          .from('complaints')
          .select('id, status, created_at, patient_dob, complaint_on_behalf, category, staff_mentioned')
          .order('created_at', { ascending: false });

        if (complaintsError) throw complaintsError;

        const complaints = allComplaints || [];

        // Separate brought forward vs new
        const broughtForward = complaints.filter(c => {
          const created = new Date(c.created_at!);
          return created < new Date(startDate) && c.status !== 'closed';
        });

        const newComplaints = complaints.filter(c => {
          const created = new Date(c.created_at!);
          return created >= new Date(startDate) && created <= new Date(endDate + 'T23:59:59');
        });

        // Fetch decisions for all complaints in period
        const allIds = [...broughtForward.map(c => c.id), ...newComplaints.map(c => c.id)];
        let decisions: any[] = [];
        if (allIds.length > 0) {
          const { data: decData } = await supabase
            .from('complaint_investigation_decisions')
            .select('complaint_id, decision_type, decided_at')
            .in('complaint_id', allIds);
          decisions = decData || [];
        }

        // Filter decisions made during the reporting period
        const periodDecisions = decisions.filter(d => {
          const decidedAt = new Date(d.decided_at);
          return decidedAt >= new Date(startDate) && decidedAt <= new Date(endDate + 'T23:59:59');
        });

        const upheld = periodDecisions.filter(d => d.decision_type === 'uphold').length;
        const partiallyUpheld = periodDecisions.filter(d => d.decision_type === 'partially_uphold').length;
        const notUpheld = periodDecisions.filter(d => d.decision_type === 'reject' || d.decision_type === 'not_upheld').length;
        const totalResolved = upheld + partiallyUpheld + notUpheld;

        const summary: KO41bSummary = {
          totalBroughtForward: broughtForward.length,
          totalNew: newComplaints.length,
          numberUpheld: upheld,
          numberPartiallyUpheld: partiallyUpheld,
          numberNotUpheld: notUpheld,
          totalResolved,
          totalCarriedForward: broughtForward.length + newComplaints.length - totalResolved,
        };

        // Age bands (new complaints only)
        const endOfYear = new Date(endDate);
        const ageCounts = new Array(12).fill(0);
        newComplaints.forEach(c => {
          const idx = getAgeBandIndex(c.patient_dob, endOfYear);
          ageCounts[idx]++;
        });
        const ageBands: KO41bAgeBand[] = AGE_BAND_LABELS.map((label, i) => ({ label, count: ageCounts[i] }));

        // Status of complainant (new complaints only)
        let patient = 0, relativeCarer = 0, unknown = 0;
        newComplaints.forEach(c => {
          if (c.complaint_on_behalf === null || c.complaint_on_behalf === undefined) {
            unknown++;
          } else if (c.complaint_on_behalf === false) {
            patient++;
          } else {
            relativeCarer++;
          }
        });
        const complainantStatus: KO41bComplainantStatus = {
          patient,
          relativeCarer,
          otherRepresentative: 0,
          unknown,
        };

        // Subject area (new complaints only)
        const subjectCounts: Record<string, number> = {};
        SUBJECT_AREA_LABELS.forEach(l => subjectCounts[l] = 0);
        newComplaints.forEach(c => {
          const mapped = CATEGORY_TO_SUBJECT[c.category] || 'Other';
          subjectCounts[mapped] = (subjectCounts[mapped] || 0) + 1;
        });
        const subjectAreas: KO41bSubjectArea[] = SUBJECT_AREA_LABELS.map(label => ({
          label,
          count: subjectCounts[label] || 0,
        }));

        // Staff groups (new complaints only)
        const staffCounts: Record<string, number> = {};
        STAFF_GROUP_LABELS.forEach(l => staffCounts[l] = 0);
        newComplaints.forEach(c => {
          const mentioned = c.staff_mentioned || [];
          if (mentioned.length === 0) {
            staffCounts['Other / No staff involved']++;
          } else {
            const groups = new Set<string>();
            mentioned.forEach((name: string) => {
              groups.add(inferStaffGroup(name));
            });
            groups.forEach(g => staffCounts[g]++);
          }
        });
        const staffGroups: KO41bStaffGroup[] = STAFF_GROUP_LABELS.map(label => ({
          label,
          count: staffCounts[label] || 0,
        }));

        setRawData({ summary, ageBands, complainantStatus, subjectAreas, staffGroups });
      } catch (err: any) {
        console.error('Error fetching KO41b data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, startDate, endDate]);

  return { data: rawData, loading, error };
}
