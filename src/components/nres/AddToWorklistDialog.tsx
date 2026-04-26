import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useNarpWorklists,
  useCreateWorklist,
  useAddPatientsToWorklist,
} from "@/hooks/useNarpWorklists";

export interface AddToWorklistPatient {
  fk_patient_link_id: string;
  added_risk_tier?: string | null;
  added_poa?: number | null;
  added_polos?: number | null;
  added_drug_count?: number | null;
  added_frailty_category?: string | null;
}

interface AddToWorklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string | null | undefined;
  practiceName?: string;
  cohortLabel?: string;
  patients: AddToWorklistPatient[];
  /** Optional: clear the source selection on success */
  onAdded?: (worklistId: string, addedCount: number) => void;
}

export const AddToWorklistDialog = ({
  open, onOpenChange, practiceId, practiceName,
  cohortLabel, patients, onAdded,
}: AddToWorklistDialogProps) => {
  const { data: worklists = [], isLoading } = useNarpWorklists(practiceId);
  const createWorklist = useCreateWorklist();
  const addPatients = useAddPatientsToWorklist();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const reset = () => {
    setMode("existing");
    setSelectedId(null);
    setNewTitle("");
    setNewDescription("");
  };

  const handleConfirm = async () => {
    if (!practiceId) {
      toast.error("Select a single practice first");
      return;
    }
    if (!patients.length) {
      toast.info("No patients selected");
      return;
    }

    try {
      let worklistId = selectedId;
      if (mode === "new") {
        if (newTitle.trim().length < 3) {
          toast.error("Worklist name must be at least 3 characters");
          return;
        }
        const created = await createWorklist.mutateAsync({
          practice_id: practiceId,
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          cohort_label: cohortLabel,
        });
        worklistId = created.id;
      }

      if (!worklistId) {
        toast.error("Pick or create a worklist");
        return;
      }

      const result = await addPatients.mutateAsync({
        worklist_id: worklistId,
        patients,
      });

      toast.success(
        result.inserted
          ? `Added ${result.inserted} patient${result.inserted === 1 ? "" : "s"} to worklist`
          : "All selected patients are already on this worklist",
      );
      onAdded?.(worklistId, result.inserted);
      reset();
      onOpenChange(false);
    } catch (err) {
      // mutations already toast; nothing else to do
      console.error("[AddToWorklistDialog] confirm failed", err);
    }
  };

  const busy = createWorklist.isPending || addPatients.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[min(720px,calc(100vh-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Add to clinical worklist
          </DialogTitle>
          <DialogDescription>
            {patients.length} patient{patients.length === 1 ? "" : "s"} from{" "}
            <span className="font-medium">{practiceName ?? "this practice"}</span>
            {cohortLabel ? <> · cohort: <span className="italic">{cohortLabel}</span></> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">
          {!practiceId && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2">
              Select a single practice (not "All Practices") to use worklists.
            </div>
          )}

          {practiceId && (
            <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === "existing" ? "default" : "outline"}
                onClick={() => setMode("existing")}
              >
                Existing worklist
              </Button>
              <Button
                size="sm"
                variant={mode === "new" ? "default" : "outline"}
                onClick={() => setMode("new")}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New worklist
              </Button>
            </div>

            {mode === "existing" && (
              <div className="space-y-2">
                {isLoading && <p className="text-xs text-muted-foreground">Loading worklists…</p>}
                {!isLoading && worklists.length === 0 && (
                  <div className="text-xs text-muted-foreground border rounded-md p-3">
                    No open worklists for this practice yet. Create one above.
                  </div>
                )}
                {!isLoading && worklists.length > 0 && (
                  <ScrollArea className="h-40 sm:h-56 border rounded-md">
                    <ul className="divide-y">
                      {worklists.map((w) => (
                        <li key={w.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(w.id)}
                            className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                              selectedId === w.id ? "bg-muted" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-sm">{w.title}</div>
                              <Badge variant="outline" className="text-[10px]">
                                {w.status}
                              </Badge>
                            </div>
                            {w.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {w.description}
                              </div>
                            )}
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Created {new Date(w.created_at).toLocaleDateString("en-GB")}
                              {w.created_by_email ? ` · ${w.created_by_email}` : ""}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wl-title" className="text-xs">Worklist name</Label>
                  <Input
                    id="wl-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. November high-risk MDT review"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wl-desc" className="text-xs">Description (optional)</Label>
                  <Textarea
                    id="wl-desc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Why this cohort, how it will be used"
                    rows={3}
                  />
                </div>
              </div>
            )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-6 py-3 sm:px-8">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={
              busy ||
              !practiceId ||
              !patients.length ||
              (mode === "existing" && !selectedId) ||
              (mode === "new" && newTitle.trim().length < 3)
            }
          >
            {busy ? "Saving…" : `Add ${patients.length} patient${patients.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
