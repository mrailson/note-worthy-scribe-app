// src/constants/demoData.ts
// Realistic synthetic patient data for AgeWell PSP demo mode
// Keys mapped to existing PatientSupportPlan.jsx SECS field keys

export interface DemoPatient {
  [sectionId: string]: Record<string, string>;
}

// Demo data for questionnaire sections (PHQ-9, GAD-7, 6-CIT, FRAT, ONS4)
export const DEMO_QUESTIONNAIRE_DATA: Record<string, Record<string, number>> = {
  phq9: { 0: 0, 1: 1, 2: 1, 3: 1, 4: 0, 5: 0, 6: 1, 7: 0, 8: 0 }, // Total=4, Minimal
  gad7: { 0: 1, 1: 0, 2: 1, 3: 0, 4: 0, 5: 1, 6: 0 },               // Total=3, Mild
};

export const DEMO_CIT_DATA: Record<number, number> = {
  0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, // Total=2, Normal
};

export const DEMO_FRAT_DATA: Record<number, number> = {
  0: 1, 1: 1, 2: 0, 3: 0, 4: 0, // Total=2, Lower risk
};

export const DEMO_ONS_DATA: Record<string, number> = {
  sat: 7, worth: 8, happy: 6, anx: 3,
};

export interface DemoActionItem {
  s: string;
  p: string;
  d: boolean;
}

export const DEMO_ACTION_PLAN: DemoActionItem[] = [
  { s: "Refer to community hearing assessment service", p: "Sarah Mitchell", d: true },
  { s: "Provide community transport information and timetables", p: "Sarah Mitchell", d: true },
  { s: "Refer David Thompson to Northamptonshire Carers", p: "Sarah Mitchell", d: true },
  { s: "Send information about local lunch clubs and WI groups", p: "Sarah Mitchell", d: false },
  { s: "Follow up on lifeline pendant — son to arrange", p: "David Thompson", d: false },
  { s: "Discuss raised toilet seat at 6-week review", p: "Sarah Mitchell", d: false },
  { s: "Register with energy company priority services", p: "David Thompson", d: false },
  { s: "Apply for Blue Badge — forms provided", p: "David Thompson", d: false },
  { s: "Notify GP surgery of assessment outcomes", p: "Sarah Mitchell", d: true },
  { s: "Schedule 6-week review for 09/05/2026", p: "Sarah Mitchell", d: true },
  { s: "Share support plan summary with patient and son", p: "Sarah Mitchell", d: false },
  { s: "Explore pain management course availability", p: "Sarah Mitchell", d: false },
  { s: "Register with National Grid priority services", p: "David Thompson", d: false },
  { s: "Provide information about get up and go classes", p: "Sarah Mitchell", d: false },
  { s: "Discuss RSV vaccine eligibility with GP", p: "Sarah Mitchell", d: false },
];

export const DEMO_PATIENT: DemoPatient = {
  demo: {
    nhsNumber: "943 281 7205",
    surgery: "Oak Lane Medical Practice",
    pharmacy: "Lloyds Pharmacy, Brackley",
    supportWorker: "Sarah Mitchell",
    title: "Mrs",
    name: "Margaret Elizabeth Thompson",
    preferredName: "Maggie",
    dob: "14/03/1941",
    age: "85",
    phone: "01604 543219",
    address: "12 Elm Close, Brackley, NN13 6AW",
  },
  consent: {
    consentName: "David Thompson",
    relationship: "Son",
    nokPhone: "07700 123456",
    nokEmail: "d.thompson@email.co.uk",
  },
  dates: {
    dateRef: "20/03/2026",
    dateFirst: "26/03/2026",
    dateAssess: "26/03/2026",
    dateMDT: "To be arranged",
    dateReview: "26/06/2026",
  },
  obs: {
    rockwood: "5 — Mildly frail",
    pulse: "76 bpm, regular",
    falls12m: "1 fall (December 2025, no injury sustained). Referred for falls prevention.",
    respRate: "16/min",
    o2sat: "96%",
    temp: "36.4°C",
    bp1sit: "138/82 mmHg",
    bp2sit: "136/80 mmHg",
    bp1stand: "132/78 mmHg",
    bp2stand: "130/76 mmHg",
    tug: "13 seconds. Slight unsteadiness on turning. Used arms of chair to rise.",
  },
  important: {
    important:
      "Staying in my own home — lived here since 1982, all memories here. Seeing grandchildren every Sunday is what I live for. My garden, especially the roses David planted the year we moved in. Independence and familiar surroundings paramount.",
  },
  health: {
    healthNotes:
      "Type 2 Diabetes (diet-controlled + Metformin), Osteoarthritis (bilateral knees — significant morning stiffness, 30 mins to get going), Mild COPD, Hypertension. Worried about falling again after December incident.",
    bones: "No fractures. Bruised hip from December fall, fully resolved.",
    remoteMon: "Not currently discussed. Patient unaware of service — to be explored.",
    painCourse: "4/10 — managed with regular paracetamol, worse in the mornings. May benefit from pain management referral.",
  },
  sleep: {
    sleepRoutine: "Bed approx 22:30. Watches TV in bed. Wakes 06:30.",
    sleepDiff: "Wakes 2-3 times per night for toilet (nocturia). Joint pain when turning in bed. Takes time to resettle.",
    sleepQual: "Fair — approximately 5-6 hours total. Disrupted by nocturia and knee pain.",
  },
  nutrition: {
    nutQual: "Good — diabetic-friendly, home-cooked meals. 3 meals per day, occasionally skips lunch. Good variety.",
    malnourished: "Not currently. Adequate intake overall. Shops with son's help.",
    nutSupps: "Vitamin D 800IU daily. Adequate hydration — 5-6 cups of tea plus water.",
  },
  senses: {
    eyeTest: "September 2025 — mild cataracts noted, monitoring",
    hearTest: "January 2026 — wears hearing aids bilaterally, well-maintained",
    dentist: "March 2025 — partial dentures upper, no issues",
    senseConcerns: "None significant. All regularly reviewed.",
  },
  meds: {
    medWorries:
      "Metformin 500mg BD, Amlodipine 5mg OD, Salbutamol inhaler PRN, Paracetamol 1g QDS PRN. Uses dosette box prepared weekly by pharmacy.",
    medSide: "None reported. Tolerating all medications well.",
    blister: "Yes — dosette box prepared weekly by Lloyds Pharmacy",
    copd: "No COPD rescue pack currently. Salbutamol inhaler PRN only.",
  },
  immun: {
    covid: "November 2025 ✓",
    flu: "October 2025 ✓",
    rsv: "Not yet offered",
    shingles: "Not yet offered — to discuss with GP",
    pneumo: "2023 ✓",
  },
  cont: {
    contFreq: "Nocturia x2-3 per night",
    contUrg: "Occasional urgency, no incontinence",
    contIssues: "Managing independently. No aids required. Opens bowels daily, no concerns.",
  },
  mood: {
    moodNotes:
      "PHQ-9 score 4 (minimal depression). GAD-7 score 3 (minimal anxiety). Generally positive outlook. Enjoys social contact. Close relationship with son and grandchildren. Active in church community.",
    memConcerns: "No significant memory concerns reported. Occasionally forgets where she put things but attributes to normal ageing.",
  },
  home: {
    livesWith: "Lives alone since husband David passed (2019)",
    dwelling: "2-bed bungalow, owner-occupied. Well-maintained.",
    ownership: "Owner-occupied, mortgage-free",
    hazards: "Loose rug in hallway — advised to remove (trip risk). Step at back door — handrail present.",
    stairs: "N/A — bungalow. No stairs.",
    access: "Step at back door needs monitoring. Otherwise good access throughout.",
  },
  mobility: {
    mobFalls: "1 fall in last 6 months (December 2025, no injury). Moderate falls risk. Referred for falls prevention.",
    aidsPlace: "Walking stick (indoor), 4-wheeled rollator (outdoor). Grab rails in bathroom.",
    aidsReq: "Perching stool for kitchen — assessment needed. Current aids adequate.",
    transfers: "Independent with aids. Manages bed transfers. Raised toilet seat in place.",
  },
  support: {
    existSupp:
      "Son David visits 3x weekly (Mon/Wed/Sat) — shopping, household tasks, emotional support. Neighbour Mrs Parker checks daily — welfare check. Weekly cleaner (private arrangement). No formal care package. Managing well with current setup.",
  },
  pcare: {
    pCare: "Independent with bath board. Manages shower independently. Takes longer in mornings due to knee stiffness. Uses long-handled shoe horn.",
    pCareSupp: "No formal care support needed. Fully independent with personal care. Takes pride in appearance.",
  },
  social: {
    socDo: "Church on Sundays (St Peter's), WI monthly meeting, gardening (limited now), grandchildren every Sunday lunch.",
    socWant: "Would like to get back to Thursday coffee morning at church hall. Wants to walk to local shop independently again. Low isolation risk — good social network.",
  },
  transport: {
    ownVeh: "No — gave up driving in 2024. Decision made with family.",
    pubTrans: "Has bus pass but rarely uses due to mobility concerns at bus stops.",
    transDiff: "Relies on son David for appointments and weekly shopping. Would benefit from community transport information.",
  },
  benefits: {
    finIssues: "None — managing well financially. Home is mortgage-free. State Pension plus Attendance Allowance (lower rate).",
    aa: "Yes — lower rate. May now qualify for higher rate given increased care needs. Review recommended.",
    poa: "Yes — Health & Welfare LPA and Property & Financial LPA both in place. David Thompson as attorney.",
  },
  safety: {
    blueBadge: "Not in place — to discuss",
    lifeline: "Not currently — to be discussed given falls history",
    keysafe: "Not in place — recommended",
    smoke: "Working — tested recently",
  },
  safeguard: {
    sgConcerns: "No safeguarding concerns identified.",
    sgSubmitted: "N/A",
  },
  other: {
    otherNotes:
      "85-year-old lady living alone in adapted bungalow with good informal support. Multiple LTCs all well-managed. Main concerns: mobility deterioration, falls risk, morning stiffness. Good mental health and social engagement.",
    refCarers: "Yes — Carers Assessment for son David recommended. Works full-time, managing caring role well but would benefit from formal support.",
    refASC: "Not currently required. Informal support adequate.",
  },
};

// Simulated transcript that builds during the demo
export const DEMO_TRANSCRIPT_LINES = [
  {
    time: "00:00",
    speaker: "clinician" as const,
    text: "Good morning Maggie, lovely to see you. I'm Sarah, your support worker from Brackley PCN. How are you today?",
  },
  {
    time: "00:08",
    speaker: "patient" as const,
    text: "Oh hello love, I'm not too bad thank you. Come in, come in. I've just put the kettle on.",
  },
  {
    time: "00:15",
    speaker: "clinician" as const,
    text: "That's very kind. So Maggie, as I mentioned on the phone, we're going to go through your Patient Support Plan today. It helps us understand how you're doing and what support might help.",
  },
  {
    time: "00:28",
    speaker: "patient" as const,
    text: "Yes, my David said you'd be coming. He worries about me since I had that little fall before Christmas.",
  },
  {
    time: "00:36",
    speaker: "clinician" as const,
    text: "That's understandable. Can you tell me a bit about how you're managing day to day?",
  },
  {
    time: "00:42",
    speaker: "patient" as const,
    text: "Well, I do alright mostly. The mornings are the worst — my knees are so stiff it takes me a good half hour to get going. But once I'm up and about I manage.",
  },
  {
    time: "00:54",
    speaker: "clinician" as const,
    text: "And you're still doing your own cooking and looking after yourself?",
  },
  {
    time: "00:58",
    speaker: "patient" as const,
    text: "Oh yes, I do all my own meals. I'm diabetic so I'm careful with what I eat. Mrs Parker next door pops in every morning to check I'm alright, and David comes three times a week.",
  },
  {
    time: "01:12",
    speaker: "clinician" as const,
    text: "That sounds like a good support network. What matters most to you, Maggie — what's really important in your life right now?",
  },
  {
    time: "01:20",
    speaker: "patient" as const,
    text: "Staying here in my own home, definitely. And seeing my grandchildren — they come every Sunday. I do miss my garden though, I can't do as much as I used to.",
  },
  {
    time: "01:34",
    speaker: "clinician" as const,
    text: "I can see you've got a lovely garden. Would getting to the shop on your own be something you'd like to work towards?",
  },
  {
    time: "01:42",
    speaker: "patient" as const,
    text: "Oh that would be wonderful. It's only five minutes away but I don't trust my legs on my own anymore.",
  },
  {
    time: "01:50",
    speaker: "clinician" as const,
    text: "Let me take some observations if that's alright, Maggie. I'll just pop this cuff on your arm...",
  },
  {
    time: "02:30",
    speaker: "clinician" as const,
    text: "All looking reasonable. BP is 138 over 82, pulse is 76 and regular. Your oxygen levels are 96 percent which is fine for you with your COPD.",
  },
  {
    time: "02:45",
    speaker: "patient" as const,
    text: "Oh good. My GP said my blood pressure was a bit high last time but the tablets seem to be helping.",
  },
  {
    time: "02:55",
    speaker: "clinician" as const,
    text: "Yes, the Amlodipine is doing its job. Now, let me ask about your sleep — how are you sleeping at the moment?",
  },
  {
    time: "03:04",
    speaker: "patient" as const,
    text: "Not brilliantly if I'm honest. I wake up two or three times to go to the loo, and sometimes my knees ache when I turn over. I probably get about five or six hours.",
  },
  {
    time: "03:18",
    speaker: "clinician" as const,
    text: "And how's your mood been? Sometimes when sleep isn't great and mobility is a worry, it can affect how we're feeling generally.",
  },
  {
    time: "03:28",
    speaker: "patient" as const,
    text: "I'm alright really. I have my down days but I've got good people around me. The church keeps me busy on Sundays and I go to the WI once a month. I'm not one for sitting about feeling sorry for myself.",
  },
  {
    time: "03:45",
    speaker: "clinician" as const,
    text: "That's great to hear. Now Maggie, I think there are a few things we could put in place to help. I'd like to refer you to the community physiotherapy team to help strengthen your knees and reduce the falls risk. How does that sound?",
  },
  {
    time: "04:00",
    speaker: "patient" as const,
    text: "Oh yes please, that would be lovely. Anything to help me get about more confidently.",
  },
  {
    time: "04:08",
    speaker: "clinician" as const,
    text: "Wonderful. I've also noticed you've got a loose rug in the hallway — that's a trip hazard we should sort out. And I think we should look at getting you a perching stool for the kitchen so you're not standing for long periods.",
  },
  {
    time: "04:22",
    speaker: "patient" as const,
    text: "David's been saying about that rug for months. I'll get him to take it up this weekend. And yes, a stool would be handy — my legs do ache after cooking.",
  },
  {
    time: "04:35",
    speaker: "clinician" as const,
    text: "Perfect. I'll also look into whether your Attendance Allowance could be reviewed — you may qualify for the higher rate now. And I think it would be good to arrange a Carers Assessment for David too, just to make sure he's getting the support he needs.",
  },
  {
    time: "04:50",
    speaker: "patient" as const,
    text: "He'd appreciate that. He does a lot for me and he works full-time too. I don't want him wearing himself out.",
  },
  {
    time: "05:00",
    speaker: "clinician" as const,
    text: "Absolutely. So let me just summarise what we've agreed today, and I'll write this all up for you and your GP...",
  },
];
