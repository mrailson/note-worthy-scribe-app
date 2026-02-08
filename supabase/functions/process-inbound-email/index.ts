import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Compliment categories (text field, same options for consistency)
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST
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
    console.log("Received inbound email webhook:", JSON.stringify(payload).substring(0, 500));

    // Resend sends { type: "email.received", created_at: ..., data: { ... } }
    // But also accept raw email payloads (for flexibility)
    let emailData: any;
    let webhookType: string | undefined;

    if (payload.type && payload.data) {
      // Standard Resend webhook format
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
      // Direct email payload (fallback)
      emailData = payload;
    } else {
      console.error("Invalid payload structure:", JSON.stringify(payload).substring(0, 300));
      return new Response(JSON.stringify({ error: "Invalid payload structure" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract email fields
    const emailId = emailData.id || emailData.email_id || null;
    const fromEmail = typeof emailData.from === "string" ? emailData.from : emailData.from?.email || emailData.from_email || "";
    const fromName = typeof emailData.from === "object" ? emailData.from?.name : emailData.from_name || "";
    const toEmail = typeof emailData.to === "string" ? emailData.to :
      Array.isArray(emailData.to) ? (typeof emailData.to[0] === "string" ? emailData.to[0] : emailData.to[0]?.email) :
      emailData.to?.email || emailData.to_email || "";
    const subject = emailData.subject || "(No subject)";
    const textBody = emailData.text || emailData.text_body || "";
    const htmlBody = emailData.html || emailData.html_body || "";
    const attachments = emailData.attachments || [];
    const hasAttachments = attachments.length > 0;
    const attachmentCount = attachments.length;

    console.log(`Processing email from: ${fromEmail} (${fromName}), subject: ${subject}, attachments: ${attachmentCount}`);

    // Save attachments to storage
    const savedAttachments: { name: string; path: string; size: number; content_type: string }[] = [];
    
    if (hasAttachments) {
      for (const attachment of attachments) {
        try {
          const fileName = attachment.filename || attachment.name || `attachment_${Date.now()}`;
          const contentType = attachment.content_type || attachment.type || "application/octet-stream";
          const content = attachment.content || attachment.data;
          
          if (!content) {
            console.log(`Skipping attachment ${fileName}: no content`);
            continue;
          }

          // Decode base64 content
          const binaryStr = atob(content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const storagePath = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("inbound-email-attachments")
            .upload(storagePath, bytes, { contentType, upsert: false });

          if (uploadError) {
            console.error(`Failed to upload attachment ${fileName}:`, uploadError);
            continue;
          }

          savedAttachments.push({
            name: fileName,
            path: storagePath,
            size: bytes.length,
            content_type: contentType,
          });

          console.log(`Saved attachment: ${fileName} (${bytes.length} bytes)`);
        } catch (attErr) {
          console.error("Error saving attachment:", attErr);
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

    // Get the email content for AI classification
    const emailContent = textBody || htmlBody?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";

    if (!emailContent || emailContent.trim().length < 10) {
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

    // AI Classification and Data Extraction
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
${emailContent.substring(0, 4000)}`;

    console.log("Calling AI for classification...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

      const statusNote = aiResponse.status === 429
        ? "Rate limit exceeded. Email queued for manual review."
        : aiResponse.status === 402
        ? "AI credits exhausted. Email queued for manual review."
        : `AI classification failed (${aiResponse.status}).`;

      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            processing_status: "manual_review",
            processing_notes: statusNote,
          })
          .eq("id", logId);
      }

      return new Response(JSON.stringify({ status: "manual_review", reason: statusNote }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    console.log("AI response:", aiContent?.substring(0, 500));

    if (!aiContent) {
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            processing_status: "manual_review",
            processing_notes: "AI returned empty response.",
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ status: "manual_review", reason: "Empty AI response" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse AI response
    let classificationResult: any;
    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || aiContent.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        classificationResult = JSON.parse(jsonMatch[1]);
      } else {
        classificationResult = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      if (logId) {
        await supabase
          .from("inbound_emails")
          .update({
            processing_status: "manual_review",
            processing_notes: `AI response could not be parsed: ${aiContent.substring(0, 200)}`,
          })
          .eq("id", logId);
      }
      return new Response(JSON.stringify({ status: "manual_review", reason: "AI parse error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classification = classificationResult.classification;
    const confidence = classificationResult.confidence || 0;
    const extractedData = classificationResult.data || {};
    const reasoning = classificationResult.reasoning || "";

    console.log(`Classification: ${classification} (confidence: ${confidence}), reasoning: ${reasoning}`);

    // If confidence is too low, mark for manual review
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

    // Find a system user (created_by) — must be a valid auth.users ID
    let createdByUserId: string | null = null;
    
    // First try: find an admin user from user_roles
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (adminUsers && adminUsers.length > 0) {
      createdByUserId = adminUsers[0].user_id;
    } else {
      // Fallback: get the first auth.users entry via admin API
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
      // Create complaint record
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
      // Create compliment record
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
