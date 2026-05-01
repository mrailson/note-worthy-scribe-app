import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isSuspectStartTime } from "@/utils/meetingTimeFormat";

export interface EditableMeeting {
  id: string;
  title: string;
  start_time: string | null;
  meeting_format: string | null;
  meeting_location: string | null;
}

interface EditMeetingMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: EditableMeeting | null;
  onSaved?: (updated: Partial<EditableMeeting>) => void;
}

type Tz = "Europe/London" | "UTC";

/**
 * Convert a UTC ISO string into local-form values (date YYYY-MM-DD and
 * time HH:mm) for the chosen timezone, suitable for <input> elements.
 */
function isoToLocalParts(iso: string | null, tz: Tz): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map(p => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * Convert a date+time entered in the chosen timezone back to a UTC ISO
 * string for storage.
 *
 * For Europe/London we work out the offset for that wall-clock moment
 * (handles BST/GMT switchover correctly).
 */
function localPartsToIso(date: string, time: string, tz: Tz): string | null {
  if (!date || !time) return null;
  if (tz === "UTC") {
    return new Date(`${date}T${time}:00Z`).toISOString();
  }
  // Europe/London — derive the offset for the wall-clock instant.
  // Step 1: treat the entered values as if they were UTC.
  const asUtc = new Date(`${date}T${time}:00Z`);
  // Step 2: ask Intl what those UTC values look like in London. Compare
  // to the entered values to compute the offset that should actually apply.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(asUtc).map(p => [p.type, p.value])
  );
  const londonAtAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    0
  );
  const offsetMs = asUtc.getTime() - londonAtAsUtc;
  return new Date(asUtc.getTime() + offsetMs).toISOString();
}

const FORMAT_OPTIONS = [
  { value: "teams", label: "MS Teams / video call" },
  { value: "face-to-face", label: "Face to face" },
  { value: "hybrid", label: "Hybrid" },
];

export const EditMeetingMetadataDialog = ({
  open,
  onOpenChange,
  meeting,
  onSaved,
}: EditMeetingMetadataDialogProps) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [tz, setTz] = useState<Tz>("Europe/London");
  const [meetingFormat, setMeetingFormat] = useState<string>("teams");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  // Hydrate fields whenever a new meeting is opened.
  useEffect(() => {
    if (!meeting) return;
    setTitle(meeting.title || "");
    const parts = isoToLocalParts(meeting.start_time, "Europe/London");
    setDate(parts.date);
    setTime(parts.time);
    setTz("Europe/London");
    setMeetingFormat(meeting.meeting_format || "teams");
    setLocation(meeting.meeting_location || "");
  }, [meeting]);

  const suspect = useMemo(
    () => isSuspectStartTime(meeting?.start_time),
    [meeting?.start_time]
  );

  const handleSave = async () => {
    if (!meeting) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const newIso = localPartsToIso(date, time, tz);
    if (date && time && !newIso) {
      toast.error("Could not parse the date/time you entered");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("You must be signed in to edit meeting details");
        setSaving(false);
        return;
      }

      // Build diff against original values for the audit log.
      const changes: Array<{ field: string; oldVal: unknown; newVal: unknown }> = [];
      if (title !== (meeting.title || "")) {
        changes.push({ field: "title", oldVal: meeting.title, newVal: title });
      }
      if (newIso && newIso !== meeting.start_time) {
        changes.push({ field: "start_time", oldVal: meeting.start_time, newVal: newIso });
      }
      if ((meetingFormat || null) !== (meeting.meeting_format || null)) {
        changes.push({
          field: "meeting_format",
          oldVal: meeting.meeting_format,
          newVal: meetingFormat,
        });
      }
      const newLoc = location.trim() || null;
      if (newLoc !== (meeting.meeting_location || null)) {
        changes.push({
          field: "meeting_location",
          oldVal: meeting.meeting_location,
          newVal: newLoc,
        });
      }

      if (changes.length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        onOpenChange(false);
        return;
      }

      // Apply update.
      const updatePayload: Record<string, unknown> = {
        title,
        meeting_format: meetingFormat,
        meeting_location: newLoc,
      };
      if (newIso) updatePayload.start_time = newIso;

      const { error: updateError } = await supabase
        .from("meetings")
        .update(updatePayload)
        .eq("id", meeting.id);
      if (updateError) throw updateError;

      // Write audit rows (best-effort — don't block on failures).
      const auditRows = changes.map(c => ({
        meeting_id: meeting.id,
        edited_by: userId,
        field_name: c.field,
        old_value: c.oldVal === undefined ? null : (c.oldVal as never),
        new_value: c.newVal === undefined ? null : (c.newVal as never),
      }));
      const { error: auditError } = await supabase
        .from("meeting_metadata_audit")
        .insert(auditRows);
      if (auditError) {
        console.warn("Audit log write failed:", auditError);
      }

      toast.success("Meeting details updated");
      onSaved?.({
        title,
        start_time: newIso ?? meeting.start_time,
        meeting_format: meetingFormat,
        meeting_location: newLoc,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update meeting metadata:", err);
      toast.error("Could not save changes — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit meeting details</DialogTitle>
          <DialogDescription>
            Correct the recorded title, date, time or format. Changes are
            audit-logged and used the next time notes are regenerated.
          </DialogDescription>
        </DialogHeader>

        {suspect && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              The stored start time looks like a scheduled value rather than the
              actual recording moment. Please verify the date and time below.
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="emm-title">Title</Label>
            <Input
              id="emm-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="emm-date">Date</Label>
              <Input
                id="emm-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emm-time">Start time</Label>
              <Input
                id="emm-time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="emm-tz">Timezone</Label>
            <Select value={tz} onValueChange={v => setTz(v as Tz)}>
              <SelectTrigger id="emm-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/London">
                  Europe/London (GMT/BST)
                </SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="emm-format">Meeting format</Label>
            <Select value={meetingFormat} onValueChange={setMeetingFormat}>
              <SelectTrigger id="emm-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="emm-location">Location (optional)</Label>
            <Input
              id="emm-location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Practice meeting room"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
