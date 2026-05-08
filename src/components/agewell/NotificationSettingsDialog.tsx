import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

type Mode = "all" | "completed_only";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationSettingsDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("agewell_notification_settings")
        .select("id, recipients, mode")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({ title: "Could not load settings", description: error.message, variant: "destructive" });
      } else if (data) {
        setRowId(data.id);
        setRecipients(data.recipients || []);
        setMode((data.mode as Mode) || "all");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, toast]);

  const addDraft = () => {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!EMAIL_RE.test(v)) {
      toast({ title: "Invalid email", description: v, variant: "destructive" });
      return;
    }
    if (recipients.includes(v)) { setDraft(""); return; }
    setRecipients((r) => [...r, v]);
    setDraft("");
  };

  const removeRecipient = (email: string) => {
    setRecipients((r) => r.filter((e) => e !== email));
  };

  const save = async () => {
    if (recipients.length === 0) {
      toast({ title: "Add at least one recipient", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      recipients,
      mode,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    };
    const { error } = rowId
      ? await supabase.from("agewell_notification_settings").update(payload).eq("id", rowId)
      : await supabase.from("agewell_notification_settings").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Notification settings saved" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Survey notification settings</DialogTitle>
          <DialogDescription>
            Choose who is emailed when an Ageing Well feedback survey is submitted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm font-semibold">Send email for</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="mt-2 space-y-2">
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="all" id="mode-all" className="mt-1" />
                  <div>
                    <Label htmlFor="mode-all" className="font-medium cursor-pointer">All submissions</Label>
                    <p className="text-xs text-muted-foreground">Email every survey, including those abandoned partway through.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="completed_only" id="mode-completed" className="mt-1" />
                  <div>
                    <Label htmlFor="mode-completed" className="font-medium cursor-pointer">Completed surveys only</Label>
                    <p className="text-xs text-muted-foreground">Only email when the respondent reaches the end (overall rating recorded).</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-semibold">Recipients</Label>
              <p className="text-xs text-muted-foreground mb-2">Add as many as you need. Press Enter or click Add.</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraft(); } }}
                />
                <Button type="button" variant="secondary" onClick={addDraft}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 min-h-[2rem]">
                {recipients.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No recipients yet.</span>
                )}
                {recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="ml-1 rounded-full hover:bg-background/50 p-0.5"
                      aria-label={`Remove ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
