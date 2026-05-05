import { supabase } from '@/integrations/supabase/client';
import { NRES_PRACTICES } from '@/data/nresPractices';

export type BuyBackEmailType =
  | 'claim_submitted'
  | 'submission_confirmation'
  | 'claim_verified'
  | 'verification_confirmation'
  | 'claim_approved'
  | 'approval_confirmation'
  | 'claim_rejected'
  | 'rejection_confirmation'
  | 'claim_queried';

export interface BuyBackEmailStaffLine {
  staff_name: string;
  staff_role: string;
  allocation_type: string;
  allocation_value: number;
  claimed_amount: number;
}

export interface BuyBackEmailData {
  claimId: string;
  practiceKey: string;
  claimMonth: string;
  totalAmount: number;
  staffLineCount: number;
  staffCategories?: string[];
  staffLines?: BuyBackEmailStaffLine[];
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

/**
 * Determine the claim type label based on staff categories.
 * Returns a specific label for single-category claims, or a generic fallback for mixed.
 */
function getClaimTypeLabel(categories?: string[]): string {
  if (!categories || categories.length === 0) return 'SDA Claim';
  const unique = [...new Set(categories)];
  if (unique.length === 1) {
    const cat = unique[0];
    if (cat === 'buyback' || cat === 'salaried') return 'Buy-Back Claim';
    if (cat === 'new_sda' || cat === 'additional' || cat === 'sda') return 'New SDA Claim';
    if (cat === 'management') return 'NRES Management Claim';
    if (cat === 'gp_locum') return 'GP Locum Claim';
    if (cat === 'meeting') return 'Meeting Attendance Claim';
  }
  return 'SDA Claim';
}

const EMAIL_TYPE_CONFIG: Record<BuyBackEmailType, { subjectAction: string; heading: (label: string) => string; colour: string }> = {
  claim_submitted: { subjectAction: 'New', heading: (l) => `New ${l} Awaiting Approval`, colour: '#2563eb' },
  submission_confirmation: { subjectAction: 'Submitted', heading: (l) => `Your ${l} Has Been Submitted`, colour: '#2563eb' },
  claim_verified: { subjectAction: 'Verified', heading: (l) => `Your ${l} Has Been Verified`, colour: '#d97706' },
  verification_confirmation: { subjectAction: 'Verification Recorded', heading: (l) => `${l} Verification Confirmation`, colour: '#d97706' },
  claim_approved: { subjectAction: 'Approved', heading: (l) => `Your ${l} Has Been Approved`, colour: '#16a34a' },
  approval_confirmation: { subjectAction: 'Approval Recorded', heading: (l) => `${l} Approval Confirmation`, colour: '#16a34a' },
  claim_rejected: { subjectAction: 'Declined', heading: (l) => `Your ${l} Has Been Declined`, colour: '#dc2626' },
  rejection_confirmation: { subjectAction: 'Rejection Recorded', heading: (l) => `${l} Rejection Confirmation`, colour: '#dc2626' },
  claim_queried: { subjectAction: 'Queried', heading: (l) => `Your ${l} Has Been Queried — Action Required`, colour: '#d97706' },
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

/** Lowercase a claim label while preserving acronyms NRES and SDA in uppercase. */
function lowercasePreserveAcronyms(label: string): string {
  return label.toLowerCase().replace(/\bnres\b/g, 'NRES').replace(/\bsda\b/g, 'SDA');
}

function buildEmailHtml(type: BuyBackEmailType, data: BuyBackEmailData): string {
  const cfg = EMAIL_TYPE_CONFIG[type];
  const claimLabel = getClaimTypeLabel(data.staffCategories);
  const claimLabelLower = lowercasePreserveAcronyms(claimLabel);
  const practiceName = NRES_PRACTICES[data.practiceKey] || data.practiceKey;
  const month = formatMonth(data.claimMonth);
  const amount = formatCurrency(data.totalAmount);
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Build staff breakdown table (reused across all email types)
  let staffBreakdown = '';
  if (data.staffLines && data.staffLines.length > 0) {
    const rows = data.staffLines.map((s, i) => {
      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      const allocLabel = s.allocation_type === 'sessions' ? 'sessions' : s.allocation_type === 'wte' ? 'WTE' : 'hours';
      return `
        <tr style="background:${bg};">
          <td style="padding:8px 12px;font-size:12px;color:#374151;border-top:1px solid #e5e7eb;">${s.staff_name}</td>
          <td style="padding:8px 12px;font-size:12px;color:#374151;border-top:1px solid #e5e7eb;">${s.staff_role}</td>
          <td style="padding:8px 12px;font-size:12px;color:#374151;border-top:1px solid #e5e7eb;text-align:center;">${s.allocation_value} ${allocLabel}</td>
          <td style="padding:8px 12px;font-size:12px;color:#374151;border-top:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(s.claimed_amount)}</td>
        </tr>`;
    }).join('');
    staffBreakdown = `
      <table width="100%" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;border-collapse:collapse;" cellpadding="0" cellspacing="0">
        <tr style="background:#1e40af;">
          <th style="padding:8px 12px;font-size:12px;color:#ffffff;text-align:left;font-weight:600;">Staff Member</th>
          <th style="padding:8px 12px;font-size:12px;color:#ffffff;text-align:left;font-weight:600;">Role</th>
          <th style="padding:8px 12px;font-size:12px;color:#ffffff;text-align:center;font-weight:600;">Allocation</th>
          <th style="padding:8px 12px;font-size:12px;color:#ffffff;text-align:right;font-weight:600;">Amount</th>
        </tr>
        ${rows}
        <tr style="background:#f0f4ff;">
          <td colspan="3" style="padding:8px 12px;font-size:12px;font-weight:700;color:#1e40af;border-top:2px solid #1e40af;">Total</td>
          <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#1e40af;border-top:2px solid #1e40af;text-align:right;">${formatCurrency(data.totalAmount)}</td>
        </tr>
      </table>`;
  }

  let bodyContent = '';

  switch (type) {
    case 'claim_submitted':
      bodyContent = `
        <p>A new ${claimLabelLower} has been submitted and requires your review.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
        ${staffBreakdown}
        <div style="margin:20px 0;text-align:center;">
          <a href="https://gpnotewell.co.uk" style="display:inline-block;padding:12px 28px;background:#1e40af;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Go to Notewell to Review</a>
        </div>
      `;
      break;
    case 'submission_confirmation':
      bodyContent = `
        <p>Your ${claimLabelLower} has been successfully submitted for approval.</p>
        <table width="100%" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;" cellpadding="0" cellspacing="0">
          <tr style="background:#f0f4ff;">
            <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e40af;" colspan="2">Submission Details</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:8px 16px;font-size:12px;font-weight:600;color:#374151;width:140px;">Practice</td>
            <td style="padding:8px 16px;font-size:12px;color:#374151;">${practiceName}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;font-size:12px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Submitted By</td>
            <td style="padding:8px 16px;font-size:12px;color:#374151;border-top:1px solid #e5e7eb;">${data.submitterName && data.submitterName !== data.submitterEmail ? `${data.submitterName} (${data.submitterEmail})` : data.submitterEmail || 'Unknown'}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:8px 16px;font-size:12px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Date &amp; Time</td>
            <td style="padding:8px 16px;font-size:12px;color:#374151;border-top:1px solid #e5e7eb;">${now}</td>
          </tr>
        </table>
        ${staffBreakdown}
        <div style="margin:20px 0;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534;">What happens next?</p>
          <ol style="margin:0;padding-left:20px;font-size:12px;color:#374151;line-height:1.8;">
            <li>Your submission will be <strong>verified and confirmed</strong> by the NRES Neighbourhood team.</li>
            <li>You will receive an email notification when this is complete (within <strong>3 working days</strong>).</li>
            <li>Once verified, the claim will be passed to <strong>PML Finance</strong> for formal approval and payment.</li>
          </ol>
        </div>
      `;
      break;
    case 'claim_verified':
      bodyContent = `
        <p>Your ${claimLabelLower} has been verified by the NRES Neighbourhood team.</p>
        ${data.reviewerName ? `<p><strong>Verified by:</strong> ${data.reviewerName}</p>` : ''}
        ${data.reviewNotes ? `<p><strong>Notes:</strong> ${data.reviewNotes}</p>` : ''}
        ${staffBreakdown}
        <div style="margin:20px 0;padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e;">What happens next?</p>
          <p style="margin:0;font-size:12px;color:#374151;line-height:1.8;">Now that your claim has been verified, we believe it is in order and it has been passed to PML for final approval. You will be notified when that has happened. Assuming it is approved as expected, the system will automatically create the invoice on your behalf and send you a copy for your records.</p>
          <p style="margin:8px 0 0;font-size:12px;color:#374151;line-height:1.8;">If you have any questions, please let your NRES management team know.</p>
        </div>
      `;
      break;
    case 'verification_confirmation':
      bodyContent = `
        <p>This confirms that you have verified the following ${claimLabelLower}. It has been forwarded to PML for final approval.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
        ${staffBreakdown}
        <div style="margin:20px 0;text-align:center;">
          <a href="https://gpnotewell.co.uk" style="display:inline-block;padding:12px 28px;background:#d97706;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Go to Notewell</a>
        </div>
      `;
      break;
    case 'claim_approved':
      bodyContent = `
        <p>Your ${claimLabelLower} has been approved.</p>
        ${data.reviewerName ? `<p><strong>Approved by:</strong> ${data.reviewerName}</p>` : ''}
        ${data.reviewNotes ? `<p><strong>Notes:</strong> ${data.reviewNotes}</p>` : ''}
        ${staffBreakdown}
      `;
      break;
    case 'approval_confirmation':
      bodyContent = `
        <p>This confirms that you have approved the following ${claimLabelLower}.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
        ${staffBreakdown}
        <div style="margin:20px 0;text-align:center;">
          <a href="https://gpnotewell.co.uk" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Go to Notewell</a>
        </div>
      `;
      break;
    case 'claim_rejected':
      bodyContent = `
        <p>Your ${claimLabelLower} has been declined.</p>
        ${data.reviewerName ? `<p><strong>Reviewed by:</strong> ${data.reviewerName}</p>` : ''}
        ${data.reviewNotes ? `<p><strong>Reason:</strong> ${data.reviewNotes}</p>` : ''}
        ${staffBreakdown}
        <p>Please review the feedback and resubmit if appropriate.</p>
      `;
      break;
    case 'rejection_confirmation':
      bodyContent = `
        <p>This confirms that you have declined the following ${claimLabelLower}.</p>
        <p><strong>Submitted by:</strong> ${data.submitterName || data.submitterEmail}</p>
        ${data.reviewNotes ? `<p><strong>Your notes:</strong> ${data.reviewNotes}</p>` : ''}
        ${staffBreakdown}
        <div style="margin:20px 0;text-align:center;">
          <a href="https://gpnotewell.co.uk" style="display:inline-block;padding:12px 28px;background:#dc2626;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">Go to Notewell</a>
        </div>
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
                <p style="margin:4px 0 0;color:#ffffff;font-size:13px;font-weight:600;">Notewell SDA Claims Portal</p>
              </td>
            </tr>
            <!-- Status bar -->
            <tr>
              <td style="background:${cfg.colour};padding:12px 32px;">
                <h2 style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${cfg.heading(claimLabel)}</h2>
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
  const claimLabel = getClaimTypeLabel(data.staffCategories);
  const practiceName = NRES_PRACTICES[data.practiceKey] || data.practiceKey;
  const month = formatMonth(data.claimMonth);
  return `${cfg.subjectAction} ${claimLabel} — ${practiceName} — ${month}`;
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
  sendingDisabled?: boolean,
): Promise<void> {
  if (sendingDisabled) {
    console.log(`[Email suppressed] ${type} — sending disabled for high-volume testing`);
    return;
  }
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
    case 'claim_verified': {
      // Notify the submitter AND the SNO/PML approver(s) who need to act next
      const approvers = await getApproverEmails(data.practiceKey);
      const set = new Set<string>();
      if (data.submitterEmail) set.add(data.submitterEmail.toLowerCase());
      approvers.forEach(e => e && set.add(e.toLowerCase()));
      recipients = Array.from(set);
      break;
    }
    case 'verification_confirmation':
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
