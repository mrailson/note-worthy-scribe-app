import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { userNameCorrections } from "@/utils/UserNameCorrections";
import { Copy, Plus, X, Save } from "lucide-react";

interface FindReplacePanelProps {
  getCurrentText: () => string;
  onApply: (updatedText: string) => void;
}

export default function FindReplacePanel({ getCurrentText, onApply }: FindReplacePanelProps) {
  const { toast } = useToast();
  const [replaceWith, setReplaceWith] = useState("");
  const [findInput, setFindInput] = useState("");
  const [finds, setFinds] = useState<string[]>([]);
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const canApply = replaceWith.trim().length > 0 && finds.length > 0;

  const previewText = useMemo(() => {
    if (!canApply) return "";
    const current = getCurrentText();
    let updated = current;
    finds.forEach((f) => {
      const pattern = new RegExp(`\\b${escapeRegex(f.trim())}\\b`, "gi");
      updated = updated.replace(pattern, replaceWith.trim());
    });
    return updated;
  }, [finds, replaceWith, getCurrentText, canApply]);

  const addFind = () => {
    const items = findInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = Array.from(new Set([...finds, ...items]));
    setFinds(next);
    setFindInput("");
  };

  const removeFind = (term: string) => {
    setFinds((prev) => prev.filter((f) => f !== term));
  };

  const applyOnly = async () => {
    if (!canApply) return;
    setIsSaving(true);
    
    try {
      // If "save for future" is checked, persist the corrections
      if (saveForFuture) {
        for (const f of finds) {
          await userNameCorrections.addCorrection(f, replaceWith.trim());
        }
        await userNameCorrections.loadCorrections(); // Refresh cache
      }
      
      onApply(previewText);
      toast({ 
        title: saveForFuture ? "Applied & Saved" : "Applied", 
        description: saveForFuture 
          ? "Changes applied and saved for future meetings." 
          : "Changes applied to current transcript." 
      });
    } catch {
      toast({ title: "Error", description: "Failed to save corrections.", variant: "destructive" as any });
    } finally {
      setIsSaving(false);
    }
  };

  const applyAndCopy = async () => {
    if (!canApply) return;
    setIsSaving(true);
    
    try {
      // If "save for future" is checked, persist the corrections
      if (saveForFuture) {
        for (const f of finds) {
          await userNameCorrections.addCorrection(f, replaceWith.trim());
        }
        await userNameCorrections.loadCorrections();
      }
      
      onApply(previewText);
      await navigator.clipboard.writeText(previewText);
      toast({ 
        title: saveForFuture ? "Copied & Saved" : "Copied", 
        description: saveForFuture 
          ? "Updated transcript copied and corrections saved for future." 
          : "Updated transcript copied." 
      });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was blocked.", variant: "destructive" as any });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="p-4 border rounded-lg bg-accent/10 space-y-3">
      <div className="flex items-center gap-2">
        <Label className="min-w-[110px]">Replace with</Label>
        <Input
          value={replaceWith}
          onChange={(e) => setReplaceWith(e.target.value)}
          placeholder="e.g., Dr Smith"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="min-w-[110px]">Find variants</Label>
          <Input
            value={findInput}
            onChange={(e) => setFindInput(e.target.value)}
            placeholder="Add one or comma-separated variants"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFind();
              }
            }}
          />
          <Button variant="outline" size="sm" onClick={addFind}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      {finds.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-[110px]">
            {finds.map((term) => (
              <Badge key={term} variant="secondary" className="flex items-center gap-1">
                {term}
                <button aria-label={`Remove ${term}`} onClick={() => removeFind(term)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pl-[110px]">
        <Checkbox
          id="save-for-future"
          checked={saveForFuture}
          onCheckedChange={(checked) => setSaveForFuture(checked === true)}
        />
        <Label htmlFor="save-for-future" className="text-sm cursor-pointer">
          Remember for future meetings
        </Label>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={applyOnly} disabled={!canApply || isSaving}>
          {isSaving ? "Saving..." : "Apply"}
        </Button>
        <Button variant="outline" size="sm" onClick={applyAndCopy} disabled={!canApply || isSaving}>
          <Copy className="h-4 w-4 mr-1" /> Apply & Copy
        </Button>
      </div>

      {saveForFuture && canApply && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <Save className="h-3 w-3" />
          These corrections will be applied automatically to future transcriptions.
        </div>
      )}
    </div>
  );
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
