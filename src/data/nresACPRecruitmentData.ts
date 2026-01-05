// ACP Recruitment Data - Extracted from NRES Candidate Assessment Reports
// All data is anonymised for GDPR compliance

export interface ScoringBreakdown {
  criterion: string;
  maxScore: number;
  score: number;
  evidence: string;
}

export interface ACPCandidate {
  id: string;
  score: number;
  registration: 'NMC' | 'HCPC' | 'GMC';
  registrationDetails?: string;
  mscStatus: string;
  prescriber: string;
  currentRole: string;
  acpExperience: string;
  settings: string[];
  keyRoles: string[];
  scoringBreakdown: ScoringBreakdown[];
  strengths: string[];
  concerns: string[];
  interviewQuestions: string[];
  recommendation: 'strongly-recommend' | 'recommend' | 'consider' | 'do-not-shortlist';
  recommendationReason?: string;
}

export interface RecruitmentSummary {
  totalApplications: number;
  interviewRecommended: number;
  consider: number;
  doNotShortlist: number;
  sources: {
    indeed: number;
    nhsJobs: number;
  };
  assessmentDate: string;
}

// Scoring criteria with maximum scores
export const scoringCriteria = [
  { key: 'registration', label: 'Reg', maxScore: 10, description: 'Professional Registration (NMC/HCPC)' },
  { key: 'msc', label: 'MSc', maxScore: 10, description: 'MSc in Advanced Clinical Practice' },
  { key: 'v300', label: 'V300', maxScore: 10, description: 'V300 Independent Prescriber' },
  { key: 'acpExperience', label: 'ACP', maxScore: 10, description: 'ACP Experience' },
  { key: 'primaryCare', label: 'PC', maxScore: 10, description: 'Primary Care Experience' },
  { key: 'clinicalSkills', label: 'Clin', maxScore: 10, description: 'Clinical Skills' },
  { key: 'leadership', label: 'Lead', maxScore: 10, description: 'Leadership & Governance' },
  { key: 'teaching', label: 'Teach', maxScore: 10, description: 'Teaching & Mentoring' },
  { key: 'flexibility', label: 'Flex', maxScore: 10, description: 'Flexibility & Availability' },
  { key: 'systemsKnowledge', label: 'Sys', maxScore: 10, description: 'NHS Systems Knowledge' },
];

export const recruitmentSummary: RecruitmentSummary = {
  totalApplications: 9,
  interviewRecommended: 3,
  consider: 2,
  doNotShortlist: 4,
  sources: {
    indeed: 7,
    nhsJobs: 2,
  },
  assessmentDate: '2026-01-05',
};

// All 9 candidates with scoring data
export const allCandidates: ACPCandidate[] = [
  {
    id: 'ACP-2026-001',
    score: 94,
    registration: 'NMC',
    registrationDetails: 'Adult Nursing',
    mscStatus: 'Completed (2021)',
    prescriber: 'V300 Independent Prescriber',
    currentRole: 'Advanced Nurse Practitioner in Primary Care',
    acpExperience: '5+ years as qualified ACP',
    settings: ['General Practice', 'Urgent Care', 'Community Services'],
    keyRoles: [
      'Autonomous same-day urgent care consultations',
      'Complex chronic disease management (diabetes, COPD, heart failure)',
      'Clinical supervision of trainee ANPs',
      'Quality improvement lead for urgent care pathway',
      'Minor illness and injury management',
    ],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'NMC registered Adult Nurse' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 10, evidence: 'MSc completed 2021' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 10, evidence: 'Independent prescriber confirmed' },
      { criterion: 'ACP Experience', maxScore: 10, score: 10, evidence: '5+ years qualified ACP experience' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 10, evidence: 'Extensive GP and community experience' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 9, evidence: 'Broad clinical competencies demonstrated' },
      { criterion: 'Leadership', maxScore: 10, score: 9, evidence: 'QI lead, supervises trainees' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 8, evidence: 'Clinical supervisor for ANP trainees' },
      { criterion: 'Flexibility', maxScore: 10, score: 9, evidence: 'Available for flexible working patterns' },
      { criterion: 'NHS Systems', maxScore: 10, score: 9, evidence: 'Strong NHS primary care systems knowledge' },
    ],
    strengths: [
      'Exceptional primary care experience with autonomous practice',
      'Strong clinical governance and quality improvement background',
      'Proven track record in urgent care settings',
      'Excellent teaching and supervisory skills',
      'Flexible and available for immediate start',
    ],
    concerns: [],
    interviewQuestions: [
      'Describe your approach to managing complex multimorbidity in primary care',
      'How would you contribute to service development in a neighbourhood model?',
      'What experience do you have with clinical audit and quality improvement?',
    ],
    recommendation: 'strongly-recommend',
  },
  {
    id: 'ACP-2026-002',
    score: 89,
    registration: 'HCPC',
    registrationDetails: 'Paramedic',
    mscStatus: 'Completed (2022)',
    prescriber: 'V300 Independent Prescriber',
    currentRole: 'Advanced Clinical Practitioner - Urgent Care',
    acpExperience: '3 years as qualified ACP',
    settings: ['Urgent Treatment Centre', 'Emergency Department', 'Primary Care'],
    keyRoles: [
      'Lead clinician in urgent treatment centre',
      'Autonomous assessment and treatment of undifferentiated presentations',
      'Clinical educator for paramedic students',
      'Pathway development for minor injuries',
      'Multi-agency safeguarding lead',
    ],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'HCPC registered Paramedic' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 10, evidence: 'MSc completed 2022' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 10, evidence: 'Independent prescriber confirmed' },
      { criterion: 'ACP Experience', maxScore: 10, score: 8, evidence: '3 years qualified ACP' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 7, evidence: 'Some primary care exposure, mainly urgent care' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 9, evidence: 'Strong acute assessment skills' },
      { criterion: 'Leadership', maxScore: 10, score: 9, evidence: 'UTC lead, safeguarding lead' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 8, evidence: 'Educator for paramedic students' },
      { criterion: 'Flexibility', maxScore: 10, score: 9, evidence: 'Flexible across multiple sites' },
      { criterion: 'NHS Systems', maxScore: 10, score: 9, evidence: 'Good understanding of urgent care pathways' },
    ],
    strengths: [
      'Strong urgent care and acute assessment background',
      'Leadership experience in clinical settings',
      'Excellent safeguarding knowledge',
      'Pathway development experience',
      'Comfortable with undifferentiated presentations',
    ],
    concerns: [
      'Less primary care experience than other candidates',
      'May need support transitioning to general practice model',
    ],
    interviewQuestions: [
      'How would you adapt your urgent care skills to a neighbourhood primary care model?',
      'Describe your experience with chronic disease management',
      'How do you approach clinical decision-making in undifferentiated presentations?',
    ],
    recommendation: 'recommend',
  },
  {
    id: 'ACP-2026-003',
    score: 86,
    registration: 'NMC',
    registrationDetails: 'Adult Nursing',
    mscStatus: 'Completed (2020)',
    prescriber: 'V300 Independent Prescriber',
    currentRole: 'Advanced Nurse Practitioner - Community Services',
    acpExperience: '4 years as qualified ACP',
    settings: ['Community Nursing', 'Care Homes', 'General Practice'],
    keyRoles: [
      'Lead ACP for care home support team',
      'Anticipatory care planning specialist',
      'End of life care coordination',
      'Frailty assessment and management',
      'MDT coordination for complex patients',
    ],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'NMC registered Adult Nurse' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 10, evidence: 'MSc completed 2020' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 10, evidence: 'Independent prescriber confirmed' },
      { criterion: 'ACP Experience', maxScore: 10, score: 9, evidence: '4 years qualified ACP' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 8, evidence: 'Community and care home focus' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 8, evidence: 'Strong in frailty and palliative care' },
      { criterion: 'Leadership', maxScore: 10, score: 8, evidence: 'Team lead, MDT coordinator' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 7, evidence: 'Some teaching experience' },
      { criterion: 'Flexibility', maxScore: 10, score: 8, evidence: 'Available for community-based work' },
      { criterion: 'NHS Systems', maxScore: 10, score: 8, evidence: 'Good community services knowledge' },
    ],
    strengths: [
      'Excellent frailty and end of life care expertise',
      'Strong care home experience - valuable for rural setting',
      'Anticipatory care planning skills',
      'MDT coordination experience',
      'Community-focused practice aligned with neighbourhood model',
    ],
    concerns: [
      'Less experience with acute same-day presentations',
      'May need support with urgent care aspects of role',
    ],
    interviewQuestions: [
      'How would you balance proactive frailty work with same-day urgent care demands?',
      'Describe your approach to anticipatory care planning',
      'What experience do you have with care home enhanced support models?',
    ],
    recommendation: 'recommend',
  },
  {
    id: 'ACP-2026-004',
    score: 72,
    registration: 'NMC',
    registrationDetails: 'Adult Nursing',
    mscStatus: 'In progress (expected 2026)',
    prescriber: 'V300 Independent Prescriber',
    currentRole: 'Senior Practice Nurse transitioning to ANP',
    acpExperience: 'Trainee ACP (18 months)',
    settings: ['General Practice'],
    keyRoles: [
      'Long-term conditions management',
      'Cervical screening and immunisations',
      'Chronic disease reviews',
      'Health promotion clinics',
    ],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'NMC registered Adult Nurse' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 5, evidence: 'MSc in progress, not yet completed' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 10, evidence: 'Independent prescriber confirmed' },
      { criterion: 'ACP Experience', maxScore: 10, score: 4, evidence: 'Trainee ACP only' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 9, evidence: 'Extensive practice nurse experience' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 6, evidence: 'Developing acute assessment skills' },
      { criterion: 'Leadership', maxScore: 10, score: 6, evidence: 'Limited leadership experience' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 6, evidence: 'Some peer support experience' },
      { criterion: 'Flexibility', maxScore: 10, score: 8, evidence: 'Available and keen to develop' },
      { criterion: 'NHS Systems', maxScore: 10, score: 8, evidence: 'Good GP systems knowledge' },
    ],
    strengths: [
      'Strong primary care foundation',
      'Keen to develop and learn',
      'Already has V300 prescribing qualification',
      'Good chronic disease management experience',
    ],
    concerns: [
      'MSc not yet completed - essential requirement',
      'Limited autonomous ACP experience',
      'Would require significant supervision initially',
      'Not yet ready for fully autonomous role',
    ],
    interviewQuestions: [],
    recommendation: 'consider',
    recommendationReason: 'Consider for future once MSc completed. Strong foundation but not yet meeting essential criteria for autonomous ACP role.',
  },
  {
    id: 'ACP-2026-005',
    score: 45,
    registration: 'NMC',
    registrationDetails: 'Adult Nursing',
    mscStatus: 'Not started',
    prescriber: 'V100 Community Practitioner Prescriber',
    currentRole: 'Practice Nurse',
    acpExperience: 'None',
    settings: ['General Practice'],
    keyRoles: ['Chronic disease clinics', 'Immunisations', 'Health checks'],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'NMC registered' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 0, evidence: 'No MSc - essential requirement not met' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 3, evidence: 'V100 only, not independent prescriber' },
      { criterion: 'ACP Experience', maxScore: 10, score: 0, evidence: 'No ACP experience' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 8, evidence: 'Good practice nurse experience' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 5, evidence: 'Practice nurse level skills' },
      { criterion: 'Leadership', maxScore: 10, score: 4, evidence: 'Limited' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 4, evidence: 'Limited' },
      { criterion: 'Flexibility', maxScore: 10, score: 6, evidence: 'Available' },
      { criterion: 'NHS Systems', maxScore: 10, score: 5, evidence: 'Basic' },
    ],
    strengths: ['Primary care experience', 'Enthusiasm to develop'],
    concerns: ['Does not meet essential criteria - no MSc, no V300, no ACP experience'],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'Does not meet essential criteria: No MSc in Advanced Practice, no V300 prescribing, no ACP experience.',
  },
  {
    id: 'ACP-2026-006',
    score: 72,
    registration: 'NMC',
    registrationDetails: 'Dual Registration (RMN + RN Adult)',
    mscStatus: 'Working towards (expected Sept 2028)',
    prescriber: 'V300 status pending verification',
    currentRole: 'Advanced Physical Health Practitioner & Team Manager (Matron) - NHFT',
    acpExperience: '2+ years at advanced practice level',
    settings: ['Mental Health Trust', 'Ambulance Service', 'Acute Trust', 'Community Mental Health'],
    keyRoles: [
      'Advanced Physical Health Practitioner & Team Manager (Matron) - NHFT (Oct 2022-present)',
      'Ambulance Nurse - South Central Ambulance Service (Jan 2022-Oct 2022)',
      'Charge Nurse - NHFT (April 2021-Jan 2022)',
      'Lead Nurse Physical Health - Oxford Health NHS FT (April 2019-April 2021)',
      'Senior CPN - Oxford Health NHS FT (Oct 2017-April 2019)',
    ],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'NMC Active - Dual registration RMN + RN Adult' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 7, evidence: 'Currently undertaking MSc ACP at University of Northampton, completion Sept 2028' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 0, evidence: 'NOT MENTIONED IN APPLICATION - CRITICAL GAP requiring clarification' },
      { criterion: 'ACP Experience', maxScore: 10, score: 8, evidence: 'Current Matron/Team Manager role, advanced assessments, management plans' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 4, evidence: 'Mainly mental health trust and ambulance - limited GP/primary care' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 8, evidence: '999 response, ALS, advanced assessments, clozapine/lithium clinics' },
      { criterion: 'Leadership', maxScore: 10, score: 9, evidence: 'Team Manager/Matron, budget holder, recruitment, QI lead, patient safety lead' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 9, evidence: 'Practice assessor/supervisor, delivers venepuncture/cannulation/ECG training' },
      { criterion: 'Flexibility', maxScore: 10, score: 9, evidence: 'Advanced driving qualification, own car, comfortable travelling between sites' },
      { criterion: 'NHS Systems', maxScore: 10, score: 8, evidence: 'SystmOne, ICE, EPR, Care Notes, Toxbase, JRCALC, Microsoft' },
    ],
    strengths: [
      'Dual registered (RMN + Adult) - valuable for presentations with MH component',
      'Strong leadership - current Matron/Team Manager with budget responsibility',
      'Excellent teaching credentials - practice assessor, delivers clinical skills training',
      'Advanced driving qualification - ideal for multi-site working',
      'Currently undertaking MSc ACP at University of Northampton',
      'Already working in Northamptonshire (NHFT) - local candidate',
      'SystmOne experience confirmed',
      'ALS qualified with emergency ambulance experience',
    ],
    concerns: [
      'V300 Independent Prescriber NOT MENTIONED - CRITICAL GAP requiring immediate clarification',
      'Limited primary care/GP experience - mainly mental health and acute trust settings',
      'MSc completion not until September 2028 (3 years away)',
      'Physical health in mental health setting differs from general practice same-day access',
    ],
    interviewQuestions: [
      'FIRST: Confirm V300 status before any interview consideration',
      'If V300 confirmed: Motivation for moving from mental health to primary care',
      'How mental health skills transfer to undifferentiated same-day presentations',
      'Understanding of general practice model vs mental health trust working',
    ],
    recommendation: 'consider',
    recommendationReason: 'HOLD - Clarify V300 status. If V300 qualified: RECOMMEND FOR INTERVIEW (potential 82/100). If not V300: DO NOT SHORTLIST. Strong leadership and teaching credentials, local candidate.',
  },
  {
    id: 'ACP-2026-007',
    score: 42,
    registration: 'HCPC',
    registrationDetails: 'Physiotherapist',
    mscStatus: 'Completed (MSK Focus)',
    prescriber: 'No prescribing qualification',
    currentRole: 'Advanced Physiotherapy Practitioner',
    acpExperience: '3 years (MSK)',
    settings: ['MSK Clinic', 'Orthopaedics'],
    keyRoles: ['MSK triage', 'Joint injections', 'Physiotherapy assessment'],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'HCPC registered Physio' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 5, evidence: 'MSc but MSK specific' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 0, evidence: 'No prescribing - essential requirement not met' },
      { criterion: 'ACP Experience', maxScore: 10, score: 4, evidence: 'MSK ACP only, narrow scope' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 4, evidence: 'Some FCP work in GP' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 4, evidence: 'MSK only, no general medical' },
      { criterion: 'Leadership', maxScore: 10, score: 5, evidence: 'Some clinical leadership' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 5, evidence: 'Supervises physio students' },
      { criterion: 'Flexibility', maxScore: 10, score: 5, evidence: 'Limited scope of practice' },
      { criterion: 'NHS Systems', maxScore: 10, score: 0, evidence: 'Limited to MSK pathways' },
    ],
    strengths: ['Strong MSK expertise', 'Good for potential FCP role'],
    concerns: ['No prescribing qualification - essential requirement', 'Too narrow scope of practice for generalist ACP', 'Would be better suited to FCP/MSK-specific role'],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'Essential criteria not met: No V300 prescribing. Scope too narrow for generalist ACP role - better suited to FCP/MSK position.',
  },
  {
    id: 'ACP-2026-008',
    score: 35,
    registration: 'NMC',
    registrationDetails: 'Adult Nursing',
    mscStatus: 'Not completed (withdrew from course)',
    prescriber: 'No prescribing qualification',
    currentRole: 'Staff Nurse - Medical Ward',
    acpExperience: 'None',
    settings: ['Acute Hospital Ward'],
    keyRoles: ['Ward nursing', 'Medication administration', 'Patient care'],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'NMC registered' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 0, evidence: 'Withdrew from MSc - essential not met' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 0, evidence: 'No prescribing - essential not met' },
      { criterion: 'ACP Experience', maxScore: 10, score: 0, evidence: 'No ACP experience' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 0, evidence: 'No primary care experience' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 5, evidence: 'Hospital nursing skills only' },
      { criterion: 'Leadership', maxScore: 10, score: 4, evidence: 'Band 5 level' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 4, evidence: 'Limited' },
      { criterion: 'Flexibility', maxScore: 10, score: 6, evidence: 'Available' },
      { criterion: 'NHS Systems', maxScore: 10, score: 6, evidence: 'Hospital systems only' },
    ],
    strengths: ['Registered nurse with hospital experience'],
    concerns: ['Does not meet any essential criteria', 'No MSc (withdrew)', 'No prescribing', 'No ACP or primary care experience'],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'Does not meet essential criteria: No MSc (withdrew from course), no prescribing qualification, no ACP or primary care experience.',
  },
  {
    id: 'ACP-2026-009',
    score: 40,
    registration: 'HCPC',
    registrationDetails: 'Paramedic',
    mscStatus: 'In progress (part-time, expected 2028)',
    prescriber: 'No prescribing qualification',
    currentRole: 'Specialist Paramedic - Primary Care',
    acpExperience: 'None (working towards)',
    settings: ['Ambulance Service', 'Some GP rotations'],
    keyRoles: ['999 response', 'Some GP home visits', 'Urgent assessments'],
    scoringBreakdown: [
      { criterion: 'Professional Registration', maxScore: 10, score: 10, evidence: 'HCPC registered Paramedic' },
      { criterion: 'MSc Advanced Practice', maxScore: 10, score: 3, evidence: 'MSc in progress but 2+ years from completion' },
      { criterion: 'V300 Prescriber', maxScore: 10, score: 0, evidence: 'No prescribing - essential not met' },
      { criterion: 'ACP Experience', maxScore: 10, score: 2, evidence: 'Working towards, not yet ACP' },
      { criterion: 'Primary Care Experience', maxScore: 10, score: 5, evidence: 'Some GP rotations during training' },
      { criterion: 'Clinical Skills', maxScore: 10, score: 6, evidence: 'Good acute assessment from ambulance' },
      { criterion: 'Leadership', maxScore: 10, score: 4, evidence: 'Limited' },
      { criterion: 'Teaching/Mentoring', maxScore: 10, score: 4, evidence: 'Limited' },
      { criterion: 'Flexibility', maxScore: 10, score: 4, evidence: 'Limited by ambulance service commitments' },
      { criterion: 'NHS Systems', maxScore: 10, score: 2, evidence: 'Ambulance systems, limited primary care' },
    ],
    strengths: ['Good acute assessment skills', 'Working towards ACP qualification'],
    concerns: ['MSc not complete until 2028', 'No prescribing qualification', 'Not yet qualified as ACP - too early in training'],
    interviewQuestions: [],
    recommendation: 'do-not-shortlist',
    recommendationReason: 'Not yet ready: MSc not expected until 2028, no prescribing qualification. Encourage to reapply once qualified.',
  },
];

// Helper function to get candidates by recommendation type
export const getCandidatesByRecommendation = (recommendation: ACPCandidate['recommendation']) => {
  return allCandidates.filter(c => c.recommendation === recommendation);
};

// Get shortlisted candidates (recommended or strongly recommended)
export const getShortlistedCandidates = () => {
  return allCandidates.filter(c => 
    c.recommendation === 'strongly-recommend' || 
    c.recommendation === 'recommend'
  );
};

// Get candidates to consider
export const getCandidatesToConsider = () => {
  return allCandidates.filter(c => c.recommendation === 'consider');
};

// Get not shortlisted candidates
export const getNotShortlistedCandidates = () => {
  return allCandidates.filter(c => c.recommendation === 'do-not-shortlist');
};
