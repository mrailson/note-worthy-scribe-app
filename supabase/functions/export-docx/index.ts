import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple markdown to HTML converter (since we can't use 'marked' in Deno edge functions)
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Lists (basic support)
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  
  // Wrap in paragraph tags
  if (!html.includes('<p>')) {
    html = '<p>' + html + '</p>';
  }
  
  // Basic table support
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('|')) {
      if (!inTable) {
        tableHtml += '<table>';
        inTable = true;
      }
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      const isHeader = i === 0 || (i > 0 && lines[i-1].includes('---'));
      const tag = isHeader ? 'th' : 'td';
      tableHtml += '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
    } else if (inTable) {
      tableHtml += '</table>';
      inTable = false;
    }
    
    if (!line.includes('|') && !line.includes('---')) {
      tableHtml += line;
    }
  }
  
  if (inTable) {
    tableHtml += '</table>';
  }
  
  return tableHtml || html;
}

// Simple HTML to DOCX converter (basic implementation)
function htmlToDocx(html: string): Uint8Array {
  // This is a very basic implementation
  // In a real application, you'd want to use a proper library
  const wordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
  
  return new TextEncoder().encode(wordXml);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { markdown, filename } = await req.json();

    if (typeof markdown !== "string" || !markdown.trim()) {
      return new Response(JSON.stringify({ error: "Body requires { markdown: string }" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Converting markdown to HTML...');
    const html = markdownToHtml(markdown);
    
    console.log('Creating Word document...');
    const page = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.4; }
  h1,h2,h3,h4 { margin: 0.6em 0 0.25em; color: #2c3e50; }
  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 16px; }
  p { margin: 0.3em 0 0.6em; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
  th, td { border: 1px solid #bbb; padding: 8px 12px; vertical-align: top; }
  th { background-color: #f8f9fa; font-weight: bold; }
  ul, ol { margin: 0.3em 0 0.6em 1.25em; }
  li { margin: 0.2em 0; }
  code { font-family: 'Courier New', monospace; background-color: #f1f1f1; padding: 2px 4px; }
  strong { font-weight: bold; }
  em { font-style: italic; }
</style>
</head><body>${html}</body></html>`;

    // For now, we'll return the HTML as a text file since creating proper DOCX is complex
    // In a production environment, you'd want to use a proper HTML to DOCX conversion library
    const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const encoder = new TextEncoder();
    const fileBuffer = encoder.encode(textContent);

    const safe = (filename || "meeting-notes").replace(/[^a-z0-9\-_]+/gi, "-");
    
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${safe}.txt"`,
      },
    });

  } catch (error) {
    console.error('Error in export-docx function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});