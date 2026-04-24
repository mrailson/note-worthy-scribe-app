import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/utils/downloadFile";

/**
 * NRES — Identifiable CSV export reason + consent modal.
 *
 * Collects:
 *   • free-text reason (≥ 10 chars)
 *   • explicit consent acknowledgement
 *
 * Then calls the `narp-export-identifiable` edge function which:
 *   • re-checks the user's `can_export_narp_identifiable` permission
 *   • decrypts NHS number / forename / surname inside Postgres
 *   • returns the CSV bytes (base64) + SHA-256 checksum
 *   • writes one row to `narp_export_log` capturing user, practice,
 *     reason, consent, row count and checksum.
 */

interface IdentifiableExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string | null;
  practiceName?: string;
  cohortLabel?: string;
  /** Optional: restrict the export to a specific list of patients (e.g. cohort selection). */
  fkPatientLinkIds?: string[];
  /** Visible row count from the drawer — shown to the user as guidance. */
  rowCountHint?: number;
}

export const IdentifiableExportModal = ({
  open,
  onOpenChange,
  practiceId,
  practiceName,
  cohortLabel,
  fkPatientLinkIds,
  rowCountHint,
}: IdentifiableExportModalProps) => {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setAcknowledged(false);
      setSubmitting(false);
    }
  }, [open]);

  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= 10;
  const canSubmit = reasonValid && acknowledged && !!practiceId && !submitting;

  const handleExport = async () => {
    if (!practiceId) {
      toast.error("No practice selected");
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("narp-export-identifiable", {
        body: {
          practice_id: practiceId,
          practice_name: practiceName,
          reason_text: reason.trim(),
          consent_acknowledged: true,
          cohort_label: cohortLabel,
          fk_patient_link_ids:
            fkPatientLinkIds && fkPatientLinkIds.length > 0 ? fkPatientLinkIds : undefined,
        },
      });

      if (error) {
        console.error("[IdentifiableExportModal] invoke failed", error);
        toast.error(error.message || "Export failed — see console for details");
        return;
      }
      if (!data?.csv_base64) {
        toast.error("Export returned no data");
        return;
      }

      // Decode base64 → Blob → trigger download
      const binary = atob(data.csv_base64 as string);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        downloadFile(url, data.filename ?? "narp-identifiable.csv");
      } finally {
        // Allow the click to flush before revoking
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      toast.success(
        `Exported ${data.row_count?.toLocaleString("en-GB") ?? "?"} rows. Audit row written.`,
      );
      onOpenChange(false);
    } catch (err) {
      console.error("[IdentifiableExportModal] unexpected", err);
      toast.error("Unexpected error during export");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!submitting ? onOpenChange(o) : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            Export with identifiers
          </DialogTitle>
          <DialogDescription>
            This export contains identifiable patient data (NHS number and name). Access is
            audit-logged against your account under the NMoC Data Sharing Agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-8 sm:px-10 py-4">
          {/* Context strip */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Practice</span>
              <span className="font-medium">{practiceName ?? "—"}</span>
            </div>
            {typeof rowCountHint === "number" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rows in current view</span>
                <span className="font-medium tabular-nums">
                  {rowCountHint.toLocaleString("en-GB")}
                </span>
              </div>
            )}
            {cohortLabel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cohort</span>
                <span className="font-medium">{cohortLabel}</span>
              </div>
            )}
          </div>

          {/* Warning banner */}
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              The exported CSV will include NHS number, surname and forename. Handle this file
              in line with your DSA: store on approved systems only, do not email externally,
              and delete when no longer required.
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="export-reason" className="text-sm font-medium">
              Reason for identifiable export <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="export-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. MDT preparation for high-risk frailty cohort, week of 28 Apr"
              rows={3}
              className="text-sm"
              disabled={submitting}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Minimum 10 characters</span>
              <span className={reasonValid ? "text-emerald-600" : ""}>
                {reasonLength}/10
              </span>
            </div>
          </div>

          {/* Consent */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="export-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
              disabled={submitting}
            />
            <Label htmlFor="export-ack" className="text-xs leading-relaxed font-normal">
              I confirm I have a legitimate need to access this identifiable data, will handle
              it under the NMoC Data Sharing Agreement, and understand this export is logged
              against my account.
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-8 sm:px-10 py-4 border-t bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={!canSubmit}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Export with identifiers
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
