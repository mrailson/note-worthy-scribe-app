import { HubConsultation, EscalationEvent, MetricData, PracticePerformance } from '@/types/nresTypes';

const now = new Date();

const createDate = (hoursAgo: number): Date => {
  const date = new Date(now);
  date.setHours(date.getHours() - hoursAgo);
  return date;
};

export const mockConsultations: HubConsultation[] = [
  // CRITICAL - >72 hours
  {
    id: 'c001',
    patientInitials: 'J.S.',
    patientDOB: '15/03/1967',
    homePractice: 'Towcester MC',
    hubPractice: 'Brackley MC',
    clinician: 'Dr. Ahmed',
    testType: 'FBC, U&E, LFTs',
    receivedAt: createDate(78),
    status: 'critical',
    assignedGP: 'Dr. Williams',
    hoursElapsed: 78,
    safetyNetting: 'Patient reported fatigue and weight loss. Urgent review required if abnormal results.',
    escalationHistory: [
      { id: 'e1', timestamp: createDate(78), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Williams' },
      { id: 'e2', timestamp: createDate(54), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Williams' },
      { id: 'e3', timestamp: createDate(30), type: 'reminder-72hr', message: '72-hour reminder sent to Dr. Williams' },
      { id: 'e4', timestamp: createDate(6), type: 'escalated-96hr', message: 'CRITICAL: Escalated to Practice Manager' }
    ]
  },
  {
    id: 'c002',
    patientInitials: 'M.P.',
    patientDOB: '22/11/1954',
    homePractice: 'Springfield',
    hubPractice: 'Parks MC',
    clinician: 'Dr. Chen',
    testType: 'Chest X-Ray',
    receivedAt: createDate(85),
    status: 'critical',
    assignedGP: 'Dr. Thompson',
    hoursElapsed: 85,
    safetyNetting: 'Chronic cough >3 weeks. Safety net for chest X-ray review within 48 hours.',
    escalationHistory: [
      { id: 'e5', timestamp: createDate(85), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Thompson' },
      { id: 'e6', timestamp: createDate(61), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Thompson' },
      { id: 'e7', timestamp: createDate(37), type: 'reminder-72hr', message: '72-hour reminder sent to Dr. Thompson' },
      { id: 'e8', timestamp: createDate(13), type: 'escalated-96hr', message: 'CRITICAL: Escalated to Practice Manager' }
    ]
  },

  // URGENT - 48-72 hours
  {
    id: 'c003',
    patientInitials: 'R.B.',
    patientDOB: '08/07/1982',
    homePractice: 'Bugbrooke',
    hubPractice: 'Denton',
    clinician: 'Dr. Patel',
    testType: 'Lipid Profile',
    receivedAt: createDate(55),
    status: 'overdue',
    assignedGP: 'Dr. Jackson',
    hoursElapsed: 55,
    safetyNetting: 'Follow-up for cardiovascular risk assessment.',
    escalationHistory: [
      { id: 'e9', timestamp: createDate(55), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Jackson' },
      { id: 'e10', timestamp: createDate(31), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Jackson' }
    ]
  },
  {
    id: 'c004',
    patientInitials: 'A.W.',
    patientDOB: '19/02/1990',
    homePractice: 'Brook',
    hubPractice: 'Towcester MC',
    clinician: 'Dr. Miller',
    testType: 'HbA1c',
    receivedAt: createDate(62),
    status: 'overdue',
    assignedGP: 'Dr. Davies',
    hoursElapsed: 62,
    safetyNetting: 'Diabetes monitoring. Patient to return if abnormal.',
    escalationHistory: [
      { id: 'e11', timestamp: createDate(62), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Davies' },
      { id: 'e12', timestamp: createDate(38), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Davies' }
    ]
  },
  {
    id: 'c005',
    patientInitials: 'L.H.',
    patientDOB: '30/05/1975',
    homePractice: 'Denton',
    hubPractice: 'Brackley MC',
    clinician: 'Dr. Robinson',
    testType: 'TFTs',
    receivedAt: createDate(50),
    status: 'overdue',
    assignedGP: 'Dr. Singh',
    hoursElapsed: 50,
    safetyNetting: 'Symptoms of hypothyroidism. Review results and consider treatment.',
    escalationHistory: [
      { id: 'e13', timestamp: createDate(50), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Singh' },
      { id: 'e14', timestamp: createDate(26), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Singh' }
    ]
  },

  // DUE SOON - <48 hours (18 more)
  {
    id: 'c006',
    patientInitials: 'S.K.',
    patientDOB: '12/09/1988',
    homePractice: 'Towcester MC',
    hubPractice: 'Parks MC',
    clinician: 'Dr. Lewis',
    testType: 'FBC',
    receivedAt: createDate(35),
    status: 'pending',
    assignedGP: 'Dr. Brown',
    hoursElapsed: 35,
    safetyNetting: 'Routine blood test follow-up.',
    escalationHistory: [
      { id: 'e15', timestamp: createDate(35), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Brown' }
    ]
  },
  {
    id: 'c007',
    patientInitials: 'T.M.',
    patientDOB: '25/01/1963',
    homePractice: 'Brackley MC',
    hubPractice: 'Springfield',
    clinician: 'Dr. Wilson',
    testType: 'U&E',
    receivedAt: createDate(28),
    status: 'pending',
    assignedGP: 'Dr. Taylor',
    hoursElapsed: 28,
    safetyNetting: 'Renal function check.',
    escalationHistory: [
      { id: 'e16', timestamp: createDate(28), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Taylor' }
    ]
  },
  {
    id: 'c008',
    patientInitials: 'N.G.',
    patientDOB: '03/12/1995',
    homePractice: 'Springfield',
    hubPractice: 'Bugbrooke',
    clinician: 'Dr. Harris',
    testType: 'CRP, ESR',
    receivedAt: createDate(42),
    status: 'pending',
    assignedGP: 'Dr. Clark',
    hoursElapsed: 42,
    safetyNetting: 'Inflammatory markers for joint pain assessment.',
    escalationHistory: [
      { id: 'e17', timestamp: createDate(42), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Clark' }
    ]
  },
  {
    id: 'c009',
    patientInitials: 'P.D.',
    patientDOB: '17/06/1971',
    homePractice: 'Parks MC',
    hubPractice: 'Denton',
    clinician: 'Dr. Young',
    testType: 'Vitamin D',
    receivedAt: createDate(20),
    status: 'pending',
    assignedGP: 'Dr. White',
    hoursElapsed: 20,
    safetyNetting: 'Check for deficiency.',
    escalationHistory: [
      { id: 'e18', timestamp: createDate(20), type: 'auto-assigned', message: 'Result automatically assigned to Dr. White' }
    ]
  },
  {
    id: 'c010',
    patientInitials: 'K.R.',
    patientDOB: '29/04/1980',
    homePractice: 'Bugbrooke',
    hubPractice: 'Brook',
    clinician: 'Dr. Green',
    testType: 'FBC, Ferritin',
    receivedAt: createDate(38),
    status: 'pending',
    assignedGP: 'Dr. Evans',
    hoursElapsed: 38,
    safetyNetting: 'Anaemia investigation.',
    escalationHistory: [
      { id: 'e19', timestamp: createDate(38), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Evans' }
    ]
  },
  {
    id: 'c011',
    patientInitials: 'D.L.',
    patientDOB: '11/08/1959',
    homePractice: 'Denton',
    hubPractice: 'Towcester MC',
    clinician: 'Dr. Scott',
    testType: 'PSA',
    receivedAt: createDate(15),
    status: 'pending',
    assignedGP: 'Dr. Adams',
    hoursElapsed: 15,
    safetyNetting: 'Prostate screening follow-up.',
    escalationHistory: [
      { id: 'e20', timestamp: createDate(15), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Adams' }
    ]
  },
  {
    id: 'c012',
    patientInitials: 'F.C.',
    patientDOB: '06/10/1992',
    homePractice: 'Brook',
    hubPractice: 'Brackley MC',
    clinician: 'Dr. King',
    testType: 'ECG',
    receivedAt: createDate(32),
    status: 'pending',
    assignedGP: 'Dr. Hall',
    hoursElapsed: 32,
    safetyNetting: 'Palpitations assessment.',
    escalationHistory: [
      { id: 'e21', timestamp: createDate(32), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Hall' }
    ]
  },
  {
    id: 'c013',
    patientInitials: 'H.T.',
    patientDOB: '23/03/1968',
    homePractice: 'Springfield',
    hubPractice: 'Parks MC',
    clinician: 'Dr. Wright',
    testType: 'B12, Folate',
    receivedAt: createDate(25),
    status: 'pending',
    assignedGP: 'Dr. Turner',
    hoursElapsed: 25,
    safetyNetting: 'Neurological symptoms investigation.',
    escalationHistory: [
      { id: 'e22', timestamp: createDate(25), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Turner' }
    ]
  },
  {
    id: 'c014',
    patientInitials: 'V.S.',
    patientDOB: '14/07/1985',
    homePractice: 'Towcester MC',
    hubPractice: 'Springfield',
    clinician: 'Dr. Baker',
    testType: 'Urine Culture',
    receivedAt: createDate(18),
    status: 'pending',
    assignedGP: 'Dr. Carter',
    hoursElapsed: 18,
    safetyNetting: 'UTI confirmation.',
    escalationHistory: [
      { id: 'e23', timestamp: createDate(18), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Carter' }
    ]
  },
  {
    id: 'c015',
    patientInitials: 'B.N.',
    patientDOB: '09/11/1973',
    homePractice: 'Brackley MC',
    hubPractice: 'Bugbrooke',
    clinician: 'Dr. Phillips',
    testType: 'Bone Profile',
    receivedAt: createDate(40),
    status: 'pending',
    assignedGP: 'Dr. Mitchell',
    hoursElapsed: 40,
    safetyNetting: 'Osteoporosis screening.',
    escalationHistory: [
      { id: 'e24', timestamp: createDate(40), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Mitchell' }
    ]
  },
  {
    id: 'c016',
    patientInitials: 'G.W.',
    patientDOB: '27/05/1987',
    homePractice: 'Parks MC',
    hubPractice: 'Denton',
    clinician: 'Dr. Morris',
    testType: 'Coeliac Screen',
    receivedAt: createDate(22),
    status: 'pending',
    assignedGP: 'Dr. Cooper',
    hoursElapsed: 22,
    safetyNetting: 'GI symptoms investigation.',
    escalationHistory: [
      { id: 'e25', timestamp: createDate(22), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Cooper' }
    ]
  },
  {
    id: 'c017',
    patientInitials: 'E.F.',
    patientDOB: '02/02/1966',
    homePractice: 'Bugbrooke',
    hubPractice: 'Brook',
    clinician: 'Dr. Morgan',
    testType: 'Glucose Tolerance Test',
    receivedAt: createDate(36),
    status: 'pending',
    assignedGP: 'Dr. Bell',
    hoursElapsed: 36,
    safetyNetting: 'Pre-diabetes assessment.',
    escalationHistory: [
      { id: 'e26', timestamp: createDate(36), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Bell' }
    ]
  },
  {
    id: 'c018',
    patientInitials: 'O.J.',
    patientDOB: '19/09/1994',
    homePractice: 'Denton',
    hubPractice: 'Towcester MC',
    clinician: 'Dr. Reed',
    testType: 'INR',
    receivedAt: createDate(12),
    status: 'pending',
    assignedGP: 'Dr. Barnes',
    hoursElapsed: 12,
    safetyNetting: 'Warfarin monitoring.',
    escalationHistory: [
      { id: 'e27', timestamp: createDate(12), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Barnes' }
    ]
  },
  {
    id: 'c019',
    patientInitials: 'I.M.',
    patientDOB: '05/12/1981',
    homePractice: 'Brook',
    hubPractice: 'Brackley MC',
    clinician: 'Dr. Coleman',
    testType: 'Spirometry',
    receivedAt: createDate(29),
    status: 'pending',
    assignedGP: 'Dr. Price',
    hoursElapsed: 29,
    safetyNetting: 'COPD monitoring.',
    escalationHistory: [
      { id: 'e28', timestamp: createDate(29), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Price' }
    ]
  },
  {
    id: 'c020',
    patientInitials: 'C.A.',
    patientDOB: '16/04/1977',
    homePractice: 'Springfield',
    hubPractice: 'Parks MC',
    clinician: 'Dr. Hughes',
    testType: 'Mammogram',
    receivedAt: createDate(44),
    status: 'pending',
    assignedGP: 'Dr. Foster',
    hoursElapsed: 44,
    safetyNetting: 'Breast screening follow-up.',
    escalationHistory: [
      { id: 'e29', timestamp: createDate(44), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Foster' }
    ]
  },
  {
    id: 'c021',
    patientInitials: 'Y.P.',
    patientDOB: '21/01/1969',
    homePractice: 'Towcester MC',
    hubPractice: 'Springfield',
    clinician: 'Dr. Gray',
    testType: 'Skin Biopsy',
    receivedAt: createDate(10),
    status: 'pending',
    assignedGP: 'Dr. Ross',
    hoursElapsed: 10,
    safetyNetting: 'Lesion assessment.',
    escalationHistory: [
      { id: 'e30', timestamp: createDate(10), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Ross' }
    ]
  },
  {
    id: 'c022',
    patientInitials: 'Q.V.',
    patientDOB: '08/06/1991',
    homePractice: 'Brackley MC',
    hubPractice: 'Bugbrooke',
    clinician: 'Dr. Ward',
    testType: 'Allergy Panel',
    receivedAt: createDate(33),
    status: 'pending',
    assignedGP: 'Dr. Perry',
    hoursElapsed: 33,
    safetyNetting: 'Allergic reaction investigation.',
    escalationHistory: [
      { id: 'e31', timestamp: createDate(33), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Perry' }
    ]
  },
  {
    id: 'c023',
    patientInitials: 'U.Z.',
    patientDOB: '13/10/1984',
    homePractice: 'Parks MC',
    hubPractice: 'Denton',
    clinician: 'Dr. Richardson',
    testType: 'Stool Sample',
    receivedAt: createDate(8),
    status: 'pending',
    assignedGP: 'Dr. Howard',
    hoursElapsed: 8,
    safetyNetting: 'GI infection check.',
    escalationHistory: [
      { id: 'e32', timestamp: createDate(8), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Howard' }
    ]
  }
];

export const mockMetrics: MetricData = {
  outstanding: 23,
  overdue: 5,
  onTimePercentage: 92,
  zeroLostDays: 156,
  trend: 'up'
};

export const mockPracticePerformance: PracticePerformance[] = [
  { practice: 'Denton', averageReviewTime: 12, onTimePercentage: 98, outstanding: 2 },
  { practice: 'Bugbrooke', averageReviewTime: 16, onTimePercentage: 95, outstanding: 3 },
  { practice: 'Towcester MC', averageReviewTime: 18, onTimePercentage: 93, outstanding: 4 },
  { practice: 'Brackley MC', averageReviewTime: 20, onTimePercentage: 91, outstanding: 4 },
  { practice: 'Brook', averageReviewTime: 22, onTimePercentage: 89, outstanding: 3 },
  { practice: 'Parks MC', averageReviewTime: 24, onTimePercentage: 87, outstanding: 4 },
  { practice: 'Springfield', averageReviewTime: 30, onTimePercentage: 82, outstanding: 3 }
];

export const mockEscalations: EscalationEvent[] = [
  { id: 'esc1', timestamp: createDate(0.5), type: 'escalated-96hr', message: 'CRITICAL: M.P. Chest X-Ray overdue >96 hours - Escalated to Practice Manager' },
  { id: 'esc2', timestamp: createDate(2), type: 'reminder-72hr', message: '72-hour reminder: L.H. TFTs - Dr. Singh' },
  { id: 'esc3', timestamp: createDate(4), type: 'reminder-48hr', message: '48-hour reminder: S.K. FBC - Dr. Brown' },
  { id: 'esc4', timestamp: createDate(6), type: 'auto-assigned', message: 'New result: Y.P. Skin Biopsy assigned to Dr. Ross' },
  { id: 'esc5', timestamp: createDate(8), type: 'reviewed', message: 'Result reviewed: T.L. ECG - Dr. Martin (completed)', actor: 'Dr. Martin' },
  { id: 'esc6', timestamp: createDate(10), type: 'reminder-48hr', message: '48-hour reminder: N.G. CRP, ESR - Dr. Clark' },
  { id: 'esc7', timestamp: createDate(12), type: 'auto-assigned', message: 'New result: U.Z. Stool Sample assigned to Dr. Howard' }
];
