import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://gpnotewell.co.uk";

interface EmailRequest {
  type: "request" | "reminder" | "confirmation" | "completed" | "declined" | "send_completed";
  document_id: string;
  signatory_id?: string;
  custom_body?: string;
  signed_file_url?: string;
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const daysBetween = (a: string, b: string): number => {
  const msPerDay = 86400000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
};

const emailWrapper = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Notewell AI</h1>
  </div>
  <div style="padding: 30px; background: #ffffff;">
    ${content}
  </div>
  <div style="padding: 20px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
      Powered by Notewell AI &middot; This is an automated message<br>
      Document Approval Service
    </p>
  </div>
</body>
</html>`;

const primaryButton = (href: string, label: string): string =>
  `<div style="text-align: center; margin: 28px 0;">
    <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">${label}</a>
  </div>`;

const infoRow = (label: string, value: string): string =>
  `<tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 14px; white-space: nowrap;">${label}</td><td style="padding: 6px 0; font-size: 14px; font-weight: 500;">${value}</td></tr>`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { type, document_id, signatory_id, custom_body, signed_file_url }: EmailRequest = await req.json();

    if (!type || !document_id) {
      return new Response(JSON.stringify({ error: "type and document_id are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("approval_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch all signatories for this document
    const { data: allSignatories } = await supabase
      .from("approval_signatories")
      .select("*")
      .eq("document_id", document_id)
      .order("sort_order", { ascending: true });

    // Download the PDF attachment for request/reminder emails
    let pdfAttachment: { filename: string; content: Uint8Array } | null = null;
    if (type === "request" || type === "reminder") {
      try {
        const { data: fileData, error: fileErr } = await supabase.storage
          .from("approval-documents")
          .download(doc.file_url.replace(/^.*approval-documents\//, ""));

        if (!fileErr && fileData) {
          const arrayBuf = await fileData.arrayBuffer();
          const originalName = doc.original_filename || "document.pdf";
          // Ensure filename always ends in .pdf (docx files are converted before upload)
          const pdfFilename = originalName.replace(/\.docx?$/i, '.pdf');
          pdfAttachment = {
            filename: pdfFilename,
            content: new Uint8Array(arrayBuf),
          };
        }
      } catch (e) {
        console.warn("Could not download attachment:", e);
      }
    }

    const results: Array<{ email: string; status: string; error?: string }> = [];

    // ─── TYPE: REQUEST ───────────────────────────────────────────────
    if (type === "request") {
      const targets = signatory_id
        ? (allSignatories || []).filter((s) => s.id === signatory_id)
        : (allSignatories || []).filter((s) => s.status === "pending");

      for (const sig of targets) {
        let html: string;

        if (custom_body) {
          // User-customised email body — replace [Signatory Name] placeholder, convert newlines to <br>
          const personalised = custom_body
            .replace(/\[Signatory Name\]/gi, sig.name)
            .replace(/\n/g, "<br>");

          html = emailWrapper(`
            <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #1a1a2e;">Document Approval Requested</h2>
            <div style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">${personalised}</div>
            <p style="margin: 16px 0 0 0; font-size: 14px; color: #475569;">The document is attached to this email for your review.</p>
            ${primaryButton(`${APP_URL}/approve/${sig.approval_token}`, "✅ Review &amp; Approve")}
            <p style="text-align: center; font-size: 13px; color: #94a3b8;">Or copy this link: ${APP_URL}/approve/${sig.approval_token}</p>
          `);
        } else {
          // Default email template
          const deadlineInfo = doc.deadline
            ? `<p style="margin: 4px 0; font-size: 14px;">⏰ <strong>Deadline:</strong> ${formatDate(doc.deadline)}</p>`
            : "";

          const messageBlock = doc.message
            ? `<div style="background: #f1f5f9; border-left: 4px solid #0EA5E9; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #475569;">"${doc.message}"</p>
              </div>`
            : "";

          html = emailWrapper(`
            <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #1a1a2e;">Document Approval Requested</h2>
            <p style="margin: 0 0 8px 0;">Dear ${sig.name},</p>
            <p style="margin: 0 0 16px 0;">${doc.sender_name || "A colleague"} has sent you a document for approval.</p>
            ${messageBlock}
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              ${infoRow("📄 Document", doc.title)}
              ${doc.category ? infoRow("📁 Category", doc.category) : ""}
              ${infoRow("👤 From", doc.sender_name || doc.sender_email || "Unknown")}
              ${infoRow("📅 Sent", formatDate(doc.created_at!))}
            </table>
            ${deadlineInfo}
            <p style="margin: 16px 0 0 0; font-size: 14px; color: #475569;">The document is attached to this email for your review.</p>
            ${primaryButton(`${APP_URL}/approve/${sig.approval_token}`, "✅ Review &amp; Approve")}
            <p style="text-align: center; font-size: 13px; color: #94a3b8;">Or copy this link: ${APP_URL}/approve/${sig.approval_token}</p>
          `);
        }

        const emailPayload: any = {
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [sig.email],
          subject: `Document Approval Requested: ${doc.title}`,
          html,
        };

        if (pdfAttachment) {
          emailPayload.attachments = [{
            filename: pdfAttachment.filename,
            content: pdfAttachment.content,
          }];
        }

        const { error: sendErr } = await resend.emails.send(emailPayload);
        results.push({ email: sig.email, status: sendErr ? "failed" : "sent", error: sendErr?.message });

        if (!sendErr) {
          // Log to audit
          await supabase.from("approval_audit_log").insert({
            document_id,
            signatory_id: sig.id,
            action: "email_sent_request",
            actor_email: doc.sender_email,
            actor_name: doc.sender_name,
          });
        }
      }
    }

    // ─── TYPE: REMINDER ──────────────────────────────────────────────
    if (type === "reminder") {
      const targets = signatory_id
        ? (allSignatories || []).filter((s) => s.id === signatory_id)
        : (allSignatories || []).filter((s) => s.status === "pending" || s.status === "viewed");

      for (const sig of targets) {
        const now = new Date().toISOString();
        let deadlineNote = "";
        if (doc.deadline) {
          const daysLeft = daysBetween(now, doc.deadline);
          deadlineNote = daysLeft > 0
            ? `<p style="margin: 8px 0; padding: 8px 12px; background: #fef3c7; border-radius: 6px; font-size: 14px;">⏰ ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining until the deadline (${formatDate(doc.deadline)})</p>`
            : `<p style="margin: 8px 0; padding: 8px 12px; background: #fee2e2; border-radius: 6px; font-size: 14px;">🚨 This document is ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} overdue (deadline was ${formatDate(doc.deadline)})</p>`;
        }

        const html = emailWrapper(`
          <div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-weight: 600; color: #92400e;">⏳ Reminder: Your approval is still required</p>
          </div>
          <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #1a1a2e;">Approval Still Required</h2>
          <p style="margin: 0 0 8px 0;">Dear ${sig.name},</p>
          <p style="margin: 0 0 16px 0;">This is a reminder that your approval is still needed for the following document:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            ${infoRow("📄 Document", doc.title)}
            ${infoRow("👤 From", doc.sender_name || doc.sender_email || "Unknown")}
            ${infoRow("📅 Originally sent", formatDate(doc.created_at!))}
          </table>
          ${deadlineNote}
          <p style="margin: 16px 0 0 0; font-size: 14px; color: #475569;">The document is re-attached for your convenience.</p>
          ${primaryButton(`${APP_URL}/approve/${sig.approval_token}`, "✅ Review &amp; Approve Now")}
        `);

        const emailPayload: any = {
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [sig.email],
          subject: `Reminder: Approval Still Required — ${doc.title}`,
          html,
        };

        if (pdfAttachment) {
          emailPayload.attachments = [{
            filename: pdfAttachment.filename,
            content: pdfAttachment.content,
          }];
        }

        const { error: sendErr } = await resend.emails.send(emailPayload);
        results.push({ email: sig.email, status: sendErr ? "failed" : "sent", error: sendErr?.message });

        if (!sendErr) {
          // Update reminder count
          await supabase
            .from("approval_signatories")
            .update({
              reminder_count: (sig.reminder_count || 0) + 1,
              last_reminder_at: now,
            })
            .eq("id", sig.id);

          await supabase.from("approval_audit_log").insert({
            document_id,
            signatory_id: sig.id,
            action: "email_sent_reminder",
            actor_email: doc.sender_email,
            actor_name: doc.sender_name,
            metadata: { reminder_number: (sig.reminder_count || 0) + 1 },
          });
        }
      }
    }

    // ─── TYPE: CONFIRMATION ──────────────────────────────────────────
    if (type === "confirmation" && signatory_id) {
      const sig = (allSignatories || []).find((s) => s.id === signatory_id);
      if (sig) {
        const html = emailWrapper(`
          <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #1a1a2e;">Approval Confirmed ✅</h2>
          <p style="margin: 0 0 8px 0;">Dear ${sig.signed_name || sig.name},</p>
          <p style="margin: 0 0 16px 0;">Thank you. Your approval has been successfully recorded.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f0fdf4; padding: 16px; border-radius: 8px;">
            ${infoRow("📄 Document", doc.title)}
            ${infoRow("✍️ Signed as", sig.signed_name || sig.name)}
            ${sig.signed_role ? infoRow("💼 Role", sig.signed_role) : ""}
            ${sig.signed_organisation ? infoRow("🏢 Organisation", sig.signed_organisation) : ""}
            ${infoRow("🕐 Approved at", sig.signed_at ? formatDate(sig.signed_at) : "Just now")}
          </table>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534;">🔒 Your electronic signature has been recorded in accordance with UK law (Electronic Communications Act 2000).</p>
          </div>
          <p style="margin: 16px 0 0 0; font-size: 14px; color: #64748b;">No further action is needed. You may close this email.</p>
        `);

        const { error: sendErr } = await resend.emails.send({
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [sig.email],
          subject: `Approval Confirmed: ${doc.title}`,
          html,
        });

        results.push({ email: sig.email, status: sendErr ? "failed" : "sent", error: sendErr?.message });

        if (!sendErr) {
          await supabase.from("approval_audit_log").insert({
            document_id,
            signatory_id: sig.id,
            action: "email_sent_confirmation",
          });
        }
      }
    }

    // ─── TYPE: COMPLETED ─────────────────────────────────────────────
    if (type === "completed") {
      const sigSummaryRows = (allSignatories || [])
        .map((s) => `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">✅ ${s.signed_name || s.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.signed_role || s.role || "—"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.signed_at ? formatDate(s.signed_at) : "—"}</td>
        </tr>`)
        .join("");

      const html = emailWrapper(`
        <div style="background: #f0fdf4; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
          <p style="margin: 0; font-weight: 600; color: #166534; font-size: 18px;">🎉 All Approvals Received</p>
        </div>
        <p style="margin: 0 0 16px 0;">All ${(allSignatories || []).length} signatories have approved <strong>${doc.title}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Name</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Role</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Signed</th>
            </tr>
          </thead>
          <tbody>${sigSummaryRows}</tbody>
        </table>
        ${primaryButton(`${APP_URL}/document-approval`, "View in Notewell")}
        <p style="text-align: center; font-size: 13px; color: #94a3b8;">You can access the full audit trail in Notewell.</p>
      `);

      const senderEmail = doc.sender_email;
      if (senderEmail) {
        const { error: sendErr } = await resend.emails.send({
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [senderEmail],
          subject: `All Approvals Received: ${doc.title}`,
          html,
        });

        results.push({ email: senderEmail, status: sendErr ? "failed" : "sent", error: sendErr?.message });

        if (!sendErr) {
          await supabase.from("approval_audit_log").insert({
            document_id,
            action: "email_sent_completed",
            actor_email: senderEmail,
          });
        }
      }
    }

    // ─── TYPE: SEND_COMPLETED ────────────────────────────────────────
    if (type === "send_completed") {

      // Download the signed PDF from storage
      let signedPdfAttachment: { filename: string; content: string } | null = null;
      const fileUrlToDownload = signed_file_url || doc.signed_file_url;
      console.log("send_completed: fileUrlToDownload =", fileUrlToDownload);

      if (fileUrlToDownload) {
        try {
          const storagePath = fileUrlToDownload.replace(/^.*approval-documents\//, "");
          console.log("send_completed: downloading storagePath =", storagePath);
          const { data: fileData, error: fileErr } = await supabase.storage
            .from("approval-documents")
            .download(storagePath);

          if (fileErr) {
            console.error("send_completed: storage download error:", fileErr);
          }

          if (!fileErr && fileData) {
            const arrayBuf = await fileData.arrayBuffer();
            // Convert to base64 string for Resend attachment
            const bytes = new Uint8Array(arrayBuf);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Content = btoa(binary);
            console.log("send_completed: attachment size =", bytes.length, "bytes, base64 length =", base64Content.length);
            signedPdfAttachment = {
              filename: `${(doc.title || "document").replace(/[^a-zA-Z0-9-_ ]/g, "")}-signed.pdf`,
              content: base64Content,
            };
          }
        } catch (e) {
          console.error("send_completed: Could not download signed PDF attachment:", e);
        }
      } else {
        console.warn("send_completed: No signed_file_url available");
      }

      const sigSummaryRows = (allSignatories || [])
        .map((s: any) => `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">✅ ${s.signed_name || s.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.signed_role || s.role || "—"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.signed_organisation || s.organisation || "—"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.signed_at ? formatDate(s.signed_at) : "—"}</td>
        </tr>`)
        .join("");

      const html = emailWrapper(`
        <div style="background: #f0fdf4; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
          <p style="margin: 0; font-weight: 600; color: #166534; font-size: 18px;">📄 Completed Signed Document</p>
        </div>
        <p style="margin: 0 0 16px 0;">The fully signed version of <strong>${doc.title}</strong> is attached to this email.</p>
        <p style="margin: 0 0 16px 0;">All ${(allSignatories || []).length} signator${(allSignatories || []).length !== 1 ? "ies" : "y"} have approved this document. The attached PDF includes the Electronic Signature Certificate with full audit trail.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Name</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Role</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Organisation</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Signed</th>
            </tr>
          </thead>
          <tbody>${sigSummaryRows}</tbody>
        </table>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px; color: #166534;">🔒 This document was electronically signed in accordance with UK law (Electronic Communications Act 2000). The attached PDF contains a SHA-256 integrity hash and full audit trail.</p>
        </div>
        <p style="text-align: center; font-size: 13px; color: #94a3b8; margin-top: 20px;">Powered by Notewell AI &middot; Document Approval Service</p>
      `);

      // Send to sender
      const allRecipients: string[] = [];
      if (doc.sender_email) allRecipients.push(doc.sender_email);
      // Also send to all signatories
      for (const s of (allSignatories || [])) {
        if (s.email && !allRecipients.includes(s.email)) {
          allRecipients.push(s.email);
        }
      }

      for (const recipientEmail of allRecipients) {
        const emailPayload: any = {
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [recipientEmail],
          subject: `Completed Signed Document: ${doc.title}`,
          html,
        };

        if (signedPdfAttachment) {
          emailPayload.attachments = [{
            filename: signedPdfAttachment.filename,
            content: signedPdfAttachment.content,
          }];
        }

        const { error: sendErr } = await resend.emails.send(emailPayload);
        results.push({ email: recipientEmail, status: sendErr ? "failed" : "sent", error: sendErr?.message });
      }

      // Audit log
      await supabase.from("approval_audit_log").insert({
        document_id,
        action: "email_sent_completed_document",
        actor_email: doc.sender_email,
        actor_name: doc.sender_name,
        metadata: { recipients: allRecipients, attachment_included: !!signedPdfAttachment },
      });
    }

    // ─── TYPE: DECLINED ──────────────────────────────────────────────
    if (type === "declined" && signatory_id) {
      const sig = (allSignatories || []).find((s) => s.id === signatory_id);
      if (sig && doc.sender_email) {
        const declineComment = sig.decline_comment
          ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #991b1b; font-size: 13px;">Reason given:</p>
              <p style="margin: 0; font-size: 14px; color: #7f1d1d;">"${sig.decline_comment}"</p>
            </div>`
          : `<p style="color: #64748b; font-size: 14px;">No reason was provided.</p>`;

        const html = emailWrapper(`
          <div style="background: #fef2f2; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-weight: 600; color: #991b1b;">❌ Approval Declined</p>
          </div>
          <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #1a1a2e;">${sig.name} has declined</h2>
          <p style="margin: 0 0 16px 0;"><strong>${sig.name}</strong> has declined to approve <strong>${doc.title}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            ${infoRow("👤 Signatory", sig.name)}
            ${sig.role ? infoRow("💼 Role", sig.role) : ""}
            ${sig.organisation ? infoRow("🏢 Organisation", sig.organisation) : ""}
          </table>
          ${declineComment}
          ${primaryButton(`${APP_URL}/document-approval`, "View Details in Notewell")}
        `);

        const { error: sendErr } = await resend.emails.send({
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [doc.sender_email],
          subject: `Approval Declined: ${doc.title}`,
          html,
        });

        results.push({ email: doc.sender_email, status: sendErr ? "failed" : "sent", error: sendErr?.message });

        if (!sendErr) {
          await supabase.from("approval_audit_log").insert({
            document_id,
            signatory_id: sig.id,
            action: "email_sent_declined",
            actor_email: sig.email,
            actor_name: sig.name,
          });
        }
      }
    }

    console.log(`✅ send-approval-email [${type}] completed:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("❌ Error in send-approval-email:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
