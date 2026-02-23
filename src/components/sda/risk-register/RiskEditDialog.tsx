import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { ProjectRisk, AssuranceItem, getRatingFromScore, getRatingBadgeStyles } from "./projectRisksData";

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

  useEffect(() => {
    if (risk) {
      setLikelihood(risk.currentLikelihood);
      setConsequence(risk.currentConsequence);
      setMitigation(risk.mitigation);
      setConcerns(risk.concerns);
      setOwner(risk.owner);
      setLastReviewed(risk.lastReviewed);
      setIndicators(risk.assuranceIndicators.map(i => ({ ...i })));
    }
  }, [risk]);

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
    });
    onOpenChange(false);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Risk: {risk.risk}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current Score */}
          <div className="space-y-2">
            <Label className="font-semibold">Current Score</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Likelihood</Label>
                <Select value={String(likelihood)} onValueChange={(v) => setLikelihood(Number(v))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground font-bold">×</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Consequence</Label>
                <Select value={String(consequence)} onValueChange={(v) => setConsequence(Number(v))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground font-bold">=</span>
              <span className="text-lg font-bold">{score}</span>
              <Badge variant="outline" className={`${badgeStyles} text-xs`}>{rating}</Badge>
            </div>
          </div>

          {/* Key Concerns */}
          <div className="space-y-2">
            <Label className="font-semibold">Key Concerns</Label>
            <Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={3} />
          </div>

          {/* Mitigation */}
          <div className="space-y-2">
            <Label className="font-semibold">Mitigation</Label>
            <Textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={3} />
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label className="font-semibold">Owner</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>

          {/* Last Reviewed */}
          <div className="space-y-2">
            <Label className="font-semibold">Last Reviewed</Label>
            <Input value={lastReviewed} onChange={(e) => setLastReviewed(e.target.value)} placeholder="e.g. Jan-26" />
          </div>

          {/* Assurance Indicators */}
          <div className="space-y-2">
            <Label className="font-semibold">Assurance Indicators</Label>
            <div className="space-y-2">
              {indicators.map((indicator) => (
                <div key={indicator.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={indicator.completed}
                    onCheckedChange={() => toggleIndicatorCompleted(indicator.id)}
                    className="h-4 w-4"
                  />
                  <Input
                    value={indicator.text}
                    onChange={(e) => updateIndicatorText(indicator.id, e.target.value)}
                    className="flex-1 h-9 text-sm"
                    placeholder="Indicator text"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeIndicator(indicator.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addIndicator} className="mt-1">
              <Plus className="h-3 w-3 mr-1" /> Add Indicator
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
