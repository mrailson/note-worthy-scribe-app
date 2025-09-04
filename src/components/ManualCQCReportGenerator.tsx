import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ManualCQCReportGeneratorProps {
  complaintId: string;
  complaintReference: string;
}

export const ManualCQCReportGenerator: React.FC<ManualCQCReportGeneratorProps> = ({
  complaintId,
  complaintReference
}) => {
  const [generating, setGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  const generateCQCReport = async () => {
    setGenerating(true);
    try {
      console.log('Manually generating CQC compliance report for complaint:', complaintId);
      
      const { data: cqcReportData, error: cqcError } = await supabase.functions.invoke(
        'generate-cqc-compliance-report',
        { body: { complaintId } }
      );
      
      if (cqcError) {
        console.error('Failed to generate CQC compliance report:', cqcError);
        throw new Error(cqcError.message || 'Failed to generate CQC compliance report');
      }
      
      console.log('CQC compliance report generated successfully:', cqcReportData);
      setReportGenerated(true);
      toast.success(`CQC compliance report generated successfully for ${complaintReference}`);
      
    } catch (error) {
      console.error('Error generating CQC compliance report:', error);
      toast.error(`Failed to generate CQC compliance report: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <FileText className="h-5 w-5" />
          CQC Compliance Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-blue-700">
            Generate a comprehensive CQC compliance evidence report for this completed complaint,
            demonstrating adherence to NHS complaint handling procedures and regulations.
          </p>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={generateCQCReport}
              disabled={generating || reportGenerated}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : reportGenerated ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Report Generated
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate CQC Compliance Report
                </>
              )}
            </Button>
            
            {reportGenerated && (
              <p className="text-sm text-green-700">
                Report has been generated and added to your CQC Evidence repository.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};