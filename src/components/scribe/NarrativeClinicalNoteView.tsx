import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, ClipboardList, Stethoscope, Brain, Activity, ListChecks, Shield, EyeOff } from "lucide-react";
import { SOAPNote, HeidiNote } from "@/types/scribe";
import { 
  transformToNarrativeClinical, 
  getNarrativeClinicalText, 
  NarrativeClinicalNote,
  NARRATIVE_CLINICAL_SECTIONS 
} from "@/utils/narrativeClinicalFormatter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InteractiveClinicalContent } from "./InteractiveClinicalContent";

interface NarrativeClinicalNoteViewProps {
  soapNote?: SOAPNote | null;
  heidiNote?: HeidiNote | null;
  showNotMentioned?: boolean;
  onShowNotMentionedChange?: (show: boolean) => void;
  editable?: boolean;
  onSectionChange?: (sectionKey: string, newContent: string) => void;
  consultationId?: string;
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
}: NarrativeClinicalNoteViewProps) => {
  // Transform the notes to Narrative Clinical format
  const narrativeClinicalNote = useMemo(() => {
    return transformToNarrativeClinical(soapNote || null, heidiNote, { showNotMentioned });
  }, [soapNote, heidiNote, showNotMentioned]);

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
    const fullText = getNarrativeClinicalText(narrativeClinicalNote);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                TPP SystmOne View
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-normal gap-1">
                <Shield className="h-3 w-3" />
                H/E/A/I/P
              </Badge>
            </div>
            <div className="flex items-center gap-3">
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
          <p className="text-xs text-muted-foreground mt-1">
            Presentational layout only • Same underlying clinical data as SOAP
          </p>
        </CardHeader>
      </Card>

      {/* Sections */}
      <Accordion type="multiple" defaultValue={NARRATIVE_CLINICAL_SECTIONS.map(s => s.key)} className="space-y-3">
        {NARRATIVE_CLINICAL_SECTIONS.map((section) => {
          const raw = narrativeClinicalNote[section.key] || '';
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
