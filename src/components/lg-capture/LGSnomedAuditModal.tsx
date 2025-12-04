import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check, X, Pencil, ZoomIn, ZoomOut, AlertTriangle, Play, Pause, SkipForward, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SnomedItemForVerification } from './LGImageVerificationModal';
import { generateAuditReport, AuditSession, AuditEntry } from './LGSnomedAuditReport';

interface LGSnomedAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SnomedItemForVerification[];
  practiceOds: string;
  patientId: string;
  patientName: string;
  patientNhs: string;
  snomedJsonUrl: string | null;
  onAuditComplete: () => void;
}

export function LGSnomedAuditModal({
  isOpen,
  onClose,
  items,
  practiceOds,
  patientId,
  patientName,
  patientNhs,
  snomedJsonUrl,
  onAuditComplete,
}: LGSnomedAuditModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditStartTime, setAuditStartTime] = useState<Date | null>(null);
  const [itemStartTime, setItemStartTime] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [itemElapsedTime, setItemElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [auditorName, setAuditorName] = useState('');
  const [auditorEmail, setAuditorEmail] = useState('');
  
  // Image viewer state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTerm, setEditedTerm] = useState('');
  const [editedCode, setEditedCode] = useState('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const itemTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentItem = items[currentIndex];

  // Get auditor info on mount
  useEffect(() => {
    const getAuditorInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setAuditorEmail(user.email);
        // Try to get profile name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) {
          setAuditorName(profile.full_name);
        } else {
          setAuditorName(user.email);
        }
      }
    };
    getAuditorInfo();
  }, []);

  // Start audit timer
  useEffect(() => {
    if (isOpen && !auditStartTime) {
      setAuditStartTime(new Date());
      setItemStartTime(new Date());
    }
  }, [isOpen]);

  // Total elapsed timer
  useEffect(() => {
    if (isOpen && auditStartTime && !isPaused && !isComplete) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - auditStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, auditStartTime, isPaused, isComplete]);

  // Item elapsed timer
  useEffect(() => {
    if (isOpen && itemStartTime && !isPaused && !isComplete) {
      itemTimerRef.current = setInterval(() => {
        setItemElapsedTime(Math.floor((Date.now() - itemStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (itemTimerRef.current) clearInterval(itemTimerRef.current);
    };
  }, [isOpen, itemStartTime, isPaused, isComplete]);

  // Fetch image for current item
  useEffect(() => {
    if (!isOpen || !currentItem || typeof currentItem.source_page !== 'number') {
      setImageUrl(null);
      setImageError(null);
      return;
    }

    const fetchImage = async () => {
      setImageLoading(true);
      setImageError(null);
      setZoom(1);

      try {
        const pageNumber = String(currentItem.source_page! + 1).padStart(3, '0');
        const imagePath = `${practiceOds}/${patientId}/raw/page_${pageNumber}.jpg`;

        const { data, error } = await supabase.storage
          .from('lg')
          .createSignedUrl(imagePath, 300);

        if (error) throw new Error(error.message);
        setImageUrl(data.signedUrl);
      } catch (err) {
        console.error('Failed to fetch image:', err);
        setImageError('Could not load source image');
      } finally {
        setImageLoading(false);
      }
    };

    fetchImage();
  }, [isOpen, currentItem?.source_page, practiceOds, patientId]);

  // Reset edit state when item changes
  useEffect(() => {
    if (currentItem) {
      setEditedTerm(currentItem.term);
      setEditedCode(currentItem.code);
      setIsEditing(false);
    }
  }, [currentItem]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const recordDecision = (decision: AuditEntry['decision'], editedData?: { term: string; code: string }) => {
    if (!currentItem || !itemStartTime) return;

    const endTime = new Date();
    const entry: AuditEntry = {
      item: { ...currentItem },
      decision,
      reviewStartTime: itemStartTime.toISOString(),
      reviewEndTime: endTime.toISOString(),
      reviewDurationSeconds: Math.floor((endTime.getTime() - itemStartTime.getTime()) / 1000),
    };

    if (decision === 'edited' && editedData) {
      entry.originalTerm = currentItem.term;
      entry.originalCode = currentItem.code;
      entry.editedTerm = editedData.term;
      entry.editedCode = editedData.code;
    }

    setAuditEntries(prev => [...prev, entry]);
  };

  const moveToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setItemStartTime(new Date());
      setItemElapsedTime(0);
    } else {
      setIsComplete(true);
    }
  };

  const handleConfirm = async () => {
    recordDecision('confirmed');
    moveToNext();
  };

  const handleSkip = async () => {
    recordDecision('skipped');
    moveToNext();
  };

  const handleRemove = async () => {
    if (!snomedJsonUrl || !currentItem) return;

    setSaving(true);
    try {
      const snomedPath = snomedJsonUrl.replace('lg/', '');
      const { data: snomedFile, error: downloadError } = await supabase.storage
        .from('lg')
        .download(snomedPath);

      if (downloadError) throw downloadError;

      const snomedData = JSON.parse(await snomedFile.text());
      const domainKey = currentItem.domain.toLowerCase() === 'diagnosis' ? 'diagnoses' :
                        currentItem.domain.toLowerCase() === 'surgery' ? 'surgeries' :
                        currentItem.domain.toLowerCase() === 'allergy' ? 'allergies' :
                        currentItem.domain.toLowerCase() === 'immunisation' ? 'immunisations' : null;

      if (!domainKey || !snomedData[domainKey]) throw new Error('Invalid domain');

      const domainArray = snomedData[domainKey] as any[];
      const itemIndex = domainArray.findIndex(
        (i: any) => i.term === currentItem.term && i.code === currentItem.code
      );

      if (itemIndex !== -1) {
        domainArray.splice(itemIndex, 1);
        const updatedJson = JSON.stringify(snomedData, null, 2);
        await supabase.storage
          .from('lg')
          .upload(snomedPath, new Blob([updatedJson], { type: 'application/json' }), { upsert: true });
      }

      recordDecision('removed');
      moveToNext();
    } catch (err) {
      console.error('Failed to remove item:', err);
      toast({ title: 'Error', description: 'Failed to remove item', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!snomedJsonUrl || !currentItem) return;
    if (!editedTerm.trim() || !editedCode.trim()) {
      toast({ title: 'Validation Error', description: 'Term and code are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const snomedPath = snomedJsonUrl.replace('lg/', '');
      const { data: snomedFile, error: downloadError } = await supabase.storage
        .from('lg')
        .download(snomedPath);

      if (downloadError) throw downloadError;

      const snomedData = JSON.parse(await snomedFile.text());
      const domainKey = currentItem.domain.toLowerCase() === 'diagnosis' ? 'diagnoses' :
                        currentItem.domain.toLowerCase() === 'surgery' ? 'surgeries' :
                        currentItem.domain.toLowerCase() === 'allergy' ? 'allergies' :
                        currentItem.domain.toLowerCase() === 'immunisation' ? 'immunisations' : null;

      if (!domainKey || !snomedData[domainKey]) throw new Error('Invalid domain');

      const domainArray = snomedData[domainKey] as any[];
      const itemIndex = domainArray.findIndex(
        (i: any) => i.term === currentItem.term && i.code === currentItem.code
      );

      if (itemIndex !== -1) {
        domainArray[itemIndex] = {
          ...domainArray[itemIndex],
          term: editedTerm.trim(),
          code: editedCode.trim(),
        };
        const updatedJson = JSON.stringify(snomedData, null, 2);
        await supabase.storage
          .from('lg')
          .upload(snomedPath, new Blob([updatedJson], { type: 'application/json' }), { upsert: true });
      }

      recordDecision('edited', { term: editedTerm.trim(), code: editedCode.trim() });
      moveToNext();
    } catch (err) {
      console.error('Failed to update item:', err);
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!auditStartTime) return;

    setGeneratingReport(true);
    try {
      const endTime = new Date();
      const totalDuration = Math.floor((endTime.getTime() - auditStartTime.getTime()) / 1000);
      
      const session: AuditSession = {
        patientId,
        patientNhsNumber: patientNhs,
        patientName,
        auditorName,
        auditorEmail,
        auditStartTime: auditStartTime.toISOString(),
        auditEndTime: endTime.toISOString(),
        totalDurationSeconds: totalDuration,
        totalItems: items.length,
        confirmedCount: auditEntries.filter(e => e.decision === 'confirmed').length,
        removedCount: auditEntries.filter(e => e.decision === 'removed').length,
        editedCount: auditEntries.filter(e => e.decision === 'edited').length,
        skippedCount: auditEntries.filter(e => e.decision === 'skipped').length,
        averageTimePerItemSeconds: totalDuration / items.length,
        entries: auditEntries,
      };

      // Save JSON to storage
      const jsonPath = `${practiceOds}/${patientId}/final/audit_report.json`;
      await supabase.storage
        .from('lg')
        .upload(jsonPath, new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }), { upsert: true });

      // Update patient record
      await supabase
        .from('lg_patients')
        .update({
          last_audit_at: endTime.toISOString(),
          last_audit_by: auditorName,
          audit_report_url: `lg/${jsonPath}`,
        })
        .eq('id', patientId);

      // Generate Word document
      await generateAuditReport(session);

      toast({
        title: 'Audit Complete',
        description: 'Report generated and downloaded successfully',
      });

      onAuditComplete();
      onClose();
    } catch (err) {
      console.error('Failed to generate report:', err);
      toast({ title: 'Error', description: 'Failed to generate audit report', variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleClose = () => {
    if (!isComplete && auditEntries.length > 0) {
      if (!confirm('Are you sure you want to cancel the audit? Progress will be lost.')) {
        return;
      }
    }
    // Reset state
    setCurrentIndex(0);
    setAuditEntries([]);
    setAuditStartTime(null);
    setItemStartTime(null);
    setElapsedTime(0);
    setItemElapsedTime(0);
    setIsComplete(false);
    setIsPaused(false);
    onClose();
  };

  if (!currentItem && !isComplete) return null;

  const pdfPageNumber = currentItem && typeof currentItem.source_page === 'number' ? currentItem.source_page + 2 : null;
  const progressPercent = ((currentIndex + (isComplete ? 1 : 0)) / items.length) * 100;

  // Summary stats
  const confirmedCount = auditEntries.filter(e => e.decision === 'confirmed').length;
  const removedCount = auditEntries.filter(e => e.decision === 'removed').length;
  const editedCount = auditEntries.filter(e => e.decision === 'edited').length;
  const skippedCount = auditEntries.filter(e => e.decision === 'skipped').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              SNOMED Audit
              {!isComplete && (
                <Badge variant="outline" className="ml-2">
                  Item {currentIndex + 1} of {items.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm font-normal">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
              {!isComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{confirmedCount} confirmed • {editedCount} edited • {removedCount} removed • {skippedCount} skipped</span>
            <span>{Math.round(progressPercent)}% complete</span>
          </div>
        </div>

        {isComplete ? (
          /* Completion screen */
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-semibold">Audit Complete</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
                  <div className="text-xs text-muted-foreground">Confirmed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{editedCount}</div>
                  <div className="text-xs text-muted-foreground">Edited</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{removedCount}</div>
                  <div className="text-xs text-muted-foreground">Removed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-600">{skippedCount}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center space-y-1">
              <p className="text-lg">Total time: <span className="font-mono font-semibold">{formatTime(elapsedTime)}</span></p>
              <p className="text-sm text-muted-foreground">
                Average: {formatTime(Math.round(elapsedTime / items.length))} per item
              </p>
            </div>

            <Button onClick={handleGenerateReport} disabled={generatingReport} size="lg">
              {generatingReport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Download Audit Report
                </>
              )}
            </Button>
          </div>
        ) : isPaused ? (
          /* Paused screen */
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-8">
            <Pause className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Audit Paused</h2>
            <p className="text-muted-foreground">Click resume to continue</p>
            <Button onClick={() => setIsPaused(false)} size="lg">
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          </div>
        ) : (
          /* Review screen */
          <>
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Image viewer */}
              <div className="relative border rounded-lg overflow-hidden bg-muted/20">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                {imageError && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <div className="text-center p-4">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">{imageError}</p>
                    </div>
                  </div>
                )}
                {imageUrl && !imageLoading && (
                  <ScrollArea className="h-[500px]">
                    <div className="p-2 flex items-start justify-center">
                      <img
                        src={imageUrl}
                        alt={`Scan page ${currentItem.source_page! + 1}`}
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                        className="max-h-[480px] w-auto object-contain"
                      />
                    </div>
                  </ScrollArea>
                )}
                {!imageLoading && !imageError && !imageUrl && typeof currentItem.source_page !== 'number' && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">No source page available</p>
                  </div>
                )}
                
                {imageUrl && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Right: Item details */}
              <div className="space-y-4">
                {/* Timer for current item */}
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Time on this item:</span>
                  <span className={`font-mono text-lg ${itemElapsedTime > 120 ? 'text-amber-600' : ''}`}>
                    {formatTime(itemElapsedTime)}
                  </span>
                </div>

                {itemElapsedTime > 120 && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Taking longer than usual - consider skipping if unclear
                  </div>
                )}

                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{currentItem.domain}</Badge>
                    {pdfPageNumber && <Badge variant="outline">PDF Page {pdfPageNumber}</Badge>}
                    <Badge 
                      variant={currentItem.confidence > 0.89 ? 'default' : 'destructive'}
                    >
                      {Math.round(currentItem.confidence * 100)}% confidence
                    </Badge>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="edit-term">Term</Label>
                        <Input id="edit-term" value={editedTerm} onChange={(e) => setEditedTerm(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="edit-code">SNOMED Code</Label>
                        <Input id="edit-code" value={editedCode} onChange={(e) => setEditedCode(e.target.value)} className="mt-1 font-mono" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Term</p>
                        <p className="font-medium">{currentItem.term}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">SNOMED Code</p>
                        <p className="font-mono text-sm">{currentItem.code}</p>
                      </div>
                    </>
                  )}

                  {currentItem.date && (
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm">{currentItem.date}</p>
                    </div>
                  )}

                  {currentItem.evidence && (
                    <div>
                      <p className="text-xs text-muted-foreground">Evidence from OCR</p>
                      <p className="text-sm italic text-muted-foreground bg-muted/50 p-2 rounded">"{currentItem.evidence}"</p>
                    </div>
                  )}
                </div>

                {currentItem.confidence <= 0.89 && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Confidence ≤89% - please verify against source
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancel Edit
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save & Next
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="destructive" onClick={handleRemove} disabled={saving} className="mr-auto ml-5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                    Remove
                  </Button>
                  <Button variant="outline" onClick={handleSkip} disabled={saving}>
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(true)} disabled={saving}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button onClick={handleConfirm} disabled={saving}>
                    <Check className="h-4 w-4 mr-2" />
                    Confirm
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
