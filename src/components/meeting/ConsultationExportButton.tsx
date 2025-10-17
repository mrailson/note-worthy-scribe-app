import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { exportConsultationToWord } from '@/utils/consultationWordExport';
import { ClinicalAction } from './ClinicalActionsPanel';

interface SoapNote {
  S: string;
  O: string;
  A: string;
  P: string;
}

interface ConsultationExportButtonProps {
  shorthand?: SoapNote;
  standard?: SoapNote;
  summaryLine?: string;
  patientCopy?: string;
  referral?: string;
  review?: string;
  clinicalActions?: ClinicalAction;
  consultationType?: string;
  consultationDate?: Date;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export const ConsultationExportButton: React.FC<ConsultationExportButtonProps> = ({
  shorthand,
  standard,
  summaryLine,
  patientCopy,
  referral,
  review,
  clinicalActions,
  consultationType,
  consultationDate,
  variant = 'outline',
  size = 'sm'
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.info('Generating consultation document...');

      await exportConsultationToWord({
        shorthand,
        standard,
        summaryLine,
        patientCopy,
        referral,
        review,
        clinicalActions,
        consultationType,
        consultationDate
      });

      toast.success('Consultation document downloaded');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export consultation document');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
    >
      <FileDown className="h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export to Word'}
    </Button>
  );
};
