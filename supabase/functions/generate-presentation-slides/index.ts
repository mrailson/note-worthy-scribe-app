import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, brief, slides, audience, practice, scheme, sourceFiles, pasteText } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const hasSource = (sourceFiles && sourceFiles.length > 0) || (pasteText && pasteText.trim());

    const system = `You are an NHS presentation writer producing board-level slides for UK primary care.
Return ONLY valid JSON. No markdown. No explanation. No code fences.
Structure:
{
  "title": "string",
  "subtitle": "string",
  "slides": [
    {
      "title": "string (max 8 words)",
      "bullets": ["string (concise, max 20 words each, max 4 bullets)"],
      "notes": "string (speaker note, 1-2 sentences)",
      "icon": "update|data|people|action|risk|finance|digital|clinical|governance|timeline|summary"
    }
  ]
}
Rules: exactly ${slides} content slides (not counting title/end). NHS professional tone. UK English. Audience: ${audience}.
${hasSource ? "Extract key points from the source material provided. Prioritise specifics: numbers, dates, names, decisions. Do not invent content not in the source." : ""}`;

    // Build user message content array
    const contentParts: any[] = [];

    // Attach any PDF files as document blocks
    const pdfFiles = (sourceFiles || []).filter((f: any) => f.type === "pdf");
    const textFiles = (sourceFiles || []).filter((f: any) => f.type === "text");

    for (const pdf of pdfFiles) {
      contentParts.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdf.b64 },
      });
    }

    // Build the text prompt
    let prompt = `Presentation title: "${title}"\nPractice/PCN: ${practice}\nColour scheme: ${scheme}\nRequested slides: ${slides}`;
    if (brief && brief.trim()) prompt += `\n\nBrief: ${brief}`;
    if (textFiles.length) {
      prompt += `\n\n--- SOURCE MATERIAL (extracted text) ---`;
      textFiles.forEach((f: any) => {
        prompt += `\n\n[File: ${f.name}]\n${(f.text || "").slice(0, 8000)}`;
      });
      prompt += `\n--- END SOURCE MATERIAL ---`;
    }
    if (pasteText && pasteText.trim()) {
      prompt += `\n\n--- PASTED SOURCE MATERIAL ---\n${pasteText.slice(0, 8000)}\n--- END ---`;
    }

    contentParts.push({ type: "text", text: prompt });

    console.log(`Generating ${slides} slides for "${title}" with ${pdfFiles.length} PDFs, ${textFiles.length} text files`);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: contentParts }],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Anthropic API error:", res.status, errorText);
      throw new Error(`Claude API error: ${res.status}`);
    }

    const d = await res.json();
    const raw = d.content?.[0]?.text || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
