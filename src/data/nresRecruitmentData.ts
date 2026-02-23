import { PracticeKey } from "@/hooks/useEstatesConfig";

export interface StaffMember {
  name: string;
  sessions: number;
  status: 'recruited' | 'confirmed' | 'offered' | 'potential' | 'tbc' | 'outstanding';
  type: string;
  notes?: string;
}

export interface PracticeWorkforce {
  gp: StaffMember[];
  acp: StaffMember[];
  buyBack: StaffMember[];
}

export interface RecruitmentPractice {
  id: string;
  name: string;
  listSize: number;
  percentTotal: number;
  sessionsRequired: { winter: number; nonWinter: number; combined: number };
  clinicalSystem: string;
  hubSpoke: string;
  workforce: PracticeWorkforce;
}

// Mapping from PracticeKey (modal) to recruitment tracker practice ID
export const practiceKeyToRecruitmentId: Record<PracticeKey, string> = {
  theParks: 'parks',
  brackley: 'brackley',
  springfield: 'springfield',
  towcester: 'towcester',
  bugbrooke: 'bugbrooke',
  brook: 'brook',
  denton: 'denton',
};

export const statusConfig = {
  recruited: { label: 'Recruited', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-200' },
  confirmed: { label: 'Confirmed', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-200' },
  offered: { label: 'Offered', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-200' },
  potential: { label: 'Potential', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50', border: 'border-amber-200' },
  tbc: { label: 'TBC/Expected', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50', border: 'border-amber-200' },
  outstanding: { label: 'Outstanding', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', border: 'border-red-200' },
};

export const practices: RecruitmentPractice[] = [
  {
    id: 'parks',
    name: 'The Parks MC',
    listSize: 22827,
    percentTotal: 25.5,
    sessionsRequired: { winter: 35, nonWinter: 29, combined: 30 },
    clinicalSystem: 'SystmOne',
    hubSpoke: 'HUB',
    workforce: {
      gp: [
        { name: 'Dr Aamir Badshah', sessions: 4, status: 'offered', type: 'New Recruit', notes: 'Offer underway' }
      ],
      acp: [],
      buyBack: [
        { name: 'Existing Staff Pool', sessions: 26, status: 'confirmed', type: 'Buy-Back', notes: 'All remaining sessions via buy-back of existing staff' }
      ]
    }
  },
  {
    id: 'brackley',
    name: 'Brackley MC',
    listSize: 16212,
    percentTotal: 18.1,
    sessionsRequired: { winter: 25, nonWinter: 21, combined: 22 },
    clinicalSystem: 'SystmOne',
    hubSpoke: 'HUB',
    workforce: {
      gp: [
        { name: 'Dr Charlotte', sessions: 5, status: 'recruited', type: 'New Recruit', notes: 'In post' },
        { name: 'Dr Rajan', sessions: 7, status: 'potential', type: 'New Recruit', notes: 'Potential offer' },
        { name: 'GP Vacancy', sessions: 3, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting' }
      ],
      acp: [],
      buyBack: [
        { name: 'Existing ANP Staff', sessions: 7, status: 'confirmed', type: 'Buy-Back', notes: 'Balance via ANP buy-back' }
      ]
    }
  },
  {
    id: 'springfield',
    name: 'Springfield Surgery',
    listSize: 12611,
    percentTotal: 14.1,
    sessionsRequired: { winter: 19, nonWinter: 16, combined: 17 },
    clinicalSystem: 'EMIS',
    hubSpoke: 'SPOKE',
    workforce: {
      gp: [
        { name: 'Dr TE', sessions: 2, status: 'confirmed', type: 'Buy-Back', notes: 'Existing staff' },
        { name: 'Dr VW', sessions: 2, status: 'tbc', type: 'Buy-Back', notes: 'Existing GP - 1-2 sessions TBC' },
        { name: 'GP Vacancy', sessions: 7, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 7 session GP' }
      ],
      acp: [
        { name: 'ACP/ANP Vacancy', sessions: 6, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 6 session ACP/ANP' }
      ],
      buyBack: []
    }
  },
  {
    id: 'towcester',
    name: 'Towcester MC',
    listSize: 11748,
    percentTotal: 13.1,
    sessionsRequired: { winter: 18, nonWinter: 15, combined: 16 },
    clinicalSystem: 'EMIS',
    hubSpoke: 'SPOKE',
    workforce: {
      gp: [
        { name: 'Dr Gareth Griffiths', sessions: 6, status: 'tbc', type: 'New Recruit', notes: 'Expected to join - TBC' },
        { name: 'New GP 2', sessions: 6, status: 'tbc', type: 'New Recruit', notes: 'Expected to join - TBC' },
        { name: 'GP Vacancy', sessions: 4, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting up to 4 further sessions' }
      ],
      acp: [
        { name: 'ACP/ANP (Balance)', sessions: 0, status: 'tbc', type: 'New Recruit', notes: 'Balance will be ACP/ANP - TBC' }
      ],
      buyBack: []
    }
  },
  {
    id: 'bugbrooke',
    name: 'Bugbrooke Surgery',
    listSize: 10788,
    percentTotal: 12.0,
    sessionsRequired: { winter: 16, nonWinter: 14, combined: 14 },
    clinicalSystem: 'SystmOne',
    hubSpoke: 'SPOKE',
    workforce: {
      gp: [
        { name: 'New GP', sessions: 5, status: 'tbc', type: 'New Recruit', notes: 'GP joining - TBC' },
        { name: 'GP Vacancy', sessions: 4, status: 'outstanding', type: 'New Recruit', notes: 'Job advert online' }
      ],
      acp: [
        { name: 'ACP/ANP (Balance)', sessions: 5, status: 'outstanding', type: 'New Recruit', notes: 'Balance will be ACP/ANP' }
      ],
      buyBack: []
    }
  },
  {
    id: 'brook',
    name: 'Brook Health Centre',
    listSize: 9069,
    percentTotal: 10.1,
    sessionsRequired: { winter: 14, nonWinter: 11, combined: 12 },
    clinicalSystem: 'SystmOne',
    hubSpoke: 'SPOKE',
    workforce: {
      gp: [
        { name: 'Dr Sam Cullen', sessions: 2, status: 'offered', type: 'New Recruit', notes: 'Just offered - Thursday' },
        { name: 'GP Vacancy', sessions: 6, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 6 session GP' }
      ],
      acp: [
        { name: 'ACP/ANP Vacancy', sessions: 4, status: 'outstanding', type: 'New Recruit', notes: 'Recruiting 4 session ACP/ANP' }
      ],
      buyBack: []
    }
  },
  {
    id: 'denton',
    name: 'Denton Village Surgery',
    listSize: 6329,
    percentTotal: 7.1,
    sessionsRequired: { winter: 10, nonWinter: 8, combined: 8 },
    clinicalSystem: 'SystmOne',
    hubSpoke: 'SPOKE',
    workforce: {
      gp: [
        { name: 'GP Vacancy', sessions: 8, status: 'outstanding', type: 'New Recruit', notes: 'Job advert online - recruiting 8 session GP' }
      ],
      acp: [],
      buyBack: []
    }
  }
];

export interface PracticeTotals {
  byStatus: Record<string, number>;
  byType: { gp: number; acp: number; buyBack: number };
  totalFilled: number;
  totalPipeline: number;
  totalOutstanding: number;
  totalPlanned: number;
  required: number;
  filledPercent: number;
  pipelinePercent: number;
  outstandingPercent: number;
}

export const calculatePracticeTotals = (
  practice: RecruitmentPractice,
  seasonFilter: string = 'combined'
): PracticeTotals => {
  const byStatus: Record<string, number> = {
    recruited: 0, confirmed: 0, offered: 0, potential: 0, tbc: 0, outstanding: 0
  };
  const byType = { gp: 0, acp: 0, buyBack: 0 };

  practice.workforce.gp.forEach(s => { byStatus[s.status] += s.sessions; byType.gp += s.sessions; });
  practice.workforce.acp.forEach(s => { byStatus[s.status] += s.sessions; byType.acp += s.sessions; });
  practice.workforce.buyBack.forEach(s => { byStatus[s.status] += s.sessions; byType.buyBack += s.sessions; });

  const totalFilled = byStatus.recruited + byStatus.confirmed + byStatus.offered;
  const totalPipeline = byStatus.potential + byStatus.tbc;
  const totalOutstanding = byStatus.outstanding;
  const totalPlanned = totalFilled + totalPipeline + totalOutstanding;

  const seasonKey = seasonFilter === 'winter' ? 'winter' : seasonFilter === 'non-winter' ? 'nonWinter' : 'combined';
  const required = practice.sessionsRequired[seasonKey];

  return {
    byStatus,
    byType,
    totalFilled,
    totalPipeline,
    totalOutstanding,
    totalPlanned,
    required,
    filledPercent: required > 0 ? Math.round((totalFilled / required) * 100) : 0,
    pipelinePercent: required > 0 ? Math.round((totalPipeline / required) * 100) : 0,
    outstandingPercent: required > 0 ? Math.round((totalOutstanding / required) * 100) : 0,
  };
};

export const getRecruitmentDataForPractice = (practiceKey: PracticeKey) => {
  const recruitmentId = practiceKeyToRecruitmentId[practiceKey];
  return practices.find(p => p.id === recruitmentId) || null;
};
