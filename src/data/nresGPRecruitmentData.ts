// GP Recruitment Data - Extracted from NRES GP Candidate Assessment Reports
// All data is anonymised for GDPR compliance

export interface GPScoringBreakdown {
  criterion: string;
  maxScore: number;
  score: number;
  evidence: string;
}

export interface GPCandidate {
  id: string;
  score: number;
  source: 'Indeed' | 'NHS Jobs' | 'BMC Practice';
  gmcNumber: string;
  gmcDetails?: string;
  cctStatus: string;
  primaryQualification: string;
  additionalQualifications: string[];
  currentRole: string;
  experience: string;
  settings: string[];
  keyRoles: string[];
  scoringBreakdown: GPScoringBreakdown[];
  strengths: string[];
  concerns: string[];
  interviewQuestions: string[];
  recommendation: 'strongly-recommend' | 'recommend' | 'consider' | 'do-not-shortlist';
  recommendationReason?: string;
}

export interface GPRecruitmentSummary {
  totalApplications: number;
  stronglyRecommend: number;
  interviewRecommended: number;
  doNotShortlist: number;
  sources: {
    indeed: number;
    nhsJobs: number;
    bmcPractice: number;
  };
  assessmentDate: string;
}

// GP-specific scoring criteria with maximum scores
export const gpScoringCriteria = [
  { key: 'cct', label: 'CCT', maxScore: 10, description: 'CCT Qualification' },
  { key: 'performers', label: 'Perf', maxScore: 10, description: 'Performers List Status' },
  { key: 'primaryCare', label: 'PC', maxScore: 10, description: 'Primary Care Experience' },
  { key: 'cdm', label: 'CDM', maxScore: 10, description: 'Chronic Disease Management' },
  { key: 'minorIllness', label: 'Minor', maxScore: 10, description: 'Minor Illness Management' },
  { key: 'autonomous', label: 'Auton', maxScore: 10, description: 'Autonomous Practice' },
  { key: 'governance', label: 'Gov', maxScore: 10, description: 'Clinical Governance' },
  { key: 'communication', label: 'Comm', maxScore: 10, description: 'Communication Skills' },
  { key: 'teamwork', label: 'Team', maxScore: 10, description: 'Team Working' },
  { key: 'teaching', label: 'Teach', maxScore: 10, description: 'Teaching/Mentoring' },
];

export const gpRecruitmentSummary: GPRecruitmentSummary = {
  totalApplications: 7,
  stronglyRecommend: 2,
  interviewRecommended: 2,
  doNotShortlist: 3,
  sources: {
    indeed: 2,
    nhsJobs: 4,
    bmcPractice: 1,
  },
  assessmentDate: '2026-01-07',
};

// All 7 GP candidates with scoring data
export const allGPCandidates: GPCandidate[] = [
  {
    id: 'GP-2026-007',
    score: 95,
    source: 'BMC Practice',
    gmcNumber: '7556726',
    gmcDetails: 'Full GMC registration confirmed',
    cctStatus: 'ST3 - CCT expected May 2026',
    primaryQualification: 'BM BCh (Distinction) University of Oxford 2017, PhD Royal Veterinary College 2014',
    additionalQualifications: [
      'LoC IUT (Coil fitting)',
      'LoC SDI (Implant fitting)',
      'Diploma in Child Health (DCH)',
      'PhD in Molecular Cell Biology',
    ],
    currentRole: 'GP ST3 - Brackley Medical Centre',
    experience: 'Currently completing ST3 at BMC, strong academic background with Oxford distinction',
    settings: ['General Practice', 'Care Home', 'Same-day Triage'],
    keyRoles: [
      'Same-day triage consultations',
      'Care home ward rounds',
      'Coil and implant fitting',
      'Chronic disease management',
      'Child health consultations',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 9, evidence: 'ST3 - CCT expected May 2026' },
      { criterion: 'Performers List', maxScore: 10, score: 10, evidence: 'Already working in Northamptonshire' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 10, evidence: 'Currently at BMC, excellent training practice' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 10, evidence: 'Strong CDM experience during training' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 9, evidence: 'Same-day triage experience' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 10, evidence: 'Working autonomously at ST3 level' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 10, evidence: 'Excellent understanding from training' },
      { criterion: 'Communication', maxScore: 10, score: 9, evidence: 'Strong patient communication skills' },
      { criterion: 'Team Working', maxScore: 10, score: 10, evidence: 'Highly valued team member at BMC' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 9, evidence: 'PhD background, teaching potential' },
    ],
    strengths: [
      'PRACTICE RECOMMENDED - BMC wants to retain her for NRES',
      'Oxford BM BCh with DISTINCTION - exceptional academic credentials',
      'PhD in Molecular Cell Biology - research capability',
      'Already working at BMC (NRES member practice) - knows the team',
      'Coil and implant trained (LoC IUT/SDI) - valuable skills',
      'Care home ward round experience - directly relevant to NRES model',
      'Same-day triage experience',
      'Diploma in Child Health',
    ],
    concerns: [
      'CCT not until May 2026 - 4 months away',
    ],
    interviewQuestions: [
      'What specifically attracts you to remaining with NRES post-CCT?',
      'How has your PhD research background influenced your clinical practice?',
      'Describe your experience with care home ward rounds at BMC',
    ],
    recommendation: 'strongly-recommend',
    recommendationReason: 'Highest scoring candidate (95/100). Practice recommended - BMC wants to retain. Oxford distinction, PhD, already embedded in NRES practices. Exceptional candidate.',
  },
  {
    id: 'GP-2026-004',
    score: 92,
    source: 'Indeed',
    gmcNumber: '7701872',
    gmcDetails: 'Full GMC registration confirmed',
    cctStatus: 'CCT achieved November 2025',
    primaryQualification: 'MBChB (2011), MRCGP (2018)',
    additionalQualifications: [
      'ILS, ALS, EPALS certified',
      'Minor surgery skills (joint injections, dermoscopy)',
      'Diploma in Dermatology',
    ],
    currentRole: 'Salaried GP - Northampton (NN1)',
    experience: '4 years NHS, 10+ years total medical experience',
    settings: ['General Practice', 'Out of Hours', 'Minor Surgery'],
    keyRoles: [
      'Full spectrum general practice consultations',
      'Minor surgery including joint injections',
      'Dermoscopy and skin lesion assessment',
      'Chronic disease management clinics',
      'On-call and duty doctor responsibilities',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 10, evidence: 'CCT achieved November 2025 - fully qualified GP' },
      { criterion: 'Performers List', maxScore: 10, score: 10, evidence: 'Currently on Northamptonshire performers list' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 10, evidence: '4 years NHS GP experience, 10+ total' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 9, evidence: 'Experienced in diabetes, hypertension, respiratory conditions' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 9, evidence: 'Strong minor illness skills demonstrated' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 10, evidence: 'Fully autonomous salaried GP' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 8, evidence: 'Good understanding of governance requirements' },
      { criterion: 'Communication', maxScore: 10, score: 9, evidence: 'Strong patient communication skills' },
      { criterion: 'Team Working', maxScore: 10, score: 9, evidence: 'Works well in MDT settings' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 8, evidence: 'Some teaching experience with trainees' },
    ],
    strengths: [
      'LOCAL TO NORTHAMPTON (NN1) - ideal for NRES neighbourhood',
      'CCT achieved November 2025 - fully qualified',
      'Already on Northamptonshire Performers List - no transfer needed',
      'Minor surgery skills including joint injections and dermoscopy',
      'ILS, ALS, EPALS certified - excellent for emergencies',
      '10+ years medical experience',
    ],
    concerns: [
      'May need to confirm current session availability',
    ],
    interviewQuestions: [
      'What attracts you to the NRES neighbourhood model specifically?',
      'How would you integrate your minor surgery skills into the neighbourhood clinics?',
      'Describe your experience with same-day urgent access consultations',
    ],
    recommendation: 'strongly-recommend',
  },
  {
    id: 'GP-2026-001',
    score: 88,
    source: 'NHS Jobs',
    gmcNumber: '7118625',
    gmcDetails: 'Full GMC registration confirmed',
    cctStatus: 'CCT expected February 2026',
    primaryQualification: 'MBBS, MRCP(UK)',
    additionalQualifications: [
      'MRCP(UK) - strong medical knowledge base',
      'Fluent in 4 languages (including Bengali, Hindi)',
      'Respiratory medicine background',
    ],
    currentRole: 'GP Registrar ST3 - completing training',
    experience: 'Completing GP training, strong hospital medicine background',
    settings: ['General Practice', 'Respiratory Medicine', 'Hospital Medicine'],
    keyRoles: [
      'GP registrar consultations under supervision',
      'Chronic disease management',
      'Respiratory conditions specialty interest',
      'Multilingual patient consultations',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 9, evidence: 'CCT expected February 2026 - imminent completion' },
      { criterion: 'Performers List', maxScore: 10, score: 8, evidence: 'Will need to transfer to Northants performers list' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 8, evidence: 'GP training experience, completing ST3' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 9, evidence: 'MRCP background, respiratory specialty' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 8, evidence: 'Standard GP trainee competencies' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 8, evidence: 'Nearly autonomous, final training stages' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 9, evidence: 'Good training in governance' },
      { criterion: 'Communication', maxScore: 10, score: 10, evidence: 'Fluent in 4 languages - excellent asset' },
      { criterion: 'Team Working', maxScore: 10, score: 9, evidence: 'Strong MDT experience from hospital' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 10, evidence: 'No visa sponsorship required' },
    ],
    strengths: [
      'CCT February 2026 - can start very soon after qualification',
      'MRCP(UK) qualified - strong medical knowledge base',
      'Fluent in 4 languages including Bengali and Hindi - excellent for diverse population',
      'No visa sponsorship required',
      'Respiratory medicine background useful for COPD/asthma management',
    ],
    concerns: [
      'CCT not yet achieved - need to confirm February 2026 date',
      'Will need performers list transfer to Northamptonshire',
    ],
    interviewQuestions: [
      'Confirm expected CCT date and any potential delays',
      'How would your MRCP background enhance your GP practice?',
      'Describe how your multilingual skills would benefit the NRES population',
    ],
    recommendation: 'recommend',
  },
  {
    id: 'GP-2026-002',
    score: 85,
    source: 'NHS Jobs',
    gmcNumber: 'Not stated - requires verification',
    gmcDetails: 'GMC number not provided in application',
    cctStatus: 'CCT 2025 (likely achieved)',
    primaryQualification: 'MBBS, MRCGP',
    additionalQualifications: [
      'Emergency Medicine background (4 years)',
      'Strong acute care skills',
    ],
    currentRole: 'Salaried GP - Bedford area',
    experience: '4 years Emergency Medicine, recently completed GP training',
    settings: ['General Practice', 'Emergency Department', 'Urgent Care'],
    keyRoles: [
      'Same-day urgent consultations',
      'Acute presentations management',
      'Chronic disease reviews',
      'ED liaison experience',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 9, evidence: 'CCT 2025 - likely achieved but needs confirmation' },
      { criterion: 'Performers List', maxScore: 10, score: 7, evidence: 'Bedford-based - will need performers list transfer' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 8, evidence: 'Recent CCT, working as salaried GP' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 9, evidence: 'Explicit CDM skills mentioned' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 9, evidence: 'Strong from ED background' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 9, evidence: 'Working autonomously as salaried GP' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 8, evidence: 'Good understanding' },
      { criterion: 'Communication', maxScore: 10, score: 8, evidence: 'Good communication skills' },
      { criterion: 'Team Working', maxScore: 10, score: 9, evidence: 'Strong MDT from ED background' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 9, evidence: 'ED teaching experience' },
    ],
    strengths: [
      'Strong Emergency Medicine background (4 years) - excellent for same-day access',
      'CCT likely achieved 2025',
      'Working autonomously as salaried GP',
      'Explicit chronic disease management experience mentioned',
      'Good acute care skills valuable for neighbourhood model',
    ],
    concerns: [
      'GMC number not stated - MUST VERIFY before interview',
      'Bedford-based - will need performers list transfer to Northamptonshire',
      'CCT status needs formal confirmation',
    ],
    interviewQuestions: [
      'FIRST: Verify GMC registration number',
      'How would your ED experience enhance the same-day access clinics?',
      'Describe your approach to balancing urgent and routine appointments',
    ],
    recommendation: 'recommend',
  },
  {
    id: 'GP-2026-003',
    score: 25,
    source: 'NHS Jobs',
    gmcNumber: '8105603',
    gmcDetails: 'GMC registration - PLAB route only',
    cctStatus: 'No CCT - PLAB level only',
    primaryQualification: 'MBBS (Overseas)',
    additionalQualifications: [
      'PLAB Parts 1 & 2 passed',
    ],
    currentRole: 'Clinical Attachment - seeking first UK position',
    experience: '1 month clinical attachment in UK only',
    settings: ['Overseas Practice'],
    keyRoles: [
      'Clinical observation only',
      'No autonomous practice in UK',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 0, evidence: 'NO CCT - PLAB level only, not GP trained' },
      { criterion: 'Performers List', maxScore: 10, score: 0, evidence: 'Not on any performers list' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 2, evidence: 'Overseas experience only, 1 month UK attachment' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 3, evidence: 'Overseas experience, not UK validated' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 3, evidence: 'Overseas experience, not UK validated' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 0, evidence: 'Clinical attachment only - no autonomous practice' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 2, evidence: 'Limited UK governance understanding' },
      { criterion: 'Communication', maxScore: 10, score: 5, evidence: 'Unknown - not assessed in UK setting' },
      { criterion: 'Team Working', maxScore: 10, score: 5, evidence: 'Unknown - limited UK experience' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 5, evidence: 'N/A' },
    ],
    strengths: [
      'GMC registered via PLAB route',
      'Enthusiasm to work in UK primary care',
    ],
    concerns: [
      'NO CCT - fundamental requirement not met',
      'Only 1 month clinical attachment experience in UK',
      'PLAB level only - not GP trained',
      'Not on any performers list',
      'Cannot work autonomously as GP',
    ],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'Does not meet essential criteria: No CCT qualification, PLAB level only, only 1 month UK clinical attachment. Cannot practice as autonomous GP.',
  },
  {
    id: 'GP-2026-005',
    score: 12,
    source: 'Indeed',
    gmcNumber: 'NONE',
    gmcDetails: 'No GMC registration',
    cctStatus: 'Not applicable',
    primaryQualification: 'BHMS (Homoeopathy) - NOT RECOGNISED IN UK',
    additionalQualifications: [
      'Homoeopathy qualification only',
    ],
    currentRole: 'Homoeopathy Practitioner',
    experience: 'Homoeopathy practice only',
    settings: ['Alternative Medicine'],
    keyRoles: [
      'Homoeopathy consultations',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 0, evidence: 'No medical qualification recognised in UK' },
      { criterion: 'Performers List', maxScore: 10, score: 0, evidence: 'Cannot be on performers list - no GMC' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 0, evidence: 'No recognised medical experience' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 0, evidence: 'N/A' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 0, evidence: 'N/A' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 0, evidence: 'Cannot practice medicine in UK' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 2, evidence: 'N/A' },
      { criterion: 'Communication', maxScore: 10, score: 5, evidence: 'Unknown' },
      { criterion: 'Team Working', maxScore: 10, score: 5, evidence: 'Unknown' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 0, evidence: 'N/A' },
    ],
    strengths: [],
    concerns: [
      'NO GMC REGISTRATION - cannot work as doctor in UK',
      'BHMS (Homoeopathy) qualification NOT RECOGNISED in UK',
      'Does not hold any medical qualification valid in UK',
      'Fundamental mismatch - this is not a medical doctor',
    ],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'INELIGIBLE: No GMC registration. Homoeopathy qualification (BHMS) not recognised in UK. Cannot legally practice as a GP.',
  },
  {
    id: 'GP-2026-006',
    score: 8,
    source: 'NHS Jobs',
    gmcNumber: 'NONE (NMC registered)',
    gmcDetails: 'Nurse - wrong professional registration',
    cctStatus: 'Not applicable - not a doctor',
    primaryQualification: 'RGN (Registered General Nurse)',
    additionalQualifications: [
      'Nursing qualification only',
    ],
    currentRole: 'Practice Nurse',
    experience: 'Nursing experience only',
    settings: ['General Practice - as nurse'],
    keyRoles: [
      'Practice nursing duties',
      'Chronic disease clinics (nursing level)',
    ],
    scoringBreakdown: [
      { criterion: 'CCT Qualification', maxScore: 10, score: 0, evidence: 'NURSE NOT DOCTOR - wrong profession' },
      { criterion: 'Performers List', maxScore: 10, score: 0, evidence: 'N/A - nurses not on medical performers list' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 3, evidence: 'Has primary care experience but as nurse' },
      { criterion: 'Chronic Disease Management', maxScore: 10, score: 2, evidence: 'Nursing level CDM only' },
      { criterion: 'Minor Illness Management', maxScore: 10, score: 0, evidence: 'Cannot diagnose/treat as nurse in GP role' },
      { criterion: 'Autonomous Practice', maxScore: 10, score: 0, evidence: 'Cannot practice as GP' },
      { criterion: 'Clinical Governance', maxScore: 10, score: 3, evidence: 'Nursing level governance' },
      { criterion: 'Communication', maxScore: 10, score: 0, evidence: 'N/A for GP role' },
      { criterion: 'Team Working', maxScore: 10, score: 0, evidence: 'N/A for GP role' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 0, evidence: 'N/A for GP role' },
    ],
    strengths: [],
    concerns: [
      'WRONG PROFESSION - this is a nurse, not a doctor',
      'No GMC registration (NMC registered as nurse)',
      'No medical qualification',
      'Cannot fulfil GP role - completely ineligible',
      'Application appears to be for wrong job advertisement',
    ],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'INELIGIBLE: Applicant is a NURSE (NMC registered), not a doctor. No GMC registration, no medical degree, no CCT. Applied for wrong role - may be interested in ANP role instead.',
  },
];

// Helper functions for filtering candidates
export const getStronglyRecommendedGPCandidates = (): GPCandidate[] => {
  return allGPCandidates.filter(c => c.recommendation === 'strongly-recommend');
};

export const getRecommendedGPCandidates = (): GPCandidate[] => {
  return allGPCandidates.filter(c => c.recommendation === 'recommend');
};

export const getNotShortlistedGPCandidates = (): GPCandidate[] => {
  return allGPCandidates.filter(c => c.recommendation === 'do-not-shortlist');
};
