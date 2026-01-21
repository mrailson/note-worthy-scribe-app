import { useMemo, useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, ClipboardList, Stethoscope, Brain, Activity, ListChecks, Shield, EyeOff, Wand2, Check, AlertTriangle, Loader2, UserCheck, RefreshCw } from "lucide-react";
import { SOAPNote, HeidiNote, PatientContext } from "@/types/scribe";
import { 
  transformToNarrativeClinical, 
  getNarrativeClinicalText, 
  NarrativeClinicalNote,
  NARRATIVE_CLINICAL_SECTIONS 
} from "@/utils/narrativeClinicalFormatter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InteractiveClinicalContent } from "./InteractiveClinicalContent";
import { useTightenSystmOneNotes } from "@/hooks/useTightenSystmOneNotes";
import { SystmOneIcon } from "@/components/icons/SystmOneIcon";

interface NarrativeClinicalNoteViewProps {
  soapNote?: SOAPNote | null;
  heidiNote?: HeidiNote | null;
  showNotMentioned?: boolean;
  onShowNotMentionedChange?: (show: boolean) => void;
  editable?: boolean;
  onSectionChange?: (sectionKey: string, newContent: string) => void;
  consultationId?: string;
  isSystmOneOptimised?: boolean;
  patientContext?: PatientContext;
  onReoptimise?: () => Promise<void>;
  isReoptimising?: boolean;
  includeNhsDobOnCopy?: boolean;
  onIncludeNhsDobOnCopyChange?: (include: boolean) => void;
  viewMode?: 'narrativeClinical' | 'systmone';
}

// Icon mapping for each section
const sectionIcons = {
  history: ClipboardList,
  examination: Stethoscope,
  assessment: Brain,
  intervention: Activity,
  plan: ListChecks,
} as const;

export const NarrativeClinicalNoteView = ({
  soapNote,
  heidiNote,
  showNotMentioned = false,
  onShowNotMentionedChange,
  editable = true,
  onSectionChange,
  consultationId,
  isSystmOneOptimised = false,
  patientContext,
  onReoptimise,
  isReoptimising = false,
  includeNhsDobOnCopy = true,
  onIncludeNhsDobOnCopyChange,
  viewMode = 'narrativeClinical',
}: NarrativeClinicalNoteViewProps) => {
  const { tightenNotes, isTightening, qualityGate, resetQualityGate } = useTightenSystmOneNotes();
  const [optimisedNote, setOptimisedNote] = useState<NarrativeClinicalNote | null>(null);
  // Transform the notes to Narrative Clinical format
  const narrativeClinicalNote = useMemo(() => {
    return transformToNarrativeClinical(soapNote || null, heidiNote, { showNotMentioned });
  }, [soapNote, heidiNote, showNotMentioned]);

  // If already optimised from database, treat current notes as optimised
  useEffect(() => {
    if (isSystmOneOptimised && !optimisedNote) {
      setOptimisedNote(narrativeClinicalNote);
    }
  }, [isSystmOneOptimised, narrativeClinicalNote, optimisedNote]);

  // Use optimised note if available, otherwise use original
  const displayNote = optimisedNote || narrativeClinicalNote;

  // Handle optimise for SystmOne
  const handleOptimise = async () => {
    const result = await tightenNotes({
      history: narrativeClinicalNote.history || '',
      examination: narrativeClinicalNote.examination || '',
      assessment: narrativeClinicalNote.assessment || '',
      plan: narrativeClinicalNote.plan || ''
    });

    if (result) {
      setOptimisedNote({
        history: result.history,
        examination: result.examination,
        assessment: result.assessment,
        intervention: narrativeClinicalNote.intervention, // Keep intervention unchanged
        plan: result.plan
      });

      // Auto-save the optimised sections to persist changes
      if (onSectionChange) {
        onSectionChange('history', result.history);
        onSectionChange('examination', result.examination);
        onSectionChange('assessment', result.assessment);
        onSectionChange('plan', result.plan);
        // Signal optimisation complete to mark consultation as SystmOne optimised
        onSectionChange('__systmone_optimised__', 'true');
      }
    }
  };

  // Revert to original
  const handleRevert = () => {
    setOptimisedNote(null);
    resetQualityGate();
    toast.info('Reverted to original notes');
  };

  // Handler for section content changes
  const handleSectionChange = useCallback((sectionKey: string, newContent: string) => {
    if (onSectionChange) {
      onSectionChange(sectionKey, newContent);
    }
  }, [onSectionChange]);

  // Remove square brackets from text
  const stripBrackets = (text: string): string => {
    return text.replace(/\[|\]/g, '');
  };

  // Filter function for "not mentioned" content
  const filterContent = (text: string): string => {
    let result = stripBrackets(text);
    
    if (showNotMentioned) return result;
    
    const notMentionedPatterns = /\b(none\s*mentioned|not\s*mentioned|none\s*discussed|not\s*discussed|none\s*given|none\s*made|none\s*required|n\/a|nil|not\s*applicable|no\s*significant|not\s*recorded|not\s*documented)\b/i;
    
    return result
      .split('\n')
      .filter(line => !notMentionedPatterns.test(line.trim()))
      .join('\n');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyAll = () => {
    let fullText = getNarrativeClinicalText(displayNote);
    
    // Prepend patient safety header if enabled and patient context available
    if (includeNhsDobOnCopy && patientContext) {
      const headerParts: string[] = [];
      
      if (patientContext.nhsNumber) {
        headerParts.push(`NHS: ${patientContext.nhsNumber}`);
      }
      if (patientContext.dateOfBirth) {
        headerParts.push(`DOB: ${patientContext.dateOfBirth}`);
      }
      
      if (headerParts.length > 0) {
        const patientHeader = headerParts.join(' | ');
        fullText = `${patientHeader}\n\n${fullText}`;
      }
    }
    
    navigator.clipboard.writeText(fullText);
    toast.success("Full note copied to clipboard");
  };

  // Check if we have any content
  const hasContent = Object.values(narrativeClinicalNote).some(v => v && v.trim());

  if (!hasContent) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No consultation notes available</p>
        </CardContent>
      </Card>
    );
  }

  // Determine if we're in SystmOne mode (either by prop or by having optimised content)
  const isInSystmOneMode = viewMode === 'systmone' || isSystmOneOptimised;
  const needsOptimisation = viewMode === 'systmone' && !isSystmOneOptimised && !optimisedNote;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className={cn(
        "border-2 bg-gradient-to-br",
        isSystmOneOptimised || optimisedNote
          ? "border-green-200 from-green-50/50 to-transparent" 
          : needsOptimisation
            ? "border-amber-200 from-amber-50/50 to-transparent"
            : "border-primary/20 from-primary/5 to-transparent"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                {isInSystmOneMode ? (
                  <>
                    <SystmOneIcon size="md" />
                    TPP SystmOne View
                  </>
                ) : (
                  <>
                    <ClipboardList className="h-4 w-4" />
                    Narrative Clinical View
                  </>
                )}
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-normal gap-1">
                <Shield className="h-3 w-3" />
                H/E/A/I/P
              </Badge>
              {(isSystmOneOptimised || optimisedNote) && (
                <Badge variant="outline" className="text-xs font-normal gap-1 bg-green-50 text-green-700 border-green-200">
                  <Wand2 className="h-3 w-3" />
                  Auto-Optimised
                </Badge>
              )}
              {needsOptimisation && (
                <Badge variant="outline" className="text-xs font-normal gap-1 bg-amber-50 text-amber-700 border-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  Needs Optimisation
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Re-optimise Button - show when not optimised and callback provided */}
              {onReoptimise && !isSystmOneOptimised && !optimisedNote && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReoptimise}
                  disabled={isReoptimising}
                  className="text-xs gap-1 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  {isReoptimising ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Optimising...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Re-optimise
                    </>
                  )}
                </Button>
              )}
              
              {/* Patient Safety Header Toggle */}
              {patientContext?.nhsNumber && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-patient-header"
                    checked={includeNhsDobOnCopy}
                    onCheckedChange={(checked) => onIncludeNhsDobOnCopyChange?.(checked)}
                    className="scale-90"
                  />
                  <Label 
                    htmlFor="include-patient-header" 
                    className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="h-3 w-3" />
                    NHS/DOB on Copy
                  </Label>
                </div>
              )}
              
              {/* Show Not Discussed Toggle */}
              {onShowNotMentionedChange && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-not-discussed"
                    checked={showNotMentioned}
                    onCheckedChange={onShowNotMentionedChange}
                    className="scale-90"
                  />
                  <Label 
                    htmlFor="show-not-discussed" 
                    className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                  >
                    <EyeOff className="h-3 w-3" />
                    Show "Not Discussed"
                  </Label>
                </div>
              )}
              
              <Button variant="ghost" size="sm" onClick={copyAll}>
                <Copy className="h-3 w-3 mr-1" /> Copy All
              </Button>
            </div>
          </div>
          
          {/* Quality Gate Badges */}
          {qualityGate && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs gap-1",
                  qualityGate.partnerSafe 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {qualityGate.partnerSafe ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                Partner Safe
              </Badge>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs gap-1",
                  qualityGate.cqcReady 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {qualityGate.cqcReady ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                CQC Ready
              </Badge>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs gap-1",
                  qualityGate.gpAuthored 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {qualityGate.gpAuthored ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                GP-Authored
              </Badge>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-1">
            Presentational layout only • Same underlying clinical data as SOAP
          </p>
        </CardHeader>
      </Card>

      {/* Sections */}
      <Accordion type="multiple" defaultValue={NARRATIVE_CLINICAL_SECTIONS.map(s => s.key)} className="space-y-3">
        {NARRATIVE_CLINICAL_SECTIONS.map((section) => {
          const raw = displayNote[section.key] || '';
          const content = filterContent(raw);
          const Icon = sectionIcons[section.key];

          const hasContent = !!content && !!content.trim();

          // When toggle is OFF, keep the UI clean by hiding empty sections.
          // When toggle is ON, show empty sections as "Not discussed".
          if (!hasContent && !showNotMentioned) return null;

          return (
            <AccordionItem
              key={section.key}
              value={section.key}
              className={cn(
                "border rounded-lg px-4 bg-white dark:bg-card",
                section.borderClass
              )}
            >
              <div className="flex items-center justify-between">
                <AccordionTrigger className="hover:no-underline py-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-7 h-7 rounded flex items-center justify-center",
                        section.colorClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="text-left">
                      <span className="font-medium">{section.title}</span>
                      <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                        {section.description}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!hasContent}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasContent) return;
                    copyToClipboard(content, section.title);
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <AccordionContent className="pt-0 pb-3">
                {hasContent ? (
                  editable ? (
                    <div className="pl-9">
                      <InteractiveClinicalContent
                        content={content}
                        sectionKey={section.key}
                        onContentChange={(newContent) => handleSectionChange(section.key, newContent)}
                        consultationId={consultationId}
                      />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed pl-9">{content}</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground italic pl-9">Not discussed</p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Safety Footer */}
      <div className="text-xs text-muted-foreground text-center py-2 border-t">
        <p className="flex items-center justify-center gap-1.5">
          <Shield className="h-3 w-3" />
          This layout follows safety rules: no asserted negatives, problem-based assessment, explicit interventions only
        </p>
      </div>
    </div>
  );
};
