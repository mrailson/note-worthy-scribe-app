import React, { useEffect, useMemo, useState } from "react";
import { CleanRule, cleanTranscripts, loadRules, saveRules } from "@/lib/transcriptCleaner";
import { NHS_DEFAULT_RULES } from "@/lib/nhsDefaultRules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Download, Upload, RefreshCw, Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

type Props = {
  transcripts: string[]; // e.g., [assembly, deepgram, whisper, browser]
  onCleaned?: (results: { cleaned: string; appliedRuleIds: string[] }[]) => void;
};

export default function TranscriptCleanerPanel({ transcripts, onCleaned }: Props) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<CleanRule[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewOut, setPreviewOut] = useState("");
  const [rawImport, setRawImport] = useState("");

  useEffect(() => {
    const existing = loadRules();
    if (existing.length) { 
      setRules(existing); 
    } else { 
      setRules(NHS_DEFAULT_RULES); 
      saveRules(NHS_DEFAULT_RULES); 
    }
  }, []);

  const currentPreview = useMemo(() => transcripts[previewIdx] ?? "", [transcripts, previewIdx]);

  useEffect(() => {
    const [res] = cleanTranscripts([currentPreview], rules);
    setPreviewOut(res.cleaned);
  }, [currentPreview, rules]);

  const addRule = () => {
    const nr: CleanRule = {
      id: `rule_${Date.now()}`,
      find: "", 
      replace: "", 
      enabled: true, 
      caseInsensitive: true, 
      wordBoundary: true, 
      isRegex: false,
    };
    const next = [...rules, nr]; 
    setRules(next); 
    saveRules(next);
  };

  const updateRule = (id: string, patch: Partial<CleanRule>) => {
    const next = rules.map(r => r.id === id ? { ...r, ...patch } : r);
    setRules(next); 
    saveRules(next);
  };

  const deleteRule = (id: string) => {
    const next = rules.filter(r => r.id !== id);
    setRules(next); 
    saveRules(next);
  };

  const resetToDefaults = () => { 
    setRules(NHS_DEFAULT_RULES); 
    saveRules(NHS_DEFAULT_RULES);
    toast.success("Rules reset to NHS defaults");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); 
    a.href = url; 
    a.download = "nhs-cleaner-rules.json"; 
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rules exported successfully");
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(rawImport) as CleanRule[];
      if (!Array.isArray(parsed)) throw new Error("Invalid JSON");
      setRules(parsed); 
      saveRules(parsed); 
      setRawImport("");
      toast.success("Rules imported successfully");
    } catch (e: any) { 
      toast.error("Import failed: " + e?.message); 
    }
  };

  const applyToAll = () => {
    const cleaned = cleanTranscripts(transcripts, rules).map(r => ({
      cleaned: r.cleaned, 
      appliedRuleIds: r.appliedRuleIds,
    }));
    onCleaned?.(cleaned);
    setOpen(false);
    toast.success("Transcripts cleaned and updated");
  };

  const serviceNames = ["AssemblyAI", "Deepgram", "Whisper", "Browser Speech"];

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          onClick={() => setOpen(true)}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Open Transcript Cleaner
        </Button>
        <Button 
          onClick={applyToAll}
          className="flex items-center gap-2"
          disabled={transcripts.every(t => !t?.trim())}
        >
          <FileText className="w-4 h-4" />
          Clean All Transcripts
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] w-full max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">NHS Transcript Cleaner — Admin</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-12 gap-6 overflow-auto max-h-[calc(90vh-6rem)]">
            {/* Rules */}
            <div className="col-span-12 lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Rules ({rules.length})</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addRule} className="flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    Add Rule
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetToDefaults} className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Reset
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportJson} className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-auto">
                {rules.map((r, index) => (
                  <Card key={r.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Switch 
                        checked={r.enabled !== false}
                        onCheckedChange={(checked) => updateRule(r.id, { enabled: checked })} 
                      />
                      <Label className="text-sm">Enabled</Label>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {index + 1}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Find</Label>
                        <Input 
                          value={r.find}
                          onChange={(e) => updateRule(r.id, { find: e.target.value })} 
                          placeholder="Text to find"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Replace</Label>
                        <Input 
                          value={r.replace}
                          onChange={(e) => updateRule(r.id, { replace: e.target.value })} 
                          placeholder="Replacement text"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`regex-${r.id}`}
                          checked={!!r.isRegex}
                          onCheckedChange={(checked) => updateRule(r.id, { isRegex: checked })}
                        />
                        <Label htmlFor={`regex-${r.id}`} className="text-sm">Regex</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`case-${r.id}`}
                          checked={r.caseInsensitive !== false}
                          onCheckedChange={(checked) => updateRule(r.id, { caseInsensitive: checked })}
                        />
                        <Label htmlFor={`case-${r.id}`} className="text-sm">Case-insensitive</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`boundary-${r.id}`}
                          checked={r.wordBoundary !== false}
                          onCheckedChange={(checked) => updateRule(r.id, { wordBoundary: checked })}
                        />
                        <Label htmlFor={`boundary-${r.id}`} className="text-sm">Word boundary</Label>
                      </div>

                      <Button 
                        size="sm"
                        variant="destructive" 
                        onClick={() => deleteRule(r.id)}
                        className="ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import Rules (JSON)
                </h4>
                <Textarea 
                  className="min-h-[120px] font-mono text-sm"
                  placeholder="Paste JSON array of rules…" 
                  value={rawImport}
                  onChange={(e) => setRawImport(e.target.value)} 
                />
                <div className="flex justify-end">
                  <Button onClick={importJson} disabled={!rawImport.trim()}>
                    Import Rules
                  </Button>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="col-span-12 lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preview</h3>
                <Select value={previewIdx.toString()} onValueChange={(value) => setPreviewIdx(parseInt(value, 10))}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transcripts.map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {serviceNames[i] || `Transcript ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Original</Label>
                  <Textarea 
                    className="min-h-[220px] font-mono text-sm" 
                    readOnly 
                    value={currentPreview}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cleaned (Live Preview)</Label>
                  <Textarea 
                    className="min-h-[220px] font-mono text-sm bg-muted/50" 
                    readOnly 
                    value={previewOut}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t">
                <Button onClick={applyToAll} className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Apply to All & Return
                </Button>
                <div className="text-sm text-muted-foreground">
                  Cleans all transcripts and updates the comparison view
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}