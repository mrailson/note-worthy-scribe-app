import { HubConsultation, EscalationEvent, MetricData, PracticePerformance } from '@/types/nresTypes';

const now = new Date();

const createDate = (hoursAgo: number): Date => {
  const date = new Date(now);
  date.setHours(date.getHours() - hoursAgo);
  return date;
};

export const ennMockConsultations: HubConsultation[] = [
  // CRITICAL - >72 hours
  {
    id: 'enn-c001',
    patientInitials: 'A.B.',
    patientDOB: '12/04/1962',
    homePractice: 'Harborough Field Surgery',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Okonkwo',
    testType: 'FBC, U&E, LFTs',
    receivedAt: createDate(80),
    status: 'critical',
    assignedGP: 'Dr. Patel',
    hoursElapsed: 80,
    safetyNetting: 'Patient reported persistent fatigue. Urgent review required if abnormal results.',
    escalationHistory: [
      { id: 'enn-e1', timestamp: createDate(80), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Patel' },
      { id: 'enn-e2', timestamp: createDate(56), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Patel' },
      { id: 'enn-e3', timestamp: createDate(32), type: 'reminder-72hr', message: '72-hour reminder sent to Dr. Patel' },
      { id: 'enn-e4', timestamp: createDate(8), type: 'escalated-96hr', message: 'CRITICAL: Escalated to Practice Manager' }
    ]
  },
  {
    id: 'enn-c002',
    patientInitials: 'C.D.',
    patientDOB: '05/09/1958',
    homePractice: 'Oundle Medical Practice',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Singh',
    testType: 'Chest X-Ray',
    receivedAt: createDate(88),
    status: 'critical',
    assignedGP: 'Dr. Morgan',
    hoursElapsed: 88,
    safetyNetting: 'Chronic cough >3 weeks. Safety net for chest X-ray review within 48 hours.',
    escalationHistory: [
      { id: 'enn-e5', timestamp: createDate(88), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Morgan' },
      { id: 'enn-e6', timestamp: createDate(64), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Morgan' },
      { id: 'enn-e7', timestamp: createDate(40), type: 'reminder-72hr', message: '72-hour reminder sent to Dr. Morgan' },
      { id: 'enn-e8', timestamp: createDate(16), type: 'escalated-96hr', message: 'CRITICAL: Escalated to Practice Manager' }
    ]
  },
  // URGENT - 48-72 hours
  {
    id: 'enn-c003',
    patientInitials: 'E.F.',
    patientDOB: '21/11/1979',
    homePractice: 'Rushden Medical Centre',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Williams',
    testType: 'Lipid Profile',
    receivedAt: createDate(58),
    status: 'overdue',
    assignedGP: 'Dr. Brown',
    hoursElapsed: 58,
    safetyNetting: 'Cardiovascular risk assessment follow-up.',
    escalationHistory: [
      { id: 'enn-e9', timestamp: createDate(58), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Brown' },
      { id: 'enn-e10', timestamp: createDate(34), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Brown' }
    ]
  },
  {
    id: 'enn-c004',
    patientInitials: 'G.H.',
    patientDOB: '17/03/1985',
    homePractice: 'Spinney Brook Medical Centre',
    hubPractice: 'The Cottons Hub',
    clinician: 'Dr. Taylor',
    testType: 'HbA1c',
    receivedAt: createDate(65),
    status: 'overdue',
    assignedGP: 'Dr. Clark',
    hoursElapsed: 65,
    safetyNetting: 'Diabetes monitoring. Patient to return if abnormal.',
    escalationHistory: [
      { id: 'enn-e11', timestamp: createDate(65), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Clark' },
      { id: 'enn-e12', timestamp: createDate(41), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Clark' }
    ]
  },
  {
    id: 'enn-c005',
    patientInitials: 'I.J.',
    patientDOB: '30/07/1972',
    homePractice: 'The Meadows Surgery',
    hubPractice: 'The Meadows Hub',
    clinician: 'Dr. Robinson',
    testType: 'TFTs',
    receivedAt: createDate(52),
    status: 'overdue',
    assignedGP: 'Dr. Hall',
    hoursElapsed: 52,
    safetyNetting: 'Symptoms of hypothyroidism. Review results and consider treatment.',
    escalationHistory: [
      { id: 'enn-e13', timestamp: createDate(52), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Hall' },
      { id: 'enn-e14', timestamp: createDate(28), type: 'reminder-48hr', message: '48-hour reminder sent to Dr. Hall' }
    ]
  },
  // DUE SOON - <48 hours
  {
    id: 'enn-c006',
    patientInitials: 'K.L.',
    patientDOB: '08/01/1990',
    homePractice: 'The Cottons Medical Centre',
    hubPractice: 'The Cottons Hub',
    clinician: 'Dr. Lewis',
    testType: 'FBC',
    receivedAt: createDate(36),
    status: 'pending',
    assignedGP: 'Dr. Evans',
    hoursElapsed: 36,
    safetyNetting: 'Routine blood test follow-up.',
    escalationHistory: [
      { id: 'enn-e15', timestamp: createDate(36), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Evans' }
    ]
  },
  {
    id: 'enn-c007',
    patientInitials: 'M.N.',
    patientDOB: '14/06/1968',
    homePractice: 'Parklands Medical Centre',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Wilson',
    testType: 'U&E',
    receivedAt: createDate(30),
    status: 'pending',
    assignedGP: 'Dr. Thompson',
    hoursElapsed: 30,
    safetyNetting: 'Renal function check.',
    escalationHistory: [
      { id: 'enn-e16', timestamp: createDate(30), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Thompson' }
    ]
  },
  {
    id: 'enn-c008',
    patientInitials: 'O.P.',
    patientDOB: '22/12/1993',
    homePractice: 'Nene Valley Surgery',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Harris',
    testType: 'CRP, ESR',
    receivedAt: createDate(44),
    status: 'pending',
    assignedGP: 'Dr. Adams',
    hoursElapsed: 44,
    safetyNetting: 'Inflammatory markers for joint pain assessment.',
    escalationHistory: [
      { id: 'enn-e17', timestamp: createDate(44), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Adams' }
    ]
  },
  {
    id: 'enn-c009',
    patientInitials: 'Q.R.',
    patientDOB: '03/05/1976',
    homePractice: 'Higham Ferrers Surgery',
    hubPractice: 'The Meadows Hub',
    clinician: 'Dr. Young',
    testType: 'Vitamin D',
    receivedAt: createDate(22),
    status: 'pending',
    assignedGP: 'Dr. White',
    hoursElapsed: 22,
    safetyNetting: 'Check for deficiency.',
    escalationHistory: [
      { id: 'enn-e18', timestamp: createDate(22), type: 'auto-assigned', message: 'Result automatically assigned to Dr. White' }
    ]
  },
  {
    id: 'enn-c010',
    patientInitials: 'S.T.',
    patientDOB: '19/08/1981',
    homePractice: 'Marshalls Road Surgery',
    hubPractice: 'The Cottons Hub',
    clinician: 'Dr. Green',
    testType: 'FBC, Ferritin',
    receivedAt: createDate(40),
    status: 'pending',
    assignedGP: 'Dr. Carter',
    hoursElapsed: 40,
    safetyNetting: 'Anaemia investigation.',
    escalationHistory: [
      { id: 'enn-e19', timestamp: createDate(40), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Carter' }
    ]
  },
  {
    id: 'enn-c011',
    patientInitials: 'U.V.',
    patientDOB: '11/02/1955',
    homePractice: 'Harborough Field Surgery',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Scott',
    testType: 'PSA',
    receivedAt: createDate(18),
    status: 'pending',
    assignedGP: 'Dr. Barnes',
    hoursElapsed: 18,
    safetyNetting: 'Prostate screening follow-up.',
    escalationHistory: [
      { id: 'enn-e20', timestamp: createDate(18), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Barnes' }
    ]
  },
  {
    id: 'enn-c012',
    patientInitials: 'W.X.',
    patientDOB: '26/10/1988',
    homePractice: 'Oundle Medical Practice',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. King',
    testType: 'ECG',
    receivedAt: createDate(34),
    status: 'pending',
    assignedGP: 'Dr. Price',
    hoursElapsed: 34,
    safetyNetting: 'Palpitations assessment.',
    escalationHistory: [
      { id: 'enn-e21', timestamp: createDate(34), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Price' }
    ]
  },
  {
    id: 'enn-c013',
    patientInitials: 'Y.Z.',
    patientDOB: '07/04/1964',
    homePractice: 'Rushden Medical Centre',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Wright',
    testType: 'B12, Folate',
    receivedAt: createDate(26),
    status: 'pending',
    assignedGP: 'Dr. Turner',
    hoursElapsed: 26,
    safetyNetting: 'Neurological symptoms investigation.',
    escalationHistory: [
      { id: 'enn-e22', timestamp: createDate(26), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Turner' }
    ]
  },
  {
    id: 'enn-c014',
    patientInitials: 'B.C.',
    patientDOB: '15/09/1996',
    homePractice: 'Spinney Brook Medical Centre',
    hubPractice: 'The Cottons Hub',
    clinician: 'Dr. Baker',
    testType: 'Urine Culture',
    receivedAt: createDate(14),
    status: 'pending',
    assignedGP: 'Dr. Foster',
    hoursElapsed: 14,
    safetyNetting: 'UTI confirmation.',
    escalationHistory: [
      { id: 'enn-e23', timestamp: createDate(14), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Foster' }
    ]
  },
  {
    id: 'enn-c015',
    patientInitials: 'D.E.',
    patientDOB: '28/03/1970',
    homePractice: 'Parklands Medical Centre',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Phillips',
    testType: 'Bone Profile',
    receivedAt: createDate(42),
    status: 'pending',
    assignedGP: 'Dr. Mitchell',
    hoursElapsed: 42,
    safetyNetting: 'Osteoporosis screening.',
    escalationHistory: [
      { id: 'enn-e24', timestamp: createDate(42), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Mitchell' }
    ]
  },
  {
    id: 'enn-c016',
    patientInitials: 'F.G.',
    patientDOB: '10/07/1983',
    homePractice: 'The Meadows Surgery',
    hubPractice: 'The Meadows Hub',
    clinician: 'Dr. Morris',
    testType: 'Coeliac Screen',
    receivedAt: createDate(20),
    status: 'pending',
    assignedGP: 'Dr. Cooper',
    hoursElapsed: 20,
    safetyNetting: 'GI symptoms investigation.',
    escalationHistory: [
      { id: 'enn-e25', timestamp: createDate(20), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Cooper' }
    ]
  },
  {
    id: 'enn-c017',
    patientInitials: 'H.I.',
    patientDOB: '02/11/1961',
    homePractice: 'Nene Valley Surgery',
    hubPractice: 'Harborough Field Surgery Hub',
    clinician: 'Dr. Reed',
    testType: 'INR',
    receivedAt: createDate(10),
    status: 'pending',
    assignedGP: 'Dr. Bell',
    hoursElapsed: 10,
    safetyNetting: 'Warfarin monitoring.',
    escalationHistory: [
      { id: 'enn-e26', timestamp: createDate(10), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Bell' }
    ]
  },
  {
    id: 'enn-c018',
    patientInitials: 'J.K.',
    patientDOB: '24/06/1992',
    homePractice: 'Higham Ferrers Surgery',
    hubPractice: 'The Meadows Hub',
    clinician: 'Dr. Coleman',
    testType: 'Spirometry',
    receivedAt: createDate(28),
    status: 'pending',
    assignedGP: 'Dr. Howard',
    hoursElapsed: 28,
    safetyNetting: 'COPD monitoring.',
    escalationHistory: [
      { id: 'enn-e27', timestamp: createDate(28), type: 'auto-assigned', message: 'Result automatically assigned to Dr. Howard' }
    ]
  },
];

export const ennMockMetrics: MetricData = {
  outstanding: 18,
  overdue: 5,
  onTimePercentage: 89,
  zeroLostDays: 42,
  trend: 'up'
};

export const ennMockPracticePerformance: PracticePerformance[] = [
  { practice: 'Harborough Field', averageReviewTime: 14, onTimePercentage: 96, outstanding: 3 },
  { practice: 'Oundle', averageReviewTime: 18, onTimePercentage: 93, outstanding: 2 },
  { practice: 'Rushden MC', averageReviewTime: 20, onTimePercentage: 91, outstanding: 2 },
  { practice: 'Spinney Brook', averageReviewTime: 22, onTimePercentage: 88, outstanding: 2 },
  { practice: 'Cottons MC', averageReviewTime: 16, onTimePercentage: 94, outstanding: 1 },
  { practice: 'Parklands', averageReviewTime: 24, onTimePercentage: 86, outstanding: 2 },
  { practice: 'Nene Valley', averageReviewTime: 19, onTimePercentage: 92, outstanding: 2 },
  { practice: 'Marshalls Road', averageReviewTime: 26, onTimePercentage: 84, outstanding: 1 },
  { practice: 'Higham Ferrers', averageReviewTime: 21, onTimePercentage: 90, outstanding: 2 },
  { practice: 'Meadows', averageReviewTime: 17, onTimePercentage: 93, outstanding: 1 },
];

export const ennMockEscalations: EscalationEvent[] = [
  { id: 'enn-esc1', timestamp: createDate(0.5), type: 'escalated-96hr', message: 'CRITICAL: C.D. Chest X-Ray overdue >96 hours - Escalated to Practice Manager' },
  { id: 'enn-esc2', timestamp: createDate(2), type: 'reminder-72hr', message: '72-hour reminder: I.J. TFTs - Dr. Hall' },
  { id: 'enn-esc3', timestamp: createDate(4), type: 'reminder-48hr', message: '48-hour reminder: K.L. FBC - Dr. Evans' },
  { id: 'enn-esc4', timestamp: createDate(6), type: 'auto-assigned', message: 'New result: H.I. INR assigned to Dr. Bell' },
  { id: 'enn-esc5', timestamp: createDate(8), type: 'reviewed', message: 'Result reviewed: L.M. ECG - Dr. Okonkwo (completed)', actor: 'Dr. Okonkwo' },
  { id: 'enn-esc6', timestamp: createDate(10), type: 'reminder-48hr', message: '48-hour reminder: O.P. CRP, ESR - Dr. Adams' },
  { id: 'enn-esc7', timestamp: createDate(12), type: 'auto-assigned', message: 'New result: B.C. Urine Culture assigned to Dr. Foster' }
];
