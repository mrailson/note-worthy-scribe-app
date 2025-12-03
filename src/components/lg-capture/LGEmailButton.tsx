import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { toast } from 'sonner';

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

function formatDobDisplay(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {}
  return dateStr;
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

      // Fetch PDF if available
      let pdfBase64: string | null = null;
      if (patient.pdf_url) {
        try {
          console.log('Fetching PDF from:', patient.pdf_url);
          // pdf_url is stored as full path like "lg/K83042/..." but bucket is 'lg'
          // so we need to strip the 'lg/' prefix
          const pdfPath = patient.pdf_url.startsWith('lg/') 
            ? patient.pdf_url.substring(3) 
            : patient.pdf_url;
          console.log('PDF path after stripping:', pdfPath);
          const { data: pdfFile, error: pdfError } = await supabase.storage
            .from('lg')
            .download(pdfPath);
          if (pdfError) {
            console.error('PDF download error:', pdfError);
          } else if (pdfFile) {
            pdfBase64 = await blobToBase64(pdfFile);
            console.log('PDF base64 length:', pdfBase64.length);
          }
        } catch (e) {
          console.error('Could not fetch PDF:', e);
        }
      }

      // Build email HTML content
      console.log('Building email HTML...');
      const emailHtml = buildEmailHtml(summaryData, snomedData);
      console.log('Email HTML length:', emailHtml.length);

      // Build attachments array (PDF only, no Word doc)
      const attachments: Array<{ filename: string; content: string; type: string }> = [];

      // Add PDF if available
      if (pdfBase64) {
        attachments.push({
          filename: `LG_Record_${nhsNumber.replace(/\s/g, '')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBase64,
          type: 'application/pdf',
        });
      }

      // Send via Resend edge function
      console.log('Invoking Resend edge function...');
      const { error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          to_email: userEmail,
          to_name: userName,
          subject: `Lloyd George Record Summary - ${patientName} (DOB: ${formatDobDisplay(dob)}) (NHS: ${nhsNumber})`,
          html_content: emailHtml,
          attachments: attachments.length > 0 ? attachments : undefined,
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
    const obj = item as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    if (obj.term) return String(obj.term);
    if (obj.description) return String(obj.description);
    if (obj.value) return String(obj.value);
    const entries = Object.entries(obj).filter(([_, v]) => v != null);
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
    }
  }
  return String(item);
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
