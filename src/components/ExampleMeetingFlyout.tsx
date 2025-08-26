"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

type ApiResult = {
  meta?: Record<string, any>;
  styles: {
    decisions_and_actions?: string;
    secretariat_resolution?: string;
    formal_minutes?: string;
    action_notes?: string;
    headline_summary?: string;
    narrative_newsletter?: string;
    decision_log?: string;
    annotated_summary?: string;
  };
};

const SETTINGS = {
  title: "Practice Management / Partners' Meeting",
  practice: "Oak Lane Medical Practice",
  date: "2025-08-22",
  time: "19:00",
  venue: "Oak Lane Medical Practice - Meeting Room",
  chair: "Dr John Smith",
  attendees: ["GP Partners", "Practice Manager (Sarah Trisson)"]
};

const SAMPLE_TRANSCRIPT = `
Right, thanks everyone for staying on after surgery. We'll try to keep this to about half an hour…

First: patient list numbers, +~120 this month, list now ~12,600…

Winter planning: ICB expects high demand (children resp., frail elderly). We need to ensure adequate staffing levels and consider locum coverage for peak periods.

Complaints & telephony: 3 formal complaints this month + ~10 informal concerns. One patient waited 45 minutes on hold. Queue message is confusing patients. Reception team received complaint about tone and manner.

Finance/workforce: PCN DES Q1 targets still outstanding - need to submit by end of month. Locum costs were £7,800 in July which is above budget. Salaried GP recruitment remains challenging. Should we consider recruiting a Nurse Practitioner instead?

Energy costs: Running at ~£1,500 per month, need to factor this into Q3 forecast. Explore solar panel installation and energy efficiency grants.

Clinical governance: Docman workflow delay identified but no patient harm. Prescribing error - wrong formulation dispensed but caught before patient harm. Implement daily safety huddles and additional prescription checks.

CQC compliance: Missing admin training certificates for 2 staff members. Infection control audits outstanding - must upload evidence by month-end to avoid compliance issues.

Action items:
- Sarah to submit PCN DES targets by Friday
- Dr Smith to review energy efficiency grant applications
- All partners to attend mandatory training update next week
- Reception team training on telephone manner scheduled for Monday
- Daily safety huddles to commence immediately
`.trim();

export default function ExampleMeetingFlyout({
  buttonClassName = "px-3 py-2 rounded bg-background border hover:bg-accent hover:text-accent-foreground"
}: { buttonClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"action_notes" | "formal_minutes">("action_notes");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);

  useEffect(() => {
    if (!open || data || loading) return;
    
    const fetchExample = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: result, error } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
          body: {
            transcript: SAMPLE_TRANSCRIPT,
            settings: SETTINGS
          }
        });

        if (error) throw error;
        setData(result as ApiResult);
      } catch (e: any) {
        console.error('Error fetching example:', e);
        setErr(e?.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    fetchExample();
  }, [open, data, loading]);

  const activeText =
    activeTab === "action_notes"
      ? data?.styles?.action_notes || ""
      : data?.styles?.formal_minutes || "";

  async function copy() {
    if (activeText) {
      await navigator.clipboard.writeText(activeText);
    }
  }

  async function downloadDocx() {
    if (!activeText) return;
    
    const filename =
      activeTab === "action_notes" ? "oak-lane-action-notes" : "oak-lane-formal-minutes";
    
    try {
      const { data: result, error } = await supabase.functions.invoke('export-docx', {
        body: { 
          markdown: activeText, 
          filename: `${filename}.docx`
        }
      });

      if (error) throw error;

      // Create blob and download
      const blob = new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Download error:', e);
      setErr(`Export failed: ${e.message}`);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button className={buttonClassName} onClick={() => setOpen(true)}>
        Show Example Meeting
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Fly-out */}
          <aside className="absolute right-0 top-0 h-full w-full max-w-3xl bg-background shadow-xl z-50 flex flex-col border-l">
            {/* Header */}
            <div className="border-b p-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">Example Meeting – Oak Lane Medical Practice</h2>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setActiveTab("action_notes")}
                  className={`px-3 py-1 rounded text-sm ${
                    activeTab === "action_notes" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted-foreground/10"
                  }`}
                >
                  Action Notes
                </button>
                <button
                  onClick={() => setActiveTab("formal_minutes")}
                  className={`px-3 py-1 rounded text-sm ${
                    activeTab === "formal_minutes" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted-foreground/10"
                  }`}
                >
                  Formal Minutes
                </button>
                <button 
                  onClick={copy} 
                  className="px-3 py-1 rounded text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Copy
                </button>
                <button 
                  onClick={downloadDocx} 
                  className="px-3 py-1 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Download Word
                </button>
                <button 
                  onClick={() => setOpen(false)} 
                  className="px-3 py-1 rounded text-sm bg-muted hover:bg-muted-foreground/10"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {loading && (
                <div className="text-sm text-muted-foreground">Loading example meeting notes...</div>
              )}
              {err && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded border">
                  {err}
                </div>
              )}
              {!loading && !err && activeText && (
                <article className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeText}</ReactMarkdown>
                </article>
              )}
              {!loading && !err && !activeText && (
                <div className="text-sm text-muted-foreground">No content available for this format.</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}