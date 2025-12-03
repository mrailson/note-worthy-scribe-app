import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } from 'docx';

interface LGEmailButtonProps {
  patient: LGPatient;
}

interface ClinicalSummary {
  summary_line?: string;
  allergies?: unknown[];
  significant_past_history?: unknown[];
  medications?: unknown[];
  immunisations?: unknown[];
  procedures?: unknown[];
  family_history?: unknown[];
  risk_factors?: unknown[];
  alerts?: Array<{ type: string; description: string }>;
  free_text_findings?: string;
}

function formatUKDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Unknown') return dateStr;
  // Try to parse and format as DD-MM-YYYY
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {
    // Return original if parsing fails
  }
  return dateStr;
}

function formatNhsNumber(nhs: string | null | undefined): string {
  if (!nhs || nhs === 'Unknown') return nhs || 'Unknown';
  const cleaned = nhs.replace(/\s/g, '');
  if (cleaned.length !== 10) return nhs;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
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
  const [sending, setSending] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        // Try to get user's name from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setUserName(profile?.full_name || user.email.split('@')[0]);
      }
    };
    fetchUserEmail();
  }, []);

  const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
  const nhsNumber = formatNhsNumber(patient.ai_extracted_nhs || patient.nhs_number);
  const dob = formatUKDate(patient.ai_extracted_dob || patient.dob || 'Unknown');

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
          text: `• ${formatListItem(a)}`,
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
          text: `• ${formatListItem(m)}`,
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
          text: `• ${formatListItem(h)}`,
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
          text: `• ${formatListItem(p)}`,
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
          text: `• ${formatListItem(i)}`,
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
          text: `• ${formatListItem(r)}`,
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
          text: `• ${formatListItem(f)}`,
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
                  createDataCell(safeString(entry.term)),
                  createDataCell(safeString(entry.code)),
                  createDataCell(`${Math.round((typeof entry.confidence === 'number' ? entry.confidence : 0) * 100)}%`),
                  createDataCell(safeString(entry.evidence) || '-'),
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
    if (!userEmail) {
      toast.error('No email address found. Please log in.');
      return;
    }

    setSending(true);
    try {
      console.log('Fetching patient data...');
      const { summaryData, snomedData } = await fetchPatientData();
      console.log('Summary data:', summaryData);
      console.log('SNOMED data:', snomedData);
      
      // Generate Word document
      console.log('Generating Word document...');
      const wordBlob = await generateWordDocument(summaryData, snomedData);
      console.log('Word blob size:', wordBlob.size);
      const wordBase64 = await blobToBase64(wordBlob);
      console.log('Word base64 length:', wordBase64.length);

      // Build email HTML content
      console.log('Building email HTML...');
      const emailHtml = buildEmailHtml(summaryData, snomedData);
      console.log('Email HTML length:', emailHtml.length);

      // Send via Resend edge function
      console.log('Invoking Resend edge function...');
      const { error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          to_email: userEmail,
          to_name: userName,
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

      toast.success(`Email sent to ${userEmail}`);
    } catch (err) {
      console.error('Failed to send email:', err);
      console.error('Error details:', err instanceof Error ? err.stack : err);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const buildEmailHtml = (summaryData: ClinicalSummary, snomedData: SnomedEntry[]) => {
    // Ensure arrays are defined
    const safeSnomedData = Array.isArray(snomedData) ? snomedData : [];
    // Calculate low confidence items (under 60%)
    const lowConfidenceCount = safeSnomedData.filter(s => typeof s.confidence === 'number' && s.confidence < 0.6).length;
    
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #005EB8; border-bottom: 2px solid #005EB8; padding-bottom: 10px;">Lloyd George Record Summary</h1>
        
        <h2 style="color: #333;">Patient Details</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td><td style="padding: 8px; border: 1px solid #ddd;">${patientName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">NHS Number</td><td style="padding: 8px; border: 1px solid #ddd;">${nhsNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">DOB</td><td style="padding: 8px; border: 1px solid #ddd;">${dob}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pages Scanned</td><td style="padding: 8px; border: 1px solid #ddd;">${patient.images_count || 0}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Items Requiring Review</td><td style="padding: 8px; border: 1px solid #ddd; ${lowConfidenceCount > 0 ? 'color: #DA291C; font-weight: bold;' : ''}">${lowConfidenceCount}</td></tr>
        </table>
    `;

    if (summaryData.summary_line) {
      html += `<h2 style="color: #333;">Clinical Summary</h2><p>${summaryData.summary_line}</p>`;
    }

    if (summaryData.allergies?.length) {
      html += `<h3 style="color: #DA291C;">⚠️ Allergies</h3><ul>${summaryData.allergies.map(a => `<li>${formatListItem(a)}</li>`).join('')}</ul>`;
    }

    if (summaryData.medications?.length) {
      html += `<h3 style="color: #333;">Medications</h3><ul>${summaryData.medications.map(m => `<li>${formatListItem(m)}</li>`).join('')}</ul>`;
    }

    if (summaryData.significant_past_history?.length) {
      html += `<h3 style="color: #333;">Significant Past History</h3><ul>${summaryData.significant_past_history.map(h => `<li>${formatListItem(h)}</li>`).join('')}</ul>`;
    }

    if (summaryData.procedures?.length) {
      html += `<h3 style="color: #333;">Procedures</h3><ul>${summaryData.procedures.map(p => `<li>${formatListItem(p)}</li>`).join('')}</ul>`;
    }

    if (summaryData.immunisations?.length) {
      html += `<h3 style="color: #333;">Immunisations</h3><ul>${summaryData.immunisations.map(i => `<li>${formatListItem(i)}</li>`).join('')}</ul>`;
    }

    if (summaryData.risk_factors?.length) {
      html += `<h3 style="color: #333;">Risk Factors</h3><ul>${summaryData.risk_factors.map(r => `<li>${formatListItem(r)}</li>`).join('')}</ul>`;
    }

    if (summaryData.family_history?.length) {
      html += `<h3 style="color: #333;">Family History</h3><ul>${summaryData.family_history.map(f => `<li>${formatListItem(f)}</li>`).join('')}</ul>`;
    }

    if (summaryData.free_text_findings) {
      html += `<h3 style="color: #333;">Additional Findings</h3><p>${summaryData.free_text_findings}</p>`;
    }

    if (safeSnomedData.length > 0) {
      html += `<h2 style="color: #333;">SNOMED CT Codes (${safeSnomedData.length} identified)</h2>`;
      
      // Group by domain
      const domains = [...new Set(safeSnomedData.map(s => s.domain))];
      
      for (const domain of domains) {
        const domainEntries = safeSnomedData.filter(s => s.domain === domain);
        html += `<h3 style="color: #005EB8;">${domain.charAt(0).toUpperCase() + domain.slice(1)}</h3>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
          <tr style="background: #005EB8; color: white;">
            <th style="padding: 6px; text-align: left;">Term</th>
            <th style="padding: 6px; text-align: left;">Code</th>
            <th style="padding: 6px; text-align: center;">Confidence</th>
          </tr>`;
        
        for (const entry of domainEntries) {
          const confPercent = Math.round((typeof entry.confidence === 'number' ? entry.confidence : 0) * 100);
          const confColor = confPercent >= 60 ? '#007F3B' : '#DA291C';
          html += `<tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 6px;">${safeString(entry.term)}</td>
            <td style="padding: 6px; font-family: monospace;">${safeString(entry.code)}</td>
            <td style="padding: 6px; text-align: center; color: ${confColor}; font-weight: bold;">${confPercent}%</td>
          </tr>`;
        }
        html += `</table>`;
      }
    }

    html += `
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Full report attached as Word document.<br>
          Generated by Notewell AI Lloyd George Capture Service<br>
          ${new Date().toLocaleString('en-GB')}
        </p>
      </div>
    `;

    return html;
  };

  const wasEmailSent = !!patient.email_sent_at;
  const emailError = (patient as any).email_error;

  return (
    <div className="space-y-2">
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={handleSend}
        disabled={sending || !userEmail}
      >
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            {wasEmailSent ? 'Resend Email' : 'Email Records'}
          </>
        )}
      </Button>
      {wasEmailSent && (
        <p className="text-xs text-muted-foreground text-center">
          Email sent automatically on {new Date(patient.email_sent_at!).toLocaleString('en-GB')}
        </p>
      )}
      {emailError && (
        <p className="text-xs text-destructive text-center">
          Auto-email failed: {emailError}
        </p>
      )}
    </div>
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

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[complex data]';
    }
  }
  return String(value);
}

function formatListItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') {
    // Handle common object structures from AI extraction
    const obj = item as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    if (obj.term) return String(obj.term);
    if (obj.description) return String(obj.description);
    if (obj.value) return String(obj.value);
    // Fallback to readable key-value pairs
    const entries = Object.entries(obj).filter(([_, v]) => v != null);
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
    }
  }
  return String(item);
}

function createDataCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ text: safeString(text), style: 'Normal' })],
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
