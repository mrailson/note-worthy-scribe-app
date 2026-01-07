import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from "npm:docx@8.5.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatEmailRequest {
  recipientEmails: string[];
  subject: string;
  chatContent: string;
  senderName: string;
  additionalNotes?: string;
  includeWordDoc?: boolean;
}

// Convert markdown content to HTML with proper table support
function markdownToHtml(content: string): string {
  const lines = content.split('\n');
  let html = '';
  let inTable = false;
  let tableRows: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a table row (contains pipes)
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator rows (contain only dashes and pipes)
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      
      // Parse table cells
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      tableRows.push(cells);
    } else {
      // If we were in a table, close it
      if (inTable) {
        html += renderHtmlTable(tableRows);
        inTable = false;
        tableRows = [];
      }
      
      // Handle regular content
      if (line === '') {
        html += '<br>';
      } else {
        // Convert markdown bold (**text**) to HTML
        let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Convert markdown italic (*text*) to HTML
        processedLine = processedLine.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Escape HTML entities
        processedLine = processedLine.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/&lt;strong&gt;/g, '<strong>')
          .replace(/&lt;\/strong&gt;/g, '</strong>')
          .replace(/&lt;em&gt;/g, '<em>')
          .replace(/&lt;\/em&gt;/g, '</em>');
        
        html += processedLine + '<br>';
      }
    }
  }
  
  // Close any remaining table
  if (inTable) {
    html += renderHtmlTable(tableRows);
  }
  
  return html;
}

// Render an HTML table from rows
function renderHtmlTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  
  let tableHtml = `
    <table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px;">
  `;
  
  rows.forEach((row, index) => {
    const isHeader = index === 0;
    const bgColor = isHeader ? '#f3f4f6' : (index % 2 === 0 ? '#ffffff' : '#f9fafb');
    
    tableHtml += '<tr>';
    row.forEach(cell => {
      const tag = isHeader ? 'th' : 'td';
      const fontWeight = isHeader ? 'font-weight: 600;' : '';
      tableHtml += `<${tag} style="border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; ${fontWeight} background-color: ${bgColor};">${escapeHtml(cell)}</${tag}>`;
    });
    tableHtml += '</tr>';
  });
  
  tableHtml += '</table>';
  return tableHtml;
}

// Escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Parse markdown content for tables and regular text for Word doc
function parseContentForWord(content: string): { type: 'text' | 'table'; data: string | string[][] }[] {
  const lines = content.split('\n');
  const sections: { type: 'text' | 'table'; data: string | string[][] }[] = [];
  let currentText = '';
  let inTable = false;
  let tableRows: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a table row
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator rows
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }
      
      if (!inTable) {
        // Save any accumulated text
        if (currentText.trim()) {
          sections.push({ type: 'text', data: currentText.trim() });
          currentText = '';
        }
        inTable = true;
        tableRows = [];
      }
      
      // Parse table cells
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      tableRows.push(cells);
    } else {
      // If we were in a table, save it
      if (inTable) {
        sections.push({ type: 'table', data: tableRows });
        inTable = false;
        tableRows = [];
      }
      
      currentText += line + '\n';
    }
  }
  
  // Save remaining content
  if (inTable) {
    sections.push({ type: 'table', data: tableRows });
  }
  if (currentText.trim()) {
    sections.push({ type: 'text', data: currentText.trim() });
  }
  
  return sections;
}

// Create a Word table from rows
function createWordTable(rows: string[][]): Table {
  const tableRows = rows.map((row, rowIndex) => {
    return new TableRow({
      children: row.map(cell => {
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell,
                  bold: rowIndex === 0,
                  size: 22, // 11pt
                }),
              ],
            }),
          ],
          shading: {
            fill: rowIndex === 0 ? 'E5E7EB' : (rowIndex % 2 === 0 ? 'FFFFFF' : 'F9FAFB'),
          },
        });
      }),
    });
  });

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

// Generate a Word document from the chat content with proper table support
async function generateWordDoc(subject: string, chatContent: string, senderName: string, additionalNotes?: string): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "Notewell AI Chat Summary",
      heading: HeadingLevel.HEADING_1,
    })
  );

  // Shared by
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Shared by: ", bold: true }),
        new TextRun({ text: senderName }),
      ],
      spacing: { after: 200 },
    })
  );

  // Subject
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Subject: ", bold: true }),
        new TextRun({ text: subject }),
      ],
      spacing: { after: 400 },
    })
  );

  // Content header
  children.push(
    new Paragraph({
      text: "Content",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200 },
    })
  );

  // Parse content for tables and text
  const contentSections = parseContentForWord(chatContent);
  
  for (const section of contentSections) {
    if (section.type === 'table') {
      children.push(createWordTable(section.data as string[][]));
      // Add spacing after table
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    } else {
      const textLines = (section.data as string).split('\n');
      for (const line of textLines) {
        children.push(
          new Paragraph({
            text: line || ' ',
            spacing: { after: 100 },
          })
        );
      }
    }
  }

  // Additional notes if present
  if (additionalNotes) {
    children.push(
      new Paragraph({
        text: "Additional Notes",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400 },
      })
    );

    const notesLines = additionalNotes.split('\n');
    for (const line of notesLines) {
      children.push(
        new Paragraph({
          text: line || ' ',
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-chat-email function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmails, subject, chatContent, senderName, additionalNotes, includeWordDoc = false }: ChatEmailRequest = await req.json();

    console.log("Sending email to:", recipientEmails);
    console.log("Subject:", subject);
    console.log("Include Word doc:", includeWordDoc);

    if (!recipientEmails || recipientEmails.length === 0) {
      throw new Error("No recipient emails provided");
    }

    if (!chatContent) {
      throw new Error("No chat content provided");
    }

    // Convert markdown content to proper HTML
    const formattedContent = markdownToHtml(chatContent);
    const formattedNotes = additionalNotes ? markdownToHtml(additionalNotes) : '';

    // Build the email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(subject)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .chat-content { background: white; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 14px; }
            .notes { margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
            .attachment-note { margin-top: 16px; padding: 12px; background: #e0f2fe; border-radius: 6px; border-left: 4px solid #0284c7; font-size: 13px; }
            h1 { margin: 0; font-size: 20px; }
            .from { margin-top: 8px; font-size: 14px; opacity: 0.9; }
            table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: 600; }
            tr:nth-child(even) td { background-color: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Notewell AI Chat Summary</h1>
            <div class="from">Shared by ${escapeHtml(senderName)}</div>
          </div>
          <div class="content">
            <div class="chat-content">${formattedContent}</div>
            ${additionalNotes ? `<div class="notes"><strong>Additional Notes:</strong><br>${formattedNotes}</div>` : ''}
            ${includeWordDoc ? `<div class="attachment-note">📎 A Word document version is attached to this email.</div>` : ''}
          </div>
          <div class="footer">
            <p>This email was sent from Notewell AI</p>
          </div>
        </body>
      </html>
    `;

    // Prepare email options
    const emailOptions: any = {
      from: "\"Notewell AI\" <noreply@bluepcn.co.uk>",
      to: recipientEmails,
      subject: subject,
      html: html,
    };

    // Generate and attach Word document if requested
    if (includeWordDoc) {
      console.log("Generating Word document with table support...");
      const wordDocBuffer = await generateWordDoc(subject, chatContent, senderName, additionalNotes);
      
      // Convert to base64 for attachment
      const base64Content = btoa(String.fromCharCode(...wordDocBuffer));
      
      // Create a descriptive filename from the subject (sanitise for filename)
      const sanitisedSubject = subject
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .substring(0, 50) // Limit length
        .replace(/-+$/, ''); // Remove trailing hyphens
      
      const filename = sanitisedSubject ? `${sanitisedSubject}.docx` : 'AI4PM-Chat-Summary.docx';
      
      emailOptions.attachments = [
        {
          filename: filename,
          content: base64Content,
        },
      ];
      console.log("Word document attached:", filename);
    }

    const emailResponse = await resend.emails.send(emailOptions);

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-chat-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);