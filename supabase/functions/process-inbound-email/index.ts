import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category mappings for complaints (matching the enum values)
const COMPLAINT_CATEGORIES = [
  "Administration",
  "Appointments & Access",
  "Clinical Care & Treatment",
  "Communication Issues",
  "Confidentiality & Data",
  "Digital Services",
  "Facilities & Environment",
  "Prescriptions",
  "Staff Attitude & Behaviour",
  "Test Results & Follow-Up",
  "other",
];

// Compliment categories
const COMPLIMENT_CATEGORIES = [
  "Clinical Care & Treatment",
  "Staff Attitude & Behaviour",
  "Communication",
  "Appointments & Access",
  "Facilities & Environment",
  "Administration",
  "Digital Services",
  "other",
];

// Complaint sources
const COMPLAINT_SOURCES = ["patient", "nhs_resolution", "icb", "cqc", "ombudsman", "mp", "solicitor", "other"];

function generateReferenceNumber(prefix: string): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}${yy}${random}`;
}

// --- Attachment analysis helpers ---

function detectFileType(contentType: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (contentType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "tif"].includes(ext)) return "image";
  if (contentType === "application/pdf" || ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext) || contentType.includes("wordprocessing") || contentType === "application/msword") return "document";
  if (["xls", "xlsx"].includes(ext) || contentType.includes("spreadsheet")) return "spreadsheet";
  if (["eml", "msg"].includes(ext) || contentType === "message/rfc822") return "email";
  if (["txt", "csv", "rtf"].includes(ext) || contentType.startsWith("text/")) return "text";
  return "other";
}

async function extractDocxText(data: Uint8Array): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return "[Could not extract document content]";
    const text = docXml
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text.substring(0, 8000);
  } catch (e) {
    console.error("DOCX extraction error:", e);
    return "[Failed to extract document text]";
  }
}

async function aiSummariseText(text: string, fileName: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are summarising an email attachment for an NHS GP practice. Provide a brief 1-2 sentence factual summary of the file's contents. Be concise. Use British English." },
          { role: "user", content: `File: "${fileName}"\n\nContent:\n${text.substring(0, 6000)}` },
        ],
      }),
    });
    if (!response.ok) {
      console.error("AI summarise error:", response.status);
      return "AI summary could not be generated.";
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
  } catch (e) {
    console.error("AI summarise error:", e);
    return "AI summary could not be generated.";
  }
}

async function aiVisionSummarise(base64Data: string, mimeType: string, fileName: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are summarising an email attachment for an NHS GP practice complaint/compliment system. Provide a brief 1-2 sentence factual summary. If it contains text, extract the key details. Use British English." },
          {
            role: "user",
            content: [
              { type: "text", text: `Summarise this file named "${fileName}".` },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("AI vision error:", response.status);
      return "AI summary could not be generated.";
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
  } catch (e) {
    console.error("AI vision error:", e);
    return "AI summary could not be generated.";
  }
}

async function summariseAttachment(
  bytes: Uint8Array,
  fileName: string,
  contentType: string,
  apiKey: string
): Promise<string> {
  const fileType = detectFileType(contentType, fileName);
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  try {
    switch (fileType) {
      case "image":
      case "pdf": {
        // Convert to base64 and use vision API
        const chunkSize = 8192;
        let binaryString = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binaryString);
        return await aiVisionSummarise(base64, contentType || (fileType === "pdf" ? "application/pdf" : "image/jpeg"), fileName, apiKey);
      }

      case "document": {
        if (ext === "docx") {
          const extractedText = await extractDocxText(bytes);
          return await aiSummariseText(extractedText, fileName, apiKey);
        }
        // For .doc, .rtf, try plain text decode
        const textContent = new TextDecoder().decode(bytes);
        if (textContent.trim().length > 20) {
          return await aiSummariseText(textContent.substring(0, 8000), fileName, apiKey);
        }
        return "Document uploaded. Content preview not available for this format.";
      }

      case "text":
      case "email": {
        const textContent = new TextDecoder().decode(bytes);
        return await aiSummariseText(textContent.substring(0, 8000), fileName, apiKey);
      }

      default:
        return "File uploaded. Content analysis not available for this format.";
    }
  } catch (e) {
    console.error(`Error summarising attachment ${fileName}:`, e);
    return "AI summary could not be generated.";
  }
}

// --- Resend content fetching ---

async function fetchEmailContentFromResend(emailId: string, apiKey: string): Promise<{ text: string; html: string }> {
  let textBody = "";
  let htmlBody = "";

  // Try the receiving endpoint first (for inbound emails)
  const endpoints = [
    `https://api.resend.com/emails/receiving/${emailId}`,
    `https://api.resend.com/emails/${emailId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying Resend endpoint: ${endpoint}`);
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.log(`Resend endpoint ${endpoint} returned ${res.status}: ${errText.substring(0, 200)}`);
        continue;
      }

      const data = await res.json();
      console.log(`Resend response fields: ${Object.keys(data).join(", ")}`);

      // Try multiple field names for text body
      textBody = data.text || data.text_body || data.text_content || data.body?.text || "";
      // Try multiple field names for HTML body
      htmlBody = data.html || data.html_body || data.html_content || data.body?.html || "";

      if (textBody || htmlBody) {
        console.log(`Successfully fetched content from ${endpoint}: text=${textBody.length} chars, html=${htmlBody.length} chars`);
        break;
      }
    } catch (err) {
      console.error(`Error fetching from ${endpoint}:`, err);
    }
  }

  // If we only have HTML, strip tags to create text fallback
  if (!textBody && htmlBody) {
    textBody = htmlBody
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    console.log(`Stripped HTML to create text body: ${textBody.length} chars`);
  }

  return { text: textBody, html: htmlBody };
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();

    // --- REPROCESS MODE ---
    if (payload.reprocess && payload.inbound_email_id) {
      console.log(`Reprocessing inbound email: ${payload.inbound_email_id}`);

      const { data: existingEmail, error: fetchErr } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("id", payload.inbound_email_id)
        .single();

      if (fetchErr || !existingEmail) {
        return new Response(JSON.stringify({ error: "Email record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let textBody = existingEmail.text_body || "";
      let htmlBody = existingEmail.html_body || "";

      // Re-fetch content from Resend if body is empty
      if ((!textBody || textBody.trim().length < 10) && existingEmail.email_id && RESEND_API_KEY) {
        console.log("Re-fetching email content from Resend...");
        const fetched = await fetchEmailContentFromResend(existingEmail.email_id, RESEND_API_KEY);
        textBody = fetched.text || textBody;
        htmlBody = fetched.html || htmlBody;
      }

      // Re-summarise attachments if AI key available
      let updatedAttachments = existingEmail.attachments || [];
      if (LOVABLE_API_KEY && Array.isArray(updatedAttachments)) {
        for (let i = 0; i < updatedAttachments.length; i++) {
          const att = updatedAttachments[i];
          if (att.ai_summary) continue; // Skip already summarised

          try {
            console.log(`Summarising attachment: ${att.name}`);
            const { data: fileData, error: dlErr } = await supabase.storage
              .from("inbound-email-attachments")
              .download(att.path);

            if (dlErr || !fileData) {
              console.error(`Failed to download attachment for summarisation: ${att.name}`, dlErr);
              continue;
            }

            const arrayBuf = await fileData.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            const summary = await summariseAttachment(bytes, att.name, att.content_type || "", LOVABLE_API_KEY);
            updatedAttachments[i] = { ...att, ai_summary: summary };
          } catch (sumErr) {
            console.error(`Error summarising attachment ${att.name}:`, sumErr);
          }
        }
      }

      // Build email content for classification
      const emailContent = textBody || htmlBody?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
      const attachmentContext = updatedAttachments
        .filter((a: any) => a.ai_summary)
        .map((a: any) => `[Attachment: ${a.name}] ${a.ai_summary}`)
        .join("\n");

      let updateData: any = {
        text_body: textBody,
        html_body: htmlBody,
        attachments: updatedAttachments,
      };

      if (emailContent.trim().length >= 10 && LOVABLE_API_KEY) {
        // Re-classify
        const classResult = await classifyEmail(
          existingEmail.from_name || "",
          existingEmail.from_email || "",
          existingEmail.subject || "",
          emailContent,
          attachmentContext,
          LOVABLE_API_KEY
        );

        if (classResult) {
          updateData.classification = classResult.classification;
          updateData.processing_status = classResult.classification === "unknown" || classResult.confidence < 0.6
            ? "manual_review"
            : "processed";
          updateData.processing_notes = `Reprocessed. Classified as ${classResult.classification} (confidence: ${(classResult.confidence * 100).toFixed(0)}%). ${classResult.reasoning}`;
        } else {
          updateData.processing_status = "manual_review";
          updateData.processing_notes = "Reprocessed. AI classification failed.";
        }
      } else if (emailContent.trim().length < 10) {
        updateData.processing_status = "manual_review";
        updateData.processing_notes = "Reprocessed. Email still has insufficient text content for AI classification.";
      }

      await supabase
        .from("inbound_emails")
        .update(updateData)
        .eq("id", payload.inbound_email_id);

      return new Response(JSON.stringify({ status: "reprocessed", ...updateData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- NORMAL WEBHOOK PROCESSING ---
    console.log("Received inbound email webhook:", JSON.stringify(payload).substring(0, 1000));

    let emailData: any;
    let webhookType: string | undefined;

    if (payload.type && payload.data) {
      webhookType = payload.type;
      if (webhookType !== "email.received") {
        console.log(`Ignoring webhook type: ${webhookType}`);
        return new Response(JSON.stringify({ status: "ignored", reason: `Webhook type ${webhookType} not handled` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      emailData = payload.data;
    } else if (payload.from || payload.subject || payload.text || payload.html) {
      emailData = payload;
    } else {
      console.error("Invalid payload structure:", JSON.stringify(payload).substring(0, 500));
      return new Response(JSON.stringify({ error: "Invalid payload structure" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log full payload structure for debugging
    console.log("Email data fields:", Object.keys(emailData).join(", "));
    console.log("Email data sample:", JSON.stringify(emailData).substring(0, 1500));

    // Extract email fields
    const emailId = emailData.id || emailData.email_id || null;
    const fromEmail = typeof emailData.from === "string" ? emailData.from : emailData.from?.email || emailData.from_email || "";
    const fromName = typeof emailData.from === "object" ? emailData.from?.name : emailData.from_name || "";
    const toEmail = typeof emailData.to === "string" ? emailData.to :
      Array.isArray(emailData.to) ? (typeof emailData.to[0] === "string" ? emailData.to[0] : emailData.to[0]?.email) :
      emailData.to?.email || emailData.to_email || "";
    const subject = emailData.subject || "(No subject)";

    // Try to get body directly from webhook payload first
    let textBody = emailData.text || emailData.text_body || emailData.text_content || emailData.body?.text || "";
    let htmlBody = emailData.html || emailData.html_body || emailData.html_content || emailData.body?.html || "";

    console.log(`Webhook body: text=${textBody.length} chars, html=${htmlBody.length} chars`);

    // If body is empty and we have an email ID, fetch from Resend API
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let attachmentMetaFromApi: any[] = [];

    if ((!textBody && !htmlBody) && emailId && RESEND_API_KEY) {
      console.log("Webhook body empty — fetching from Resend API...");
      const fetched = await fetchEmailContentFromResend(emailId, RESEND_API_KEY);
      textBody = fetched.text;
      htmlBody = fetched.html;
    } else if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured — cannot fetch email content");
    }

    // Strip HTML to text as final fallback
    if (!textBody && htmlBody) {
      textBody = htmlBody
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    // Fetch attachment list from Resend API
    if (emailId && RESEND_API_KEY) {
      try {
        const attachRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });

        if (attachRes.ok) {
          const attachData = await attachRes.json();
          attachmentMetaFromApi = attachData.data || attachData || [];
          if (!Array.isArray(attachmentMetaFromApi)) attachmentMetaFromApi = [];
          console.log(`Resend returned ${attachmentMetaFromApi.length} attachment(s)`);
        } else {
          console.log(`Resend attachments API returned ${attachRes.status}: ${(await attachRes.text()).substring(0, 200)}`);
        }
      } catch (attachErr) {
        console.error("Error fetching attachments from Resend:", attachErr);
      }
    }

    // Merge attachment info from webhook payload and API
    const webhookAttachments = emailData.attachments || [];
    const hasAttachments = webhookAttachments.length > 0 || attachmentMetaFromApi.length > 0;
    const attachmentCount = Math.max(webhookAttachments.length, attachmentMetaFromApi.length);

    console.log(`Processing email from: ${fromEmail} (${fromName}), subject: ${subject}, body: ${textBody.length} chars, attachments: ${attachmentCount}`);

    // Download and save attachments
    const savedAttachments: { name: string; path: string; size: number; content_type: string; ai_summary?: string }[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Download from Resend API download URLs
    if (attachmentMetaFromApi.length > 0) {
      for (const att of attachmentMetaFromApi) {
        try {
          const fileName = att.filename || att.name || `attachment_${Date.now()}`;
          const contentType = att.content_type || "application/octet-stream";
          const downloadUrl = att.download_url;

          if (!downloadUrl) {
            console.log(`Skipping attachment ${fileName}: no download_url`);
            continue;
          }

          console.log(`Downloading attachment: ${fileName} from ${downloadUrl}`);
          const dlRes = await fetch(downloadUrl);
          if (!dlRes.ok) {
            console.error(`Failed to download attachment ${fileName}: ${dlRes.status}`);
            continue;
          }

          const arrayBuffer = await dlRes.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const storagePath = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("inbound-email-attachments")
            .upload(storagePath, bytes, { contentType, upsert: false });

          if (uploadError) {
            console.error(`Failed to upload attachment ${fileName}:`, uploadError);
            continue;
          }

          // Generate AI summary
          let aiSummary: string | undefined;
          if (LOVABLE_API_KEY) {
            try {
              aiSummary = await summariseAttachment(bytes, fileName, contentType, LOVABLE_API_KEY);
              console.log(`AI summary for ${fileName}: ${aiSummary?.substring(0, 100)}`);
            } catch (sumErr) {
              console.error(`Error summarising ${fileName}:`, sumErr);
            }
          }

          savedAttachments.push({
            name: fileName,
            path: storagePath,
            size: bytes.length,
            content_type: contentType,
            ai_summary: aiSummary,
          });

          console.log(`Saved attachment: ${fileName} (${bytes.length} bytes)`);
        } catch (attErr) {
          console.error("Error saving attachment:", attErr);
        }
      }
    }

    // Fallback: try webhook-embedded attachments (base64)
    if (savedAttachments.length === 0 && webhookAttachments.length > 0) {
      for (const attachment of webhookAttachments) {
        try {
          const fileName = attachment.filename || attachment.name || `attachment_${Date.now()}`;
          const contentType = attachment.content_type || attachment.type || "application/octet-stream";
          const content = attachment.content || attachment.data;

          if (!content) continue;

          const binaryStr = atob(content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const storagePath = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("inbound-email-attachments")
            .upload(storagePath, bytes, { contentType, upsert: false });

          if (uploadError) continue;

          // Generate AI summary
          let aiSummary: string | undefined;
          if (LOVABLE_API_KEY) {
            try {
              aiSummary = await summariseAttachment(bytes, fileName, contentType, LOVABLE_API_KEY);
            } catch (sumErr) {
              console.error(`Error summarising ${fileName}:`, sumErr);
            }
          }

          savedAttachments.push({
            name: fileName,
            path: storagePath,
            size: bytes.length,
            content_type: contentType,
            ai_summary: aiSummary,
          });
        } catch (attErr) {
          console.error("Error saving webhook attachment:", attErr);
        }
      }
    }

    // Create initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from("inbound_emails")
      .insert({
        email_id: emailId,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject: subject,
        text_body: textBody,
        html_body: htmlBody,
        has_attachments: hasAttachments,
        attachment_count: attachmentCount,
        attachments: savedAttachments,
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Error creating inbound email log:", logError);
    }

    const logId = logEntry?.id;
    console.log("Created inbound email log entry:", logId);

    // Build classification context including attachment summaries
    const emailContent = textBody || htmlBody?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
    const attachmentContext = savedAttachments
      .filter((a) => a.ai_summary)
      .map((a) => `[Attachment: ${a.name}] ${a.ai_summary}`)
      .join("\n");

    const fullContext = attachmentContext
      ? `${emailContent}\n\n--- Attachment Summaries ---\n${attachmentContext}`
      : emailContent;

    if (!fullContext || fullContext.trim().length < 10) {
      console.log("Email has insufficient content for classification");
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            processing_status: "manual_review",
            processing_notes: "Email has insufficient text content for AI classification.",
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ status: "manual_review", reason: "Insufficient content" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI Classification
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            processing_status: "failed",
            processing_notes: "AI service not configured (missing API key).",
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classResult = await classifyEmail(fromName, fromEmail, subject, fullContext, "", LOVABLE_API_KEY);

    if (!classResult) {
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            processing_status: "manual_review",
            processing_notes: "AI classification failed or returned empty response.",
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ status: "manual_review", reason: "AI classification failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { classification, confidence, extractedData, reasoning } = classResult;

    console.log(`Classification: ${classification} (confidence: ${confidence}), reasoning: ${reasoning}`);

    // If confidence too low, mark for manual review
    if (confidence < 0.6 || classification === "unknown") {
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            classification: classification || "unknown",
            processing_status: "manual_review",
            processing_notes: `Low confidence (${confidence}): ${reasoning}`,
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ status: "manual_review", classification, confidence, reasoning }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find a system user for created_by
    let createdByUserId: string | null = null;
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (adminUsers && adminUsers.length > 0) {
      createdByUserId = adminUsers[0].user_id;
    } else {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (!authError && authUsers?.users && authUsers.users.length > 0) {
        createdByUserId = authUsers.users[0].id;
      }
    }

    if (!createdByUserId) {
      console.error("No system user found for created_by field");
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            classification,
            processing_status: "manual_review",
            processing_notes: "No system user found to assign as creator. Please process manually.",
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ status: "manual_review", reason: "No system user" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recordId: string | null = null;
    let recordType: string | null = null;

    if (classification === "complaint") {
      const referenceNumber = generateReferenceNumber("COMP");
      const today = new Date().toISOString().split("T")[0];

      const complaintData = {
        reference_number: referenceNumber,
        patient_name: extractedData.patient_name || fromName || "Unknown",
        patient_contact_email: fromEmail || null,
        incident_date: extractedData.incident_date || today,
        complaint_title: extractedData.complaint_title || subject || "Email Complaint",
        complaint_description: extractedData.complaint_description || emailContent.substring(0, 2000),
        category: COMPLAINT_CATEGORIES.includes(extractedData.category) ? extractedData.category : "other",
        priority: ["low", "medium", "high", "urgent"].includes(extractedData.priority) ? extractedData.priority : "medium",
        status: "submitted",
        complaint_source: COMPLAINT_SOURCES.includes(extractedData.complaint_source) ? extractedData.complaint_source : "patient",
        consent_given: false,
        created_by: createdByUserId,
        staff_mentioned: Array.isArray(extractedData.staff_mentioned) ? extractedData.staff_mentioned : [],
      };

      console.log("Creating complaint record:", JSON.stringify(complaintData).substring(0, 300));

      const { data: complaint, error: complaintError } = await supabase
        .from("complaints")
        .insert(complaintData)
        .select("id")
        .single();

      if (complaintError) {
        console.error("Error creating complaint:", complaintError);
        if (logId) {
          await supabase
            .from("inbound_emails")
            .update({
              classification,
              processing_status: "failed",
              processing_notes: `Failed to create complaint: ${complaintError.message}`,
            })
            .eq("id", logId);
        }
        return new Response(JSON.stringify({ status: "failed", error: complaintError.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      recordId = complaint.id;
      recordType = "complaint";
      console.log(`Created complaint ${referenceNumber} with ID ${recordId}`);
    } else if (classification === "compliment") {
      const today = new Date().toISOString().split("T")[0];

      const complimentData = {
        patient_name: extractedData.patient_name || fromName || "Unknown",
        patient_contact_email: fromEmail || null,
        compliment_date: today,
        compliment_title: extractedData.compliment_title || subject || "Email Compliment",
        compliment_description: extractedData.compliment_description || emailContent.substring(0, 2000),
        category: COMPLIMENT_CATEGORIES.includes(extractedData.category) ? extractedData.category : "other",
        source: "email",
        staff_mentioned: Array.isArray(extractedData.staff_mentioned) ? extractedData.staff_mentioned : [],
        created_by: createdByUserId,
      };

      console.log("Creating compliment record:", JSON.stringify(complimentData).substring(0, 300));

      const { data: compliment, error: complimentError } = await supabase
        .from("compliments")
        .insert(complimentData)
        .select("id, reference_number")
        .single();

      if (complimentError) {
        console.error("Error creating compliment:", complimentError);
        if (logId) {
          await supabase
            .from("inbound_emails")
            .update({
              classification,
              processing_status: "failed",
              processing_notes: `Failed to create compliment: ${complimentError.message}`,
            })
            .eq("id", logId);
        }
        return new Response(JSON.stringify({ status: "failed", error: complimentError.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      recordId = compliment.id;
      recordType = "compliment";
      console.log(`Created compliment ${compliment.reference_number} with ID ${recordId}`);
    }

    // Update log entry with results
    if (logId) {
      await supabase
        .from("inbound_emails")
        .update({
          classification,
          record_id: recordId,
          record_type: recordType,
          processing_status: "processed",
          processing_notes: `Classified as ${classification} (confidence: ${(confidence * 100).toFixed(0)}%). ${reasoning}`,
        })
        .eq("id", logId);
    }

    console.log(`Successfully processed inbound email. Classification: ${classification}, Record: ${recordType}/${recordId}`);

    return new Response(
      JSON.stringify({
        status: "processed",
        classification,
        confidence,
        record_type: recordType,
        record_id: recordId,
        reasoning,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// --- AI Classification helper ---

async function classifyEmail(
  fromName: string,
  fromEmail: string,
  subject: string,
  emailContent: string,
  attachmentContext: string,
  apiKey: string
): Promise<{ classification: string; confidence: number; extractedData: any; reasoning: string } | null> {
  const classificationPrompt = `You are a UK NHS GP practice email classifier and data extractor. Analyse the following email and:

1. CLASSIFY the email as either "complaint", "compliment", or "unknown".
   - Complaint: Dissatisfaction, issues, concerns, formal complaints, negative experiences, requests for investigation
   - Compliment: Praise, thanks, positive feedback, appreciation, recognition of good care
   - Unknown: Cannot determine confidently, spam, unrelated, or ambiguous

2. EXTRACT structured data based on the classification.

For COMPLAINTS extract:
- patient_name: The patient's full name (or sender name if not explicitly stated)
- complaint_title: A concise professional title summarising the complaint (max 100 chars)
- complaint_description: A professional summary of the complaint suitable for NHS records. Rewrite in third person, formal tone. Include key details and concerns raised.
- category: One of: ${COMPLAINT_CATEGORIES.join(", ")}
- priority: One of: low, medium, high, urgent (infer from severity)
- incident_date: The date the incident occurred (YYYY-MM-DD format, or null if not mentioned)
- complaint_source: One of: ${COMPLAINT_SOURCES.join(", ")} (detect if sender is an organisation)
- staff_mentioned: Array of staff names mentioned (or empty array)

For COMPLIMENTS extract:
- patient_name: The patient's full name (or sender name)
- compliment_title: A concise title summarising the positive feedback (max 100 chars)
- compliment_description: The compliment rewritten professionally for records
- category: One of: ${COMPLIMENT_CATEGORIES.join(", ")}
- staff_mentioned: Array of staff names mentioned (or empty array)

Respond with ONLY valid JSON using this exact structure:
{
  "classification": "complaint" | "compliment" | "unknown",
  "confidence": 0.0-1.0,
  "data": { ... extracted fields ... },
  "reasoning": "Brief explanation of classification"
}`;

  const userPrompt = `Email from: ${fromName} <${fromEmail}>
Subject: ${subject}

Body:
${emailContent.substring(0, 4000)}${attachmentContext ? `\n\n--- Attachment Summaries ---\n${attachmentContext}` : ""}`;

  console.log("Calling AI for classification...");

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: classificationPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      return null;
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    console.log("AI response:", aiContent?.substring(0, 500));

    if (!aiContent) return null;

    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || aiContent.match(/(\{[\s\S]*\})/);
    let parsed: any;
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      parsed = JSON.parse(aiContent);
    }

    return {
      classification: parsed.classification,
      confidence: parsed.confidence || 0,
      extractedData: parsed.data || {},
      reasoning: parsed.reasoning || "",
    };
  } catch (e) {
    console.error("Classification error:", e);
    return null;
  }
}
