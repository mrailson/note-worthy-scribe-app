import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "npm:docx@8.5.0";

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInlineMarkdownToHtml(text: string): string {
  // Escape first, then re-introduce a small set of safe tags.
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

// Render markdown-ish content to HTML for email (headings, lists, tables, bold/italic).
function markdownToHtml(content: string): string {
  const lines = content.split("\n");
  let html = "";

  let inTable = false;
  let tableRows: string[][] = [];

  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      html += renderHtmlTable(tableRows);
      inTable = false;
      tableRows = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, "");
    const trimmed = line.trim();

    // Table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeLists();

      // Skip separator rows
      if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      tableRows.push(cells);
      continue;
    }

    // Not a table row
    closeTable();

    if (!trimmed) {
      closeLists();
      html += "<br>";
      continue;
    }

    // Headings (# .. ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      // Start at h2 because the email has its own H1 in the header.
      const tag = `h${Math.min(level + 1, 6)}`;
      html += `<${tag} style="margin: 16px 0 8px 0;">${formatInlineMarkdownToHtml(
        headingMatch[2]
      )}</${tag}>`;
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        html += '<ul style="margin: 12px 0; padding-left: 22px;">';
        inUl = true;
      }
      html += `<li style="margin: 4px 0;">${formatInlineMarkdownToHtml(
        ulMatch[1]
      )}</li>`;
      continue;
    }

    // Ordered list (1. Item)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        html += '<ol style="margin: 12px 0; padding-left: 22px;">';
        inOl = true;
      }
      html += `<li style="margin: 4px 0;">${formatInlineMarkdownToHtml(
        olMatch[1]
      )}</li>`;
      continue;
    }

    // Normal paragraph
    closeLists();
    html += `<p style="margin: 10px 0;">${formatInlineMarkdownToHtml(
      trimmed
    )}</p>`;
  }

  closeTable();
  closeLists();
  return html;
}

function renderHtmlTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  let tableHtml =
    '<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px;">';

  rows.forEach((row, index) => {
    const isHeader = index === 0;
    const bgColor = isHeader
      ? "#f3f4f6"
      : index % 2 === 0
      ? "#ffffff"
      : "#f9fafb";

    tableHtml += "<tr>";
    row.forEach((cell) => {
      const tag = isHeader ? "th" : "td";
      const fontWeight = isHeader ? "font-weight: 600;" : "";
      tableHtml += `<${tag} style="border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; ${fontWeight} background-color: ${bgColor};">${escapeHtml(
        cell
      )}</${tag}>`;
    });
    tableHtml += "</tr>";
  });

  tableHtml += "</table>";
  return tableHtml;
}

function makeDocxFilenameFromSubject(subject: string): string {
  const raw = (subject || "").replace(/[\r\n]+/g, " ").trim();
  const cleaned = raw
    // Remove filename-forbidden characters
    .replace(/[\\/?:%*|\"<>]/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  const base = cleaned.substring(0, 80).trim();
  return base ? `${base}.docx` : "AI4PM-Chat-Summary.docx";
}

function parseInlineMarkdownToRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const input = text ?? "";

  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;

  for (const match of input.matchAll(tokenRegex)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const plain = input.slice(lastIndex, index);
      if (plain) runs.push(new TextRun({ text: plain }));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
        })
      );
    } else {
      runs.push(new TextRun({ text: token }));
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < input.length) {
    const plain = input.slice(lastIndex);
    if (plain) runs.push(new TextRun({ text: plain }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: input }));
  }

  return runs;
}

// Split markdown into text + table chunks (keeps tables intact).
function parseContentForWord(
  content: string
): { type: "text" | "table"; data: string | string[][] }[] {
  const lines = content.split("\n");
  const sections: { type: "text" | "table"; data: string | string[][] }[] = [];
  let currentText = "";
  let inTable = false;
  let tableRows: string[][] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, "").trim();

    if (line.startsWith("|") && line.endsWith("|")) {
      // Skip separator rows
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }

      if (!inTable) {
        if (currentText.trim()) {
          sections.push({ type: "text", data: currentText.trim() });
          currentText = "";
        }
        inTable = true;
        tableRows = [];
      }

      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      tableRows.push(cells);
      continue;
    }

    if (inTable) {
      sections.push({ type: "table", data: tableRows });
      inTable = false;
      tableRows = [];
    }

    currentText += rawLine.replace(/\r/g, "") + "\n";
  }

  if (inTable) sections.push({ type: "table", data: tableRows });
  if (currentText.trim()) sections.push({ type: "text", data: currentText.trim() });

  return sections;
}

function createWordTable(rows: string[][]): Table {
  const tableRows = rows.map((row, rowIndex) => {
    return new TableRow({
      children: row.map((cell) => {
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
            fill:
              rowIndex === 0
                ? "E5E7EB"
                : rowIndex % 2 === 0
                ? "FFFFFF"
                : "F9FAFB",
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

function appendMarkdownText(children: (Paragraph | Table)[], textBlock: string) {
  const lines = textBlock.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, "");
    const trimmed = line.trim();

    if (!trimmed) {
      children.push(new Paragraph({ text: " ", spacing: { after: 120 } }));
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading =
        level === 1
          ? HeadingLevel.HEADING_2
          : level === 2
          ? HeadingLevel.HEADING_3
          : level === 3
          ? HeadingLevel.HEADING_4
          : HeadingLevel.HEADING_5;

      children.push(
        new Paragraph({
          heading,
          children: parseInlineMarkdownToRuns(headingMatch[2]),
          spacing: { before: 180, after: 120 },
        })
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineMarkdownToRuns(bulletMatch[1]),
          spacing: { after: 80 },
        })
      );
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      // Keep simple and reliable: render the number as text.
      children.push(
        new Paragraph({
          children: parseInlineMarkdownToRuns(trimmed),
          spacing: { after: 80 },
        })
      );
      continue;
    }

    children.push(
      new Paragraph({
        children: parseInlineMarkdownToRuns(trimmed),
        spacing: { after: 120 },
      })
    );
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function generateWordDoc(
  subject: string,
  chatContent: string,
  senderName: string,
  additionalNotes?: string
): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

  // Title: use the email subject so the document matches what the recipient expects.
  children.push(
    new Paragraph({
      text: subject?.trim() || "Notewell AI Chat Summary",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
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
      spacing: { before: 200, after: 120 },
    })
  );

  // Parse content for tables and text
  const contentSections = parseContentForWord(chatContent);

  for (const section of contentSections) {
    if (section.type === "table") {
      children.push(createWordTable(section.data as string[][]));
      children.push(new Paragraph({ text: " ", spacing: { after: 200 } }));
    } else {
      appendMarkdownText(children, section.data as string);
    }
  }

  // Additional notes if present
  if (additionalNotes?.trim()) {
    children.push(
      new Paragraph({
        text: "Additional Notes",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 120 },
      })
    );

    appendMarkdownText(children, additionalNotes);
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
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
    const {
      recipientEmails,
      subject,
      chatContent,
      senderName,
      additionalNotes,
      includeWordDoc = false,
    }: ChatEmailRequest = await req.json();

    console.log("Sending email to:", recipientEmails);
    console.log("Subject:", subject);
    console.log("Include Word doc:", includeWordDoc);

    if (!recipientEmails || recipientEmails.length === 0) {
      throw new Error("No recipient emails provided");
    }

    if (!chatContent) {
      throw new Error("No chat content provided");
    }

    // Convert markdown content to HTML for email
    const formattedContent = markdownToHtml(chatContent);
    const formattedNotes = additionalNotes ? markdownToHtml(additionalNotes) : "";

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
            code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; background: #f3f4f6; padding: 0 4px; border-radius: 4px; }
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
            ${additionalNotes ? `<div class="notes"><strong>Additional Notes:</strong><br>${formattedNotes}</div>` : ""}
            ${includeWordDoc ? `<div class="attachment-note">📎 A Word document version is attached to this email.</div>` : ""}
          </div>
          <div class="footer">
            <p>This email was sent from Notewell AI</p>
          </div>
        </body>
      </html>
    `;

    const emailOptions: any = {
      from: '"Notewell AI" <noreply@bluepcn.co.uk>',
      to: recipientEmails,
      subject: subject,
      html: html,
    };

    if (includeWordDoc) {
      console.log("Generating Word document with improved formatting...");
      const wordDocBuffer = await generateWordDoc(
        subject,
        chatContent,
        senderName,
        additionalNotes
      );

      const base64Content = uint8ToBase64(wordDocBuffer);
      const filename = makeDocxFilenameFromSubject(subject);

      emailOptions.attachments = [
        {
          filename,
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
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
