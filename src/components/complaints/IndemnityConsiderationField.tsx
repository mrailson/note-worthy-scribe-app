import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { showToast } from "@/utils/toastWrapper";
import { logComplaintActionWithMetadata } from "@/utils/auditLogger";

interface IndemnityConsiderationFieldProps {
  complaintId: string;
  isOutcomeFinalised: boolean;
}

const INDEMNITY_OPTIONS = [
  { value: "not_applicable", label: "Not applicable" },
  { value: "advice_sought", label: "Advice sought from MDO" },
  { value: "advice_planned", label: "Advice to be sought" },
  { value: "mdu_contacted", label: "MDU contacted" },
  { value: "mps_contacted", label: "MPS contacted" },
  { value: "other_mdo", label: "Other MDO contacted" },
  { value: "under_review", label: "Under review" },
] as const;

type IndemnityStatus = (typeof INDEMNITY_OPTIONS)[number]["value"];

export const IndemnityConsiderationField = ({
  complaintId,
  isOutcomeFinalised,
}: IndemnityConsiderationFieldProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<IndemnityStatus | "">("");
  const [notes, setNotes] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const { data, error } = await supabase
          .from("complaint_indemnity_considerations")
          .select("*")
          .eq("complaint_id", complaintId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching indemnity consideration:", error);
          return;
        }

        if (data) {
          setStatus(data.consideration_status as IndemnityStatus);
          setNotes(data.notes || "");
          setIsLocked(data.is_locked || false);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();
  }, [complaintId]);

  const handleStatusChange = async (newStatus: IndemnityStatus) => {
    if (isLocked || isOutcomeFinalised || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("complaint_indemnity_considerations")
        .upsert(
          {
            complaint_id: complaintId,
            consideration_status: newStatus,
            selected_by: user.id,
            notes,
            is_locked: false,
          },
          { onConflict: "complaint_id" }
        );

      if (error) throw error;

      setStatus(newStatus);

      await logComplaintActionWithMetadata(
        complaintId,
        "indemnity_consideration_updated",
        `Indemnity consideration set to: ${newStatus}`,
        user.id
      );

      showToast.success("Indemnity consideration updated", {
        section: "complaints",
      });
    } catch (error) {
      console.error("Error saving indemnity consideration:", error);
      showToast.error("Failed to save indemnity consideration", {
        section: "complaints",
      });
    } finally {
      setSaving(false);
    }
  };

  const disabled = isLocked || isOutcomeFinalised || saving;

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Indemnity Consideration</Label>
        {isLocked && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        )}
      </div>
      <Select
        value={status}
        onValueChange={(val) => handleStatusChange(val as IndemnityStatus)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select status..." />
        </SelectTrigger>
        <SelectContent>
          {INDEMNITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Internal only — not included in patient correspondence
      </p>
    </div>
  );
};
