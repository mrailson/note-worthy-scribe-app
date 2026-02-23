import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, AlertTriangle, Upload, FileText } from "lucide-react";
import { ProjectRisk, AssuranceItem, RiskDocument, getRatingFromScore, getRatingBadgeStyles } from "./projectRisksData";
import { toast } from "sonner";
import { PersonSelect } from "@/components/sda/PersonSelect";

interface RiskEditDialogProps {
  risk: ProjectRisk | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: ProjectRisk) => void;
}

export const RiskEditDialog = ({ risk, open, onOpenChange, onSave }: RiskEditDialogProps) => {
  const [likelihood, setLikelihood] = useState(1);
  const [consequence, setConsequence] = useState(1);
  const [mitigation, setMitigation] = useState("");
  const [concerns, setConcerns] = useState("");
  const [owner, setOwner] = useState("");
  const [lastReviewed, setLastReviewed] = useState("");
  const [indicators, setIndicators] = useState<AssuranceItem[]>([]);
  const [documents, setDocuments] = useState<RiskDocument[]>([]);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  useEffect(() => {
    if (risk) {
      setLikelihood(risk.currentLikelihood);
      setConsequence(risk.currentConsequence);
      setMitigation(risk.mitigation);
      setConcerns(risk.concerns);
      setOwner(risk.owner);
      setLastReviewed(risk.lastReviewed);
      setIndicators(risk.assuranceIndicators.map(i => ({ ...i })));
      setDocuments(risk.documents ? [...risk.documents] : []);
    }
  }, [risk]);

  const handleFileAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: RiskDocument[] = [];
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds 20MB limit.`);
        return;
      }
      newDocs.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      });
    });
    if (newDocs.length > 0) {
      setDocuments(prev => [...prev, ...newDocs]);
    }
    e.target.value = '';
  }, []);

  if (!risk) return null;

  const score = likelihood * consequence;
  const rating = getRatingFromScore(score);
  const badgeStyles = getRatingBadgeStyles(score);

  const handleSave = () => {
    onSave({
      ...risk,
      currentLikelihood: likelihood,
      currentConsequence: consequence,
      currentScore: score,
      mitigation,
      concerns,
      owner,
      lastReviewed,
      assuranceIndicators: indicators,
      documents,
    });
    onOpenChange(false);
  };

  const removeDocument = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addIndicator = () => {
    const newId = indicators.length > 0 ? Math.max(...indicators.map(i => i.id)) + 1 : 1;
    setIndicators([...indicators, { id: newId, text: "", completed: false }]);
  };

  const updateIndicatorText = (id: number, text: string) => {
    setIndicators(indicators.map(i => i.id === id ? { ...i, text } : i));
  };

  const toggleIndicatorCompleted = (id: number) => {
    setIndicators(indicators.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  };

  const removeIndicator = (id: number) => {
    setIndicators(indicators.filter(i => i.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-8rem)] overflow-y-auto bg-white px-8 sm:px-10">
        <DialogHeader className="pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#005EB8] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">Edit Risk</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{risk.risk}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Score */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <Label className="font-semibold text-slate-800 text-sm">Current Risk Score</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Likelihood</Label>
                <Select value={String(likelihood)} onValueChange={(v) => setLikelihood(Number(v))}>
                  <SelectTrigger className="w-20 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground font-bold text-lg">×</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Consequence</Label>
                <Select value={String(consequence)} onValueChange={(v) => setConsequence(Number(v))}>
                  <SelectTrigger className="w-20 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground font-bold text-lg">=</span>
              <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-1.5">
                <span className="text-xl font-bold text-slate-900">{score}</span>
                <Badge variant="outline" className={`${badgeStyles} text-xs`}>{rating}</Badge>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Original score: {risk.originalLikelihood} × {risk.originalConsequence} = {risk.originalScore}
            </p>
          </div>

          {/* Key Concerns */}
          <div className="space-y-2">
            <Label className="font-semibold text-slate-800 text-sm">Key Concerns</Label>
            <Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={3} className="bg-white" />
          </div>

          {/* Mitigation */}
          <div className="space-y-2">
            <Label className="font-semibold text-slate-800 text-sm">Mitigation</Label>
            <Textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={3} className="bg-white" />
          </div>

          {/* Owner & Last Reviewed side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold text-slate-800 text-sm">Owner</Label>
              <PersonSelect value={owner} onChange={setOwner} placeholder="Select owner" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-slate-800 text-sm">Last Reviewed</Label>
              <Input value={lastReviewed} onChange={(e) => setLastReviewed(e.target.value)} placeholder="e.g. Jan-26" className="bg-white" />
            </div>
          </div>

          {/* Assurance Indicators */}
          <div className="space-y-3">
            <Label className="font-semibold text-slate-800 text-sm">Assurance Indicators</Label>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {indicators.map((indicator) => (
                <div key={indicator.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={indicator.completed}
                    onCheckedChange={() => toggleIndicatorCompleted(indicator.id)}
                    className="h-4 w-4"
                  />
                  <Input
                    value={indicator.text}
                    onChange={(e) => updateIndicatorText(indicator.id, e.target.value)}
                    className="flex-1 h-9 text-sm border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
                    placeholder="Indicator text"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeIndicator(indicator.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {indicators.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No indicators yet. Add one below.
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={addIndicator}>
              <Plus className="h-3 w-3 mr-1" /> Add Indicator
            </Button>
          </div>

          {/* Documents */}
          <div className="space-y-3">
            <Label className="font-semibold text-slate-800 text-sm">Documents</Label>
            {documents.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-3 w-3 mr-1" /> Add Files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileAdd}
                  />
                </label>
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1">Any format, max 20MB per file</p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-[#005EB8] hover:bg-[#004F9E]">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
