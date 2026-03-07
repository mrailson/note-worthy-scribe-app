import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Upload, Loader2, AlertTriangle, CheckCircle2, Pencil, Lock, ChevronDown, FileText, Info } from 'lucide-react';
import { format, addYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChangeType, CHANGE_TYPE_CONFIG, calculateNextVersion } from '@/hooks/usePolicyVersions';
import { useDropzone } from 'react-dropzone';
import { WordProcessor } from '@/utils/fileProcessors/WordProcessor';
import { PDFProcessor } from '@/utils/fileProcessors/PDFProcessor';
import { toast } from 'sonner';

interface UploadRevisedVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyTitle: string;
  currentVersion: string;
  currentContent: string;
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

interface SectionDiff {
  title: string;
  status: 'unchanged' | 'modified' | 'auto';
  oldText?: string;
  newText?: string;
}

const parseSections = (content: string): { title: string; body: string }[] => {
  const lines = content.split('\n');
  const sections: { title: string; body: string }[] = [];
  let currentTitle = 'Preamble';
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentBody.length > 0 || currentTitle !== 'Preamble') {
        sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
      }
      currentTitle = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentBody.length > 0 || sections.length > 0) {
    sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
  }
  return sections;
};

const isSection11 = (title: string) => /section\s*11|11[\.\):]?\s*version\s*history|version\s*history/i.test(title);

const computeDiff = (oldContent: string, newContent: string): SectionDiff[] => {
  const oldSections = parseSections(oldContent);
  const newSections = parseSections(newContent);
  const diffs: SectionDiff[] = [];

  const maxLen = Math.max(oldSections.length, newSections.length);
  for (let i = 0; i < maxLen; i++) {
    const oldSec = oldSections[i];
    const newSec = newSections[i];
    const title = newSec?.title || oldSec?.title || `Section ${i + 1}`;

    if (isSection11(title)) {
      diffs.push({ title, status: 'auto' });
      continue;
    }

    const oldBody = (oldSec?.body || '').replace(/\s+/g, ' ').trim();
    const newBody = (newSec?.body || '').replace(/\s+/g, ' ').trim();

    if (oldBody === newBody) {
      diffs.push({ title, status: 'unchanged' });
    } else {
      diffs.push({
        title,
        status: 'modified',
        oldText: oldSec?.body || '',
        newText: newSec?.body || '',
      });
    }
  }
  return diffs;
};

export const UploadRevisedVersionModal = ({
  open,
  onOpenChange,
  policyTitle,
  currentVersion,
  currentContent,
  metadata,
  onPublish,
  onSaveDraft,
}: UploadRevisedVersionModalProps) => {
  const [step, setStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [changeType, setChangeType] = useState<ChangeType>('content_change');
  const [changeSummary, setChangeSummary] = useState('');
  const [approvedBy, setApprovedBy] = useState(metadata?.approved_by || '');
  const [nextReviewDate, setNextReviewDate] = useState<Date>(addYears(new Date(), 1));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sectionDiffs, setSectionDiffs] = useState<SectionDiff[]>([]);
  const [filenameWarning, setFilenameWarning] = useState(false);

  const config = CHANGE_TYPE_CONFIG[changeType];
  const newVersion = calculateNextVersion(currentVersion, config.increment);
  const modifiedCount = sectionDiffs.filter(d => d.status === 'modified').length;
  const noChanges = sectionDiffs.length > 0 && modifiedCount === 0;

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'docx' && ext !== 'pdf') {
      toast.error('Only .docx and .pdf files are accepted');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 25MB.');
      return;
    }

    // Check filename similarity
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '').toLowerCase();
    const policyNameLower = policyTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileNameClean = nameWithoutExt.replace(/[^a-z0-9]/g, '');
    if (!fileNameClean.includes(policyNameLower.slice(0, 10)) && !policyNameLower.includes(fileNameClean.slice(0, 10))) {
      setFilenameWarning(true);
    } else {
      setFilenameWarning(false);
    }

    setUploadedFile(file);
    setIsExtracting(true);

    try {
      let text = '';
      if (ext === 'docx') {
        text = await WordProcessor.extractText(file);
      } else {
        text = await PDFProcessor.extractText(file);
      }
      setExtractedContent(text);
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Failed to extract text from file');
      setUploadedFile(null);
    } finally {
      setIsExtracting(false);
    }
  }, [policyTitle]);

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 25 * 1024 * 1024,
    multiple: false,
    noClick: true,
  });

  const goToStep3 = () => {
    const diffs = computeDiff(currentContent, extractedContent);
    setSectionDiffs(diffs);
    setStep(3);
  };

  const handlePublish = async () => {
    if (!changeSummary.trim()) return;
    setIsSubmitting(true);
    try {
      await onPublish({
        changeType,
        changeSummary,
        policyContent: extractedContent,
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
        policyContent: extractedContent,
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
    setUploadedFile(null);
    setExtractedContent('');
    setChangeType('content_change');
    setChangeSummary('');
    setIsSubmitting(false);
    setSectionDiffs([]);
    setFilenameWarning(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Upload Revised Version — {policyTitle}
            <span className="block text-xs text-muted-foreground font-normal mt-1">
              Step {step} of 4
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — File Upload */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div
              {...getRootProps()}
              onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              )}
            >
              <input {...getInputProps()} />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Extracting text from document…</p>
                </div>
              ) : uploadedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                  <Button variant="link" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setExtractedContent(''); }}>
                    Remove and choose different file
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive ? 'Drop your revised policy here' : 'Drop your revised policy here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground">Accepted: .docx .pdf</p>
                </div>
              )}
            </div>

            {filenameWarning && uploadedFile && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>The filename doesn't appear to match this policy. Make sure you've selected the right file.</span>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Upload the edited version downloaded from this card. Version history (Section 11) will be rebuilt automatically — do not worry if your edits changed it.</span>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!uploadedFile || isExtracting || !extractedContent}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Change Type */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <Label className="text-sm font-medium">Which best describes your changes?</Label>
            <RadioGroup value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)}>
              {(Object.entries(CHANGE_TYPE_CONFIG) as [ChangeType, typeof CHANGE_TYPE_CONFIG[ChangeType]][]).map(([key, cfg]) => (
                <div key={key} className="flex items-center space-x-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={key} id={`upload-${key}`} />
                  <Label htmlFor={`upload-${key}`} className="flex-1 cursor-pointer">
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
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={goToStep3}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 3 — Diff Preview */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <Label className="text-sm font-medium">Changes detected in your upload</Label>

            {noChanges && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No differences detected</p>
                  <p className="text-xs mt-1">The uploaded file appears identical to the current version. Are you sure you uploaded the right file?</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => { setStep(1); setUploadedFile(null); setExtractedContent(''); }}>
                      Upload different file
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStep(4)}>
                      Continue anyway
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
              {sectionDiffs.map((diff, i) => (
                <div key={i}>
                  {diff.status === 'modified' ? (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left">
                        <Pencil className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="flex-1 truncate">{diff.title}</span>
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Modified</Badge>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-2">
                          {diff.oldText && (
                            <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 text-xs">
                              <p className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1">Removed</p>
                              <p className="text-red-800 dark:text-red-300 line-through whitespace-pre-wrap line-clamp-6">{diff.oldText}</p>
                            </div>
                          )}
                          {diff.newText && (
                            <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 text-xs">
                              <p className="text-[10px] font-medium text-green-600 dark:text-green-400 mb-1">Added</p>
                              <p className="text-green-800 dark:text-green-300 underline whitespace-pre-wrap line-clamp-6">{diff.newText}</p>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm">
                      {diff.status === 'auto' ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-muted-foreground">{diff.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {diff.status === 'auto' ? 'Auto-rebuilt (ignored)' : 'No changes'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {modifiedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {modifiedCount} {modifiedCount === 1 ? 'section' : 'sections'} modified
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={() => setStep(4)} disabled={noChanges && sectionDiffs.length > 0 ? false : false}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Confirm */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="uploadChangeSummary" className="text-sm font-medium">
                  Change Summary <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="uploadChangeSummary"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Briefly describe what you changed"
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
                <Label htmlFor="uploadApprovedBy" className="text-sm font-medium">Approved By</Label>
                <Input
                  id="uploadApprovedBy"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Preview row */}
            <div className="bg-muted/50 rounded-md p-3 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">New Section 11 row to be added:</p>
              <div className="flex items-center gap-2 text-xs flex-wrap">
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

            <div className="flex items-start gap-2 p-2 rounded text-[11px] text-muted-foreground bg-muted/30">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              Section 11 inside the policy will be auto-updated to include this row.
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save as Draft
                </Button>
                <Button onClick={handlePublish} disabled={!changeSummary.trim() || isSubmitting}>
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
