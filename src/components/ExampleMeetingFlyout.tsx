import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ApiResult = {
  meta?: Record<string, any>;
  styles: {
    decisions_and_actions: string;
    secretariat_resolution: string;
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

Winter planning: ICB expects high demand (children resp., frail elderly)…

Complaints & telephony: 3 formal + ~10 informal; one 45-min call wait; queue message confusing; reception tone complaint…

Finance/workforce: PCN DES Q1 outstanding; locum £7,800 (July); salaried GP recruitment weak; consider Nurse Practitioner…

Energy: ~£1,500/m; factor into forecast; explore solar/efficiency grants…

Clinical governance: Docman workflow delay (no harm); prescribing wrong formulation (no harm); safety huddle + daily checks…

CQC: missing admin training certificates; infection control audits outstanding — upload by month-end.

Regarding the prescribing incident - Dr Jones mentioned it was caught by our double-check system before dispensing. We should update the training schedule for the new locums on formulation selection. Sarah will coordinate with the clinical lead.

For the energy costs, Dr Smith suggested we review the heating schedule and possibly invest in programmable thermostats. This could save us 10-15% according to the NHS sustainability team guidelines.

The CQC preparation is critical - we have 3 weeks to complete all outstanding training certificates and upload the infection control audit results. All partners need to review their mandatory training status by Friday.

Next meeting scheduled for September 15th, same time. Meeting closed at 19:28.
`.trim();

interface ExampleMeetingFlyoutProps {
  buttonClassName?: string;
}

export default function ExampleMeetingFlyout({
  buttonClassName = "px-3 py-2 rounded bg-muted hover:bg-muted/80 text-sm"
}: ExampleMeetingFlyoutProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"decisions_and_actions" | "secretariat_resolution">("decisions_and_actions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);

  useEffect(() => {
    if (!open || data || loading) return;
    
    const fetchExample = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data: result, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
          body: {
            transcript: SAMPLE_TRANSCRIPT,
            settings: SETTINGS
          }
        });

        if (functionError) {
          throw new Error(functionError.message || 'Failed to generate example meeting notes');
        }

        setData(result as ApiResult);
      } catch (e: any) {
        console.error('Error generating example meeting notes:', e);
        setError(e?.message || "Unexpected error generating example");
      } finally {
        setLoading(false);
      }
    };

    fetchExample();
  }, [open, data, loading]);

  const activeText = data?.styles?.[activeTab] || "";

  const copy = async () => {
    if (activeText) {
      try {
        await navigator.clipboard.writeText(activeText);
        toast.success("Copied to clipboard");
      } catch (e) {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  const downloadDocx = async () => {
    if (!activeText) return;
    
    try {
      const filename = activeTab === "decisions_and_actions" 
        ? "oak-lane-decisions-and-actions" 
        : "oak-lane-secretariat-resolution";

      const { data: blob, error } = await supabase.functions.invoke('export-docx', {
        body: { 
          markdown: activeText, 
          filename 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Create download link
      const url = URL.createObjectURL(new Blob([blob]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      toast.success("Document downloaded");
    } catch (e: any) {
      console.error('Export error:', e);
      toast.error(`Export failed: ${e.message}`);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <Button 
        variant="outline" 
        size="sm"
        className={buttonClassName}
        onClick={() => setOpen(true)}
      >
        Show Example Meeting
      </Button>

      {/* Sheet/Flyout */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-hidden flex flex-col">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-lg font-semibold">
              Example Meeting – Oak Lane Medical Practice
            </SheetTitle>
          </SheetHeader>
          
          {/* Tab Controls */}
          <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
            <Button
              variant={activeTab === "decisions_and_actions" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("decisions_and_actions")}
            >
              Decisions & Actions
            </Button>
            <Button
              variant={activeTab === "secretariat_resolution" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("secretariat_resolution")}
            >
              Resolution Minutes
            </Button>
            
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={copy} disabled={!activeText}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadDocx} disabled={!activeText}>
                <Download className="w-4 h-4 mr-2" />
                Download Word
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="text-sm text-muted-foreground">Loading example meeting notes...</div>
              </div>
            )}
            
            {error && (
              <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            
            {!loading && !error && activeText && (
              <article className="prose prose-slate max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeText}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}