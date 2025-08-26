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
  title: "Practice Management / Partners' Meeting",
  practice: "Oak Lane Medical Practice",
  date: "2025-08-22",
  time: "19:00",
  venue: "Oak Lane Medical Practice - Meeting Room",
  chair: "Dr John Smith",
  attendees: ["GP Partners", "Practice Manager (Sarah Trisson)"],
};

const SAMPLE_TRANSCRIPT = `Right, thanks everyone for staying on after surgery. We'll try to keep this to about half an hour if we can, though there are quite a few things to get through today. First, just to check, does anyone have any urgent items to add to the agenda before we start? No? Okay, great. Let's begin.

So, the first thing is the patient list numbers. We've seen a small increase again this month, around 120 new registrations, mostly younger families and a few people moving in from nearby practices. This does mean our list size is now just over 12,600, which is putting additional pressure on our capacity, particularly in terms of appointments and repeat prescribing workload. We need to think about whether we're at a point where we can justify requesting an additional ARRS role or whether we need to reconfigure our current allocation. We'll come back to ARRS roles later on the agenda, but keep that in mind.

Next up, winter planning. We had the briefing from the ICB about anticipated seasonal pressures, and it looks like demand is expected to be high again, particularly with respiratory infections in children and frail elderly patients. They're encouraging practices to expand same-day access wherever possible and to work closely with the neighbourhood team for home visiting and frailty. Our current same-day capacity is stretched already, and last week we had days where we were well over the safe limits. We either need to look at extending duty doctor hours or using some of the PCN acute visiting service more actively. How do we feel about that? I know duty is already a sticking point for most of us, but if we can't create more same-day appointments, we'll just end up with an overwhelmed reception team and more complaints. Maybe we can pilot having an extra session on Mondays and Fridays for the next two months. That might help with peaks.

Speaking of complaints, I've looked at the last month's feedback and complaints log. We had three formal complaints and about ten bits of informal feedback, mostly related to waiting times and call queues. One patient said they were waiting 45 minutes on the phone, which is obviously not acceptable. We've been trialling the new cloud-based telephony, and while call quality is better, the queuing system seems to be confusing patients. They think they're being cut off when actually they're in the queue. We might need to add a clearer message or update the call-back option so patients understand what's happening. Also, one complaint was about an interaction with a receptionist—tone of voice described as rude and unhelpful. We know the team are under pressure, but we'll need to do another round of customer service training and maybe a short refresher on conflict management. I'll get a quote for that and bring it back next month.

Next item: finances. We're still waiting on the PCN DES payment for Q1, which is frustrating because it affects our cash flow. In the meantime, locum costs have gone up again. July's locum spend was about £7,800, largely due to annual leave cover and sickness. We can't sustain that long term, so we need to think about whether we can bring in a salaried doctor. The problem is recruitment—we've had the advert out for months with barely any interest. Do we consider another nurse practitioner instead? They can pick up minor illness and some chronic disease work, which might relieve the GPs a bit. But we need to weigh that against QOF performance and patient expectations. Patients still want to see a GP, and while NPs are great, there's a perception issue we can't ignore.

While we're on finances, the energy bills have gone up again. We're now paying nearly £1,500 a month for gas and electric. We could look at another energy supplier, but realistically, the savings will be minimal. Longer term, we might want to explore solar panels or some sort of efficiency grant. For now, though, we'll just need to factor this into our forecast. I'll share the updated cash flow spreadsheet on Teams after the meeting.

Moving on to clinical governance. We've had a couple of significant events to review. One was a delay in sending out blood results because of an issue with Docman workflow. The patient wasn't harmed, but it could have been serious if the medication change had been urgent. We need to remind all clinicians to check their workflow daily and set up a backup system if someone is off unexpectedly. The other event was a prescribing error—wrong formulation of a drug issued. Again, no harm done, but it's a learning point. We should probably do a quick safety huddle about that and make sure everyone's confident with the new prescribing alerts in SystmOne.

Also, CQC compliance. We've still got some outstanding actions from the last mock inspection, particularly around staff training records and infection control audits. Most of the clinical staff are up to date, but we're missing certificates for some admin staff. Can we make it a priority to upload those by the end of the month?`;

const FALLBACK_DANDA = `| Field | Details |
|---|---|
| **Meeting** | Practice Management / Partners' Meeting |
| **Practice** | Oak Lane Medical Practice |
| **Date/Time** | 2025-08-22 / 19:00 |
| **Venue** | Oak Lane Medical Practice - Meeting Room |
| **Chair** | Dr John Smith |
| **Attendees** | GP Partners; Practice Manager (Sarah Trisson) |

## Decisions / Consensus
1. **Noted** list growth to ~12,600 (≈+120 this month) with pressure on appointments and repeat prescribing.
2. **In principle** strengthen winter same-day access; **pilot extra sessions on Mondays & Fridays for 2 months** (final sign-off TBC).
3. **Agreed** to revise cloud-telephony queue/callback messaging and test with live callers.
4. **Agreed** to arrange **customer-service & conflict** refresher training; quote to next meeting.
5. **Agreed** to implement **Docman daily-check SOP** and hold a **prescribing safety huddle**.
6. **Agreed** to complete **CQC** actions by **month-end**.

## Actions Log
| Ref | Action | Owner | Due | Status |
|---|---|---|---|---|
| A1 | ARRS options paper (new role vs reallocation) | PM + CDs | Next meeting | Open |
| A2 | Winter plan + **Mon/Fri pilot** | Ops/Duty Lead | 1 week | Open |
| A3 | Telephony prompts: queue/callback | IT/Telephony Lead | 2 weeks | Open |
| A4 | Service/conflict training quote | PM/Training Lead | Next meeting | Open |
| A5 | Docman SOP + spot audit | Clinical Gov Lead | 1 week | Open |
| A6 | Prescribing safety huddle | Medicines Lead | 2 weeks | Open |
| A7 | Upload admin certs; complete IPC items | HR / IPC Lead | Month-end | Open |`;

const FALLBACK_RES = `1. **Resolved/Noted:** Practice list ~**12,600** (≈+120 this month), increasing pressure on appointments and repeat prescribing.
2. **Resolved (in principle):** Pilot extra **Mon/Fri** same-day sessions for 2 months (subject to rota/rooms).
3. **Resolved:** Update **queue/callback** telephony messaging; test with live callers.
4. **Resolved:** Arrange **customer-service & conflict** refresher training.
5. **Resolved:** Implement **Docman daily-check SOP** and hold a **prescribing safety huddle**.
6. **Resolved:** Complete **CQC** gaps (admin certificates; infection control) by **month-end**.

**Annex A – Action Schedule**

| Ref | Task | Lead | Contributors | Deadline |
|---|---|---|---|---|
| R1 | Finalise winter plan & pilot metrics | Ops/Duty Lead | Rota Admin | 1 week |
| R2 | Telephony prompts + QA tests | IT/Telephony Lead | PM; Reception Leads | 2 weeks |
| R3 | Service/conflict training: quote + dates | PM/Training Lead | HR | Next meeting |
| R4 | Docman SOP: publish + audit | Clinical Gov Lead | All clinicians | 1 week |
| R5 | Prescribing safety huddle (S1 alerts) | Medicines Lead | CDs | 2 weeks |
| R6 | Upload admin certificates; complete IPC | HR / IPC Lead | — | Month-end |`;

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
        ? "decisions-and-actions"
        : tab === "resolution"
        ? "secretariat-resolution"
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
        Show Example Meeting
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="border-b p-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">Example Meeting — Oak Lane Medical Practice</h2>

              {/* clearly switchable tabs */}
              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => setTab("danda")}
                  className={`px-3 py-1 rounded border ${
                    tab === "danda" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  title="View Decisions & Actions (mapped from action_notes)"
                >
                  Decisions & Actions
                </button>
                <button
                  onClick={() => setTab("resolution")}
                  className={`px-3 py-1 rounded border ${
                    tab === "resolution" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
                  }`}
                  title="View Resolution Minutes (mapped from decision_log)"
                >
                  Resolution Minutes
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
              {loading && <div className="text-sm text-gray-600">Loading example meeting notes…</div>}
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