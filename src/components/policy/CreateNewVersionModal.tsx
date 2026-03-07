import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Lock, Loader2 } from 'lucide-react';
import { format, addYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChangeType, CHANGE_TYPE_CONFIG, calculateNextVersion } from '@/hooks/usePolicyVersions';

interface CreateNewVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: string;
  policyContent: string;
  metadata: any;
  onPublish: (data: {
    changeType: ChangeType;
    changeSummary: string;
    policyContent: string;
    approvedBy: string;
    nextReviewDate: string;
  }) => Promise<void>;
  onSaveDraft: (data: {
    changeType: ChangeType;
    changeSummary: string;
    policyContent: string;
    approvedBy: string;
    nextReviewDate: string;
  }) => Promise<void>;
}

export const CreateNewVersionModal = ({
  open,
  onOpenChange,
  currentVersion,
  policyContent,
  metadata,
  onPublish,
  onSaveDraft,
}: CreateNewVersionModalProps) => {
  const [step, setStep] = useState(1);
  const [changeType, setChangeType] = useState<ChangeType>('content_change');
  const [editedContent, setEditedContent] = useState(policyContent);
  const [changeSummary, setChangeSummary] = useState('');
  const [approvedBy, setApprovedBy] = useState(metadata?.approved_by || '');
  const [nextReviewDate, setNextReviewDate] = useState<Date>(addYears(new Date(), 1));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = CHANGE_TYPE_CONFIG[changeType];
  const newVersion = calculateNextVersion(currentVersion, config.increment);

  // Parse policy content into sections
  const sections = editedContent.split(/(?=^#{1,3}\s)/m).filter(Boolean);
  const isSection11 = (s: string) => /^#{1,3}\s*(section\s*11|11[\.\):]?\s*version\s*history)/i.test(s.trim());

  const handlePublish = async () => {
    if (!changeSummary.trim()) return;
    setIsSubmitting(true);
    try {
      await onPublish({
        changeType,
        changeSummary,
        policyContent: editedContent,
        approvedBy,
        nextReviewDate: format(nextReviewDate, 'yyyy-MM-dd'),
      });
      onOpenChange(false);
      resetState();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      await onSaveDraft({
        changeType,
        changeSummary: changeSummary || 'Draft',
        policyContent: editedContent,
        approvedBy,
        nextReviewDate: format(nextReviewDate, 'yyyy-MM-dd'),
      });
      onOpenChange(false);
      resetState();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setChangeType('content_change');
    setChangeSummary('');
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create New Version — Step {step} of 3
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Select change type */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <Label className="text-sm font-medium">Select change type</Label>
            <RadioGroup value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)}>
              {(Object.entries(CHANGE_TYPE_CONFIG) as [ChangeType, typeof CHANGE_TYPE_CONFIG[ChangeType]][]).map(([key, cfg]) => (
                <div key={key} className="flex items-center space-x-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="flex-1 cursor-pointer">
                    <span className="font-medium">{cfg.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      → v{calculateNextVersion(currentVersion, cfg.increment)}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              This will create version <strong>v{newVersion}</strong>
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 2 — Edit Policy */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <Label className="text-sm font-medium">Edit policy content</Label>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {sections.map((section, idx) => {
                const locked = isSection11(section);
                return (
                  <div key={idx} className="relative">
                    {locked && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-muted-foreground z-10" title="Auto-maintained by Notewell — cannot be manually edited">
                        <Lock className="h-3 w-3" />
                        <span className="text-[10px]">Auto-maintained</span>
                      </div>
                    )}
                    <Textarea
                      value={section}
                      onChange={(e) => {
                        if (locked) return;
                        const updated = [...sections];
                        updated[idx] = e.target.value;
                        setEditedContent(updated.join(''));
                      }}
                      readOnly={locked}
                      className={cn(
                        'min-h-[80px] text-xs font-mono',
                        locked && 'opacity-60 bg-muted cursor-not-allowed'
                      )}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="changeSummary" className="text-sm font-medium">
                  Change Summary <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="changeSummary"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Describe the changes made..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Next Review Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1', !nextReviewDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextReviewDate ? format(nextReviewDate, 'dd/MM/yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextReviewDate}
                      onSelect={(d) => d && setNextReviewDate(d)}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="approvedBy" className="text-sm font-medium">Approved By</Label>
                <Input
                  id="approvedBy"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-muted/50 rounded-md p-3 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">New Section 11 row to be added:</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">v{newVersion}</span>
                <span>|</span>
                <span>{format(new Date(), 'dd/MM/yyyy')}</span>
                <span>|</span>
                <span>{approvedBy || '—'}</span>
                <span>|</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>{config.pillLabel}</span>
                <span>|</span>
                <span className="truncate">{changeSummary || '—'}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save as Draft
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={!changeSummary.trim() || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Publish New Version
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
