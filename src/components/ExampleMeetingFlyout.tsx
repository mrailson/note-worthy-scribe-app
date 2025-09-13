"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

type StylesUnion = string | { markdown?: string; table_markdown?: string };
type SixStyles = {
  formal_minutes?: StylesUnion;
  action_notes?: StylesUnion;
  headline_summary?: StylesUnion;
  narrative_newsletter?: StylesUnion;
  decision_log?: StylesUnion;
  annotated_summary?: StylesUnion;
};

type FnResult = { meta?: any; styles?: SixStyles } | null;

type Tab = "danda" | "resolution" | "transcript";

const SETTINGS = {
  title: "Patient Consultation - Mrs Sarah Mitchell",
  practice: "Oak Lane Medical Practice",
  date: "2025-08-22",
  time: "14:30",
  venue: "Oak Lane Medical Practice - Room 3",
  clinician: "Dr John Smith",
  patient: "Mrs Sarah Mitchell (DOB: 15/03/1967, NHS: 456 789 0123)",
};

const SAMPLE_TRANSCRIPT = `Good afternoon, Mrs Mitchell. Thank you for coming in today. I can see from your notes that you've been having some issues with persistent cough and feeling generally unwell. Can you tell me a bit more about what's been happening?

Well, Doctor Smith, it started about three weeks ago. At first I thought it was just a cold, you know, because my granddaughter had been poorly the week before. But it's just not shifted. The cough is really bothering me, especially at night. I'm hardly getting any sleep, and my husband says I'm keeping him awake too.

I see. Can you describe the cough for me? Is it dry or are you bringing anything up?

It's mostly dry, but sometimes in the morning there's a bit of clear phlegm. Nothing colored or blood or anything like that. It's just this persistent tickling feeling in my throat that makes me cough.

Right. And you mentioned feeling generally unwell - can you expand on that?

Yes, I've been feeling quite tired, more than usual. I know I'm 57 now, but I'm normally quite active. I walk the dog twice a day and do my yoga classes. But for the last couple of weeks, I've just felt drained. Even climbing the stairs leaves me a bit breathless, which isn't like me at all.

Have you had a fever at all?

I did feel a bit hot and cold in the first few days, but I haven't actually taken my temperature. My daughter bought me one of those ear thermometers, but I can never work out how to use it properly.

That's fine. Any chest pain or tightness?

Not pain exactly, but sometimes it feels a bit tight, especially when I'm coughing a lot. And I've noticed I get a bit wheezy, particularly in the evenings.

I see you're normally quite fit and well, Mrs Mitchell. Are you taking any regular medications?

Just the blood pressure tablets - the amlodipine 5mg once a day. Oh, and I take vitamin D because you told me to last year when my levels were low. I've been taking some over-the-counter cough mixture too, but it doesn't seem to be helping much.

Any allergies I should know about?

No, nothing that I know of. Well, I do get a bit sneezy around cats, but that's about it.

Right, let me just examine you now. I'm going to listen to your chest and check your throat and ears. Can you sit forward for me please?

[Examination findings noted - chest clear, mild throat erythema, no lymphadenopathy]

Well, Mrs Mitchell, from what you've told me and my examination, this sounds like it could be a post-viral cough. These can be quite persistent and frustrating, but they usually settle on their own. However, given that you've been feeling breathless and tired, I'd like to do a few simple tests just to make sure everything's okay.

What sort of tests, Doctor?

I'd like to do a chest X-ray to have a look at your lungs, and some blood tests to check for any signs of infection or other issues. We can arrange both of those for you today if you're happy to pop over to the phlebotomy clinic after we're done here.

Yes, that sounds sensible. I'd rather know for certain. When will I get the results?

The blood tests should be back in a day or two, and I'll give you a call once I have them. The X-ray will be reported within 48 hours usually. In the meantime, I'm going to prescribe you a short course of prednisolone - that's a steroid that can help reduce inflammation in your airways and should help with the cough.

Is that safe with my blood pressure medication?

Yes, it's fine to take with amlodipine. It's just a short course - five days at 30mg once daily with food. It might make you feel a bit more energetic initially, and some people find it affects their sleep slightly, but those effects wear off quickly.

Alright. And if the cough doesn't improve?

If you're not feeling better in a week, or if you develop a fever, increased breathlessness, or start coughing up colored phlegm, I want you to come back straight away. Don't wait for an appointment - just call and say you need to be seen urgently.

Thank you, Doctor. You've put my mind at rest. I was starting to worry it might be something more serious.

It's completely understandable to be concerned, especially when symptoms persist. The tests will give us a clearer picture, but I'm optimistic this will settle down soon. Make sure you rest, stay hydrated, and don't try to do too much while you're recovering.`;

const FALLBACK_DANDA = `| Field | Details |
|---|---|
| **Patient** | Mrs Sarah Mitchell |
| **DOB** | 15/03/1967 (Age 58) |
| **NHS Number** | 456 789 0123 |
| **Practice** | Oak Lane Medical Practice |
| **Date/Time** | 2025-08-22 / 14:30 |
| **Clinician** | Dr John Smith |
| **Consultation Type** | Face-to-face |

## Clinical Summary
**Presenting Complaint:** 3-week history of persistent dry cough with general malaise and increasing breathlessness.

**History:** Post-viral symptoms following family illness. Dry cough with occasional clear morning sputum, disrupting sleep. Associated fatigue and exertional dyspnoea. No fever currently, mild initial pyrexia. No chest pain, mild chest tightness with wheeze in evenings.

**Examination:** Chest clear on auscultation, mild throat erythema, no lymphadenopathy.

**Assessment:** Likely post-viral cough syndrome. Differential includes atypical pneumonia or early bronchitis.

## Management Plan
| Action | Details | Timeline |
|---|---|---|
| **Investigations** | Chest X-ray and blood tests (FBC, CRP, U&E) | Today |
| **Treatment** | Prednisolone 30mg OD for 5 days with food | Started today |
| **Follow-up** | Results review within 48-72 hours | By phone |
| **Safety netting** | Return if fever, worsening breathlessness, or colored sputum | Immediate |

## Medications
- **Continuing:** Amlodipine 5mg OD (for hypertension)
- **New:** Prednisolone 30mg OD x 5 days
- **Advice:** Continue vitamin D as prescribed`;

const FALLBACK_RES = `**CONSULTATION SUMMARY - Mrs Sarah Mitchell**
*Oak Lane Medical Practice - 22/08/2025*

**Primary Issue Resolved:** Persistent cough and malaise - likely post-viral syndrome with appropriate investigation and treatment plan established.

**Immediate Actions Completed:**
1. **Clinical Assessment:** Comprehensive history and examination completed - chest clear, mild throat inflammation noted.
2. **Investigations Ordered:** Chest X-ray and blood tests (FBC, CRP, U&E) arranged for same day.
3. **Treatment Initiated:** Prednisolone 30mg daily x 5 days prescribed - patient counselled on administration with food.
4. **Safety Netting:** Clear instructions provided for urgent return if symptoms worsen.

**Follow-up Plan:**
- Results review within 48-72 hours via telephone
- Patient advised to continue regular medications (amlodipine, vitamin D)
- Return if fever, increased breathlessness, or productive cough develops

**Patient Understanding:** 
Mrs Mitchell demonstrated good understanding of the diagnosis, treatment plan, and warning signs. She was reassured about the likely benign nature of her symptoms while acknowledging the importance of investigation.

**Clinical Codes:**
- R05 - Cough
- R53 - Malaise and fatigue  
- R06.0 - Dyspnoea

**Next Review:** Results dependent - 2-3 days`;

function readBlock(b?: StylesUnion): string {
  if (!b) return "";
  if (typeof b === "string") return b;
  return b.markdown || b.table_markdown || "";
}

async function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  let t: number;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => (t = window.setTimeout(() => rej(new Error("Timed out")), ms))),
  ]).finally(() => clearTimeout(t!));
}

export default function ExampleMeetingFlyout({
  buttonClassName = "px-3 py-2 rounded bg-muted hover:bg-muted/80 text-sm",
}: { buttonClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("danda");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [styles, setStyles] = useState<SixStyles | null>(null);

  const activeText = useMemo(() => {
    if (tab === "transcript") {
      return `### Transcript\n\n${SAMPLE_TRANSCRIPT}`;
    }
    // map: D&A -> action_notes, Resolution -> decision_log
    if (tab === "danda") return readBlock(styles?.action_notes) || FALLBACK_DANDA;
    return readBlock(styles?.decision_log) || FALLBACK_RES;
  }, [tab, styles]);

  useEffect(() => {
    if (!open || styles || loading) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke("generate-meeting-notes-six-styles", {
            body: { transcript: SAMPLE_TRANSCRIPT, settings: SETTINGS },
          }),
          15000
        );

        if (error) throw error;
        const result = (data as FnResult) || null;
        if (!result?.styles) throw new Error("Function returned no styles.");
        setStyles(result.styles);
      } catch (e: any) {
        setErr(
          `Couldn't load example from edge function (${e?.message || "unknown error"}). Showing a built-in example instead.`
        );
        // Use built-in fallback (so UI never stays blank)
        setStyles({});
      } finally {
        setLoading(false);
      }
    })();
  }, [open, styles, loading]);

  async function copy() {
    if (activeText) await navigator.clipboard.writeText(activeText);
  }

  async function downloadDocx() {
  const name =
      tab === "danda"
        ? "clinical-summary"
        : tab === "resolution"
        ? "consultation-summary"
        : "transcript";
    try {
      const r = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: activeText, filename: `oak-lane-${name}` }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oak-lane-${name}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: download as .md
      const blob = new Blob([activeText], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oak-lane-${name}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)}>
        Show Example Consultation
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="border-b p-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">Example Consultation — Oak Lane Medical Practice</h2>

              {/* clearly switchable tabs */}
              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => setTab("danda")}
                  className={`px-3 py-1 rounded border ${
                    tab === "danda" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  title="View Clinical Summary and Management Plan"
                >
                  Clinical Summary
                </button>
                <button
                  onClick={() => setTab("resolution")}
                  className={`px-3 py-1 rounded border ${
                    tab === "resolution" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  title="View Consultation Summary and Outcome"
                >
                  Consultation Summary
                </button>
                <button
                  onClick={() => setTab("transcript")}
                  className={`px-3 py-1 rounded border ${
                    tab === "transcript" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  title="View the full transcript used"
                >
                  Transcript
                </button>
              </div>

              <div className="ml-auto flex gap-2">
                <button onClick={copy} className="px-3 py-1 rounded bg-gray-800 text-white">
                  Copy
                </button>
                <button onClick={downloadDocx} className="px-3 py-1 rounded bg-indigo-600 text-white">
                  Download Word
                </button>
                <button onClick={() => setOpen(false)} className="px-3 py-1 rounded bg-gray-200">
                  Close
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto">
              {loading && <div className="text-sm text-gray-600">Loading example consultation notes…</div>}
              {!loading && err && (
                <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                  {err}
                </div>
              )}
              {!loading && (
                <article className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeText}</ReactMarkdown>
                </article>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}