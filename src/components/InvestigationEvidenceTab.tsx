import React from 'react';
import { RequestInformationPanel } from '@/components/RequestInformationPanel';
import { InvestigationFindings } from '@/components/InvestigationFindings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Upload, Volume2 } from 'lucide-react';
import { InvestigationEvidence } from '@/components/InvestigationEvidence';

interface InvestigationEvidenceTabProps {
  complaintId: string;
  disabled?: boolean;
}

export function InvestigationEvidenceTab({ complaintId, disabled = false }: InvestigationEvidenceTabProps) {
  return (
    <div className="space-y-6">
      {/* Request Information Panel - Top Priority */}
      <RequestInformationPanel complaintId={complaintId} disabled={disabled} />

      {/* Evidence & Transcripts Section */}
      <InvestigationEvidence complaintId={complaintId} disabled={disabled} />

      {/* Investigation Findings */}
      <InvestigationFindings complaintId={complaintId} disabled={disabled} />
    </div>
  );
}
