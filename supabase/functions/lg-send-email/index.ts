import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType } from "npm:docx@8.5.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  patientId: string;
  recipientEmail: string;
  recipientName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientId, recipientEmail, recipientName }: EmailRequest = await req.json();

    if (!patientId || !recipientEmail) {
      throw new Error("Missing patientId or recipientEmail");
    }

    console.log(`Sending LG email for patient ${patientId} to ${recipientEmail}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient record
    const { data: patient, error: patientError } = await supabase
      .from('lg_patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      throw new Error(`Patient not found: ${patientError?.message}`);
    }

    // Get summary JSON
    let summaryData: any = null;
    if (patient.summary_json_url) {
      const { data: summaryFile } = await supabase.storage
        .from('lg')
        .download(patient.summary_json_url.replace('lg/', ''));
      if (summaryFile) {
        summaryData = JSON.parse(await summaryFile.text());
      }
    }

    // Get SNOMED data
    let snomedData: any = null;
    if (patient.snomed_json_url) {
      const { data: snomedFile } = await supabase.storage
        .from('lg')
        .download(patient.snomed_json_url.replace('lg/', ''));
      if (snomedFile) {
        snomedData = JSON.parse(await snomedFile.text());
      }
    }

    // Create signed URLs for attachments
    const attachments: any[] = [];
    
    // PDF attachment
    if (patient.pdf_url) {
      const { data: pdfData } = await supabase.storage
        .from('lg')
        .download(patient.pdf_url.replace('lg/', ''));
      if (pdfData) {
        const pdfBuffer = await pdfData.arrayBuffer();
        attachments.push({
          filename: `${patient.nhs_number || patient.id}_lloyd-george.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        });
      }
    }

    // CSV attachment
    if (patient.snomed_csv_url) {
      const { data: csvData } = await supabase.storage
        .from('lg')
        .download(patient.snomed_csv_url.replace('lg/', ''));
      if (csvData) {
        attachments.push({
          filename: `${patient.nhs_number || patient.id}_snomed-codes.csv`,
          content: Buffer.from(await csvData.arrayBuffer()).toString('base64'),
        });
      }
    }

    // Create Word document
    const wordDoc = await createWordDocument(patient, summaryData, snomedData);
    attachments.push({
      filename: `${patient.nhs_number || patient.id}_clinical-summary.docx`,
      content: Buffer.from(wordDoc).toString('base64'),
    });

    const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Not recorded';

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Notewell LG Capture <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `Lloyd George Record - ${patientName} (NHS: ${nhsNumber})`,
      html: generateEmailHtml(patient, summaryData, recipientName),
      attachments,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the action
    await supabase.from('lg_audit_logs').insert({
      id: generateULID(),
      patient_id: patientId,
      event: 'email_sent',
      actor: recipientName || recipientEmail,
      meta: {
        recipient: recipientEmail,
        attachments_count: attachments.length,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function generateEmailHtml(patient: any, summaryData: any, recipientName?: string): string {
  const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
  const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Not recorded';
  const dob = patient.ai_extracted_dob || patient.dob || 'Not recorded';
  const processedDate = new Date(patient.processing_completed_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  let summaryHtml = '';
  if (summaryData) {
    if (summaryData.summary_line) {
      summaryHtml += `<p><strong>Summary:</strong> ${summaryData.summary_line}</p>`;
    }
    if (summaryData.allergies?.length > 0) {
      summaryHtml += `<p><strong>Allergies:</strong> ${summaryData.allergies.map((a: any) => a.substance).join(', ')}</p>`;
    }
    if (summaryData.medications?.length > 0) {
      summaryHtml += `<p><strong>Medications:</strong> ${summaryData.medications.map((m: any) => m.name).join(', ')}</p>`;
    }
    if (summaryData.free_text_findings) {
      summaryHtml += `<p><strong>Additional findings:</strong> ${summaryData.free_text_findings}</p>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #005EB8; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #f8f9fa; padding: 20px; border: 1px solid #e5e7eb; }
    .patient-card { background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #005EB8; }
    .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 16px; font-weight: 600; color: #111827; }
    .summary { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
    .footer { padding: 16px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
    .attachments { background: #ecfdf5; padding: 12px 16px; border-radius: 6px; margin-top: 16px; }
    .attachments-title { color: #047857; font-weight: 600; margin-bottom: 8px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 Lloyd George Record Capture</h1>
  </div>
  <div class="content">
    ${recipientName ? `<p>Dear ${recipientName},</p>` : ''}
    <p>Please find attached the digitised Lloyd George medical record with clinical summary and SNOMED codes.</p>
    
    <div class="patient-card">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <div class="label">Patient Name</div>
          <div class="value">${patientName}</div>
        </div>
        <div>
          <div class="label">NHS Number</div>
          <div class="value" style="font-family: monospace;">${nhsNumber}</div>
        </div>
        <div>
          <div class="label">Date of Birth</div>
          <div class="value">${dob}</div>
        </div>
        <div>
          <div class="label">Pages Scanned</div>
          <div class="value">${patient.images_count}</div>
        </div>
      </div>
    </div>

    ${summaryHtml ? `<div class="summary"><h3 style="margin-top: 0; color: #005EB8;">Clinical Summary</h3>${summaryHtml}</div>` : ''}

    <div class="attachments">
      <div class="attachments-title">📎 Attachments</div>
      <ul>
        <li>Lloyd George PDF (searchable, ${patient.images_count} pages)</li>
        <li>Clinical Summary (Word document)</li>
        <li>SNOMED Codes (CSV for import)</li>
      </ul>
    </div>

    <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">
      Processed on ${processedDate} by ${patient.uploader_name}<br>
      Practice ODS: ${patient.practice_ods}
    </p>
  </div>
  <div class="footer">
    <p>This email was sent from Notewell LG Capture.<br>
    Patient data should be handled in accordance with NHS data protection policies.</p>
  </div>
</body>
</html>
  `;
}

async function createWordDocument(patient: any, summaryData: any, snomedData: any): Promise<Uint8Array> {
  const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
  const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Not recorded';
  const dob = patient.ai_extracted_dob || patient.dob || 'Not recorded';

  const sections: any[] = [];

  // Title
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: "Lloyd George Record Summary", bold: true, size: 32, color: "005EB8" })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  // Patient details table
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: "Patient Details", bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
    })
  );

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        createTableRow("Patient Name", patientName),
        createTableRow("NHS Number", nhsNumber),
        createTableRow("Date of Birth", dob),
        createTableRow("Sex", patient.ai_extracted_sex || patient.sex || 'Unknown'),
        createTableRow("Pages Scanned", String(patient.images_count)),
        createTableRow("Practice ODS", patient.practice_ods),
        createTableRow("Captured By", patient.uploader_name),
        createTableRow("Processed", new Date(patient.processing_completed_at).toLocaleString('en-GB')),
      ],
    })
  );

  // Clinical Summary
  if (summaryData) {
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: "Clinical Summary", bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    if (summaryData.summary_line) {
      sections.push(new Paragraph({ children: [new TextRun({ text: summaryData.summary_line })], spacing: { after: 100 } }));
    }

    // Allergies
    if (summaryData.allergies?.length > 0) {
      sections.push(createSectionHeading("Allergies"));
      for (const item of summaryData.allergies) {
        sections.push(createBulletPoint(`${item.substance}${item.reaction ? ` - ${item.reaction}` : ''}`));
      }
    }

    // Past History
    if (summaryData.significant_past_history?.length > 0) {
      sections.push(createSectionHeading("Significant Past History"));
      for (const item of summaryData.significant_past_history) {
        sections.push(createBulletPoint(`${item.condition}${item.first_noted ? ` (${item.first_noted})` : ''}`));
      }
    }

    // Medications
    if (summaryData.medications?.length > 0) {
      sections.push(createSectionHeading("Medications"));
      for (const item of summaryData.medications) {
        sections.push(createBulletPoint(`${item.name}${item.dose ? ` ${item.dose}` : ''}${item.frequency ? ` ${item.frequency}` : ''}`));
      }
    }

    // Immunisations
    if (summaryData.immunisations?.length > 0) {
      sections.push(createSectionHeading("Immunisations"));
      for (const item of summaryData.immunisations) {
        sections.push(createBulletPoint(`${item.vaccine}${item.date ? ` (${item.date})` : ''}`));
      }
    }

    // Procedures
    if (summaryData.procedures?.length > 0) {
      sections.push(createSectionHeading("Procedures"));
      for (const item of summaryData.procedures) {
        sections.push(createBulletPoint(`${item.name}${item.date ? ` (${item.date})` : ''}`));
      }
    }

    // Free text
    if (summaryData.free_text_findings) {
      sections.push(createSectionHeading("Additional Findings"));
      sections.push(new Paragraph({ children: [new TextRun({ text: summaryData.free_text_findings })], spacing: { after: 100 } }));
    }
  }

  // SNOMED Codes
  if (snomedData) {
    const allCodes = [
      ...(snomedData.problems || []).map((c: any) => ({ ...c, domain: 'Problem' })),
      ...(snomedData.allergies || []).map((c: any) => ({ ...c, domain: 'Allergy' })),
      ...(snomedData.procedures || []).map((c: any) => ({ ...c, domain: 'Procedure' })),
      ...(snomedData.immunisations || []).map((c: any) => ({ ...c, domain: 'Immunisation' })),
    ];

    if (allCodes.length > 0) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: "SNOMED CT Codes", bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 100 },
        })
      );

      const codeRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Domain", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Term", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Code", bold: true })] })] }),
          ],
        }),
        ...allCodes.map((code: any) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: code.domain })] }),
            new TableCell({ children: [new Paragraph({ text: code.term || '' })] }),
            new TableCell({ children: [new Paragraph({ text: code.code || 'UNKNOWN' })] }),
          ],
        })),
      ];

      sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: codeRows }));
    }
  }

  // Footer disclaimer
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: "\n\nDisclaimer: ", bold: true, size: 18 }), new TextRun({ text: "This document was generated by AI processing of scanned Lloyd George records. All clinical information should be verified before use.", size: 18, italics: true })],
      spacing: { before: 400 },
    })
  );

  const doc = new Document({
    sections: [{ children: sections }],
  });

  return await Packer.toBuffer(doc);
}

function createTableRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: value })],
        width: { size: 70, type: WidthType.PERCENTAGE },
      }),
    ],
  });
}

function createSectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: "005EB8" })],
    spacing: { before: 200, after: 80 },
  });
}

function createBulletPoint(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}` })],
    spacing: { after: 40 },
  });
}

function generateULID(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const time = Date.now();
  let timeStr = '';
  let t = time;
  for (let i = 10; i > 0; i--) {
    timeStr = ENCODING[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  let randomStr = '';
  for (let i = 0; i < 16; i++) {
    randomStr += ENCODING[Math.floor(Math.random() * 32)];
  }
  return timeStr + randomStr;
}
