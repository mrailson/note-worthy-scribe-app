import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, AlertCircle, MinusCircle, Circle, Ban, ChevronDown, Info, MessageSquare, Paperclip, Search, ClipboardCheck, Star } from 'lucide-react';
import { InspectionElement } from '@/hooks/useMockInspection';
import { StatusQuickPick } from './StatusQuickPick';
import { EvidenceAttachment } from './EvidenceAttachment';
import { EnhancedBrowserMic, EnhancedBrowserMicRef } from '@/components/ai4gp/EnhancedBrowserMic';
import { cn } from '@/lib/utils';

interface InspectionElementCardProps {
  element: InspectionElement;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<InspectionElement>) => Promise<boolean>;
}

// Parse structured guidance text into sections
const parseGuidance = (guidance: string) => {
  const sections: { lookFor?: string; cqcExpects?: string; whatGoodLooksLike?: string; fallback?: string } = {};
  
  // Check if it's the new structured format
  const lookForMatch = guidance.match(/LOOK FOR:\s*([\s\S]*?)(?=CQC EXPECTS:|WHAT GOOD LOOKS LIKE:|$)/i);
  const cqcExpectsMatch = guidance.match(/CQC EXPECTS:\s*([\s\S]*?)(?=WHAT GOOD LOOKS LIKE:|$)/i);
  const whatGoodMatch = guidance.match(/WHAT GOOD LOOKS LIKE:\s*([\s\S]*?)$/i);
  
  if (lookForMatch || cqcExpectsMatch || whatGoodMatch) {
    if (lookForMatch) sections.lookFor = lookForMatch[1].trim();
    if (cqcExpectsMatch) sections.cqcExpects = cqcExpectsMatch[1].trim();
    if (whatGoodMatch) sections.whatGoodLooksLike = whatGoodMatch[1].trim();
  } else {
    // Fallback for old format
    sections.fallback = guidance;
  }
  
  return sections;
};

// Guidance Panel Component
const GuidancePanel = ({ guidance }: { guidance: string }) => {
  const sections = parseGuidance(guidance);
  
  if (sections.fallback) {
    return (
      <div className="p-3 bg-accent/50 rounded-lg border border-border">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">What evidence to look for:</p>
            <p className="text-sm text-muted-foreground">{sections.fallback}</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {sections.lookFor && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-start gap-2">
            <Search className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Look For</p>
              <p className="text-sm text-blue-700 dark:text-blue-400/90">{sections.lookFor}</p>
            </div>
          </div>
        </div>
      )}
      
      {sections.cqcExpects && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-2">
            <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">CQC Expects</p>
              <p className="text-sm text-amber-700 dark:text-amber-400/90">{sections.cqcExpects}</p>
            </div>
          </div>
        </div>
      )}
      
      {sections.whatGoodLooksLike && (
        <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/50">
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">What Good Looks Like</p>
              <p className="text-sm text-green-700 dark:text-green-400/90">{sections.whatGoodLooksLike}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'met':
      return { 
        icon: CheckCircle2, 
        color: 'text-green-600', 
        bgColor: 'bg-green-50 dark:bg-green-950/30',
        borderColor: 'border-green-200 dark:border-green-800',
        label: 'Met' 
      };
    case 'partially_met':
      return { 
        icon: MinusCircle, 
        color: 'text-amber-600', 
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        label: 'Partially Met' 
      };
    case 'not_met':
      return { 
        icon: AlertCircle, 
        color: 'text-red-600', 
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        label: 'Not Met' 
      };
    case 'not_applicable':
      return { 
        icon: Ban, 
        color: 'text-muted-foreground', 
        bgColor: 'bg-muted/30',
        borderColor: 'border-muted',
        label: 'N/A' 
      };
    default:
      return { 
        icon: Circle, 
        color: 'text-muted-foreground', 
        bgColor: 'bg-background',
        borderColor: 'border-border',
        label: 'Not Assessed' 
      };
  }
};

export const InspectionElementCard = ({
  element,
  isExpanded,
  onToggle,
  onUpdate
}: InspectionElementCardProps) => {
  const [evidenceNotes, setEvidenceNotes] = useState(element.evidence_notes || '');
  const [improvementComments, setImprovementComments] = useState(element.improvement_comments || '');
  const [isSaving, setIsSaving] = useState(false);
  const evidenceMicRef = useRef<EnhancedBrowserMicRef>(null);
  const improvementMicRef = useRef<EnhancedBrowserMicRef>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const statusConfig = getStatusConfig(element.status);
  const StatusIcon = statusConfig.icon;

  // Auto-save with debounce
  const triggerAutoSave = useCallback((notes: string, comments: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      await onUpdate({ 
        evidence_notes: notes, 
        improvement_comments: comments 
      });
      setIsSaving(false);
    }, 1000);
  }, [onUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleStatusChange = async (newStatus: InspectionElement['status']) => {
    await onUpdate({ status: newStatus });
  };

  const handleEvidenceNotesChange = (value: string) => {
    setEvidenceNotes(value);
    triggerAutoSave(value, improvementComments);
  };

  const handleImprovementCommentsChange = (value: string) => {
    setImprovementComments(value);
    triggerAutoSave(evidenceNotes, value);
  };

  const handleEvidenceTranscriptUpdate = (text: string) => {
    const newValue = evidenceNotes ? `${evidenceNotes} ${text}` : text;
    setEvidenceNotes(newValue);
    triggerAutoSave(newValue, improvementComments);
  };

  const handleImprovementTranscriptUpdate = (text: string) => {
    const newValue = improvementComments ? `${improvementComments} ${text}` : text;
    setImprovementComments(newValue);
    triggerAutoSave(evidenceNotes, newValue);
  };

  const evidenceFilesArray = Array.isArray(element.evidence_files) ? element.evidence_files : [];
  const hasContent = element.evidence_notes || element.improvement_comments || evidenceFilesArray.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn(
        "transition-all",
        statusConfig.borderColor,
        isExpanded && statusConfig.bgColor
      )}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 text-left">
              <StatusIcon className={cn("h-5 w-5 flex-shrink-0", statusConfig.color)} />
              <div>
                <span className="font-medium text-sm">
                  {element.element_key}: {element.element_name}
                </span>
                {hasContent && (
                  <div className="flex items-center gap-2 mt-1">
                    {element.evidence_notes && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                    {evidenceFilesArray.length > 0 && (
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2 py-1 rounded", statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* Evidence Guidance - Structured */}
            <GuidancePanel guidance={element.evidence_guidance} />

            {/* Quick Pick Status */}
            <div>
              <label className="text-sm font-medium mb-2 block">Assessment Status</label>
              <StatusQuickPick 
                currentStatus={element.status}
                onStatusChange={handleStatusChange}
              />
            </div>

            {/* Evidence Notes with Mic */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Evidence Notes</label>
                <div className="flex items-center gap-2">
                  {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
                  <EnhancedBrowserMic
                    ref={evidenceMicRef}
                    onTranscriptUpdate={handleEvidenceTranscriptUpdate}
                    compact
                    className="h-8 w-8"
                  />
                </div>
              </div>
              <Textarea
                value={evidenceNotes}
                onChange={(e) => handleEvidenceNotesChange(e.target.value)}
                placeholder="Describe the evidence you found or where it's located..."
                className="min-h-[80px]"
              />
            </div>

            {/* Evidence Attachments */}
            <EvidenceAttachment
              files={evidenceFilesArray as { type: string; url?: string; id?: string; name: string }[]}
              onFilesChange={(files) => onUpdate({ evidence_files: files as unknown })}
              elementId={element.id}
              elementKey={element.element_key}
              elementName={element.element_name}
            />

            {/* Improvement Comments - show for partially met or not met */}
            {(element.status === 'partially_met' || element.status === 'not_met') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">💡 Improvement Ideas</label>
                  <EnhancedBrowserMic
                    ref={improvementMicRef}
                    onTranscriptUpdate={handleImprovementTranscriptUpdate}
                    compact
                    className="h-8 w-8"
                  />
                </div>
                <Textarea
                  value={improvementComments}
                  onChange={(e) => handleImprovementCommentsChange(e.target.value)}
                  placeholder="How could this area be strengthened? What actions would help?"
                  className="min-h-[80px]"
                />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
