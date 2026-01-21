import { useMemo, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, Brain, ListChecks, ClipboardList, ChevronDown, ChevronRight, Phone } from "lucide-react";
import { EmisIcon } from "@/components/icons/EmisIcon";
import { SOAPNote, HeidiNote, ConsultationType } from "@/types/scribe";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EmisNoteViewProps {
  soapNote?: SOAPNote | null;
  heidiNote?: HeidiNote | null;
  consultationType?: ConsultationType;
  showNotMentioned?: boolean;
  onShowNotMentionedChange?: (show: boolean) => void;
}

// Parse plan text into grouped action types
const parsePlanIntoGroups = (planText: string): {
  investigations: string[];
  referral: string[];
  followUp: string[];
  safetyNetting: string[];
  other: string[];
} => {
  const lines = planText
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 0);

  const groups = {
    investigations: [] as string[],
    referral: [] as string[],
    followUp: [] as string[],
    safetyNetting: [] as string[],
    other: [] as string[],
  };

  const investigationKeywords = /\b(ecg|blood|test|xray|x-ray|scan|mri|ct|ultrasound|urine|sample|fbc|u&e|lft|tft|hba1c|cholesterol|lipid|crp|esr|ferritin|b12|folate|vitamin|glucose|psa|investigation)/i;
  const referralKeywords = /\b(refer|referral|pathway|consultant|specialist|urgent|2ww|two\s*week|cardiology|gastro|neuro|ortho|ent|dermatology|urology|gynae|rheumatology|oncology|respiratory)/i;
  const followUpKeywords = /\b(follow\s*up|review|appointment|f\/u|fu\s|recall|book|schedule|weeks?|days?|months?|return|come\s*back)/i;
  const safetyKeywords = /\b(safety|advised|advice|warning|999|111|a&e|emergency|call|attend|worsen|worse|concern|red\s*flag|seek|urgent\s*care|out\s*of\s*hours)/i;

  for (const line of lines) {
    if (safetyKeywords.test(line)) {
      groups.safetyNetting.push(line);
    } else if (investigationKeywords.test(line)) {
      groups.investigations.push(line);
    } else if (referralKeywords.test(line)) {
      groups.referral.push(line);
    } else if (followUpKeywords.test(line)) {
      groups.followUp.push(line);
    } else {
      groups.other.push(line);
    }
  }

  return groups;
};

// Format assessment as problem-based list
const formatAssessmentAsProblems = (assessmentText: string): string[] => {
  return assessmentText
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 0 && !/^(assessment|impression|diagnosis)/i.test(l));
};

// Format for EMIS copy (plain text, no markdown)
const formatForEmisCopy = (assessment: string[], planGroups: ReturnType<typeof parsePlanIntoGroups>): string => {
  const parts: string[] = [];

  // Assessment section
  parts.push('Assessment:');
  assessment.forEach(item => {
    parts.push(item);
  });

  parts.push('');

  // Plan section
  parts.push('Plan:');
  
  // Combine all plan items into sentences
  const allPlanItems: string[] = [];
  
  if (planGroups.investigations.length > 0) {
    allPlanItems.push(...planGroups.investigations);
  }
  if (planGroups.referral.length > 0) {
    allPlanItems.push(...planGroups.referral);
  }
  if (planGroups.followUp.length > 0) {
    allPlanItems.push(...planGroups.followUp);
  }
  if (planGroups.other.length > 0) {
    allPlanItems.push(...planGroups.other);
  }
  if (planGroups.safetyNetting.length > 0) {
    parts.push(allPlanItems.join('. ') + (allPlanItems.length > 0 ? '.' : ''));
    parts.push('Safety-netted: ' + planGroups.safetyNetting.join(' '));
  } else {
    parts.push(allPlanItems.join('. ') + (allPlanItems.length > 0 ? '.' : ''));
  }

  return parts.join('\n');
};

export const EmisNoteView = ({
  soapNote,
  heidiNote,
  consultationType = 'f2f',
  showNotMentioned = false,
  onShowNotMentionedChange,
}: EmisNoteViewProps) => {
  const [historyOpen, setHistoryOpen] = useState(true);

  // Extract content from notes
  const assessment = useMemo(() => {
    const text = heidiNote?.impression || soapNote?.A || '';
    return formatAssessmentAsProblems(text);
  }, [heidiNote, soapNote]);

  const planText = useMemo(() => {
    return heidiNote?.plan || soapNote?.P || '';
  }, [heidiNote, soapNote]);

  const planGroups = useMemo(() => {
    return parsePlanIntoGroups(planText);
  }, [planText]);

  const historyText = useMemo(() => {
    return heidiNote?.history || soapNote?.S || '';
  }, [heidiNote, soapNote]);

  const examinationText = useMemo(() => {
    return heidiNote?.examination || soapNote?.O || '';
  }, [heidiNote, soapNote]);

  // Check if examination has content
  const hasExamination = useMemo(() => {
    const text = examinationText.trim().toLowerCase();
    if (!text) return false;
    // Filter out "none mentioned" type content
    const notMentionedPatterns = /^(none\s*mentioned|not\s*mentioned|none\s*discussed|not\s*examined|no\s*examination|n\/a|nil|telephone|not\s*applicable)$/i;
    return !notMentionedPatterns.test(text);
  }, [examinationText]);

  const isTelephoneConsultation = consultationType === 'telephone';

  // Copy handlers
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  const copyForEmis = useCallback(() => {
    const text = formatForEmisCopy(assessment, planGroups);
    navigator.clipboard.writeText(text);
    toast.success("Copied for EMIS (Assessment + Plan)");
  }, [assessment, planGroups]);

  const copyAll = useCallback(() => {
    const parts: string[] = [];
    
    // History section
    if (historyText.trim()) {
      parts.push('History:');
      parts.push(historyText.trim());
      parts.push('');
      parts.push('');
    }
    
    // Examination section
    parts.push('Examination:');
    assessment.forEach(item => parts.push(`• ${item}`));
    parts.push('');
    parts.push('');
    
    // Comment (Plan) section
    parts.push('Comment:');
    if (planGroups.investigations.length > 0) {
      parts.push('Investigations');
      planGroups.investigations.forEach(item => parts.push(`• ${item}`));
      parts.push('');
    }
    if (planGroups.referral.length > 0) {
      parts.push('Referral');
      planGroups.referral.forEach(item => parts.push(`• ${item}`));
      parts.push('');
    }
    if (planGroups.followUp.length > 0) {
      parts.push('Follow-up');
      planGroups.followUp.forEach(item => parts.push(`• ${item}`));
      parts.push('');
    }
    if (planGroups.other.length > 0) {
      planGroups.other.forEach(item => parts.push(`• ${item}`));
      parts.push('');
    }
    if (planGroups.safetyNetting.length > 0) {
      parts.push('Safety-netting');
      planGroups.safetyNetting.forEach(item => parts.push(`• ${item}`));
    }
    
    navigator.clipboard.writeText(parts.join('\n'));
    toast.success("Full EMIS note copied (History + Examination + Comment)");
  }, [historyText, assessment, planGroups]);

  // Check if we have any content
  const hasContent = assessment.length > 0 || planText.trim();

  if (!hasContent) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No consultation notes available</p>
        </CardContent>
      </Card>
    );
  }

  // Check if plan group has items
  const hasGroupItems = (group: string[]) => group.length > 0;
  const totalPlanGroups = [
    planGroups.investigations,
    planGroups.referral,
    planGroups.followUp,
    planGroups.safetyNetting,
    planGroups.other
  ].filter(g => g.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EmisIcon size="md" />
              <CardTitle className="text-lg">EMIS View</CardTitle>
              <Badge variant="secondary" className="text-xs font-normal">
                EMIS-optimised
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy All
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* History Section - Collapsed by Default */}
      {historyText.trim() && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {historyOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">History</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      (click to {historyOpen ? 'collapse' : 'expand'} – full history & risk factors)
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(historyText, 'History');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {historyText}
                </pre>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Examination Section - Always Expanded */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Examination</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => copyToClipboard(assessment.join('\n'), 'Examination')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {assessment.map((problem, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span className="font-medium">{problem}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comment (Plan) Section - Always Expanded */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Comment (Plan)</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => copyToClipboard(planText, 'Comment (Plan)')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Investigations */}
          {hasGroupItems(planGroups.investigations) && (
            <div>
              {totalPlanGroups > 1 && (
                <h4 className="text-sm font-medium text-muted-foreground mb-1.5">Investigations</h4>
              )}
              <div className="space-y-1">
                {planGroups.investigations.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral */}
          {hasGroupItems(planGroups.referral) && (
            <div>
              {totalPlanGroups > 1 && (
                <h4 className="text-sm font-medium text-muted-foreground mb-1.5">Referral</h4>
              )}
              <div className="space-y-1">
                {planGroups.referral.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {hasGroupItems(planGroups.followUp) && (
            <div>
              {totalPlanGroups > 1 && (
                <h4 className="text-sm font-medium text-muted-foreground mb-1.5">Follow-up</h4>
              )}
              <div className="space-y-1">
                {planGroups.followUp.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other */}
          {hasGroupItems(planGroups.other) && (
            <div className="space-y-1">
              {planGroups.other.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Safety-netting - Always at bottom, highlighted */}
          {hasGroupItems(planGroups.safetyNetting) && (
            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1.5">Safety-netting</h4>
              <div className="space-y-1 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                {planGroups.safetyNetting.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objective/Examination Section - Conditional */}
      {isTelephoneConsultation && !hasExamination ? (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Phone className="h-4 w-4" />
              <span>Telephone consultation – no physical examination performed</span>
            </div>
          </CardContent>
        </Card>
      ) : hasExamination ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Objective</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copyToClipboard(examinationText, 'Objective')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {examinationText}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
