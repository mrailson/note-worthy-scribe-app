import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://gpnotewell.co.uk";
const FONT_STACK = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

interface EmailRequest {
  type: "request" | "reminder" | "confirmation" | "completed" | "declined" | "send_completed" | "multi_request" | "multi_send_completed";
  document_id?: string;
  group_id?: string;
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

/** Prepend "Dr" to a name if the title field is "Dr" (case-insensitive). */
const withTitle = (name: string, title?: string | null): string => {
  if (!title) return name;
  if (title.trim().toUpperCase() === "DR") {
    // Avoid doubling if name already starts with "Dr "
    if (/^Dr\s/i.test(name)) return `Dr ${name.replace(/^Dr\s+/i, "")}`;
    return `Dr ${name}`;
  }
  return name;
};

// ─── TABLE-BASED EMAIL HELPERS (all inline CSS, Outlook-safe) ────────

const emailWrapper = (content: string): string => `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: ${FONT_STACK}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Outer wrapper table -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 24px 0;">
        <!-- Inner 600px container -->
        <!--[if (gte mso 9)|(IE)]><table cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td><![endif]-->
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-collapse: collapse;">
          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background-color: #005EB8; padding: 20px 30px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.2;">Notewell AI</td>
                      </tr>
                      <tr>
                        <td style="font-family: ${FONT_STACK}; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1.5px; padding-top: 2px;">DOCUMENT APPROVAL SERVICE</td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block;">
                      <tr>
                        <td style="background-color: rgba(255,255,255,0.2); border-radius: 20px; padding: 5px 14px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; color: #ffffff;">&#128274; Secure</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- ═══ ACCENT STRIPE ═══ -->
          <tr>
            <td style="height: 4px; font-size: 0; line-height: 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td width="50%" style="height: 4px; background-color: #005EB8; font-size: 0; line-height: 0;">&nbsp;</td>
                <td width="50%" style="height: 4px; background-color: #41B6E6; font-size: 0; line-height: 0;">&nbsp;</td>
              </tr></table>
            </td>
          </tr>
          <!-- ═══ BODY ═══ -->
          <tr>
            <td style="padding: 32px 30px;">
              ${content}
            </td>
          </tr>
          <!-- ═══ DIVIDER ═══ -->
          <tr>
            <td style="padding: 0 30px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top: 1px solid #e2e8f0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f8fafc; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; color: #94a3b8; padding-bottom: 4px;">Powered by Notewell AI</td>
                </tr>
                <tr>
                  <td align="center" style="font-family: ${FONT_STACK}; font-size: 11px; color: #cbd5e1; line-height: 1.5;">This is an automated message &middot; Document Approval Service</td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 6px;">
                    <a href="https://gpnotewell.co.uk" style="font-family: ${FONT_STACK}; font-size: 11px; color: #005EB8; text-decoration: none;">gpnotewell.co.uk</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

const primaryButton = (href: string, label: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0 8px 0;">
    <tr>
      <td align="center">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:400px;" arcsize="12%" strokecolor="#007f3b" fillcolor="#007f3b">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:bold;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <table cellpadding="0" cellspacing="0" border="0" style="max-width: 400px; width: 100%;">
          <tr>
            <td align="center" style="background-color: #007f3b; border-radius: 6px; padding: 16px 24px;">
              <a href="${href}" style="display: block; font-family: ${FONT_STACK}; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; line-height: 1.2;">${label}</a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;

const fallbackLink = (href: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 20px 0;">
    <tr>
      <td align="center" style="font-family: ${FONT_STACK}; font-size: 12px; color: #94a3b8;">
        Or copy this link: <a href="${href}" style="color: #005EB8; text-decoration: underline; word-break: break-all;">${href}</a>
      </td>
    </tr>
  </table>`;

const detailsCard = (rows: string, headerLabel?: string): string =>
  `<table cellpadding="0" cellspacing="0" border="1" bordercolor="#e2e8f0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
    ${headerLabel ? `<tr>
      <td colspan="2" style="background-color: #edf2f7; padding: 10px 16px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0;">${headerLabel}</td>
    </tr>` : ""}
    ${rows}
  </table>`;

const detailRow = (label: string, value: string, isLast = false): string =>
  `<tr>
    <td width="110" style="padding: 10px 16px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: top; background-color: #f8fafc;${isLast ? "" : " border-bottom: 1px solid #e2e8f0;"}">${label}</td>
    <td style="padding: 10px 16px; font-family: ${FONT_STACK}; font-size: 14px; font-weight: 500; color: #2d3748; background-color: #f8fafc;${isLast ? "" : " border-bottom: 1px solid #e2e8f0;"}">${value}</td>
  </tr>`;

const categoryBadge = (cat: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0" style="display: inline-block;"><tr><td style="background-color: #edf2f7; border-radius: 12px; padding: 3px 12px; font-family: ${FONT_STACK}; font-size: 12px; font-weight: 600; color: #4a5568;">${cat}</td></tr></table>`;

const infoNote = (text: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;">
    <tr><td align="center" style="font-family: ${FONT_STACK}; font-size: 13px; color: #a0aec0;">${text}</td></tr>
  </table>`;

const alertBanner = (bgColor: string, textColor: string, text: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
    <tr><td style="background-color: ${bgColor}; padding: 12px 16px; border-radius: 8px; font-family: ${FONT_STACK}; font-size: 14px; font-weight: 600; color: ${textColor};">${text}</td></tr>
  </table>`;

const legalNotice = (bgColor: string, borderColor: string, textColor: string, text: string): string =>
  `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
    <tr><td style="background-color: ${bgColor}; border: 1px solid ${borderColor}; padding: 12px 16px; border-radius: 8px; font-family: ${FONT_STACK}; font-size: 14px; color: ${textColor};">${text}</td></tr>
  </table>`;

const signatoryTable = (headCols: string[], rows: string): string => {
  const ths = headCols.map(c => `<th style="padding: 10px 12px; text-align: left; font-family: ${FONT_STACK}; font-weight: 600; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${c}</th>`).join("");
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
    <tr style="background-color: #005EB8;">${ths}</tr>
    ${rows}
  </table>`;
};

// ─── HANDLER ─────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  console.log("send-approval-email v3 - with size guard");
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

    const { type, document_id, group_id, signatory_id, custom_body, signed_file_url }: EmailRequest = await req.json();

    // ─── MULTI_REQUEST: one email per signatory for all docs in group ───
    if (type === "multi_request") {
      if (!group_id) {
        return new Response(JSON.stringify({ error: "group_id is required for multi_request" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Fetch all documents in the group
      const { data: groupDocs } = await supabase
        .from("approval_documents")
        .select("*")
        .eq("multi_doc_group_id", group_id)
        .order("created_at");

      if (!groupDocs || groupDocs.length === 0) {
        return new Response(JSON.stringify({ error: "No documents found for this group" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Fetch all signatories for all docs in the group
      const docIds = groupDocs.map(d => d.id);
      const { data: allGroupSigs } = await supabase
        .from("approval_signatories")
        .select("*")
        .in("document_id", docIds)
        .order("sort_order");

      // Group by email to find unique signatories and their group_token
      const emailMap = new Map<string, { sigs: any[], group_token: string }>();
      for (const sig of (allGroupSigs || [])) {
        if (!emailMap.has(sig.email)) {
          emailMap.set(sig.email, { sigs: [], group_token: sig.group_token });
        }
        emailMap.get(sig.email)!.sigs.push(sig);
      }

      // Look up sender info from first doc
      const firstDoc = groupDocs[0];
      let senderTitle: string | null = null;
      if (firstDoc.sender_id) {
        const { data: sp } = await supabase.from("profiles").select("title").eq("user_id", firstDoc.sender_id).single();
        senderTitle = sp?.title || null;
      }
      const senderDisplayName = withTitle(firstDoc.sender_name || firstDoc.sender_email || "Unknown", senderTitle);

      const results: Array<{ email: string; status: string; error?: string }> = [];

      for (const [email, { sigs, group_token: gt }] of emailMap) {
        const sigDisplayName = withTitle(sigs[0].name, sigs[0].signatory_title);
        const approveUrl = `${APP_URL}/approve/group/${gt}`;

        // Build document list rows
        const docListRows = groupDocs.map((d, i) => 
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #1a202c;">${i + 1}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #1a202c;">${d.title}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${d.category || "—"}</td>
          </tr>`
        ).join("");

        const messageBlock = firstDoc.message
          ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;">
              <tr><td style="border-left: 4px solid #005EB8; background-color: #f1f5f9; padding: 12px 16px; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568; font-style: italic;">&ldquo;${firstDoc.message}&rdquo;</td></tr>
            </table>`
          : "";

        const deadlineInfo = firstDoc.deadline
          ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0;"><tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">Deadline: <strong>${formatDate(firstDoc.deadline)}</strong></td></tr></table>`
          : "";

        let html: string;
        if (custom_body) {
          const personalised = custom_body
            .replace(/\[Signatory Name\]/gi, sigDisplayName)
            .replace(/\n/g, "<br>");

          html = emailWrapper(`
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">Document Approval Requested</td></tr>
              <tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568; line-height: 1.6; padding-bottom: 16px;">${personalised}</td></tr>
            </table>
            ${signatoryTable(["#", "Document", "Category"], docListRows)}
            ${primaryButton(approveUrl, "&#10003; Review &amp; Approve All Documents")}
            ${fallbackLink(approveUrl)}
          `);
        } else {
          html = emailWrapper(`
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">Document Approval Requested</td></tr>
              <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 4px;">Hello ${sigDisplayName},</td></tr>
              <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;">${senderDisplayName} has sent you <strong>${groupDocs.length} documents</strong> for approval. Please review each document and approve below.</td></tr>
            </table>
            ${messageBlock}
            ${signatoryTable(["#", "Document", "Category"], docListRows)}
            ${deadlineInfo}
            ${infoNote("Click the button below to review all documents and approve with a single action.")}
            ${primaryButton(approveUrl, "&#10003; Review &amp; Approve All Documents")}
            ${fallbackLink(approveUrl)}
          `);
        }

        const { error: sendErr } = await resend.emails.send({
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [email],
          subject: `Document Approval Requested: ${groupDocs.length} documents from ${senderDisplayName}`,
          html,
        });
        results.push({ email, status: sendErr ? "failed" : "sent", error: sendErr?.message });

        if (!sendErr) {
          for (const did of docIds) {
            await supabase.from("approval_audit_log").insert({
              document_id: did,
              action: "email_sent_multi_request",
              actor_email: firstDoc.sender_email,
              actor_name: firstDoc.sender_name,
              metadata: { group_id, signatory_email: email },
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ─── MULTI_SEND_COMPLETED: one email with all signed docs attached ───
    if (type === "multi_send_completed") {
      if (!group_id) {
        return new Response(JSON.stringify({ error: "group_id is required for multi_send_completed" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: groupDocs } = await supabase
        .from("approval_documents")
        .select("*")
        .eq("multi_doc_group_id", group_id);

      if (!groupDocs || groupDocs.length === 0) {
        return new Response(JSON.stringify({ error: "No documents found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Fetch all signatories across all docs
      const docIds = groupDocs.map(d => d.id);
      const { data: allSigs } = await supabase
        .from("approval_signatories")
        .select("*")
        .in("document_id", docIds)
        .order("sort_order");

      // Check signed PDF sizes and attach if small, otherwise provide download links
      const attachments: { filename: string; content: string }[] = [];
      const downloadLinks: { title: string; url: string }[] = [];
      const MULTI_MAX_BYTES = 5 * 1024 * 1024; // 5MB per file to avoid OOM

      for (const gd of groupDocs) {
        if (gd.signed_file_url) {
          const sp = gd.signed_file_url.replace(/^.*approval-documents\//, "");
          const pathParts = sp.split("/");
          const fileName = pathParts.pop() || "";
          const folder = pathParts.join("/");

          // Check size before downloading
          let fileSize = 0;
          try {
            const { data: listData } = await supabase.storage.from("approval-documents").list(folder, { search: fileName, limit: 1 });
            fileSize = listData?.[0]?.metadata?.size || 0;
          } catch (_) {}

          if (fileSize > MULTI_MAX_BYTES || fileSize === 0) {
            console.log(`multi_send_completed: ${gd.title} too large (${fileSize} bytes), providing download link`);
            downloadLinks.push({ title: gd.title, url: `${APP_URL}/document-approval` });
          } else {
            try {
              const { data: fd, error: fe } = await supabase.storage.from("approval-documents").download(sp);
              if (!fe && fd) {
                const ab = await fd.arrayBuffer();
                const bytes = new Uint8Array(ab);
                attachments.push({
                  filename: `${(gd.title || "document").replace(/[^a-zA-Z0-9-_ ]/g, "")}-signed.pdf`,
                  content: encodeBase64(bytes),
                });
              } else {
                downloadLinks.push({ title: gd.title, url: gd.signed_file_url });
              }
            } catch (e) {
              console.warn("Could not download signed PDF for", gd.id, e);
              downloadLinks.push({ title: gd.title, url: gd.signed_file_url });
            }
          }
        }
      }

      // Build document table
      const docRows = groupDocs.map(d => {
        const docSigs = (allSigs || []).filter(s => s.document_id === d.id);
        const sigNames = docSigs.map(s => withTitle(s.signed_name || s.name, s.signatory_title)).join(", ");
        return `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #1a202c;">${d.title}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${sigNames}</td>
        </tr>`;
      }).join("");

      const docsLabel = groupDocs.length === 2 ? "Both documents have" : `All ${groupDocs.length} documents have`;
      const attachNote = attachments.length > 0
        ? "The signed copies are attached to this email."
        : "The signed documents are available for download below.";

      const downloadLinksHtml = downloadLinks.length > 0
        ? downloadLinks.map(dl => primaryButton(dl.url, `Download: ${dl.title}`)).join("")
        : "";

      const html = emailWrapper(`
        ${alertBanner("#f0fdf4", "#166534", "&#127881; All Documents Fully Signed")}
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;">${docsLabel} been approved by all signatories. ${attachNote}</td></tr>
        </table>
        ${signatoryTable(["Document", "Signatories"], docRows)}
        ${downloadLinksHtml}
        ${legalNotice("#f0fdf4", "#bbf7d0", "#166534", "These documents were electronically signed in accordance with UK law (Electronic Communications Act 2000). Each PDF contains a SHA-256 integrity hash and full audit trail.")}
        ${primaryButton(`${APP_URL}/document-approval`, "View in Notewell")}
      `);

      // Collect all recipients (sender + all unique signatory emails)
      const allRecipients: string[] = [];
      const senderEmail = groupDocs[0].sender_email;
      if (senderEmail) allRecipients.push(senderEmail);
      for (const s of (allSigs || [])) {
        if (s.email && !allRecipients.includes(s.email)) allRecipients.push(s.email);
      }

      const results: Array<{ email: string; status: string; error?: string }> = [];

      for (const recipientEmail of allRecipients) {
        const emailPayload: any = {
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [recipientEmail],
          subject: `Completed Signed Documents: ${groupDocs.length} documents fully approved`,
          html,
        };
        if (attachments.length > 0) {
          emailPayload.attachments = attachments.map(a => ({
            filename: a.filename,
            content: a.content,
            type: "application/pdf",
          }));
        }
        const { error: sendErr } = await resend.emails.send(emailPayload);
        results.push({ email: recipientEmail, status: sendErr ? "failed" : "sent", error: sendErr?.message });
      }

      // Audit log
      for (const did of docIds) {
        await supabase.from("approval_audit_log").insert({
          document_id: did,
          action: "email_sent_multi_completed",
          actor_email: senderEmail,
          metadata: { group_id, recipients: allRecipients, attachments_count: attachments.length },
        });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!document_id) {
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

    // Look up sender's title from profiles
    let senderTitle: string | null = null;
    if (doc.sender_id) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("title")
        .eq("user_id", doc.sender_id)
        .single();
      senderTitle = senderProfile?.title || null;
    }
    const senderDisplayName = withTitle(doc.sender_name || doc.sender_email || "Unknown", senderTitle);

    // Download the PDF attachment for request/reminder emails (skip if >5MB to avoid memory limits)
    const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB — keep low to avoid edge function memory limits
    let pdfAttachment: { filename: string; content: Uint8Array } | null = null;
    let pdfDownloadUrl: string | null = null;
    if (type === "request" || type === "reminder") {
      const fileSizeBytes = doc.file_size_bytes || 0;
      if (fileSizeBytes > MAX_ATTACHMENT_BYTES) {
        // Too large to attach — provide a download link via the approval page instead
        console.log(`PDF too large to attach (${fileSizeBytes} bytes), skipping inline attachment`);
        pdfDownloadUrl = doc.file_url;
      } else {
        try {
          const { data: fileData, error: fileErr } = await supabase.storage
            .from("approval-documents")
            .download(doc.file_url.replace(/^.*approval-documents\//, ""));

          if (!fileErr && fileData) {
            const arrayBuf = await fileData.arrayBuffer();
            const originalName = doc.original_filename || "document.pdf";
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
    }

    const results: Array<{ email: string; status: string; error?: string }> = [];

    // ─── TYPE: REQUEST ───────────────────────────────────────────────
    if (type === "request") {
      const targets = signatory_id
        ? (allSignatories || []).filter((s) => s.id === signatory_id)
        : (allSignatories || []).filter((s) => s.status === "pending");

      for (const sig of targets) {
        const approveUrl = `${APP_URL}/approve/${sig.approval_token}`;
        const sigDisplayName = withTitle(sig.name, sig.signatory_title);
        const fromEmail = doc.sender_email || "";
        const fromValue = fromEmail
          ? `<a href="mailto:${fromEmail}" style="color: #005EB8; text-decoration: none; font-weight: 500;">${senderDisplayName}</a>`
          : senderDisplayName;
        let html: string;

        if (custom_body) {
          const personalised = custom_body
            .replace(/\[Signatory Name\]/gi, sigDisplayName)
            .replace(/\n/g, "<br>");

          html = emailWrapper(`
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">Document Approval Requested</td></tr>
              <tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568; line-height: 1.6; padding-bottom: 16px;">${personalised}</td></tr>
            </table>
            ${pdfAttachment ? infoNote("The document is attached to this email for your review.") : infoNote("Please click the button below to view and approve the document.")}
            ${primaryButton(approveUrl, "&#10003; Approve Document")}
            ${fallbackLink(approveUrl)}
          `);
        } else {
          const deadlineInfo = doc.deadline
            ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0;"><tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">Deadline: <strong>${formatDate(doc.deadline)}</strong></td></tr></table>`
            : "";

          const messageBlock = doc.message
            ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;">
                <tr><td style="border-left: 4px solid #005EB8; background-color: #f1f5f9; padding: 12px 16px; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568; font-style: italic;">&ldquo;${doc.message}&rdquo;</td></tr>
              </table>`
            : "";

          html = emailWrapper(`
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">Document Approval Requested</td></tr>
              <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 4px;">Hello ${sigDisplayName},</td></tr>
              <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;">${senderDisplayName} has sent you a document for approval. Please review the details below.</td></tr>
            </table>
            ${messageBlock}
            ${detailsCard(`
              ${detailRow("Document", doc.title)}
              ${doc.category ? detailRow("Category", categoryBadge(doc.category)) : ""}
              ${detailRow("From", fromValue)}
              ${detailRow("Sent", formatDate(doc.created_at!), true)}
            `, "DOCUMENT DETAILS")}
            ${deadlineInfo}
             ${pdfAttachment ? infoNote("The document is attached to this email for your review.") : infoNote("Please click the button below to view and approve the document.")}
            ${primaryButton(approveUrl, "&#10003; Approve Document")}
            ${fallbackLink(approveUrl)}
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
        const approveUrl = `${APP_URL}/approve/${sig.approval_token}`;
        const sigDisplayName = withTitle(sig.name, sig.signatory_title);
        const now = new Date().toISOString();
        let deadlineNote = "";
        if (doc.deadline) {
          const daysLeft = daysBetween(now, doc.deadline);
          deadlineNote = daysLeft > 0
            ? alertBanner("#fef3c7", "#92400e", `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining until the deadline (${formatDate(doc.deadline)})`)
            : alertBanner("#fee2e2", "#991b1b", `This document is ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} overdue (deadline was ${formatDate(doc.deadline)})`);
        }

        const html = emailWrapper(`
          ${alertBanner("#fef3c7", "#92400e", "&#9203; Reminder: Your approval is still required")}
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">Approval Still Required</td></tr>
            <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 4px;">Hello ${sigDisplayName},</td></tr>
            <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;">This is a reminder that your approval is still needed for the following document:</td></tr>
          </table>
          ${detailsCard(`
            ${detailRow("Document", doc.title)}
            ${detailRow("From", senderDisplayName)}
            ${detailRow("Sent", formatDate(doc.created_at!), true)}
          `, "DOCUMENT DETAILS")}
          ${deadlineNote}
          ${pdfAttachment ? infoNote("The document is re-attached for your convenience.") : infoNote("Please click the button below to view and approve the document.")}
          ${primaryButton(approveUrl, "&#10003; Approve Document")}
          ${fallbackLink(approveUrl)}
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
        const sigDisplayName = withTitle(sig.signed_name || sig.name, sig.signatory_title);
        const html = emailWrapper(`
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">Approval Confirmed</td></tr>
            <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 4px;">Dear ${sigDisplayName},</td></tr>
            <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;">Thank you. Your approval has been successfully recorded.</td></tr>
          </table>
          ${detailsCard(`
            ${detailRow("Document", doc.title)}
            ${detailRow("Signed as", sigDisplayName)}
            ${sig.signed_role ? detailRow("Role", sig.signed_role) : ""}
            ${sig.signed_organisation ? detailRow("Organisation", sig.signed_organisation) : ""}
            ${detailRow("Approved at", sig.signed_at ? formatDate(sig.signed_at) : "Just now", true)}
          `, "APPROVAL DETAILS")}
          ${legalNotice("#f0fdf4", "#bbf7d0", "#166534", "Your electronic signature has been recorded in accordance with UK law (Electronic Communications Act 2000).")}
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #a0aec0; padding-top: 8px;">No further action is needed. You may close this email.</td></tr>
          </table>
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
      const sigRows = (allSignatories || [])
        .map((s) => `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #1a202c;">${withTitle(s.signed_name || s.name, s.signatory_title)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${s.signed_role || s.role || "—"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${s.signed_at ? formatDate(s.signed_at) : "—"}</td>
        </tr>`)
        .join("");

      const html = emailWrapper(`
        ${alertBanner("#f0fdf4", "#166534", "&#127881; All Approvals Received")}
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;">All ${(allSignatories || []).length} signatories have approved <strong style="color: #1a202c;">${doc.title}</strong>.</td></tr>
        </table>
        ${signatoryTable(["Name", "Role", "Signed"], sigRows)}
        ${primaryButton(`${APP_URL}/document-approval`, "View in Notewell")}
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

      // Check signed PDF size and attach if small enough, otherwise provide download link
      let signedPdfAttachment: { filename: string; content: string } | null = null;
      let signedPdfDownloadUrl: string | null = null;
      const fileUrlToDownload = signed_file_url || doc.signed_file_url;
      console.log("send_completed: fileUrlToDownload =", fileUrlToDownload);

      if (fileUrlToDownload) {
        const storagePath = fileUrlToDownload.replace(/^.*approval-documents\//, "");
        // Check file size before downloading to avoid OOM
        const pathParts = storagePath.split("/");
        const fileName = pathParts.pop() || "";
        const folder = pathParts.join("/");
        let actualSize = 0;
        try {
          const { data: listData } = await supabase.storage.from("approval-documents").list(folder, { search: fileName, limit: 1 });
          actualSize = listData?.[0]?.metadata?.size || 0;
          console.log("send_completed: signed PDF size from metadata =", actualSize);
        } catch (e) {
          console.warn("send_completed: could not check file size, will provide download link");
        }

        if (actualSize > MAX_ATTACHMENT_BYTES || actualSize === 0) {
          console.log(`send_completed: signed PDF too large or unknown size (${actualSize} bytes), providing download link`);
          signedPdfDownloadUrl = `${APP_URL}/document-approval`;
        } else {
          try {
            const { data: fileData, error: fileErr } = await supabase.storage.from("approval-documents").download(storagePath);
            if (fileErr) {
              console.error("send_completed: storage download error:", fileErr);
              signedPdfDownloadUrl = `${APP_URL}/document-approval`;
            } else if (fileData) {
              const arrayBuf = await fileData.arrayBuffer();
              const bytes = new Uint8Array(arrayBuf);
              const base64Content = encodeBase64(bytes);
              console.log("send_completed: attachment size =", bytes.length, "bytes");
              signedPdfAttachment = {
                filename: `${(doc.title || "document").replace(/[^a-zA-Z0-9-_ ]/g, "")}-signed.pdf`,
                content: base64Content,
              };
            }
          } catch (e) {
            console.error("send_completed: Could not download signed PDF:", e);
            signedPdfDownloadUrl = `${APP_URL}/document-approval`;
          }
        }
      } else {
        console.warn("send_completed: No signed_file_url available");
      }

      const sigRows = (allSignatories || [])
        .map((s: any) => `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #1a202c;">${withTitle(s.signed_name || s.name, s.signatory_title)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${s.signed_role || s.role || "—"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${s.signed_organisation || s.organisation || "—"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568;">${s.signed_at ? formatDate(s.signed_at) : "—"}</td>
        </tr>`)
        .join("");

      const attachmentNote = signedPdfAttachment
        ? `The fully signed version of <strong style="color: #1a202c;">${doc.title}</strong> is attached to this email.`
        : signedPdfDownloadUrl
          ? `The signed version of <strong style="color: #1a202c;">${doc.title}</strong> is too large to attach. You can download it using the button below.`
          : `The fully signed version of <strong style="color: #1a202c;">${doc.title}</strong> has been generated.`;

      const html = emailWrapper(`
        ${alertBanner("#f0fdf4", "#166534", "&#128196; Completed Signed Document")}
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 12px;">${attachmentNote}</td></tr>
          <tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #4a5568; padding-bottom: 16px;">All ${(allSignatories || []).length} signator${(allSignatories || []).length !== 1 ? "ies" : "y"} have approved this document. The PDF includes the Electronic Signature Certificate with full audit trail.</td></tr>
        </table>
        ${signatoryTable(["Name", "Role", "Organisation", "Signed"], sigRows)}
        ${signedPdfDownloadUrl ? primaryButton(signedPdfDownloadUrl, "Download Signed Document") : ""}
        ${legalNotice("#f0fdf4", "#bbf7d0", "#166534", "This document was electronically signed in accordance with UK law (Electronic Communications Act 2000). The PDF contains a SHA-256 integrity hash and full audit trail.")}
      `);

      // Send to sender + all signatories
      const allRecipients: string[] = [];
      if (doc.sender_email) allRecipients.push(doc.sender_email);
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
          console.log("send_completed: attaching PDF to email for", recipientEmail);
          emailPayload.attachments = [{
            filename: signedPdfAttachment.filename,
            content: signedPdfAttachment.content,
            type: "application/pdf",
          }];
        } else {
          console.warn("send_completed: no attachment available for", recipientEmail);
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
        const sigDisplayName = withTitle(sig.name, sig.signatory_title);
        const declineComment = sig.decline_comment
          ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;">
              <tr><td style="border-left: 4px solid #ef4444; background-color: #fef2f2; padding: 12px 16px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr><td style="font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: #991b1b; padding-bottom: 4px;">Reason given:</td></tr>
                  <tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #7f1d1d;">&ldquo;${sig.decline_comment}&rdquo;</td></tr>
                </table>
              </td></tr>
            </table>`
          : `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;"><tr><td style="font-family: ${FONT_STACK}; font-size: 14px; color: #a0aec0;">No reason was provided.</td></tr></table>`;

        const html = emailWrapper(`
          ${alertBanner("#fef2f2", "#991b1b", "&#10060; Approval Declined")}
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: #1a202c; padding-bottom: 16px;">${sigDisplayName} has declined</td></tr>
            <tr><td style="font-family: ${FONT_STACK}; font-size: 15px; color: #4a5568; padding-bottom: 16px;"><strong>${sigDisplayName}</strong> has declined to approve <strong>${doc.title}</strong>.</td></tr>
          </table>
          ${detailsCard(`
            ${detailRow("Signatory", sigDisplayName)}
            ${sig.role ? detailRow("Role", sig.role) : ""}
            ${detailRow("Organisation", sig.organisation || "—", true)}
          `, "SIGNATORY DETAILS")}
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

Deno.serve(handler);
