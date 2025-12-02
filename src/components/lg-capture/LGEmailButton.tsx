import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Mail, Loader2, Send, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } from 'docx';

interface LGEmailButtonProps {
  patient: LGPatient;
}

interface ClinicalSummary {
  summary_line?: string;
  allergies?: string[];
  significant_past_history?: string[];
  medications?: string[];
  immunisations?: string[];
  procedures?: string[];
  family_history?: string[];
  risk_factors?: string[];
  alerts?: Array<{ type: string; description: string }>;
  free_text_findings?: string;
}

interface SnomedEntry {
  domain: string;
  term: string;
  code: string;
  confidence: number;
  evidence: string;
  source: string;
}

export function LGEmailButton({ patient }: LGEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
  const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Unknown';
  const dob = patient.ai_extracted_dob || patient.dob || 'Unknown';

  const fetchPatientData = async () => {
    const basePath = `${patient.practice_ods}/${patient.id}`;
    
    let summaryData: ClinicalSummary = {};
    let snomedData: SnomedEntry[] = [];

    try {
      const { data: summaryFile } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/summary.json`);
      if (summaryFile) {
        summaryData = JSON.parse(await summaryFile.text());
      }
    } catch (e) {
      console.log('No summary data found');
    }

    try {
      const { data: snomedFile } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/snomed.json`);
      if (snomedFile) {
        snomedData = JSON.parse(await snomedFile.text());
      }
    } catch (e) {
      console.log('No SNOMED data found');
    }

    return { summaryData, snomedData };
  };

  const generateWordDocument = async (summaryData: ClinicalSummary, snomedData: SnomedEntry[]) => {
    const sections = [];

    // Title
    sections.push(
      new Paragraph({
        text: 'Lloyd George Record Summary',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // Patient Details Table
    sections.push(
      new Paragraph({
        text: 'Patient Details',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
      })
    );

    const patientTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createTableRow('Patient Name', patientName),
        createTableRow('NHS Number', nhsNumber),
        createTableRow('Date of Birth', dob),
        createTableRow('Sex', patient.ai_extracted_sex || patient.sex || 'Unknown'),
        createTableRow('Practice ODS', patient.practice_ods),
        createTableRow('Record Date', new Date().toLocaleDateString('en-GB')),
      ],
    });
    sections.push(patientTable);

    // Clinical Summary
    if (summaryData.summary_line) {
      sections.push(
        new Paragraph({
          text: 'Clinical Summary',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: summaryData.summary_line,
          spacing: { after: 200 },
        })
      );
    }

    // Allergies
    if (summaryData.allergies?.length) {
      sections.push(
        new Paragraph({
          text: 'Allergies',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.allergies.map(a => new Paragraph({
          text: `• ${a}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Medications
    if (summaryData.medications?.length) {
      sections.push(
        new Paragraph({
          text: 'Medications',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.medications.map(m => new Paragraph({
          text: `• ${m}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Significant Past History
    if (summaryData.significant_past_history?.length) {
      sections.push(
        new Paragraph({
          text: 'Significant Past History',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.significant_past_history.map(h => new Paragraph({
          text: `• ${h}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Procedures
    if (summaryData.procedures?.length) {
      sections.push(
        new Paragraph({
          text: 'Procedures',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.procedures.map(p => new Paragraph({
          text: `• ${p}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Immunisations
    if (summaryData.immunisations?.length) {
      sections.push(
        new Paragraph({
          text: 'Immunisations',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.immunisations.map(i => new Paragraph({
          text: `• ${i}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Risk Factors
    if (summaryData.risk_factors?.length) {
      sections.push(
        new Paragraph({
          text: 'Risk Factors',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.risk_factors.map(r => new Paragraph({
          text: `• ${r}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Family History
    if (summaryData.family_history?.length) {
      sections.push(
        new Paragraph({
          text: 'Family History',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.family_history.map(f => new Paragraph({
          text: `• ${f}`,
          spacing: { after: 50 },
        }))
      );
    }

    // Alerts
    if (summaryData.alerts?.length) {
      sections.push(
        new Paragraph({
          text: 'Clinical Alerts',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...summaryData.alerts.map(a => new Paragraph({
          children: [
            new TextRun({ text: `⚠️ ${a.type}: `, bold: true }),
            new TextRun({ text: a.description }),
          ],
          spacing: { after: 50 },
        }))
      );
    }

    // Free Text Findings
    if (summaryData.free_text_findings) {
      sections.push(
        new Paragraph({
          text: 'Additional Findings',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({
          text: summaryData.free_text_findings,
          spacing: { after: 200 },
        })
      );
    }

    // SNOMED CT Codes Section
    if (snomedData.length > 0) {
      sections.push(
        new Paragraph({
          text: 'SNOMED CT Codes',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: 'The following SNOMED CT codes have been identified from the Lloyd George records:',
          spacing: { after: 200 },
        })
      );

      // Group by domain
      const domains = [...new Set(snomedData.map(s => s.domain))];
      
      for (const domain of domains) {
        const domainEntries = snomedData.filter(s => s.domain === domain);
        
        sections.push(
          new Paragraph({
            text: domain.charAt(0).toUpperCase() + domain.slice(1),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );

        const snomedTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createHeaderCell('Term'),
                createHeaderCell('SNOMED Code'),
                createHeaderCell('Confidence'),
                createHeaderCell('Evidence'),
              ],
            }),
            ...domainEntries.map(entry => 
              new TableRow({
                children: [
                  createDataCell(entry.term),
                  createDataCell(entry.code),
                  createDataCell(`${Math.round(entry.confidence * 100)}%`),
                  createDataCell(entry.evidence || '-'),
                ],
              })
            ),
          ],
        });
        sections.push(snomedTable);
      }
    }

    // Footer
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Generated by Notewell AI Lloyd George Capture Service',
            italics: true,
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Report generated: ${new Date().toLocaleString('en-GB')}`,
            italics: true,
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: sections,
      }],
    });

    return await Packer.toBlob(doc);
  };

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSending(true);
    try {
      const { summaryData, snomedData } = await fetchPatientData();
      
      // Generate Word document
      const wordBlob = await generateWordDocument(summaryData, snomedData);
      const wordBase64 = await blobToBase64(wordBlob);

      // Build email HTML content
      const emailHtml = buildEmailHtml(summaryData, snomedData);

      // Send via EmailJS edge function
      const { error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: {
          to_email: email.trim(),
          to_name: name.trim() || 'Recipient',
          subject: `Lloyd George Record Summary - ${patientName} (NHS: ${nhsNumber})`,
          html_content: emailHtml,
          attachments: [{
            filename: `LG_Summary_${nhsNumber.replace(/\s/g, '')}_${new Date().toISOString().split('T')[0]}.docx`,
            content: wordBase64,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }],
        },
      });

      if (error) throw error;

      toast.success('Email sent successfully');
      setOpen(false);
      setEmail('');
      setName('');
    } catch (err) {
      console.error('Failed to send email:', err);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const { summaryData, snomedData } = await fetchPatientData();
      const wordBlob = await generateWordDocument(summaryData, snomedData);
      
      const url = URL.createObjectURL(wordBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LG_Summary_${nhsNumber.replace(/\s/g, '')}_${new Date().toISOString().split('T')[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Report downloaded');
    } catch (err) {
      console.error('Failed to generate report:', err);
      toast.error('Failed to generate report');
    }
  };

  const buildEmailHtml = (summaryData: ClinicalSummary, snomedData: SnomedEntry[]) => {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #005EB8; border-bottom: 2px solid #005EB8; padding-bottom: 10px;">Lloyd George Record Summary</h1>
        
        <h2 style="color: #333;">Patient Details</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td><td style="padding: 8px; border: 1px solid #ddd;">${patientName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">NHS Number</td><td style="padding: 8px; border: 1px solid #ddd;">${nhsNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">DOB</td><td style="padding: 8px; border: 1px solid #ddd;">${dob}</td></tr>
        </table>
    `;

    if (summaryData.summary_line) {
      html += `<h2 style="color: #333;">Clinical Summary</h2><p>${summaryData.summary_line}</p>`;
    }

    if (summaryData.allergies?.length) {
      html += `<h3 style="color: #DA291C;">⚠️ Allergies</h3><ul>${summaryData.allergies.map(a => `<li>${a}</li>`).join('')}</ul>`;
    }

    if (snomedData.length > 0) {
      html += `<h2 style="color: #333;">SNOMED CT Codes Identified</h2><p>${snomedData.length} clinical codes extracted from records.</p>`;
    }

    html += `
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Full report attached as Word document.<br>
          Generated by Notewell AI Lloyd George Capture Service
        </p>
      </div>
    `;

    return html;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Mail className="mr-2 h-4 w-4" />
          Email Records
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Patient Records</DialogTitle>
          <DialogDescription>
            Send the Lloyd George summary report with SNOMED codes to an email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium">{patientName}</p>
            <p className="text-muted-foreground font-mono text-xs">NHS: {nhsNumber}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="doctor@nhs.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Recipient Name (optional)</Label>
            <Input
              id="name"
              placeholder="Dr. Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Email includes:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Patient details and clinical summary</li>
              <li>SNOMED CT codes with confidence scores</li>
              <li>Word document report attachment</li>
            </ul>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs"
            onClick={handleDownloadReport}
          >
            <Download className="mr-2 h-3 w-3" />
            Preview/Download Report
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createTableRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
        shading: { fill: 'F0F4F5' },
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ text: value })],
      }),
    ],
  });
}

function createHeaderCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })] })],
    shading: { fill: '005EB8' },
  });
}

function createDataCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ text, style: 'Normal' })],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    },
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
