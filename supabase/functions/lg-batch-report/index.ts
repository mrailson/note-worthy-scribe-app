import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BatchPatient {
  id: string;
  patient_name: string | null;
  ai_extracted_name: string | null;
  nhs_number: string | null;
  dob: string | null;
  images_count: number | null;
  job_status: string;
  processing_error: string | null;
  pdf_url: string | null;
  pdf_size_mb: number | null;
  summary_json: any | null;
  snomed_json: any | null;
  created_at: string;
  upload_started_at: string | null;
  upload_completed_at: string | null;
  ocr_started_at: string | null;
  ocr_completed_at: string | null;
  summary_started_at: string | null;
  summary_completed_at: string | null;
  pdf_created_at: string | null;
  pdf_completed_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchId, userEmail, userName, practiceName } = await req.json();

    if (!batchId || !userEmail) {
      return new Response(
        JSON.stringify({ error: "batchId and userEmail are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating batch report for batch: ${batchId}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all patients in this batch
    const { data: patients, error: fetchError } = await supabaseAdmin
      .from("lg_patients")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching batch patients:", fetchError);
      throw new Error(`Failed to fetch batch patients: ${fetchError.message}`);
    }

    if (!patients || patients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No patients found for this batch" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch summary JSON for each patient
    const patientsWithSummaries: BatchPatient[] = [];
    
    for (const patient of patients) {
      let summaryData = null;
      let snomedData = null;

      // Try to fetch summary JSON from storage
      if (patient.practice_ods && patient.id) {
        const summaryPath = `${patient.practice_ods}/${patient.id}/final/summary.json`;
        const snomedPath = `${patient.practice_ods}/${patient.id}/final/snomed.json`;

        const { data: summaryFile } = await supabaseAdmin.storage
          .from("lg")
          .download(summaryPath);
        
        if (summaryFile) {
          try {
            summaryData = JSON.parse(await summaryFile.text());
          } catch {}
        }

        const { data: snomedFile } = await supabaseAdmin.storage
          .from("lg")
          .download(snomedPath);
        
        if (snomedFile) {
          try {
            snomedData = JSON.parse(await snomedFile.text());
          } catch {}
        }
      }

      patientsWithSummaries.push({
        ...patient,
        summary_json: summaryData,
        snomed_json: snomedData
      });
    }

    // Calculate statistics
    const totalFiles = patientsWithSummaries.length;
    const successfulFiles = patientsWithSummaries.filter(p => p.job_status === "succeeded").length;
    const failedFiles = patientsWithSummaries.filter(p => p.job_status === "failed").length;
    const totalPagesScanned = patientsWithSummaries.reduce((sum, p) => sum + (p.images_count || 0), 0);

    // Calculate total processing time
    const firstUploadStart = patientsWithSummaries
      .map(p => p.upload_started_at ? new Date(p.upload_started_at).getTime() : Infinity)
      .reduce((min, t) => Math.min(min, t), Infinity);
    
    const lastPdfComplete = patientsWithSummaries
      .map(p => p.pdf_completed_at ? new Date(p.pdf_completed_at).getTime() : 0)
      .reduce((max, t) => Math.max(max, t), 0);

    const totalProcessingTimeMs = lastPdfComplete - firstUploadStart;
    const totalProcessingMins = Math.round(totalProcessingTimeMs / 60000);
    const totalProcessingSecs = Math.round((totalProcessingTimeMs % 60000) / 1000);

    // Generate HTML email
    const emailHtml = generateBatchEmailHtml(
      patientsWithSummaries,
      {
        totalFiles,
        successfulFiles,
        failedFiles,
        totalPagesScanned,
        processingTime: `${totalProcessingMins}m ${totalProcessingSecs}s`,
        practiceName: practiceName || "Unknown Practice",
        userName: userName || "LG Capture User"
      }
    );

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Notewell AI <noreply@bluepcn.co.uk>",
        to: [userEmail],
        subject: `LG Capture Batch Report - ${new Date().toLocaleDateString("en-GB")} - ${totalFiles} files`,
        html: emailHtml
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error(`Email send failed: ${emailResponse.status}`);
    }

    // Mark batch report as sent
    await supabaseAdmin
      .from("lg_patients")
      .update({ batch_report_sent: true })
      .eq("batch_id", batchId);

    console.log(`Batch report sent successfully for ${totalFiles} files`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        filesProcessed: totalFiles,
        emailSentTo: userEmail 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Batch report error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateBatchEmailHtml(
  patients: BatchPatient[],
  stats: {
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalPagesScanned: number;
    processingTime: string;
    practiceName: string;
    userName: string;
  }
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { 
    weekday: "long", 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Generate file rows
  const fileRows = patients.map(p => {
    const patientName = p.ai_extracted_name || p.patient_name || "—";
    const dob = p.dob ? new Date(p.dob).toLocaleDateString("en-GB") : "—";
    const pagesScanned = p.images_count || 0;
    
    // Count summary items
    let summaryItems = 0;
    let medsCount = 0;
    let diagnosesCount = 0;
    let allergiesCount = 0;
    let immunisationsCount = 0;
    
    if (p.summary_json) {
      const s = p.summary_json;
      diagnosesCount = (s.significant_past_history?.length || 0);
      allergiesCount = (s.allergies?.length || 0);
      immunisationsCount = (s.immunisations?.length || 0);
      medsCount = (s.medications?.length || 0);
      summaryItems = diagnosesCount + allergiesCount + immunisationsCount + (s.procedures?.length || 0);
    }

    const statusColor = p.job_status === "succeeded" ? "#10b981" : 
                       p.job_status === "failed" ? "#ef4444" : "#f59e0b";
    const statusText = p.job_status === "succeeded" ? "✓" : 
                      p.job_status === "failed" ? "✗" : "⋯";

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${patientName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${dob}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center;">${pagesScanned}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center;">${summaryItems > 0 ? `${summaryItems} items` : "—"}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center;">${medsCount > 0 ? medsCount : "—"}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${statusColor}20; color: ${statusColor}; font-weight: 600;">
            ${statusText}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  // Generate detailed breakdown
  const detailedBreakdown = patients.filter(p => p.job_status === "succeeded" && p.summary_json).map(p => {
    const s = p.summary_json;
    const patientName = p.ai_extracted_name || p.patient_name || "Unknown";
    
    const sections = [];
    
    if (s.summary_line) {
      sections.push(`<p style="margin: 8px 0; font-size: 13px;"><strong>Summary:</strong> ${s.summary_line}</p>`);
    }
    
    // Smoking status from social_history
    if (s.social_history?.smoking_status && s.social_history.smoking_status !== "unknown") {
      let smokingText = s.social_history.smoking_status;
      if (s.social_history.stopped_year) {
        smokingText += ` (stopped ${s.social_history.stopped_year})`;
      }
      if (s.social_history.pack_years) {
        smokingText += `, ${s.social_history.pack_years} pack-years`;
      }
      sections.push(`<p style="margin: 4px 0; font-size: 12px; color: #6b7280;">🚬 Smoking: ${smokingText}</p>`);
    }
    
    // Diagnoses count
    const diagnosesCount = (s.significant_past_history?.length || 0) + (s.diagnoses?.length || 0);
    if (diagnosesCount > 0) {
      sections.push(`<p style="margin: 4px 0; font-size: 12px; color: #6b7280;">Diagnoses: ${diagnosesCount}</p>`);
    }
    
    if (s.allergies?.length > 0) {
      const allergyNames = s.allergies.map((a: any) => typeof a === "string" ? a : a.name || a.allergen || JSON.stringify(a)).slice(0, 5);
      sections.push(`<p style="margin: 4px 0; font-size: 12px; color: #6b7280;">Allergies: ${allergyNames.join(", ")}${s.allergies.length > 5 ? ` +${s.allergies.length - 5} more` : ""}</p>`);
    }
    
    if (s.medications?.length > 0) {
      const medNames = s.medications.map((m: any) => typeof m === "string" ? m : m.name || m.medication || JSON.stringify(m)).slice(0, 5);
      sections.push(`<p style="margin: 4px 0; font-size: 12px; color: #6b7280;">Medications: ${medNames.join(", ")}${s.medications.length > 5 ? ` +${s.medications.length - 5} more` : ""}</p>`);
    }
    
    // Immunisation summary (new field) or fallback to count
    if (s.immunisation_summary) {
      sections.push(`<p style="margin: 4px 0; font-size: 12px; color: #6b7280;">💉 Immunisations: ${s.immunisation_summary}</p>`);
    } else if (s.immunisations?.length > 0) {
      sections.push(`<p style="margin: 4px 0; font-size: 12px; color: #6b7280;">Immunisations: ${s.immunisations.length}</p>`);
    }
    
    // Verification flags
    if (s.verification_flags) {
      const flags = [];
      if (s.verification_flags.all_active_problems_coded) flags.push("✓ Problems coded");
      if (s.verification_flags.allergies_verified) flags.push("✓ Allergies verified");
      if (s.verification_flags.medications_verified) flags.push("✓ Medications verified");
      if (flags.length > 0) {
        sections.push(`<p style="margin: 4px 0; font-size: 11px; color: #10b981;">${flags.join(" • ")}</p>`);
      }
    }

    return `
      <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #005eb8;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #005eb8;">${patientName}</h4>
        ${sections.join("")}
      </div>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #005eb8 0%, #003d7a 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600;">LG Capture Batch Report</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">${stats.practiceName} • ${dateStr} at ${timeStr}</p>
    </div>

    <!-- Summary Stats -->
    <div style="background: white; padding: 20px; border-bottom: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 28px; font-weight: 700; color: #005eb8;">${stats.totalFiles}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Files Processed</div>
          </td>
          <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 28px; font-weight: 700; color: #10b981;">${stats.successfulFiles}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Successful</div>
          </td>
          <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 28px; font-weight: 700; color: #1f2937;">${stats.totalPagesScanned}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Pages</div>
          </td>
          <td style="padding: 12px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #6b7280;">${stats.processingTime}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Processing Time</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Files Table -->
    <div style="background: white; padding: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Files Summary</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Patient Name</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">DOB</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Pages</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Summary</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Meds</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${fileRows}
        </tbody>
      </table>
    </div>

    ${detailedBreakdown ? `
    <!-- Detailed Breakdown -->
    <div style="background: white; padding: 20px; border-top: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Clinical Summary Details</h2>
      ${detailedBreakdown}
    </div>
    ` : ""}

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Generated by Notewell AI LG Capture • ${dateStr}
      </p>
    </div>

  </div>
</body>
</html>
  `;
}