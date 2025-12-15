import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Pencil,
  Loader2,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// Toast messages removed from LG Capture service

interface SnomedItem {
  id: string;
  type: 'Diagnosis' | 'Surgery' | 'Immunisation' | 'Allergy' | 'Other';
  term: string;
  snomed_code: string;
  date: string | null;
  confidence: number;
  page_number: number;
}

interface AuditedItem {
  id: string;
  status: 'confirmed' | 'corrected' | 'removed' | 'needs_manual_review';
  original: {
    type: string;
    term: string;
    code: string;
    date: string | null;
    confidence: number;
    page_number: number;
  };
  corrected: {
    type: string | null;
    term: string | null;
    code: string | null;
    date: string | null;
  };
  reason: string;
}

interface AuditSummary {
  total_items: number;
  confirmed_count: number;
  corrected_count: number;
  removed_count: number;
  needs_manual_review_count: number;
  messages_for_user: string[];
}

interface LGQualityGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  practiceOds: string;
  snomedItems: SnomedItem[];
  snomedJsonUrl: string | null;
  onComplete: () => void;
}

export function LGQualityGateModal({
  isOpen,
  onClose,
  patientId,
  practiceOds,
  snomedItems,
  snomedJsonUrl,
  onComplete,
}: LGQualityGateModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [results, setResults] = useState<{
    audited_items: AuditedItem[];
    audit_summary: AuditSummary;
  } | null>(null);
  const [applyingCorrections, setApplyingCorrections] = useState(false);

  const runQualityGate = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);

    try {
      // Prepare items for the edge function
      const items = snomedItems.map((item, index) => ({
        id: `item_${index}`,
        type: item.type,
        term: item.term,
        snomed_code: item.snomed_code,
        date: item.date,
        confidence: item.confidence,
        page_number: item.page_number,
      }));

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('lg-snomed-quality-gate', {
        body: {
          patient_id: patientId,
          practice_ods: practiceOds,
          snomed_items: items,
          include_images: true,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults(data);
      setProgress(100);
    } catch (err) {
      console.error('Quality gate error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const applyCorrections = async () => {
    if (!results || !snomedJsonUrl) return;

    setApplyingCorrections(true);
    try {
      // Download current SNOMED JSON
      const snomedPath = snomedJsonUrl.replace('lg/', '');
      const { data: snomedFile, error: downloadError } = await supabase.storage
        .from('lg')
        .download(snomedPath);

      if (downloadError) throw downloadError;

      const snomedData = JSON.parse(await snomedFile.text());

      // Apply corrections and removals
      for (const item of results.audited_items) {
        if (item.status === 'removed') {
          // Remove from appropriate array
          const domainKey = getDomainKey(item.original.type);
          if (domainKey && snomedData[domainKey]) {
            snomedData[domainKey] = snomedData[domainKey].filter(
              (i: any) => !(i.term === item.original.term && i.code === item.original.code)
            );
          }
        } else if (item.status === 'corrected') {
          // Update in appropriate array
          const originalDomainKey = getDomainKey(item.original.type);
          const correctedDomainKey = getDomainKey(item.corrected.type || item.original.type);

          if (originalDomainKey && snomedData[originalDomainKey]) {
            const index = snomedData[originalDomainKey].findIndex(
              (i: any) => i.term === item.original.term && i.code === item.original.code
            );

            if (index !== -1) {
              // If type changed, move to new array
              if (originalDomainKey !== correctedDomainKey && correctedDomainKey) {
                const [removed] = snomedData[originalDomainKey].splice(index, 1);
                if (!snomedData[correctedDomainKey]) snomedData[correctedDomainKey] = [];
                snomedData[correctedDomainKey].push({
                  ...removed,
                  term: item.corrected.term || removed.term,
                  code: item.corrected.code || removed.code,
                  date: item.corrected.date !== undefined ? item.corrected.date : removed.date,
                });
              } else {
                // Update in place
                snomedData[originalDomainKey][index] = {
                  ...snomedData[originalDomainKey][index],
                  term: item.corrected.term || snomedData[originalDomainKey][index].term,
                  code: item.corrected.code || snomedData[originalDomainKey][index].code,
                  date: item.corrected.date !== undefined ? item.corrected.date : snomedData[originalDomainKey][index].date,
                };
              }
            }
          }
        }
      }

      // Upload updated SNOMED JSON
      const updatedJson = JSON.stringify(snomedData, null, 2);
      await supabase.storage
        .from('lg')
        .upload(snomedPath, new Blob([updatedJson], { type: 'application/json' }), { upsert: true });

      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to apply corrections:', err);
    } finally {
      setApplyingCorrections(false);
    }
  };

  const getDomainKey = (type: string | null): string | null => {
    if (!type) return null;
    const t = type.toLowerCase();
    if (t === 'diagnosis') return 'diagnoses';
    if (t === 'surgery') return 'surgeries';
    if (t === 'allergy') return 'allergies';
    if (t === 'immunisation') return 'immunisations';
    return null;
  };

  const getStatusIcon = (status: AuditedItem['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'corrected':
        return <Pencil className="h-4 w-4 text-blue-600" />;
      case 'removed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'needs_manual_review':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: AuditedItem['status']) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>;
      case 'corrected':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Corrected</Badge>;
      case 'removed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Removed</Badge>;
      case 'needs_manual_review':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Manual Review</Badge>;
    }
  };

  const hasCorrections = results && (results.audit_summary.corrected_count > 0 || results.audit_summary.removed_count > 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            AI Quality Gate - SNOMED Verification
          </DialogTitle>
        </DialogHeader>

        {!results ? (
          /* Pre-run state */
          <div className="flex-1 space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-2">About the Quality Gate</h3>
                <p className="text-sm text-muted-foreground">
                  The AI Quality Gate will review each SNOMED code against the original scanned page image 
                  and OCR text to verify accuracy. It will:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 text-left max-w-md mx-auto">
                  <li>• <strong>Confirm</strong> codes that match the source document</li>
                  <li>• <strong>Correct</strong> codes with errors (wrong code, term, or date)</li>
                  <li>• <strong>Remove</strong> codes with no supporting evidence</li>
                  <li>• <strong>Flag</strong> ambiguous items for manual review</li>
                </ul>
              </div>

              <div className="text-sm text-muted-foreground">
                <FileText className="h-4 w-4 inline mr-1" />
                {snomedItems.length} SNOMED item(s) to review
              </div>

              {isRunning && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
                    Reviewing items... This may take a minute.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Results state */
          <div className="flex-1 space-y-4 overflow-hidden">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-green-600">{results.audit_summary.confirmed_count}</div>
                  <div className="text-xs text-muted-foreground">Confirmed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-blue-600">{results.audit_summary.corrected_count}</div>
                  <div className="text-xs text-muted-foreground">Corrected</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-red-600">{results.audit_summary.removed_count}</div>
                  <div className="text-xs text-muted-foreground">Removed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-amber-600">{results.audit_summary.needs_manual_review_count}</div>
                  <div className="text-xs text-muted-foreground">Manual Review</div>
                </CardContent>
              </Card>
            </div>

            {/* Messages */}
            {results.audit_summary.messages_for_user.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Summary</h4>
                <ul className="text-sm space-y-1">
                  {results.audit_summary.messages_for_user.map((msg, i) => (
                    <li key={i} className="text-muted-foreground">{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detailed results */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {results.audited_items.map((item) => (
                  <Card key={item.id} className={
                    item.status === 'confirmed' ? 'border-green-200 bg-green-50/30' :
                    item.status === 'corrected' ? 'border-blue-200 bg-blue-50/30' :
                    item.status === 'removed' ? 'border-red-200 bg-red-50/30' :
                    'border-amber-200 bg-amber-50/30'
                  }>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          {getStatusIcon(item.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{item.original.term}</span>
                              {getStatusBadge(item.status)}
                              <Badge variant="outline" className="text-xs">Page {item.original.page_number + 1}</Badge>
                            </div>
                            
                            {item.status === 'corrected' && (
                              <div className="mt-1 flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground line-through">{item.original.term}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="text-blue-700 font-medium">{item.corrected.term}</span>
                              </div>
                            )}
                            
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.reason}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isRunning}>
                Cancel
              </Button>
              <Button onClick={runQualityGate} disabled={isRunning || snomedItems.length === 0}>
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Run Quality Gate
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {hasCorrections && (
                <Button onClick={applyCorrections} disabled={applyingCorrections}>
                  {applyingCorrections ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Apply {results.audit_summary.corrected_count + results.audit_summary.removed_count} Change(s)
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
