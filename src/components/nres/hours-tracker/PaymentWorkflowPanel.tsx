import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import type { BuyBackClaim } from "@/hooks/useNRESBuyBackClaims";

export type PaymentStatusValue =
  | "received"
  | "entered_on_system"
  | "scheduled"
  | "payment_sent"
  | "queried";

interface PaymentAuditEntry {
  status: PaymentStatusValue;
  user_email: string;
  timestamp: string;
  notes?: string;
}

const STATUS_CONFIG: Record<
  PaymentStatusValue,
  { label: string; icon: React.ReactNode; colour: string; bgClass: string }
> = {
  received: {
    label: "Received",
    icon: <FileText className="w-3.5 h-3.5" />,
    colour: "text-blue-700",
    bgClass: "bg-blue-100 dark:bg-blue-900/40",
  },
  entered_on_system: {
    label: "Entered on System",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    colour: "text-indigo-700",
    bgClass: "bg-indigo-100 dark:bg-indigo-900/40",
  },
  scheduled: {
    label: "Scheduled for Payment",
    icon: <Clock className="w-3.5 h-3.5" />,
    colour: "text-amber-700",
    bgClass: "bg-amber-100 dark:bg-amber-900/40",
  },
  payment_sent: {
    label: "Payment Sent",
    icon: <CreditCard className="w-3.5 h-3.5" />,
    colour: "text-green-700",
    bgClass: "bg-green-100 dark:bg-green-900/40",
  },
  queried: {
    label: "Queried",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    colour: "text-orange-700",
    bgClass: "bg-orange-100 dark:bg-orange-900/40",
  },
};

const STATUS_ORDER: PaymentStatusValue[] = [
  "received",
  "entered_on_system",
  "scheduled",
  "payment_sent",
];

function getNextStatuses(current: PaymentStatusValue | null): PaymentStatusValue[] {
  if (!current || current === "queried") {
    // From queried or null, can go to any non-terminal status
    return ["received", "entered_on_system", "scheduled", "payment_sent"];
  }
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return [];
  // Next status in sequence
  return [STATUS_ORDER[idx + 1]];
}

interface PaymentWorkflowPanelProps {
  claim: BuyBackClaim;
  onUpdatePayment: (
    claimId: string,
    updates: {
      payment_status?: PaymentStatusValue;
      pml_po_reference?: string;
      payment_method?: string;
      bacs_reference?: string;
      expected_payment_date?: string;
      actual_payment_date?: string;
      payment_notes?: string;
    }
  ) => Promise<void>;
  saving?: boolean;
}

export const PaymentWorkflowPanel: React.FC<PaymentWorkflowPanelProps> = ({
  claim,
  onUpdatePayment,
  saving,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [queryReason, setQueryReason] = useState("");
  const [showQueryInput, setShowQueryInput] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState("");

  const currentStatus = (claim as any).payment_status as PaymentStatusValue | null;
  const auditTrail = ((claim as any).payment_audit_trail || []) as PaymentAuditEntry[];
  const poRef = (claim as any).pml_po_reference || "";
  const paymentMethod = (claim as any).payment_method || "";
  const bacsRef = (claim as any).bacs_reference || "";
  const expectedDate = (claim as any).expected_payment_date || "";
  const actualDate = (claim as any).actual_payment_date || "";
  const paymentNotes = (claim as any).payment_notes || "";

  // Local editable state for fields
  const [localPO, setLocalPO] = useState(poRef);
  const [localMethod, setLocalMethod] = useState(paymentMethod);
  const [localBACS, setLocalBACS] = useState(bacsRef);
  const [localExpected, setLocalExpected] = useState(expectedDate);
  const [localActual, setLocalActual] = useState(actualDate);
  const [localNotes, setLocalNotes] = useState(paymentNotes);

  // Sync from claim on mount / change
  React.useEffect(() => {
    setLocalPO((claim as any).pml_po_reference || "");
    setLocalMethod((claim as any).payment_method || "");
    setLocalBACS((claim as any).bacs_reference || "");
    setLocalExpected((claim as any).expected_payment_date || "");
    setLocalActual((claim as any).actual_payment_date || "");
    setLocalNotes((claim as any).payment_notes || "");
  }, [claim]);

  const nextStatuses = getNextStatuses(currentStatus);
  const isTerminal = currentStatus === "payment_sent";

  const handleTransition = async (newStatus: PaymentStatusValue) => {
    await onUpdatePayment(claim.id, {
      payment_status: newStatus,
      pml_po_reference: localPO || undefined,
      payment_method: localMethod || undefined,
      bacs_reference: localBACS || undefined,
      expected_payment_date: localExpected || undefined,
      actual_payment_date: newStatus === "payment_sent" ? localActual || new Date().toISOString().split("T")[0] : localActual || undefined,
      payment_notes: transitionNotes || localNotes || undefined,
    });
    setTransitionNotes("");
  };

  const handleQuery = async () => {
    if (!queryReason.trim()) return;
    await onUpdatePayment(claim.id, {
      payment_status: "queried",
      payment_notes: queryReason,
    });
    setQueryReason("");
    setShowQueryInput(false);
  };

  const handleSaveFields = async () => {
    await onUpdatePayment(claim.id, {
      pml_po_reference: localPO || undefined,
      payment_method: localMethod || undefined,
      bacs_reference: localBACS || undefined,
      expected_payment_date: localExpected || undefined,
      actual_payment_date: localActual || undefined,
      payment_notes: localNotes || undefined,
    });
  };

  const currentConfig = currentStatus ? STATUS_CONFIG[currentStatus] : null;

  return (
    <div className="border-t bg-emerald-50/50 dark:bg-emerald-950/20">
      {/* Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Payment Processing
          </span>
          {currentConfig && (
            <Badge variant="secondary" className={`text-[10px] px-2 py-0 h-5 border-0 ${currentConfig.bgClass} ${currentConfig.colour}`}>
              {currentConfig.icon}
              <span className="ml-1">{currentConfig.label}</span>
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Status Progress */}
          <div className="flex items-center gap-1">
            {STATUS_ORDER.map((s, i) => {
              const cfg = STATUS_CONFIG[s];
              const currentIdx = currentStatus ? STATUS_ORDER.indexOf(currentStatus) : -1;
              const isActive = s === currentStatus;
              const isPast = currentIdx >= 0 && STATUS_ORDER.indexOf(s) < currentIdx;
              const isQueried = currentStatus === "queried";
              return (
                <React.Fragment key={s}>
                  {i > 0 && (
                    <div className={`h-0.5 flex-1 ${isPast || isActive ? "bg-emerald-400" : isQueried ? "bg-orange-300" : "bg-border"}`} />
                  )}
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap ${
                      isActive
                        ? `${cfg.bgClass} ${cfg.colour}`
                        : isPast
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cfg.icon}
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Queried warning */}
          {currentStatus === "queried" && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="text-xs text-orange-800 dark:text-orange-200">
                <strong>Invoice Queried</strong> — this invoice has been paused with a query. NRES has been notified. Resolve the query then advance to the next status.
              </div>
            </div>
          )}

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">PML PO / Internal Ref</label>
              <Input
                className="text-xs mt-1 h-8"
                placeholder="e.g. PO-2026-001"
                value={localPO}
                onChange={e => setLocalPO(e.target.value)}
                disabled={isTerminal}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Payment Method</label>
              <Select value={localMethod} onValueChange={setLocalMethod} disabled={isTerminal}>
                <SelectTrigger className="text-xs mt-1 h-8">
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BACS">BACS</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">BACS Reference</label>
              <Input
                className="text-xs mt-1 h-8"
                placeholder="BACS ref number..."
                value={localBACS}
                onChange={e => setLocalBACS(e.target.value)}
                disabled={isTerminal}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Expected Payment Date</label>
              <Input
                type="date"
                className="text-xs mt-1 h-8"
                value={localExpected}
                onChange={e => setLocalExpected(e.target.value)}
                disabled={isTerminal}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Actual Payment Date</label>
              <Input
                type="date"
                className="text-xs mt-1 h-8"
                value={localActual}
                onChange={e => setLocalActual(e.target.value)}
                disabled={isTerminal}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
              <Textarea
                className="text-xs mt-1 min-h-[32px] resize-none"
                rows={1}
                placeholder="Payment notes..."
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                disabled={isTerminal}
              />
            </div>
          </div>

          {/* Save fields button */}
          {!isTerminal && (
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSaveFields} disabled={saving}>
                Save Details
              </Button>
            </div>
          )}

          {/* Status transition actions */}
          {!isTerminal && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Advance Status</p>
              {nextStatuses.length > 0 && (
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      className="text-xs h-8"
                      placeholder="Transition notes (optional)..."
                      value={transitionNotes}
                      onChange={e => setTransitionNotes(e.target.value)}
                    />
                  </div>
                  {nextStatuses.map(ns => {
                    const cfg = STATUS_CONFIG[ns];
                    return (
                      <Button
                        key={ns}
                        size="sm"
                        className={`h-8 text-xs gap-1 ${
                          ns === "payment_sent"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                        onClick={() => handleTransition(ns)}
                        disabled={saving}
                      >
                        {cfg.icon} {cfg.label}
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Query action */}
              {!showQueryInput ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-orange-400 text-orange-700 hover:bg-orange-50"
                  onClick={() => setShowQueryInput(true)}
                  disabled={saving || currentStatus === "queried"}
                >
                  <AlertTriangle className="w-3 h-3" /> Query Invoice
                </Button>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      className="text-xs h-8"
                      placeholder="Query reason (required)..."
                      value={queryReason}
                      onChange={e => setQueryReason(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleQuery}
                    disabled={saving || !queryReason.trim()}
                  >
                    <Send className="w-3 h-3" /> Send Query
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => { setShowQueryInput(false); setQueryReason(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Audit Trail */}
          {auditTrail.length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Payment Audit Trail</p>
              <div className="space-y-0">
                {auditTrail.map((entry, i) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  return (
                    <div key={i} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-1.5 min-w-[140px]">
                        <div className={`w-2 h-2 rounded-full ${
                          entry.status === "queried" ? "bg-orange-500"
                          : entry.status === "payment_sent" ? "bg-green-500"
                          : "bg-indigo-500"
                        }`} />
                        <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 border-0 ${cfg?.bgClass} ${cfg?.colour}`}>
                          {cfg?.label || entry.status}
                        </Badge>
                      </div>
                      <div className="flex-1 text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">{entry.user_email}</span>
                        <span className="mx-1">—</span>
                        <span>{format(new Date(entry.timestamp), "dd/MM/yyyy")} at {format(new Date(entry.timestamp), "HH:mm")}</span>
                        {entry.notes && (
                          <p className="mt-0.5 text-muted-foreground italic">"{entry.notes}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
