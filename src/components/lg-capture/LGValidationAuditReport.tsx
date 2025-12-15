import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
// Toast messages removed from LG Capture service
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { FileText, Mail, Loader2 } from 'lucide-react';

interface LGPatientFile {
  id: string;
  patient_name: string | null;
  nhs_number: string | null;
  dob: string | null;
  images_count: number | null;
  created_at: string;
  downloaded_at: string | null;
  uploaded_to_s1_at: string | null;
  validated_at: string | null;
  validation_result?: {
    clinical_system?: string;
    nhs_match?: boolean;
    dob_match?: boolean;
    file_detected?: boolean;
    confidence?: number;
    manual_override?: boolean;
    override_reason?: string | null;
    validated_at?: string;
  } | null;
}

interface LGValidationAuditReportProps {
  patient: LGPatientFile;
  uploaderName?: string;
  practiceOds?: string;
}

const formatNhsNumber = (nhs: string | null): string => {
  if (!nhs) return '—';
  const clean = nhs.replace(/\s/g, '');
  if (clean.length !== 10) return nhs;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return `${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} on ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  } catch {
    return dateStr;
  }
};

export function LGValidationAuditReport({ patient, uploaderName = 'Unknown', practiceOds = 'Unknown' }: LGValidationAuditReportProps) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();
      setUserEmail(data?.email || user?.email || null);
    };
    fetchUserEmail();
  }, [user]);

  const generateWordDocument = async (): Promise<Blob> => {
    const validation = patient.validation_result;
    const clinicalSystem = validation?.clinical_system === 'emis' ? 'EMIS Web' : 'SystmOne';
    
    const createTableRow = (label: string, value: string) => {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
            shading: { fill: 'f0f0f0' }
          }),
          new TableCell({
            width: { size: 6000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: value, size: 22 })] })]
          })
        ]
      });
    };

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Lloyd George Record Upload', bold: true, size: 36, color: '005EB8' }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Validation Audit Report', bold: true, size: 28 }),
            ],
            spacing: { after: 400 }
          }),

          // Patient Details
          new Paragraph({
            children: [new TextRun({ text: 'Patient Details', bold: true, size: 26, color: '005EB8' })],
            spacing: { before: 300, after: 200 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow('Patient Name', patient.patient_name || '—'),
              createTableRow('NHS Number', formatNhsNumber(patient.nhs_number)),
              createTableRow('Date of Birth', formatDate(patient.dob)),
            ]
          }),

          // Scan Details
          new Paragraph({
            children: [new TextRun({ text: 'Scan Details', bold: true, size: 26, color: '005EB8' })],
            spacing: { before: 400, after: 200 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow('Scan Date', formatDateTime(patient.created_at)),
              createTableRow('Uploader', uploaderName),
              createTableRow('Practice ODS', practiceOds),
              createTableRow('Pages Scanned', String(patient.images_count || 0)),
            ]
          }),

          // Publishing Workflow
          new Paragraph({
            children: [new TextRun({ text: 'Publishing Workflow', bold: true, size: 26, color: '005EB8' })],
            spacing: { before: 400, after: 200 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow('Downloaded', formatDateTime(patient.downloaded_at)),
              createTableRow(`Uploaded to ${clinicalSystem}`, formatDateTime(patient.uploaded_to_s1_at)),
              createTableRow('Validated', formatDateTime(patient.validated_at)),
            ]
          }),

          // Validation Details
          new Paragraph({
            children: [new TextRun({ text: 'Validation Details', bold: true, size: 26, color: '005EB8' })],
            spacing: { before: 400, after: 200 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow('Clinical System', clinicalSystem),
              createTableRow('NHS Number Match', validation?.nhs_match ? '✓ Verified' : '✗ Mismatch'),
              createTableRow('DOB Match', validation?.dob_match ? '✓ Verified' : '✗ Mismatch'),
              createTableRow('File Detected', validation?.file_detected ? '✓ Yes' : '✗ No'),
              createTableRow('Confidence Score', `${Math.round((validation?.confidence || 0) * 100)}%`),
              createTableRow('Manual Override', validation?.manual_override ? 'Yes' : 'No'),
              ...(validation?.manual_override && validation?.override_reason ? [
                createTableRow('Override Reason', validation.override_reason)
              ] : [])
            ]
          }),

          // Footer
          new Paragraph({
            children: [
              new TextRun({ 
                text: `Report generated: ${formatDateTime(new Date().toISOString())}`, 
                size: 18, 
                italics: true,
                color: '666666'
              })
            ],
            spacing: { before: 600 }
          }),
          new Paragraph({
            children: [
              new TextRun({ 
                text: 'Notewell AI — LG Capture Validation System', 
                size: 18, 
                italics: true,
                color: '666666'
              })
            ]
          })
        ]
      }]
    });

    return await Packer.toBlob(doc);
  };

  const downloadAuditReport = async () => {
    setGenerating(true);
    try {
      const blob = await generateWordDocument();
      const nhsClean = patient.nhs_number?.replace(/\s/g, '') || 'unknown';
      const filename = `LG_Validation_Audit_${nhsClean}_${new Date().toISOString().split('T')[0]}.docx`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Error generating audit report:', err);
    } finally {
      setGenerating(false);
    }
  };

  const emailAuditReport = async () => {
    if (!userEmail) {
      return;
    }

    setEmailing(true);
    try {
      const blob = await generateWordDocument();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const validation = patient.validation_result;
      const clinicalSystem = validation?.clinical_system === 'emis' ? 'EMIS Web' : 'SystmOne';

      const { error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          template: 'lg-validation-audit',
          to: userEmail,
          patientName: patient.patient_name || 'Unknown',
          nhsNumber: formatNhsNumber(patient.nhs_number),
          dob: formatDate(patient.dob),
          pagesScanned: patient.images_count || 0,
          scanDate: formatDateTime(patient.created_at),
          downloadedAt: formatDateTime(patient.downloaded_at),
          uploadedAt: formatDateTime(patient.uploaded_to_s1_at),
          validatedAt: formatDateTime(patient.validated_at),
          clinicalSystem,
          nhsMatch: validation?.nhs_match || false,
          dobMatch: validation?.dob_match || false,
          fileDetected: validation?.file_detected || false,
          confidence: Math.round((validation?.confidence || 0) * 100),
          manualOverride: validation?.manual_override || false,
          overrideReason: validation?.override_reason || null,
          uploaderName,
          practiceOds,
          attachmentBase64: base64,
          attachmentFilename: `LG_Validation_Audit_${patient.nhs_number?.replace(/\s/g, '') || 'unknown'}.docx`
        }
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error emailing audit report:', err);
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={downloadAuditReport}
        disabled={generating}
        className="gap-1"
      >
        {generating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FileText className="h-3 w-3" />
        )}
        Audit
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={emailAuditReport}
        disabled={emailing}
        className="gap-1"
      >
        {emailing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Mail className="h-3 w-3" />
        )}
        Email
      </Button>
    </div>
  );
}
