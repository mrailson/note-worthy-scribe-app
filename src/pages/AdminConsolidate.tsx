import React from 'react';
import { BatchConsolidateButton } from '@/components/admin/BatchConsolidateButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminConsolidate: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Admin: Batch Consolidate</h1>
            <p className="text-muted-foreground">Recover lost transcript data from chunks</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">About This Tool</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This tool fixes a data integrity issue where transcription chunks were not properly 
                consolidated into final transcripts. Many meetings show only 30-40% of their actual 
                words in the transcript view, while the rest remains in chunks.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2">What This Does:</h3>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                <li>Finds all meetings with transcription chunks</li>
                <li>Consolidates chunks (using cleaned text when available, raw text as fallback)</li>
                <li>Updates the meeting_transcripts table with complete data</li>
                <li>Preserves all existing data - this is a recovery operation</li>
              </ul>
            </div>

            <BatchConsolidateButton />
          </div>
        </Card>
      </div>
    </div>
  );
};
