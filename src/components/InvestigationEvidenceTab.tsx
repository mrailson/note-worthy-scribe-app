import React from 'react';
import { RequestInformationPanel } from '@/components/RequestInformationPanel';
import { InvestigationEvidence } from '@/components/InvestigationEvidence';
import { CriticalFriendReview } from '@/components/CriticalFriendReview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight } from 'lucide-react';

interface InvestigationEvidenceTabProps {
  complaintId: string;
  practiceId?: string | null;
  disabled?: boolean;
  onCreateOutcomeLetter?: () => void;
}

export function InvestigationEvidenceTab({ complaintId, practiceId, disabled = false, onCreateOutcomeLetter }: InvestigationEvidenceTabProps) {
  return (
    <div className="space-y-6">
      {/* Request Information Panel - Top Priority */}
      <RequestInformationPanel complaintId={complaintId} practiceId={practiceId} disabled={disabled} />

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
