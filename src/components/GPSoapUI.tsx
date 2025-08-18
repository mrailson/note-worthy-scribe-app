import React, { useMemo, useState } from "react";

// GP Scribe – SOAP Notes UI Mock for Lovable
// - Single-file React component using Tailwind only (no external UI libs)
// - Shows dropdown of 15 common templates
// - Toggle between GP Shorthand and Standard
// - Always-on Summary Line for SystmOne copy
// - Tabs: Consultation Summary / Patient Copy / Referral / Review & Recs
// - SOAP rendered as card blocks with clear visual hierarchy
// - Copy-to-clipboard helpers (work in preview)

interface GPSoapUIProps {
  exampleData?: {
    title?: string;
    type?: string;
    duration?: string;
    summary?: string;
    patientCopy?: string;
    referralLetter?: string;
    aiReview?: string;
  };
}

export default function GPSoapUI({ exampleData }: GPSoapUIProps) {
  type Soap = { S: string; O: string; A: string; P: string };
  type Template = {
    id: string;
    name: string;
    category?: string;
    summaryLine: string;
    shorthand: Soap;
    standard: Soap;
    patientCopy?: string;
    referral?: string;
    review?: string;
  };

  const TEMPLATES: Template[] = [
    {
      id: "urti",
      name: "General Consultation (URTI)",
      category: "Acute Illness",
      summaryLine: "URTI 3/7, well, safety-net",
      shorthand: {
        S: "pt c/o sore throat 3/7, blocked nose, cough now productive; chills yest; paracetamol partial relief; no SOB/CP",
        O: "Obs WNL, chest clear, nodes small, throat red, no wheeze",
        A: "Viral URTI",
        P: "Reassure, fluids, paracetamol, safety-net if fever >5/7, SOB, CP or rash"
      },
      standard: {
        S: "Patient reports 3-day history of sore throat, blocked nose and cough becoming productive. Subjective fever/chills yesterday. Partial relief with paracetamol. Denies shortness of breath or chest pain.",
        O: "Observations within normal limits. Chest clear. Mild cervical lymphadenopathy. Oropharynx erythematous. No wheeze.",
        A: "Likely viral upper respiratory tract infection.",
        P: "Reassurance. Advise fluids and regular paracetamol. Safety‑net: seek care if symptoms worsen, fever persists beyond 5 days, shortness of breath, chest pain or new rash."
      },
      patientCopy:
        "You have a viral upper respiratory infection (a common cold). Drink plenty of fluids, rest and use paracetamol for fever/sore throat. Seek help urgently if breathing becomes difficult, chest pain develops, or you feel much worse.",
      referral:
        "Not indicated today. Consider if persistent symptoms >3w or red flags (hemoptysis, weight loss, recurrent infections).",
      review:
        "Self‑care, OTC meds, safety‑net documented. No antibiotics given."
    },
    {
      id: "t2dm",
      name: "Long‑Term Condition Review (Diabetes)",
      category: "Chronic",
      summaryLine: "T2DM stable; HbA1c ↓; cont Rx; rpt 3/12",
      shorthand: {
        S: "DM review; no hypo sx; diet stable; meds compliant",
        O: "BP 128/78; BMI 29; HbA1c 52 (prev 58); feet NAD",
        A: "T2DM – stable; improving control",
        P: "Continue meds; reinforce diet/ex; repeat HbA1c 3/12; retinal screen up to date"
      },
      standard: {
        S: "Attends for routine diabetes review. No hypoglycaemia symptoms. Adhering to medication and diet.",
        O: "BP 128/78, BMI 29. HbA1c 52 mmol/mol (previously 58). Foot exam normal.",
        A: "Type 2 diabetes mellitus – stable with improving glycaemic control.",
        P: "Continue current medications. Reinforce diet and exercise. Repeat HbA1c in 3 months. Confirm retinal screening status."
      },
      patientCopy:
        "Your diabetes is stable and improving. Continue your current tablets, healthy diet and physical activity. We'll repeat your HbA1c blood test in 3 months.",
      referral: "No routine referral required. Consider DSN if HbA1c worsens or hypo concerns.",
      review: "QOF checks complete; foot check done; follow‑up 3/12."
    },
    {
      id: "depression",
      name: "Mental Health (Depression)",
      category: "MH",
      summaryLine: "Mild depression; IAPT referral; FU 4/52; safety‑net",
      shorthand: {
        S: "Low mood, ↓sleep; no SI; coping at work",
        O: "Affect flat; eye contact ok; no psychotic features",
        A: "Mild depression",
        P: "Self‑help info; IAPT referral; consider SSRI if no improvement; FU 4/52; safety‑net provided"
      },
      standard: {
        S: "Reports low mood and reduced sleep. Denies suicidal ideation. Managing work responsibilities.",
        O: "Flat affect; maintains eye contact; no psychosis.",
        A: "Mild depressive episode.",
        P: "Provided self‑help resources and referred to IAPT. Consider SSRI if no improvement. Safety‑net advice given. Review in 4 weeks."
      },
      patientCopy:
        "Your symptoms are consistent with mild depression. We've referred you to talking therapies (IAPT). Try the self‑help resources provided. If you feel unsafe or develop suicidal thoughts, seek urgent help (111/999/A&E).",
      referral: "IAPT referral submitted today.",
      review: "PHQ‑9 to be repeated at FU; crisis plan documented."
    },
    {
      id: "uti",
      name: "UTI (Cystitis)",
      category: "Acute Illness",
      summaryLine: "UTI 3/7; nitrofurantoin 100mg MR bd 3/7; safety‑net pyelo",
      shorthand: {
        S: "Dysuria, freq, urgency 3/7; no fever; no loin pain",
        O: "Dip +nitrites +leuks; afebrile",
        A: "Lower UTI",
        P: "Nitrofurantoin 3/7; fluids; safety‑net for pyelonephritis red flags"
      },
      standard: {
        S: "Three days of dysuria, urinary frequency and urgency. No fever or loin pain.",
        O: "Urine dip positive for nitrites and leukocytes. Afebrile.",
        A: "Lower urinary tract infection (uncomplicated).",
        P: "Nitrofurantoin 100 mg modified‑release twice daily for 3 days. Encourage fluids. Safety‑net for pyelonephritis red flags (fever, flank pain, vomiting)."
      },
      patientCopy:
        "You have a bladder infection. Take nitrofurantoin as prescribed and drink plenty of fluids. Seek urgent help if you get fever, back/flank pain or vomiting.",
      referral: "Not required today unless recurrent/complicated.",
      review: "If unresolved after course, send MSU and review."
    },
    {
      id: "lbp",
      name: "Musculoskeletal (Back Pain)",
      category: "MSK",
      summaryLine: "Mech LBP 5/7; no red flags; advice+analgesia",
      shorthand: {
        S: "Back pain 5/7; no red flags; better with rest",
        O: "Gait normal; neuro NAD; SLR negative",
        A: "Mechanical lower back pain",
        P: "Advice, activity modification, simple analgesia PRN, physio info, safety‑net"
      },
      standard: {
        S: "Five days of lower back pain. Denies red flags (weakness, incontinence, weight loss). Pain improves with rest.",
        O: "Normal gait; neurological exam normal; straight‑leg raise negative.",
        A: "Mechanical lower back pain.",
        P: "Provide advice and activity modification. Simple analgesia as required. Physio/self‑management leaflet. Safety‑net for red flags."
      },
      patientCopy:
        "Your back pain is mechanical (muscle/joint strain). Keep gently active, avoid bed rest, and use simple pain relief if needed. See a clinician urgently if you develop leg weakness, numbness in the saddle area, or bladder/bowel problems.",
      referral: "Physio if persisting >6w or recurrent; urgent pathway if red flags.",
      review: "FU PRN; consider MSK pathway if not improving."
    },

    // The remaining entries use concise placeholder content to keep this mock compact.
    ...[
      "Respiratory (Asthma/COPD Review)",
      "Cardiac (Chest Pain / ?Angina)",
      "Child Consultation (Fever)",
      "Elderly / Multimorbidity",
      "Women’s Health (Contraception / HRT)",
      "Palliative Care Review",
      "ENT (Otitis / Tonsillitis)",
      "Dermatology (Eczema / Rash)",
      "Gastrointestinal (Abdo pain / Diarrhoea)",
      "Medication Review / Polypharmacy"
    ].map((name, idx) => {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return {
        id: id + "-placeholder",
        name,
        category: idx < 1 ? "Review" : "",
        summaryLine: `${name} – example summary line`,
        shorthand: { S: "Example shorthand S", O: "Example shorthand O", A: "Example shorthand A", P: "Example shorthand P" },
        standard: { S: "Example standard S", O: "Example standard O", A: "Example standard A", P: "Example standard P" },
        patientCopy: "Plain‑English patient copy goes here.",
        referral: "Referral guidance goes here.",
        review: "Review & recommendations notes go here."
      } as Template;
    })
  ];

  // Helper function to parse example summary into SOAP format
  const parseExampleToSOAP = (summary: string): Soap => {
    // Try to extract SOAP sections from the structured summary
    const lines = summary.split('\n');
    let subjective = '';
    let objective = '';
    let assessment = '';
    let plan = '';
    
    let currentSection = '';
    
    for (const line of lines) {
      if (line.includes('History of Presenting Complaint') || line.includes('Chief Complaint')) {
        currentSection = 'S';
      } else if (line.includes('Examination')) {
        currentSection = 'O';
      } else if (line.includes('Assessment')) {
        currentSection = 'A';
      } else if (line.includes('Plan')) {
        currentSection = 'P';
      } else if (line.trim() && !line.startsWith('**') && !line.startsWith('#')) {
        switch (currentSection) {
          case 'S':
            subjective += line.replace(/^[-•]\s*/, '') + ' ';
            break;
          case 'O':
            objective += line.replace(/^[-•]\s*/, '') + ' ';
            break;
          case 'A':
            assessment += line.replace(/^[-•]\s*/, '') + ' ';
            break;
          case 'P':
            plan += line.replace(/^[-•]\s*/, '') + ' ';
            break;
        }
      }
    }
    
    return {
      S: subjective.trim() || 'Patient presents with symptoms as described in consultation',
      O: objective.trim() || 'Physical examination findings as documented',
      A: assessment.trim() || 'Clinical assessment and diagnosis',
      P: plan.trim() || 'Management plan and follow-up arrangements'
    };
  };

  // Create example template if exampleData is provided
  const exampleTemplate: Template | null = exampleData ? {
    id: "example-loaded",
    name: exampleData.title || "Loaded Example",
    category: exampleData.type || "Example",
    summaryLine: `${exampleData.title || 'Example consultation'} - ${exampleData.duration || 'duration unknown'}`,
    shorthand: parseExampleToSOAP(exampleData.summary || ''),
    standard: parseExampleToSOAP(exampleData.summary || ''),
    patientCopy: exampleData.patientCopy || "Patient copy will appear here",
    referral: exampleData.referralLetter || "No referral needed",
    review: exampleData.aiReview || "Review and recommendations will appear here"
  } : null;

  // Use example template if available, otherwise use default
  const availableTemplates = exampleTemplate ? [exampleTemplate, ...TEMPLATES] : TEMPLATES;
  const [selectedId, setSelectedId] = useState<string>(exampleTemplate?.id || TEMPLATES[0].id);
  const [mode, setMode] = useState<"shorthand" | "standard">("shorthand");
  const [tab, setTab] = useState<"summary" | "patient" | "referral" | "review">("summary");

  const tpl = useMemo(() => availableTemplates.find(t => t.id === selectedId)!, [selectedId, availableTemplates]);
  const soap = mode === "shorthand" ? tpl.shorthand : tpl.standard;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard");
    } catch {
      alert("Copy failed – select and copy manually.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{tpl.name}</h1>
            <p className="text-xs text-slate-500">{tpl.category} • {exampleData?.duration || '05:00'} • {exampleData?.summary ? Math.round(exampleData.summary.split(' ').length / 2) : 345} words</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copy(tpl.summaryLine)}
              className="rounded-full border px-3 py-1.5 text-xs hover:bg-slate-100"
              title="Copy Summary Line"
            >
              Copy Summary Line
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-full border px-3 py-1.5 text-xs hover:bg-slate-100"
              title="Print/Save PDF"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Template + Mode */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Template</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {availableTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Format</label>
            <div className="flex items-center gap-2 rounded-xl border bg-white p-2 shadow-sm">
              <button
                onClick={() => setMode("shorthand")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "shorthand" ? "bg-sky-500 text-white" : "hover:bg-slate-100"}`}
              >
                GP Shorthand
              </button>
              <button
                onClick={() => setMode("standard")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "standard" ? "bg-sky-500 text-white" : "hover:bg-slate-100"}`}
              >
                Standard Detail
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { id: "summary", label: "Consultation Summary" },
            { id: "patient", label: "Patient Copy" },
            { id: "referral", label: "Referral" },
            { id: "review", label: "Review & Recommendations" }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`rounded-lg px-3 py-2 ${tab === id ? "bg-sky-600 text-white" : "bg-white border hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Summary Line */}
        <div className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm"><span className="font-semibold">Summary Line:</span> {tpl.summaryLine}</p>
            <button onClick={() => copy(tpl.summaryLine)} className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-100">Copy</button>
          </div>
        </div>

        {/* Panels */}
        {tab === "summary" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SoapCard title="S – Subjective" icon="📝" text={soap.S} tone="sky" mono={mode === "shorthand"} />
            <SoapCard title="O – Objective" icon="🩺" text={soap.O} tone="emerald" mono={mode === "shorthand"} />
            <SoapCard title="A – Assessment" icon="🔎" text={soap.A} tone="amber" mono={false} />
            <SoapCard title="P – Plan" icon="✅" text={soap.P} tone="violet" mono={false} />
          </div>
        )}

        {tab === "patient" && (
          <PlainCard title="Patient Copy" body={tpl.patientCopy || "Patient‑friendly summary will appear here."} />
        )}
        {tab === "referral" && (
          <PlainCard title="Referral" body={tpl.referral || "Referral text/criteria will appear here."} />
        )}
        {tab === "review" && (
          <PlainCard title="Review & Recommendations" body={tpl.review || "Follow‑up plan, safety‑netting and recommendations go here."} />
        )}

        {/* Footer action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">Design mock • Clean cards • Clear SOAP • Copy helpers</div>
          <div className="flex items-center gap-2">
            <button onClick={() => copy(renderSoap(soap))} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100">Copy SOAP</button>
            <button onClick={() => copy(tpl.patientCopy || "")} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100">Copy Patient Copy</button>
            <button onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100">Export PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoapCard({ title, icon, text, tone = "sky", mono = false }: { title: string; icon: string; text: string; tone?: "sky" | "emerald" | "amber" | "violet"; mono?: boolean }) {
  const toneMap: Record<string, string> = {
    sky: "bg-sky-50 border-sky-200",
    emerald: "bg-emerald-50 border-emerald-200",
    amber: "bg-amber-50 border-amber-200",
    violet: "bg-violet-50 border-violet-200"
  };
  return (
    <div className={`rounded-2xl border ${toneMap[tone]} p-4 shadow-sm`}
         style={{ boxShadow: "0 1px 0 rgba(2,6,23,0.04), 0 1px 2px rgba(2,6,23,0.08)" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" aria-hidden>{icon}</span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{text}</p>
    </div>
  );
}

function PlainCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="whitespace-pre-wrap text-sm">{body}</p>
    </div>
  );
}

function renderSoap(s: { S: string; O: string; A: string; P: string }) {
  return `S: ${s.S}\nO: ${s.O}\nA: ${s.A}\nP: ${s.P}`;
}
