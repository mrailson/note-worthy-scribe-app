import { useState } from "react";

// Demo data - in production this would come from the assessment API
const patientData = {
  demographics: {
    nhsNumber: "943 281 7205",
    title: "Mrs",
    name: "Margaret Elizabeth Thompson",
    preferredName: "Maggie",
    dob: "14/03/1941",
    age: 85,
    phone: "01604 543219",
    address: "12 Elm Close, Brackley, NN13 6AW",
    surgery: "Oak Lane Medical Practice",
    pharmacy: "Lloyds Pharmacy, Brackley",
    supportWorker: "Sarah Mitchell",
    consentName: "David Thompson",
    consentRelationship: "Son",
    consentPhone: "07891 234567",
    consentEmail: "david.thompson@email.com",
  },
  dates: {
    referral: "12/02/2026",
    firstContact: "18/02/2026",
    assessment: "28/03/2026",
    mdt: "Pending",
    sixWeekReview: "09/05/2026",
  },
  scores: {
    phq2: { score: 1, max: 6, label: "No signs of depression" },
    phq9: { score: 4, max: 27, severity: "Minimal", label: "Below threshold" },
    gad7: { score: 3, max: 21, severity: "Mild", label: "Mild anxiety" },
    sixCit: { score: 2, max: 28, severity: "Normal", label: "No cognitive concerns" },
    frat: { score: 2, max: 5, severity: "Lower risk", label: "Lower falls risk" },
    ons4: {
      lifeSatisfaction: 7,
      worthwhile: 8,
      happiness: 6,
      anxiety: 3,
    },
    rockwood: 4,
    uclaLoneliness: 4,
  },
  observations: {
    pulse: 72,
    respiratoryRate: 16,
    oxygenSaturation: "97%",
    temperature: "36.4°C",
    bp1Sitting: "138/82",
    bp2Sitting: "135/80",
    bp1Standing: "130/78",
    bp2Standing: "128/76",
    timedGetUpAndGo: "14 seconds",
    fallsLast12Months: 1,
  },
  aboutPatient: {
    importantToThem: "Staying independent at home. Seeing grandchildren regularly. Continuing to tend her garden.",
    health: "Osteoarthritis in both knees. Type 2 diabetes managed with Metformin. Mild COPD. No previous broken bones. Not currently on remote monitoring. Interested in the pain course.",
    sleep: "Generally sleeps well but wakes 1-2 times per night. Goes to bed around 10pm, rises at 7am. Occasionally finds it hard to fall back asleep.",
    nutrition: "Good appetite. Eats regular meals. Son brings shopping weekly. No concerns about malnutrition. No supplements currently.",
    lastChecks: "Eye test: October 2025. Hearing test: Never. Dentist: March 2025. No immediate concerns but would benefit from hearing assessment.",
    medication: "Takes 5 medications daily. No reported side effects. Uses blister pack from Lloyds Pharmacy with weekly delivery. Has COPD rescue pack. No concerns about compliance.",
    immunisations: "Covid-19: Up to date (Autumn 2025). Flu: October 2025. RSV: Not yet offered. Shingles: Completed. Pneumococcal: Completed.",
    continence: "Occasional urgency. No products currently used. Able to access toilet independently. No issues discussed.",
  },
  moodAndCognition: {
    phq9Responses: [0, 1, 1, 1, 0, 0, 1, 0, 0],
    gad7Responses: [1, 0, 1, 0, 0, 1, 0],
    sixCitResponses: [0, 0, 0, 0, 0, 2],
    moodNotes: "Generally positive outlook. Mild worry about managing at home long-term. No memory concerns reported by patient or son.",
  },
  homeAndMobility: {
    livingSituation: "Lives alone. Son David visits 2-3 times per week.",
    dwelling: "Semi-detached bungalow, privately owned.",
    hazards: "No clutter. Well-maintained. Small step at front door — handrail in place.",
    stairs: "No stairs — bungalow. One step at front and back doors.",
    mobility: "Walks with a stick outdoors. Independent indoors. Manages transfers independently. Gets in/out of bed without difficulty.",
    aids: "Walking stick (in place). Grab rails in bathroom (in place). Perching stool in kitchen (in place).",
    aidsRequired: "Raised toilet seat discussed — patient will consider.",
    adaptations: "Wet room already installed. Key safe in place.",
  },
  support: {
    existingSupport: "Son David — shopping, garden, transport. Neighbour Jean — checks in daily. No formal carers. No social worker involvement.",
    personalCare: "Fully independent with bathing (uses wet room), dressing, and getting in/out of bed. No support needed currently.",
    householdChores: "Son helps with heavy cleaning, garden, and bins. Patient manages light cleaning, laundry, and cooking independently.",
    socialActivities: "Attends church on Sundays. Used to enjoy the WI but stopped during Covid. Would like to restart a social group. Enjoys reading and gardening.",
    transport: "No own vehicle. Son drives her for appointments and shopping. Uses community transport occasionally. Would benefit from regular community transport info.",
  },
  safetyAndBenefits: {
    benefitsCheck: "Receives Attendance Allowance. No issues managing finances. Son has LPA for Health and Finance.",
    priorityRegisters: "Registered with Anglian Water. Not registered with energy or National Grid — information given.",
    blueBadge: "Not in place. Discussed — information given to apply.",
    lifeline: "Not in place. Discussed — son to arrange.",
    keySafe: "In place.",
    smokeAlarms: "Installed and working. Fire safety check completed 2025.",
    poa: "Health and Finance LPA in place (David Thompson).",
    safeguarding: "No concerns identified.",
    anythingElse: "Patient would like information about local lunch clubs. Care directory provided. No referral to ASC needed at this time. Referred to Northamptonshire Carers for son David.",
  },
  actionPlan: [
    { action: "Refer to community hearing assessment service", person: "Sarah Mitchell", completed: true },
    { action: "Provide community transport information and timetables", person: "Sarah Mitchell", completed: true },
    { action: "Refer David Thompson to Northamptonshire Carers", person: "Sarah Mitchell", completed: true },
    { action: "Send information about local lunch clubs and WI groups", person: "Sarah Mitchell", completed: false },
    { action: "Follow up on lifeline pendant — son to arrange", person: "David Thompson", completed: false },
    { action: "Discuss raised toilet seat at 6-week review", person: "Sarah Mitchell", completed: false },
    { action: "Register with energy company priority services", person: "David Thompson", completed: false },
    { action: "Apply for Blue Badge — forms provided", person: "David Thompson", completed: false },
    { action: "Notify GP surgery of assessment outcomes", person: "Sarah Mitchell", completed: true },
    { action: "Schedule 6-week review for 09/05/2026", person: "Sarah Mitchell", completed: true },
    { action: "Share support plan summary with patient and son", person: "Sarah Mitchell", completed: false },
    { action: "Explore pain management course availability", person: "Sarah Mitchell", completed: false },
  ],
  completionStats: { completed: 23, notApplicable: 0, pending: 6 },
};

// ─── Colour tokens ───
const NHS_BLUE = "#005EB8";
const NHS_DARK = "#003087";
const NHS_LIGHT_BLUE = "#41B6E6";
const WARM_GREY = "#F7F5F2";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8E4DF";
const SCORE_GREEN = "#00703C";
const SCORE_AMBER = "#D4760A";
const SCORE_RED = "#D5281B";
const TEXT_PRIMARY = "#212B32";
const TEXT_SECONDARY = "#4C6272";
const ACCENT_TEAL = "#009688";

function getScoreColour(score, thresholds) {
  if (score <= thresholds[0]) return SCORE_GREEN;
  if (score <= thresholds[1]) return SCORE_AMBER;
  return SCORE_RED;
}

// ─── Reusable Components ───
function ScorePill({ label, score, max, severity, thresholds = [5, 14] }) {
  const colour = getScoreColour(score, thresholds);
  return (
    <div style={{ textAlign: "center", padding: "16px 12px", background: CARD_BG, borderRadius: 12, border: `1px solid ${BORDER}`, minWidth: 120, flex: "1 1 120px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SECONDARY, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: colour, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>/{max}</div>
      {severity && <div style={{ fontSize: 11, marginTop: 6, color: colour, fontWeight: 600 }}>{severity}</div>}
    </div>
  );
}

function StatCard({ number, label, colour = NHS_BLUE }) {
  return (
    <div style={{ textAlign: "center", padding: "14px 10px", background: `${colour}10`, borderRadius: 10, border: `1px solid ${colour}25`, flex: "1 1 100px" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: colour }}>{number}</div>
      <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
      {icon && <span style={{ fontSize: 16, marginTop: 2, flexShrink: 0 }}>{icon}</span>}
      <div style={{ minWidth: 140, color: TEXT_SECONDARY, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{label}</div>
      <div style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 400, flex: 1 }}>{value || "—"}</div>
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 12, border: `1px solid ${BORDER}`, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", background: `linear-gradient(135deg, ${NHS_BLUE}08, ${NHS_LIGHT_BLUE}08)`, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: NHS_DARK, letterSpacing: "-0.01em" }}>{title}</h3>
      </div>
      <div style={{ padding: "8px 20px 16px" }}>{children}</div>
    </div>
  );
}

function TextBlock({ label, text }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: NHS_BLUE, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.6, background: `${WARM_GREY}`, padding: "10px 14px", borderRadius: 8, borderLeft: `3px solid ${NHS_LIGHT_BLUE}` }}>{text || "—"}</div>
    </div>
  );
}

// ─── Tab Definitions ───
const TABS = [
  { id: "overview", label: "Overview", icon: "👤" },
  { id: "observations", label: "Observations", icon: "🩺" },
  { id: "about", label: "About Patient", icon: "📋" },
  { id: "mood", label: "Mood & Cognition", icon: "🧠" },
  { id: "home", label: "Home & Mobility", icon: "🏠" },
  { id: "support", label: "Support & Safety", icon: "🤝" },
  { id: "actions", label: "Action Plan", icon: "✅" },
];

// ─── Tab Content Components ───
function OverviewTab({ data }) {
  const d = data.demographics;
  const s = data.scores;
  const dt = data.dates;
  const cs = data.completionStats;
  return (
    <div>
      {/* Patient Banner */}
      <div style={{ background: `linear-gradient(135deg, ${NHS_BLUE}, ${NHS_DARK})`, borderRadius: 14, padding: "22px 26px", marginBottom: 20, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
            {d.preferredName[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{d.name}</h2>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
              <span>Preferred: {d.preferredName}</span>
              <span>DOB: {d.dob}</span>
              <span>Age: {d.age}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Scores */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <ScorePill label="PHQ-9" score={s.phq9.score} max={s.phq9.max} severity={s.phq9.severity} thresholds={[4, 14]} />
        <ScorePill label="GAD-7" score={s.gad7.score} max={s.gad7.max} severity={s.gad7.severity} thresholds={[5, 10]} />
        <ScorePill label="6-CIT" score={s.sixCit.score} max={s.sixCit.max} severity={s.sixCit.severity} thresholds={[7, 9]} />
        <ScorePill label="FRAT" score={s.frat.score} max={s.frat.max} severity={s.frat.severity} thresholds={[2, 3]} />
        <ScorePill label="Rockwood" score={s.rockwood} max={9} severity="Vulnerable" thresholds={[3, 5]} />
      </div>

      {/* Completion Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <StatCard number={cs.completed} label="Completed" colour={SCORE_GREEN} />
        <StatCard number={cs.notApplicable} label="N/A" colour={TEXT_SECONDARY} />
        <StatCard number={cs.pending} label="Pending" colour={SCORE_AMBER} />
      </div>

      {/* Demographics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Patient Details" icon="📇">
          <InfoRow label="NHS Number" value={d.nhsNumber} />
          <InfoRow label="Phone" value={d.phone} />
          <InfoRow label="Address" value={d.address} />
          <InfoRow label="Surgery" value={d.surgery} />
          <InfoRow label="Pharmacy" value={d.pharmacy} />
          <InfoRow label="Support Worker" value={d.supportWorker} />
        </SectionCard>

        <SectionCard title="Key Dates" icon="📅">
          <InfoRow label="Referral" value={dt.referral} />
          <InfoRow label="First Contact" value={dt.firstContact} />
          <InfoRow label="Assessment" value={dt.assessment} />
          <InfoRow label="MDT" value={dt.mdt} />
          <InfoRow label="6-Week Review" value={dt.sixWeekReview} />
        </SectionCard>
      </div>

      {/* Consent */}
      <SectionCard title="Consent to Act" icon="✍️">
        <InfoRow label="Name" value={d.consentName} />
        <InfoRow label="Relationship" value={d.consentRelationship} />
        <InfoRow label="Phone" value={d.consentPhone} />
        <InfoRow label="Email" value={d.consentEmail} />
      </SectionCard>
    </div>
  );
}

function ObservationsTab({ data }) {
  const o = data.observations;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Vital Signs" icon="❤️">
          <InfoRow label="Pulse" value={`${o.pulse} bpm`} />
          <InfoRow label="Respiratory Rate" value={`${o.respiratoryRate} breaths/min`} />
          <InfoRow label="Oxygen Saturation" value={o.oxygenSaturation} />
          <InfoRow label="Temperature" value={o.temperature} />
        </SectionCard>

        <SectionCard title="Blood Pressure" icon="🩸">
          <InfoRow label="1st Sitting" value={o.bp1Sitting} />
          <InfoRow label="2nd Sitting" value={o.bp2Sitting} />
          <InfoRow label="1st Standing" value={o.bp1Standing} />
          <InfoRow label="2nd Standing" value={o.bp2Standing} />
        </SectionCard>
      </div>

      <SectionCard title="Functional Assessment" icon="🚶">
        <InfoRow label="Timed Get Up & Go" value={o.timedGetUpAndGo} />
        <InfoRow label="Falls (Last 12 Months)" value={o.fallsLast12Months} />
        <InfoRow label="Rockwood Frailty" value={`${data.scores.rockwood} / 9`} />
      </SectionCard>

      {/* Clinical Scores Visual */}
      <SectionCard title="Clinical Scores Overview" icon="📊">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {[
            { label: "PHQ-2", score: data.scores.phq2.score, max: data.scores.phq2.max, desc: data.scores.phq2.label },
            { label: "PHQ-9", score: data.scores.phq9.score, max: data.scores.phq9.max, desc: data.scores.phq9.label },
            { label: "GAD-7", score: data.scores.gad7.score, max: data.scores.gad7.max, desc: data.scores.gad7.label },
            { label: "6-CIT", score: data.scores.sixCit.score, max: data.scores.sixCit.max, desc: data.scores.sixCit.label },
            { label: "FRAT", score: data.scores.frat.score, max: data.scores.frat.max, desc: data.scores.frat.label },
          ].map((item) => {
            const pct = (item.score / item.max) * 100;
            const col = pct < 25 ? SCORE_GREEN : pct < 55 ? SCORE_AMBER : SCORE_RED;
            return (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{item.score}/{item.max} — {item.desc}</span>
                </div>
                <div style={{ height: 8, background: "#E8E4DF", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(pct, 2)}%`, background: col, borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function AboutPatientTab({ data }) {
  const a = data.aboutPatient;
  return (
    <div>
      <TextBlock label="What Is Important to Them" text={a.importantToThem} />
      <TextBlock label="Health & Conditions" text={a.health} />
      <TextBlock label="Sleep Patterns" text={a.sleep} />
      <TextBlock label="Nutrition" text={a.nutrition} />
      <TextBlock label="Recent Checks (Eyes, Hearing, Dentist)" text={a.lastChecks} />
      <TextBlock label="Medication" text={a.medication} />
      <TextBlock label="Immunisations" text={a.immunisations} />
      <TextBlock label="Continence" text={a.continence} />
    </div>
  );
}

function MoodTab({ data }) {
  const s = data.scores;
  const phq9Questions = [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself",
    "Trouble concentrating on things",
    "Moving or speaking slowly / being restless",
    "Thoughts of being better off dead or self-harm",
  ];
  const gad7Questions = [
    "Feeling nervous, anxious or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing",
    "Being so restless it's hard to sit still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid as if something awful might happen",
  ];
  const scoreLabels = ["Not at all", "Several days", "More than half", "Nearly every day"];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <ScorePill label="PHQ-9" score={s.phq9.score} max={27} severity={s.phq9.severity} thresholds={[4, 14]} />
        <ScorePill label="GAD-7" score={s.gad7.score} max={21} severity={s.gad7.severity} thresholds={[5, 10]} />
        <ScorePill label="6-CIT" score={s.sixCit.score} max={28} severity={s.sixCit.severity} thresholds={[7, 9]} />
      </div>

      <TextBlock label="Overall Mood Notes" text={data.moodAndCognition.moodNotes} />

      {/* PHQ-9 Breakdown */}
      <SectionCard title="PHQ-9 Responses" icon="📝">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
          {phq9Questions.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 8 ? `1px solid ${BORDER}` : "none" }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: data.moodAndCognition.phq9Responses[i] === 0 ? `${SCORE_GREEN}18` : `${SCORE_AMBER}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: data.moodAndCognition.phq9Responses[i] === 0 ? SCORE_GREEN : SCORE_AMBER, flexShrink: 0 }}>
                {data.moodAndCognition.phq9Responses[i]}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY }}>{q}</div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY, flexShrink: 0 }}>{scoreLabels[data.moodAndCognition.phq9Responses[i]]}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* GAD-7 Breakdown */}
      <SectionCard title="GAD-7 Responses" icon="📝">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
          {gad7Questions.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 6 ? `1px solid ${BORDER}` : "none" }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: data.moodAndCognition.gad7Responses[i] === 0 ? `${SCORE_GREEN}18` : `${SCORE_AMBER}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: data.moodAndCognition.gad7Responses[i] === 0 ? SCORE_GREEN : SCORE_AMBER, flexShrink: 0 }}>
                {data.moodAndCognition.gad7Responses[i]}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY }}>{q}</div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY, flexShrink: 0 }}>{scoreLabels[data.moodAndCognition.gad7Responses[i]]}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ONS4 Wellbeing */}
      <SectionCard title="ONS4 Personal Wellbeing" icon="🌟">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {[
            { label: "Life Satisfaction", score: s.ons4.lifeSatisfaction, desc: "How satisfied are you with your life?" },
            { label: "Worthwhile", score: s.ons4.worthwhile, desc: "Do you feel the things you do are worthwhile?" },
            { label: "Happiness", score: s.ons4.happiness, desc: "How happy did you feel yesterday?" },
            { label: "Anxiety", score: s.ons4.anxiety, desc: "How anxious did you feel yesterday?", invert: true },
          ].map((item) => {
            const col = item.invert ? (item.score <= 1 ? SCORE_GREEN : item.score <= 3 ? "#7FB069" : item.score <= 5 ? SCORE_AMBER : SCORE_RED) : (item.score >= 7 ? SCORE_GREEN : item.score >= 5 ? SCORE_AMBER : SCORE_RED);
            return (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: col }}>{item.score}/10</span>
                </div>
                <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4 }}>{item.desc}</div>
                <div style={{ height: 6, background: "#E8E4DF", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.score * 10}%`, background: col, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function HomeTab({ data }) {
  const h = data.homeAndMobility;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Living Situation" icon="🏡">
          <InfoRow label="Lives with" value={h.livingSituation} />
          <InfoRow label="Dwelling" value={h.dwelling} />
          <InfoRow label="Hazards" value={h.hazards} />
          <InfoRow label="Stairs" value={h.stairs} />
        </SectionCard>

        <SectionCard title="Mobility & Falls" icon="🚶">
          <InfoRow label="Mobility" value={h.mobility} />
          <InfoRow label="FRAT Score" value={`${data.scores.frat.score}/5 — ${data.scores.frat.severity}`} />
          <InfoRow label="Falls (12 months)" value={data.observations.fallsLast12Months} />
          <InfoRow label="Get Up & Go" value={data.observations.timedGetUpAndGo} />
        </SectionCard>
      </div>

      <SectionCard title="Aids & Adaptations" icon="🔧">
        <TextBlock label="In Place" text={h.aids} />
        <TextBlock label="Required / Discussed" text={h.aidsRequired} />
        <TextBlock label="Adaptations" text={h.adaptations} />
      </SectionCard>
    </div>
  );
}

function SupportTab({ data }) {
  const su = data.support;
  const sb = data.safetyAndBenefits;

  const checkItems = [
    { label: "Key Safe", value: sb.keySafe, done: true },
    { label: "Smoke Alarms", value: sb.smokeAlarms, done: true },
    { label: "Power of Attorney", value: sb.poa, done: true },
    { label: "Lifeline Pendant", value: sb.lifeline, done: false },
    { label: "Blue Badge", value: sb.blueBadge, done: false },
    { label: "Priority Registers", value: sb.priorityRegisters, done: false },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <TextBlock label="Existing Support" text={su.existingSupport} />
          <TextBlock label="Personal Care" text={su.personalCare} />
          <TextBlock label="Household Chores" text={su.householdChores} />
        </div>
        <div>
          <TextBlock label="Social Activities" text={su.socialActivities} />
          <TextBlock label="Transport" text={su.transport} />
          <TextBlock label="Benefits" text={sb.benefitsCheck} />
        </div>
      </div>

      <SectionCard title="Safety Checklist" icon="🛡️">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 8 }}>
          {checkItems.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: item.done ? `${SCORE_GREEN}08` : `${SCORE_AMBER}08`, borderRadius: 8, border: `1px solid ${item.done ? SCORE_GREEN : SCORE_AMBER}20` }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{item.done ? "✅" : "⏳"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{item.label}</div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Safeguarding & Other Notes" icon="📌">
        <InfoRow label="Safeguarding" value={sb.safeguarding} />
        <TextBlock label="Additional Notes" text={sb.anythingElse} />
      </SectionCard>
    </div>
  );
}

function ActionPlanTab({ data }) {
  const completed = data.actionPlan.filter((a) => a.completed);
  const pending = data.actionPlan.filter((a) => !a.completed);
  const pct = Math.round((completed.length / data.actionPlan.length) * 100);

  return (
    <div>
      {/* Progress Bar */}
      <div style={{ background: CARD_BG, borderRadius: 14, border: `1px solid ${BORDER}`, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>Action Plan Progress</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: NHS_BLUE }}>{pct}%</span>
        </div>
        <div style={{ height: 10, background: "#E8E4DF", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${NHS_BLUE}, ${NHS_LIGHT_BLUE})`, borderRadius: 5, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12, color: TEXT_SECONDARY }}>
          <span>✅ {completed.length} Completed</span>
          <span>⏳ {pending.length} Pending</span>
          <span>📋 {data.actionPlan.length} Total</span>
        </div>
      </div>

      {/* Pending Actions */}
      {pending.length > 0 && (
        <SectionCard title="Pending Actions" icon="⏳">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
            {pending.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: `${SCORE_AMBER}06`, borderRadius: 8, border: `1px solid ${SCORE_AMBER}15` }}>
                <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>⬜</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>{item.action}</div>
                  <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 3 }}>Assigned: {item.person}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Completed Actions */}
      <SectionCard title="Completed Actions" icon="✅">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
          {completed.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: `${SCORE_GREEN}06`, borderRadius: 8, border: `1px solid ${SCORE_GREEN}15` }}>
              <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>{item.action}</div>
                <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 3 }}>Completed by: {item.person}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main Component ───
export default function AgeWellSupportPlanSummary({ onBack }) {
  const [activeTab, setActiveTab] = useState("overview");

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab data={patientData} />;
      case "observations": return <ObservationsTab data={patientData} />;
      case "about": return <AboutPatientTab data={patientData} />;
      case "mood": return <MoodTab data={patientData} />;
      case "home": return <HomeTab data={patientData} />;
      case "support": return <SupportTab data={patientData} />;
      case "actions": return <ActionPlanTab data={patientData} />;
      default: return null;
    }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif", background: WARM_GREY, minHeight: "100vh", color: TEXT_PRIMARY }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${NHS_BLUE}, ${NHS_DARK})`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Notewell<span style={{ fontWeight: 400, opacity: 0.7 }}> AI</span>
          </div>
          <div style={{ height: 20, width: 1, background: "rgba(255,255,255,0.25)" }} />
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 }}>Age Well — Patient Support Plan Summary</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>28 March 2026</div>
      </div>

      {/* Quick ID Bar */}
      <div style={{ background: CARD_BG, borderBottom: `1px solid ${BORDER}`, padding: "10px 28px", display: "flex", alignItems: "center", gap: 24, fontSize: 13 }}>
        <span style={{ fontWeight: 700, color: NHS_DARK }}>{patientData.demographics.preferredName} {patientData.demographics.name.split(" ").pop()}</span>
        <span style={{ color: TEXT_SECONDARY }}>NHS: {patientData.demographics.nhsNumber}</span>
        <span style={{ color: TEXT_SECONDARY }}>Age: {patientData.demographics.age}</span>
        <span style={{ color: TEXT_SECONDARY }}>{patientData.demographics.surgery}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a href="/documents/AgeWell_Support_Plan_Maggie_Thompson.docx" download style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, background: NHS_BLUE, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            📄 Export DOCX
          </a>
          <button style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, background: "transparent", color: NHS_BLUE, border: `1px solid ${NHS_BLUE}`, borderRadius: 6, cursor: "pointer" }}>
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ background: CARD_BG, borderBottom: `2px solid ${BORDER}`, padding: "0 28px", display: "flex", gap: 0, overflowX: "auto" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "14px 18px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? NHS_BLUE : TEXT_SECONDARY,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? `3px solid ${NHS_BLUE}` : "3px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
        {renderTab()}
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 28px", textAlign: "center", fontSize: 11, color: TEXT_SECONDARY, borderTop: `1px solid ${BORDER}`, background: CARD_BG }}>
        Generated by Notewell AI · NRES Neighbourhood Access Service · Brackley and Towcester PCN · {new Date().toLocaleDateString("en-GB")}
      </div>
    </div>
  );
}
