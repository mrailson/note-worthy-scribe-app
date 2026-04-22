import React from 'react';
import { RequestInformationPanel } from '@/components/RequestInformationPanel';
import { InvestigationEvidence } from '@/components/InvestigationEvidence';
import { CriticalFriendReview } from '@/components/CriticalFriendReview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InvestigationEvidenceTabProps {
  complaintId: string;
  practiceId?: string | null;
  patientName?: string;
  referenceNumber?: string;
  disabled?: boolean;
  onCreateOutcomeLetter?: () => void;
}

export function InvestigationEvidenceTab({ complaintId, practiceId, patientName, referenceNumber, disabled = false, onCreateOutcomeLetter }: InvestigationEvidenceTabProps) {
  return (
    <div className="space-y-6">
      {/* Request Information Panel - Top Priority */}
      <RequestInformationPanel complaintId={complaintId} practiceId={practiceId} disabled={disabled} />

      {/* Patient Context Banner */}
      {(patientName || referenceNumber) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 font-medium">
            You are uploading evidence for: <span className="font-bold">{patientName || 'Unknown Patient'}</span>
            {referenceNumber && <span className="ml-2 font-mono text-sm">({referenceNumber})</span>}
            <span className="ml-2 font-normal text-amber-700">— Please check this is the correct patient before uploading.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Evidence & Transcripts Section */}
      <InvestigationEvidence complaintId={complaintId} disabled={disabled} />

      {/* Critical Friend Review */}
      <CriticalFriendReview complaintId={complaintId} disabled={disabled} />

      {/* Create Outcome Letter CTA */}
      {onCreateOutcomeLetter && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-lg">Ready to Create Outcome Letter?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  When you're satisfied with your investigation, create the formal outcome letter for the patient.
                </p>
              </div>
              <Button onClick={onCreateOutcomeLetter} className="ml-4">
                <FileText className="h-4 w-4 mr-2" />
                Create Outcome Letter
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
