import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { showToast } from "@/utils/toastWrapper";
import { logComplaintActionWithMetadata } from "@/utils/auditLogger";

interface IndemnityConsiderationFieldProps {
  complaintId: string;
  isOutcomeFinalised: boolean;
}

const INDEMNITY_OPTIONS = [
  {
    value: "advice_not_required",
    label: "Advice not required",
    helper: "Low-risk service or communication issue only",
    showProvider: false,
    showNotes: false,
  },
  {
    value: "advice_considered_not_required",
    label: "Advice considered — not required at this stage",
    helper: "Reviewed internally, no clinical or legal risk identified",
    showProvider: false,
    showNotes: false,
  },
  {
    value: "advice_sought",
    label: "Advice sought from medical defence organisation",
    helper: "",
    showProvider: true,
    showNotes: false,
  },
  {
    value: "advice_planned",
    label: "Advice planned before outcome is issued",
    helper: "",
    showProvider: false,
    showNotes: true,
  },
] as const;

type IndemnityStatus = (typeof INDEMNITY_OPTIONS)[number]["value"];

export const IndemnityConsiderationField = ({
  complaintId,
  isOutcomeFinalised,
}: IndemnityConsiderationFieldProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<IndemnityStatus | "">("");
  const [providerName, setProviderName] = useState("");
  const [notes, setNotes] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  // Fetch existing selection
  useEffect(() => {
    const fetchExisting = async () => {
      if (!complaintId) return;

      try {
        const { data, error } = await supabase
          .from("complaint_indemnity_considerations" as any)
          .select("*")
          .eq("complaint_id", complaintId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching indemnity consideration:", error);
          return;
        }

        if (data) {
          const record = data as any;
          setStatus(record.consideration_status || "");
          setProviderName(record.provider_name || "");
          setNotes(record.notes || "");
          setIsLocked(record.is_locked || false);
          setExistingId(record.id);
        }
      } catch (err) {
        console.error("Error loading indemnity consideration:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();
  }, [complaintId]);

  const locked = isLocked || isOutcomeFinalised;

  const handleStatusChange = async (newStatus: string) => {
    if (!user?.id || locked) return;

    const oldStatus = status;
    setStatus(newStatus as IndemnityStatus);

    // Clear fields that don't apply to the new selection
    const option = INDEMNITY_OPTIONS.find((o) => o.value === newStatus);
    if (!option?.showProvider) setProviderName("");
    if (!option?.showNotes) setNotes("");

    await saveSelection(newStatus as IndemnityStatus, providerName, notes, oldStatus);
  };

  const handleProviderBlur = async () => {
    if (!status || locked) return;
    await saveSelection(status as IndemnityStatus, providerName, notes);
  };

  const handleNotesBlur = async () => {
    if (!status || locked) return;
    await saveSelection(status as IndemnityStatus, providerName, notes);
  };

  const saveSelection = async (
    newStatus: IndemnityStatus,
    provider: string,
    notesValue: string,
    oldStatus?: string
  ) => {
    if (!user?.id || !complaintId) return;

    setSaving(true);
    try {
      const payload = {
        complaint_id: complaintId,
        consideration_status: newStatus,
        provider_name: provider || null,
        notes: notesValue || null,
        selected_by: user.id,
      };

      let error;
      if (existingId) {
        const result = await supabase
          .from("complaint_indemnity_considerations" as any)
          .update({
            consideration_status: newStatus,
            provider_name: provider || null,
            notes: notesValue || null,
          } as any)
          .eq("id", existingId);
        error = result.error;
      } else {
        const result = await supabase
          .from("complaint_indemnity_considerations" as any)
          .insert(payload as any)
          .select()
          .single();
        error = result.error;
        if (!error && result.data) {
          setExistingId((result.data as any).id);
        }
      }

      if (error) {
        console.error("Error saving indemnity consideration:", error);
        showToast.error("Failed to save indemnity consideration", {
          section: "complaints",
        });
        return;
      }

      // Audit log the change
      await logComplaintActionWithMetadata(
        complaintId,
        "indemnity_consideration_updated",
        `Indemnity consideration updated`,
        oldStatus ? { consideration_status: oldStatus } : undefined,
        { consideration_status: newStatus }
      );
    } catch (err) {
      console.error("Error saving indemnity consideration:", err);
      showToast.error("Failed to save indemnity consideration", {
        section: "complaints",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedOption = INDEMNITY_OPTIONS.find((o) => o.value === status);

  if (loading) {
    return null;
  }

  return (
    <div className="border rounded p-3 bg-muted/20 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <Label className="text-xs font-medium">Indemnity consideration</Label>

        <Select
          value={status}
          onValueChange={handleStatusChange}
          disabled={locked}
        >
          <SelectTrigger className="h-8 text-xs w-auto min-w-[220px] max-w-[320px]">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {INDEMNITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {saving && (
          <span className="text-[10px] text-muted-foreground">Saving…</span>
        )}
      </div>

      {/* Helper note for the selected option */}
      {selectedOption?.helper && (
        <p className="text-[11px] text-muted-foreground italic pl-6">
          {selectedOption.helper}
        </p>
      )}

      {/* Provider field — shown for "advice_sought" */}
      {selectedOption?.showProvider && (
        <div className="flex items-center gap-2 pl-6">
          <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
            Provider:
          </Label>
          <Input
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            onBlur={handleProviderBlur}
            placeholder="e.g. MDU, MPS, MDDUS"
            disabled={locked}
            className="h-7 text-xs max-w-[240px]"
          />
        </div>
      )}

      {/* Notes field — shown for "advice_planned" */}
      {selectedOption?.showNotes && (
        <div className="pl-6">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Notes (optional)…"
            disabled={locked}
            className="text-xs min-h-[40px] resize-none"
            rows={1}
          />
        </div>
      )}

      {locked && (
        <p className="text-[10px] text-muted-foreground italic pl-6">
          Locked — outcome finalised.
        </p>
      )}

      <p className="text-[9px] text-muted-foreground/50 pl-6">
        Internal only — not included in patient correspondence.
      </p>
    </div>
  );
};
