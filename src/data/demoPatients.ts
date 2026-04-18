export interface DemoPatient {
  id: string;
  titleKeywords: string[];     // match meeting title to patient
  salutation: string;          // Mrs, Mr, Dr
  fullName: string;            // Dorothy Margaret Pearson
  preferredName: string;       // Dot
  dob: string;                 // 15/03/1942
  age: number;
  gender: string;              // Female
  nhsNumber: string;           // 438 291 7654 (with spaces)
  address: string;             // 14 Primrose Lane, Towcester NN12 6BH
  phone: string;               // 01327 325 591
  registeredGp: string;        // Dr A Patel
  practice: string;            // Towcester Medical Centre
  odsCode: string;             // K81039
  gpSystem: 'SystmOne' | 'EMIS';
  nextOfKin: {
    name: string;
    relationship: string;
    phone: string;
    lpa?: string;              // "Health & Finance"
  };
  clinicalFlags: Array<{
    label: string;
    tone: 'amber' | 'red' | 'blue' | 'grey';
  }>;
  visit: {
    date: string;              // 15 Apr 2026
    type: string;              // Home Frailty Review
    worker: string;            // Sarah Mitchell
    workerRole: string;        // AgeWell Support Worker
    location: string;          // Patient's home
  };
  initials: string;            // DP
  avatarColor: string;         // #1B3A5C
  supportPlan?: {
    filename: string;
    path: string;
    pages: number;
    size_kb: number;
    generated_at: string;       // ISO
    sections_populated: number; // About-the-Patient narrative sections
    action_plan_rows: number;
    generated_by_notewell: boolean;
  };
}

export const DEMO_PATIENTS: DemoPatient[] = [
  {
    id: 'dot-pearson',
    titleKeywords: ['ageing well', 'agewell', 'dorothy pearson', 'dot pearson'],
    salutation: 'Mrs',
    fullName: 'Dorothy Margaret Pearson',
    preferredName: 'Dot',
    dob: '15/03/1942',
    age: 84,
    gender: 'Female',
    nhsNumber: '438 291 7654',
    address: '14 Primrose Lane, Towcester NN12 6BH',
    phone: '01327 325 591',
    registeredGp: 'Dr A Patel',
    practice: 'Towcester Medical Centre',
    odsCode: 'K81039',
    gpSystem: 'SystmOne',
    nextOfKin: {
      name: 'Sandra Williams',
      relationship: 'Daughter',
      phone: '07709 864 321',
      lpa: 'Health & Finance',
    },
    clinicalFlags: [
      { label: 'Falls Risk × 2', tone: 'red' },
      { label: 'Postural Hypotension', tone: 'amber' },
      { label: 'Rockwood 5 — Mildly Frail', tone: 'amber' },
      { label: 'Bereaved (18/12)', tone: 'blue' },
      { label: 'LPA in place', tone: 'grey' },
    ],
    visit: {
      date: '15 Apr 2026',
      type: 'Home Frailty Review',
      worker: 'Sarah Mitchell',
      workerRole: 'AgeWell Support Worker',
      location: "Patient's home",
    },
    initials: 'DP',
    avatarColor: '#1B3A5C',
    supportPlan: {
      filename: 'AgeWell_PSP_Dorothy_Pearson_Support_Plan.docx',
      path: '/demo/support-plan/AgeWell_PSP_Dorothy_Pearson_Populated.docx',
      pages: 10,
      size_kb: 140,
      generated_at: '2026-04-16T17:40:00Z',
      sections_populated: 18,
      action_plan_rows: 15,
      generated_by_notewell: true,
    },
  },
];

export function getDemoPatientForMeeting(meeting: {
  title: string;
  folder?: string;
  folders?: string[];
}): DemoPatient | null {
  const folders = meeting.folders || (meeting.folder ? [meeting.folder] : []);
  const isDemoFolder = folders.some(f =>
    f.toLowerCase().includes('demonstration')
  );
  if (!isDemoFolder) return null;

  const title = meeting.title.toLowerCase();
  return DEMO_PATIENTS.find(p =>
    p.titleKeywords.some(k => title.includes(k))
  ) || null;
}
