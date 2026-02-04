import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, AlertCircle, MinusCircle, Circle, Ban, ChevronDown, Info, MessageSquare, Paperclip } from 'lucide-react';
import { InspectionElement } from '@/hooks/useMockInspection';
import { StatusQuickPick } from './StatusQuickPick';
import { EvidenceAttachment } from './EvidenceAttachment';
import { cn } from '@/lib/utils';

interface InspectionElementCardProps {
  element: InspectionElement;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<InspectionElement>) => Promise<boolean>;
}

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

  const statusConfig = getStatusConfig(element.status);
  const StatusIcon = statusConfig.icon;

  const handleStatusChange = async (newStatus: InspectionElement['status']) => {
    await onUpdate({ status: newStatus });
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await onUpdate({ 
      evidence_notes: evidenceNotes, 
      improvement_comments: improvementComments 
    });
    setIsSaving(false);
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
            {/* Evidence Guidance */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    What evidence to look for:
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {element.evidence_guidance}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Pick Status */}
            <div>
              <label className="text-sm font-medium mb-2 block">Assessment Status</label>
              <StatusQuickPick 
                currentStatus={element.status}
                onStatusChange={handleStatusChange}
              />
            </div>

            {/* Evidence Notes */}
            <div>
              <label className="text-sm font-medium mb-2 block">Evidence Notes</label>
              <Textarea
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Describe the evidence you found or where it's located..."
                className="min-h-[80px]"
              />
            </div>

            {/* Evidence Attachments */}
            <EvidenceAttachment
              files={evidenceFilesArray as { type: string; url?: string; id?: string; name: string }[]}
              onFilesChange={(files) => onUpdate({ evidence_files: files as unknown })}
            />

            {/* Improvement Comments - show for partially met or not met */}
            {(element.status === 'partially_met' || element.status === 'not_met') && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  💡 Improvement Ideas
                </label>
                <Textarea
                  value={improvementComments}
                  onChange={(e) => setImprovementComments(e.target.value)}
                  placeholder="How could this area be strengthened? What actions would help?"
                  className="min-h-[80px]"
                />
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveNotes} 
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
