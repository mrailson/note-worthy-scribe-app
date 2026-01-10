import React from 'react';
import { 
  ReferralSuggestion, 
  CONFIDENCE_COLOURS, 
  PRIORITY_COLOURS, 
  PRIORITY_LABELS 
} from '@/types/referral';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  AlertTriangle,
  Stethoscope,
  Activity,
  ClipboardList,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReferralSuggestionCardProps {
  suggestion: ReferralSuggestion;
  onGenerateDraft: (suggestion: ReferralSuggestion) => void;
  isGenerating: boolean;
  isSelected?: boolean;
}

const EVIDENCE_ICONS: Record<string, React.ReactNode> = {
  symptom: <Activity className="h-3 w-3" />,
  examination: <Stethoscope className="h-3 w-3" />,
  risk_factor: <AlertTriangle className="h-3 w-3" />,
  plan: <ClipboardList className="h-3 w-3" />,
  negative: <Search className="h-3 w-3" />,
};

export function ReferralSuggestionCard({
  suggestion,
  onGenerateDraft,
  isGenerating,
  isSelected
}: ReferralSuggestionCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Card className={cn(
      "transition-all",
      isSelected && "ring-2 ring-primary",
      "hover:shadow-md"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base font-medium leading-tight">
              {suggestion.displayName}
            </CardTitle>
            {suggestion.pathway && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {suggestion.pathway}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <Badge 
              variant="outline" 
              className={cn("text-xs", CONFIDENCE_COLOURS[suggestion.confidence])}
            >
              {suggestion.confidence}
            </Badge>
            <Badge 
              variant="outline" 
              className={cn("text-xs", PRIORITY_COLOURS[suggestion.priority])}
            >
              {PRIORITY_LABELS[suggestion.priority]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Contra-flags (missing info warnings) */}
        {suggestion.contraFlags && suggestion.contraFlags.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              {suggestion.contraFlags.map((flag, i) => (
                <div key={i}>{flag}</div>
              ))}
            </div>
          </div>
        )}

        {/* Why suggested - expandable */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between h-8 text-xs"
            >
              <span className="text-muted-foreground">
                Why suggested? ({suggestion.triggerEvidence?.length || 0} reasons)
              </span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2 pl-1">
              {suggestion.triggerEvidence?.map((evidence, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="shrink-0 mt-0.5 text-muted-foreground">
                    {EVIDENCE_ICONS[evidence.type] || <FileText className="h-3 w-3" />}
                  </span>
                  <div>
                    <span className="text-muted-foreground capitalize">
                      {evidence.type.replace('_', ' ')}:
                    </span>{' '}
                    <span className="italic">"{evidence.text}"</span>
                    <span className="text-muted-foreground ml-1">
                      ({evidence.source})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Generate Draft button */}
        <Button
          onClick={() => onGenerateDraft(suggestion)}
          disabled={isGenerating}
          size="sm"
          className="w-full"
        >
          <FileText className="h-4 w-4 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate Draft'}
        </Button>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground text-center italic">
          Suggestion only — clinician decides
        </p>
      </CardContent>
    </Card>
  );
}
