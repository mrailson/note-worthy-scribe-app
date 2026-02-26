import { supabase } from '@/integrations/supabase/client';
import { NRES_PRACTICES } from '@/data/nresPractices';

export type BuyBackEmailType =
  | 'claim_submitted'
  | 'submission_confirmation'
  | 'claim_approved'
  | 'approval_confirmation'
  | 'claim_rejected'
  | 'rejection_confirmation';

export interface BuyBackEmailData {
  claimId: string;
  practiceKey: string;
  claimMonth: string;
  totalAmount: number;
  staffLineCount: number;
  submitterEmail: string;
  submitterName?: string;
  reviewerEmail?: string;
  reviewerName?: string;
  reviewNotes?: string;
}

interface SendEmailPayload {
  to_email: string;
  subject: string;
  html_content: string;
  from_name?: string;
  from_email?: string;
}

const EMAIL_TYPE_CONFIG: Record<BuyBackEmailType, { subjectPrefix: string; heading: string; colour: string }> = {
  claim_submitted: { subjectPrefix: 'New Buy-Back Claim', heading: 'New Claim Awaiting Approval', colour: '#2563eb' },
  submission_confirmation: { subjectPrefix: 'Claim Submitted', heading: 'Your Claim Has Been Submitted', colour: '#2563eb' },
  claim_approved: { subjectPrefix: 'Claim Approved', heading: 'Your Claim Has Been Approved', colour: '#16a34a' },
  approval_confirmation: { subjectPrefix: 'Approval Recorded', heading: 'Approval Confirmation', colour: '#16a34a' },
  claim_rejected: { subjectPrefix: 'Claim Declined', heading: 'Your Claim Has Been Declined', colour: '#dc2626' },
  rejection_confirmation: { subjectPrefix: 'Rejection Recorded', heading: 'Rejection Confirmation', colour: '#dc2626' },
};

function formatMonth(claimMonth: string): string {
  // claimMonth is "YYYY-MM" — parse manually to avoid UTC/timezone issues
  const [yearStr, monthStr] = claimMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return claimMonth;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildEmailHtml(type: BuyBackEmailType, data: BuyBackEmailData): string {
  const cfg = EMAIL_TYPE_CONFIG[type];
  const practiceName = NRES_PRACTICES[data.practiceKey] || data.practiceKey;
  const month = formatMonth(data.claimMonth);
  const amount = formatCurrency(data.totalAmount);
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  let bodyContent = '';

  switch (type) {
    case 'claim_submitted':
      bodyContent = `
        <p>A new buy-back claim has been submitted and requires your review.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
      `;
      break;
    case 'submission_confirmation':
      bodyContent = `
        <p>Your buy-back claim has been successfully submitted for approval.</p>
        <p>You will receive an email notification once the claim has been reviewed.</p>
      `;
      break;
    case 'claim_approved':
      bodyContent = `
        <p>Your buy-back claim has been approved.</p>
        ${data.reviewerName ? `<p><strong>Approved by:</strong> ${data.reviewerName}</p>` : ''}
        ${data.reviewNotes ? `<p><strong>Notes:</strong> ${data.reviewNotes}</p>` : ''}
      `;
      break;
    case 'approval_confirmation':
      bodyContent = `
        <p>This confirms that you have approved the following buy-back claim.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
      `;
      break;
    case 'claim_rejected':
      bodyContent = `
        <p>Your buy-back claim has been declined.</p>
        ${data.reviewerName ? `<p><strong>Reviewed by:</strong> ${data.reviewerName}</p>` : ''}
        ${data.reviewNotes ? `<p><strong>Reason:</strong> ${data.reviewNotes}</p>` : ''}
        <p>Please review the feedback and resubmit if appropriate.</p>
      `;
      break;
    case 'rejection_confirmation':
      bodyContent = `
        <p>This confirms that you have declined the following buy-back claim.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
        ${data.reviewNotes ? `<p><strong>Your notes:</strong> ${data.reviewNotes}</p>` : ''}
      `;
      break;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Notewell AI</h1>
                <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">Buy-Back Claims Management</p>
              </td>
            </tr>
            <!-- Status bar -->
            <tr>
              <td style="background:${cfg.colour};padding:12px 32px;">
                <h2 style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${cfg.heading}</h2>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:24px 32px;color:#1f2937;font-size:14px;line-height:1.6;">
                ${bodyContent}
                <!-- Claim summary -->
                <table width="100%" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;" cellpadding="0" cellspacing="0">
                  <tr style="background:#f9fafb;">
                    <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;">Practice</td>
                    <td style="padding:10px 16px;font-size:13px;color:#374151;">${practiceName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Period</td>
                    <td style="padding:10px 16px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">${month}</td>
                  </tr>
                  <tr style="background:#f9fafb;">
                    <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Total Amount</td>
                    <td style="padding:10px 16px;font-size:13px;font-weight:700;color:${cfg.colour};border-top:1px solid #e5e7eb;">${amount}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Staff Lines</td>
                    <td style="padding:10px 16px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">${data.staffLineCount}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
                <p style="margin:0;">This is an automated notification from Notewell AI. Sent ${now}.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function buildSubject(type: BuyBackEmailType, data: BuyBackEmailData): string {
  const cfg = EMAIL_TYPE_CONFIG[type];
  const practiceName = NRES_PRACTICES[data.practiceKey] || data.practiceKey;
  const month = formatMonth(data.claimMonth);
  return `${cfg.subjectPrefix} — ${practiceName} — ${month}`;
}

/**
 * Resolve approver emails for a given practice.
 */
async function getApproverEmails(practiceKey: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('nres_buyback_access')
    .select('user_id')
    .eq('practice_key', practiceKey)
    .eq('access_role', 'approver');

  if (error || !data?.length) return [];

  const userIds = data.map((row: any) => row.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .in('user_id', userIds);

  if (profileError || !profiles) return [];
  return profiles.map((p: any) => p.email).filter(Boolean);
}

/**
 * Send a single email via the send-email-resend edge function.
 */
async function sendEmail(payload: SendEmailPayload): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email-resend', {
      body: payload,
    });
    if (error) {
      console.error('Email send error:', error);
      return false;
    }
    return data?.success === true;
  } catch (err) {
    console.error('Email send exception:', err);
    return false;
  }
}

/**
 * Main dispatch function. Sends the appropriate email(s) for a given event.
 * If testingMode is true, all emails are redirected to overrideEmail.
 */
export async function sendBuyBackEmail(
  type: BuyBackEmailType,
  data: BuyBackEmailData,
  testingMode: boolean,
  overrideEmail?: string,
): Promise<void> {
  const subject = buildSubject(type, data);
  const html = buildEmailHtml(type, data);

  let recipients: string[] = [];

  switch (type) {
    case 'claim_submitted':
      recipients = await getApproverEmails(data.practiceKey);
      break;
    case 'submission_confirmation':
    case 'claim_approved':
    case 'claim_rejected':
      recipients = [data.submitterEmail];
      break;
    case 'approval_confirmation':
    case 'rejection_confirmation':
      recipients = data.reviewerEmail ? [data.reviewerEmail] : [];
      break;
  }

  if (testingMode && overrideEmail) {
    recipients = recipients.length > 0 ? [overrideEmail] : [];
  }

  // Send to each recipient
  await Promise.all(
    recipients.filter(Boolean).map(email =>
      sendEmail({
        to_email: email,
        subject,
        html_content: html,
        from_name: 'Notewell AI',
        from_email: 'noreply@bluepcn.co.uk',
      })
    )
  );
}
