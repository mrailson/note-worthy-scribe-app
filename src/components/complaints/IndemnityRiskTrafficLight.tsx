import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  RefreshCw,
  Info,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/utils/toastWrapper";
import { logComplaintActionWithMetadata } from "@/utils/auditLogger";

type RiskLevel = "green" | "amber" | "red";
type Recommendation = "no_action" | "consider_mdo" | "contact_mdo_now";
type Mdo = "mdu" | "mps" | "other" | "unknown";

interface Assessment {
  id: string;
  complaint_id: string;
  risk_level: RiskLevel;
  recommendation: Recommendation;
  suggested_mdo: Mdo;
  rationale: string[];
  red_flags: string[];
  confidence: number;
  generated_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  is_stale: boolean;
}

interface Props {
  complaintId: string;
}

const LEVEL_STYLES: Record<RiskLevel, { wrap: string; chip: string; pulse: boolean; icon: JSX.Element; label: string }> = {
  green: {
    wrap: "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800",
    chip: "bg-green-600 text-white",
    pulse: false,
    icon: <ShieldCheck className="h-5 w-5" />,
    label: "Low risk",
  },
  amber: {
    wrap: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
    chip: "bg-amber-500 text-white",
    pulse: true,
    icon: <ShieldQuestion className="h-5 w-5" />,
    label: "Amber — consider MDO",
  },
  red: {
    wrap: "border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-800",
    chip: "bg-red-600 text-white",
    pulse: true,
    icon: <ShieldAlert className="h-5 w-5" />,
    label: "Red — contact MDO",
  },
};

const REC_TEXT: Record<Recommendation, string> = {
  no_action: "No medico-legal escalation indicators detected.",
  consider_mdo: "Best practice: consider contacting your MDO (MDU/MPS) before responding.",
  contact_mdo_now: "Strongly recommended: contact your MDO (MDU/MPS) now before responding.",
};

const MDO_LABEL: Record<Mdo, string> = {
  mdu: "MDU",
  mps: "MPS",
  other: "Other MDO",
  unknown: "MDU / MPS",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

export const IndemnityRiskTrafficLight = ({ complaintId }: Props) => {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("complaint_indemnity_risk_assessments")
      .select("*")
      .eq("complaint_id", complaintId)
      .maybeSingle();
    if (error) console.error("Load risk assessment failed:", error);
    setAssessment((data as Assessment) ?? null);
    setLoading(false);
    return data as Assessment | null;
  }, [complaintId]);

  const runAssessment = useCallback(async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("assess-complaint-indemnity-risk", {
        body: { complaintId },
      });
      if (error) throw error;
      if (data?.assessment) {
        setAssessment(data.assessment as Assessment);
        showToast.success("Indemnity risk assessed", { section: "complaints" });
      }
    } catch (e: any) {
      console.error("Risk assessment failed:", e);
      showToast.error(e?.message || "Failed to assess indemnity risk", { section: "complaints" });
    } finally {
      setRunning(false);
    }
  }, [complaintId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await load();
      if (cancelled) return;
      if (!existing) await runAssessment();
    })();
    return () => {
      cancelled = true;
    };
  }, [load, runAssessment]);

  const acknowledge = async () => {
    if (!user || !assessment) return;
    const { error } = await supabase
      .from("complaint_indemnity_risk_assessments")
      .update({ acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
      .eq("id", assessment.id);
    if (error) {
      showToast.error("Failed to acknowledge", { section: "complaints" });
      return;
    }
    setAssessment({ ...assessment, acknowledged_by: user.id, acknowledged_at: new Date().toISOString() });
    await logComplaintActionWithMetadata(
      complaintId,
      "indemnity_risk_acknowledged",
      `Indemnity risk (${assessment.risk_level.toUpperCase()}) acknowledged`,
      user.id,
    );
    showToast.success("Risk acknowledged", { section: "complaints" });
  };

  if (loading) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Loading indemnity risk…
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">No indemnity risk assessment yet.</span>
        <Button size="sm" variant="outline" onClick={runAssessment} disabled={running}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", running && "animate-spin")} />
          {running ? "Assessing…" : "Assess now"}
        </Button>
      </div>
    );
  }

  const style = LEVEL_STYLES[assessment.risk_level];
  const needsAck = assessment.risk_level !== "green" && !assessment.acknowledged_at;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "rounded-lg border-2 p-3 transition-all",
          style.wrap,
          needsAck && style.pulse && "animate-pulse-slow",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className={cn("rounded-full p-1.5 shrink-0", style.chip)}>{style.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold uppercase tracking-wide">Indemnity Risk: {assessment.risk_level}</span>
                <Badge variant="outline" className="text-[10px]">
                  {MDO_LABEL[assessment.suggested_mdo]}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Advisory only — generated by AI from the complaint text. Does not replace MDO advice. The registered clinician retains responsibility.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm font-medium mt-0.5">{REC_TEXT[assessment.recommendation]}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {needsAck && (
              <Button size="sm" variant="outline" onClick={acknowledge} className="h-7 text-xs">
                <Check className="h-3.5 w-3.5 mr-1" />
                Acknowledge
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={runAssessment} disabled={running} className="h-7 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", running && "animate-spin")} />
              Re-assess
            </Button>
          </div>
        </div>

        {(assessment.rationale?.length ?? 0) > 0 && (
          <ul className="mt-2 ml-9 space-y-0.5">
            {assessment.rationale.map((r, i) => (
              <li key={i} className="text-xs flex gap-1.5">
                <span className="opacity-60">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {(assessment.red_flags?.length ?? 0) > 0 && (
          <div className="mt-2 ml-9 flex flex-wrap gap-1">
            {assessment.red_flags.map((f, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 ml-9 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Confidence {Math.round(assessment.confidence * 100)}%</span>
          <span>Updated {formatTime(assessment.generated_at)}</span>
          {assessment.acknowledged_at && (
            <span className="text-green-700 dark:text-green-400">Acknowledged {formatTime(assessment.acknowledged_at)}</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
