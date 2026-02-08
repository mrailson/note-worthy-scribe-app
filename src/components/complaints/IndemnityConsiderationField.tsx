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
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Indemnity consideration</Label>
        {saving && (
          <span className="text-xs text-muted-foreground ml-auto">Saving…</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Some complaints benefit from early advice from a medical defence
        organisation before correspondence is finalised.
      </p>

      <Select
        value={status}
        onValueChange={handleStatusChange}
        disabled={locked}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select consideration status" />
        </SelectTrigger>
        <SelectContent>
          {INDEMNITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Helper note for the selected option */}
      {selectedOption?.helper && (
        <p className="text-xs text-muted-foreground italic pl-1">
          {selectedOption.helper}
        </p>
      )}

      {/* Provider field — shown for "advice_sought" */}
      {selectedOption?.showProvider && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Provider (e.g. MDU, MPS, MDDUS, other)
          </Label>
          <Input
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            onBlur={handleProviderBlur}
            placeholder="e.g. MDU"
            disabled={locked}
            className="text-sm"
          />
        </div>
      )}

      {/* Notes field — shown for "advice_planned" */}
      {selectedOption?.showNotes && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Notes (optional)
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Any additional notes…"
            disabled={locked}
            className="text-sm min-h-[60px]"
            rows={2}
          />
        </div>
      )}

      {locked && (
        <p className="text-xs text-muted-foreground italic">
          This field is locked as the outcome has been finalised.
        </p>
      )}

      {/* Discreet footer */}
      <p className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/50">
        Shared to support learning and service improvement — not to attribute
        fault.
      </p>
    </div>
  );
};
