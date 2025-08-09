import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { Copy, Plus, X } from "lucide-react";

interface FindReplacePanelProps {
  getCurrentText: () => string;
  onApply: (updatedText: string) => void;
}

export default function FindReplacePanel({ getCurrentText, onApply }: FindReplacePanelProps) {
  const { toast } = useToast();
  const [replaceWith, setReplaceWith] = useState("");
  const [findInput, setFindInput] = useState("");
  const [finds, setFinds] = useState<string[]>([]);
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

  const applyOnly = () => {
    if (!canApply) return;
    onApply(previewText);
    toast({ title: "Applied", description: "Changes applied to current transcript." });
  };

  const applyAndCopy = async () => {
    if (!canApply) return;
    onApply(previewText);
    try {
      await navigator.clipboard.writeText(previewText);
      toast({ title: "Copied", description: "Updated transcript copied." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was blocked.", variant: "destructive" as any });
    }
  };

  const saveAndApply = async () => {
    if (!canApply) return;
    try {
      // Save each find variant as its own correction mapping to the same replacement
      for (const f of finds) {
        await medicalTermCorrector.addCorrection(f, replaceWith);
      }
      // Refresh in-memory corrections for future use
      await medicalTermCorrector.refreshCorrections();
      onApply(previewText);
      toast({ title: "Saved", description: "Corrections saved and applied." });
    } catch {
      toast({ title: "Save failed", description: "Could not save corrections.", variant: "destructive" as any });
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

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={applyOnly} disabled={!canApply}>
          Apply only
        </Button>
        <Button variant="outline" size="sm" onClick={applyAndCopy} disabled={!canApply}>
          <Copy className="h-4 w-4 mr-1" /> Apply & Copy
        </Button>
        <Button size="sm" onClick={saveAndApply} disabled={!canApply}>
          Save & Apply for future
        </Button>
      </div>

      {canApply && (
        <div className="mt-2 text-xs text-muted-foreground">
          This will also update future transcriptions automatically.
        </div>
      )}
    </div>
  );
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
