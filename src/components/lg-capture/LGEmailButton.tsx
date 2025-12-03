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
  diagnoses?: Array<{ condition: string; date_noted: string; status: string }>;
  surgeries?: Array<{ procedure: string; date: string; notes: string }>;
  allergies?: Array<{ allergen: string; reaction: string; year: string }>;
  immunisations?: Array<{ vaccine: string; date: string }>;
  family_history?: Array<{ relation: string; condition: string }>;
  social_history?: { smoking_status: string; stopped_year?: string; alcohol: string; occupation: string };
  hospital_findings?: Array<{ condition: string; date: string; outcome: string }>;
  medications?: Array<{ drug: string; dose: string; status: string }>;
  alerts?: Array<{ type: string; note: string }>;
  free_text_findings?: string;
  // Legacy fields
  significant_past_history?: unknown[];
  procedures?: unknown[];
  risk_factors?: unknown[];
}

function formatUKDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Unknown') return dateStr;
  // Format as DD-MMM-YYYY (e.g., 15-Mar-1952)
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
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
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #005EB8; border-bottom: 3px solid #005EB8; padding-bottom: 10px;">Lloyd George Record Summary</h1>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Patient Name</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">NHS Number</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${nhsNumber}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Date of Birth</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${formatDobDisplay(dob)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pages Scanned</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${patient.images_count || 0}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">SNOMED Items for Review</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${lowConfidenceCount} items with confidence &lt;60%</td>
          </tr>
        </table>
    `;

    // Clinical Summary
    if (summaryData.summary_line) {
      html += `<h2 style="color: #005EB8; margin-top: 30px;">Clinical Summary</h2>`;
      html += `<p style="background: #f0f4f5; padding: 15px; border-radius: 5px;">${summaryData.summary_line}</p>`;
    }

    // Diagnoses (new schema) or Significant Past History (legacy)
    const diagnoses = summaryData.diagnoses || [];
    if (diagnoses.length > 0) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Diagnoses</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
      for (const item of diagnoses) {
        html += `<li><strong>${item.condition || 'Unknown'}</strong> - ${item.date_noted || 'Unknown'} (${item.status || 'unknown'})</li>`;
      }
      html += `</ul>`;
    }

    // Major Surgeries (new schema)
    const surgeries = summaryData.surgeries || [];
    if (surgeries.length > 0) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Major Surgeries</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
      for (const surg of surgeries) {
        html += `<li><strong>${surg.procedure || 'Unknown'}</strong> - ${surg.date || 'Unknown'}${surg.notes ? ` (${surg.notes})` : ''}</li>`;
      }
      html += `</ul>`;
    }

    // Allergies
    const allergies = summaryData.allergies || [];
    if (allergies.length > 0) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Allergies</h3><ul style="background: #fff5f5; padding: 15px 30px; border-radius: 5px; border-left: 4px solid #DA291C;">`;
      for (const allergy of allergies) {
        html += `<li><strong>${allergy.allergen || 'Unknown'}</strong>: ${allergy.reaction || 'Unknown reaction'}${allergy.year ? ` (${allergy.year})` : ''}</li>`;
      }
      html += `</ul>`;
    }

    // Immunisations
    const immunisations = summaryData.immunisations || [];
    if (immunisations.length > 0) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Immunisations</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
      for (const imm of immunisations) {
        html += `<li><strong>${imm.vaccine || 'Unknown'}</strong> - ${imm.date || 'Unknown'}</li>`;
      }
      html += `</ul>`;
    }

    // Medications (NO status label)
    const medications = summaryData.medications || [];
    if (medications.length > 0) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Medications</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
      for (const med of medications) {
        html += `<li><strong>${med.drug || 'Unknown'}</strong> ${med.dose || ''}</li>`;
      }
      html += `</ul>`;
    }

    // Social History
    const social = summaryData.social_history;
    if (social && (social.smoking_status !== 'unknown' || social.alcohol !== 'unknown' || social.occupation)) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Social History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
      if (social.smoking_status && social.smoking_status !== 'unknown') {
        const smokingText = social.smoking_status === 'ex' 
          ? `Ex-smoker${social.stopped_year ? ` (stopped ${social.stopped_year})` : ''}`
          : social.smoking_status;
        html += `<li><strong>Smoking</strong>: ${smokingText}</li>`;
      }
      if (social.alcohol && social.alcohol !== 'unknown') {
        html += `<li><strong>Alcohol</strong>: ${social.alcohol}</li>`;
      }
      if (social.occupation) {
        html += `<li><strong>Occupation</strong>: ${social.occupation}</li>`;
      }
      html += `</ul>`;
    }

    // Family History
    const familyHistory = summaryData.family_history || [];
    if (familyHistory.length > 0) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Family History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
      for (const fh of familyHistory) {
        html += `<li><strong>${fh.relation || 'Unknown'}</strong>: ${fh.condition || 'Unknown'}</li>`;
      }
      html += `</ul>`;
    }

    // Additional Findings
    if (summaryData.free_text_findings) {
      html += `<h3 style="color: #005EB8; margin-top: 20px;">Additional Findings</h3>`;
      html += `<p style="background: #f0f4f5; padding: 15px; border-radius: 5px;">${summaryData.free_text_findings}</p>`;
    }

    // SNOMED CT Codes
    if (safeSnomedData.length > 0) {
      html += `<h2 style="color: #005EB8; margin-top: 30px;">SNOMED CT Codes (Problem Codes - ${safeSnomedData.length} identified)</h2>`;
      html += `<p style="color: #666; font-size: 12px; margin-bottom: 15px;">Codes suitable for import into GP systems. Review items with confidence &lt;60%.</p>`;
      
      // Group by domain
      const domains = [...new Set(safeSnomedData.map(s => s.domain))];
      
      for (const domain of domains) {
        const domainEntries = safeSnomedData.filter(s => s.domain === domain);
        html += `<h4 style="color: #003087; margin-top: 15px;">${domain.charAt(0).toUpperCase() + domain.slice(1)}</h4>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
          <tr style="background: #005EB8; color: white;">
            <th style="padding: 8px; text-align: left;">Term</th>
            <th style="padding: 8px; text-align: left;">SNOMED Code</th>
            <th style="padding: 8px; text-align: center;">Confidence</th>
          </tr>`;
        
        for (const entry of domainEntries) {
          const confPercent = Math.round((typeof entry.confidence === 'number' ? entry.confidence : 0) * 100);
          const confColor = confPercent >= 80 ? '#007F3B' : confPercent >= 60 ? '#ED8B00' : '#DA291C';
          html += `<tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px;">${safeString(entry.term)}</td>
            <td style="padding: 8px; font-family: monospace;">${safeString(entry.code)}</td>
            <td style="padding: 8px; text-align: center; color: ${confColor}; font-weight: bold;">${confPercent}%</td>
          </tr>`;
        }
        html += `</table>`;
      }
    }

    html += `
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          Full summarising report attached with PDF of scanned files.<br>
          Generated by LG Capture - Notewell AI<br>
          ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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
