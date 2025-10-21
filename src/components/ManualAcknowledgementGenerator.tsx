import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ManualAcknowledgementGeneratorProps {
  complaintId: string;
  complaintReference: string;
  currentStatus: string;
  onSuccess?: () => void;
}

export const ManualAcknowledgementGenerator: React.FC<ManualAcknowledgementGeneratorProps> = ({
  complaintId,
  complaintReference,
  currentStatus,
  onSuccess
}) => {
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkAndFixStatus = async () => {
    setChecking(true);
    try {
      console.log('Checking acknowledgement status for complaint:', complaintId);
      
      // Check if acknowledgement already exists
      const { data: acknowledgement, error: ackError } = await supabase
        .from('complaint_acknowledgements')
        .select('*')
        .eq('complaint_id', complaintId)
        .maybeSingle();
      
      if (ackError) throw ackError;
      
      if (acknowledgement && currentStatus === 'submitted') {
        // Acknowledgement exists but status is stuck - fix it
        console.log('Found existing acknowledgement, updating status...');
        const { error: statusError } = await supabase
          .from('complaints')
          .update({ 
            status: 'under_review',
            acknowledged_at: acknowledgement.created_at
          })
          .eq('id', complaintId);
        
        if (statusError) throw statusError;
        
        toast.success(`Status fixed for ${complaintReference}`);
        onSuccess?.();
      } else if (!acknowledgement) {
        toast.info('No acknowledgement found. Use "Generate Acknowledgement" instead.');
      } else {
        toast.success('Status is already correct.');
        onSuccess?.();
      }
      
    } catch (error) {
      console.error('Error checking/fixing status:', error);
      toast.error(`Failed to fix status: ${error.message || 'Unknown error'}`);
    } finally {
      setChecking(false);
    }
  };

  const generateAcknowledgement = async () => {
    setGenerating(true);
    try {
      console.log('Manually generating acknowledgement letter for complaint:', complaintId);
      
      const { data: ackData, error: ackError } = await supabase.functions.invoke(
        'generate-complaint-acknowledgement',
        { body: { complaintId } }
      );
      
      if (ackError) {
        console.error('Failed to generate acknowledgement:', ackError);
        toast.error(`Failed to generate acknowledgement: ${ackError.message || 'Unknown error'}`);
        throw new Error(ackError.message || 'Failed to generate acknowledgement');
      }
      
      console.log('Acknowledgement generated successfully:', ackData);
      toast.success(`Acknowledgement letter generated successfully for ${complaintReference}`);
      onSuccess?.();
      
    } catch (error) {
      console.error('Error generating acknowledgement:', error);
      toast.error(`Failed to generate acknowledgement: ${error.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const isStuck = currentStatus === 'submitted';

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          Acknowledgement Letter Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-amber-700">
            {isStuck 
              ? 'This complaint appears to be stuck in "Generating..." status. Use the tools below to fix it.'
              : 'Manage the acknowledgement letter for this complaint.'}
          </p>
          
          <div className="flex flex-wrap items-center gap-2">
            {isStuck && (
              <Button 
                onClick={checkAndFixStatus}
                disabled={checking}
                variant="outline"
                className="border-amber-600 text-amber-700 hover:bg-amber-100"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Fix Stuck Status
                  </>
                )}
              </Button>
            )}
            
            <Button 
              onClick={generateAcknowledgement}
              disabled={generating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {isStuck ? 'Regenerate Acknowledgement' : 'Generate Acknowledgement'}
                </>
              )}
            </Button>
          </div>
          
          {isStuck && (
            <p className="text-xs text-amber-600">
              Try "Fix Stuck Status" first if the acknowledgement was already generated but the status didn't update.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
