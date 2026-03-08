import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (action === 'generate_questions') {
      return await handleGenerateQuestions(body, LOVABLE_API_KEY);
    }

    if (action === 'generate_document') {
      return await handleGenerateDocument(body, LOVABLE_API_KEY);
    }

    if (action === 'refine_document') {
      return await handleRefineDocument(body, LOVABLE_API_KEY);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Document Studio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(messages: any[], apiKey: string, timeout = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        return { error: "Rate limit exceeded. Please try again shortly.", status: 429 };
      }
      if (response.status === 402) {
        return { error: "Usage limit reached. Please add credits.", status: 402 };
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return { error: "AI generation failed", status: 500 };
    }

    const data = await response.json();
    return { content: data.choices?.[0]?.message?.content || "" };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function handleGenerateQuestions(body: any, apiKey: string) {
  const { documentType, hasFiles, hasSupportingText } = body;

  const systemPrompt = `You are helping a GP practice user prepare a document. Generate 2-4 short clarifying questions to ensure the document meets their needs.

Return a JSON array of questions. Each question object has:
- "question": string
- "type": "text" or "pills"
- "options": string[] (only for pills type, 3-6 options)
- "multiSelect": boolean (only for pills)

Be practical, not bureaucratic. If the user has already uploaded files, ask fewer questions.
${hasFiles ? 'The user has already uploaded supporting files.' : ''}
${hasSupportingText ? 'The user has already provided supporting text.' : ''}`;

  const result = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Generate clarifying questions for this document request: ${documentType}` },
  ], apiKey);

  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse JSON from response
  try {
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ questions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleGenerateDocument(body: any, apiKey: string) {
  const {
    documentType,
    documentTypeName,
    systemPrompt: typeSystemPrompt,
    freeFormRequest,
    clarifyingAnswers,
    supportingText,
    fileContents,
    harmTriageResult,
    practiceContext,
  } = body;

  // Build the system prompt
  let systemPrompt = typeSystemPrompt || `You are generating a professional document for a UK GP practice. Follow these rules:

ANTI-FABRICATION RULE (HIGHEST PRIORITY):
Only include facts, data, and details explicitly provided in the user's inputs, uploaded files, and clarifying answers. If information is not provided, do not invent it. Write around gaps honestly.

LANGUAGE:
- British English throughout
- UK date format: "8 March 2026"
- NHS terminology

FORMAT:
- Professional flowing prose with clear headings
- Well-organised sections

TONE:
- Professional, clear, and practical`;

  // Add practice context
  if (practiceContext?.practiceName) {
    systemPrompt += `\n\nPRACTICE DETAILS:\n- Name: ${practiceContext.practiceName}`;
    if (practiceContext.practiceAddress) systemPrompt += `\n- Address: ${practiceContext.practiceAddress}`;
    if (practiceContext.practicePhone) systemPrompt += `\n- Phone: ${practiceContext.practicePhone}`;
    if (practiceContext.practiceEmail) systemPrompt += `\n- Email: ${practiceContext.practiceEmail}`;
    if (practiceContext.practiceWebsite) systemPrompt += `\n- Website: ${practiceContext.practiceWebsite}`;
    if (practiceContext.userName) systemPrompt += `\n- Author: ${practiceContext.userName}`;
    if (practiceContext.userRole) systemPrompt += `\n- Author Role: ${practiceContext.userRole}`;
  }

  // Add signature block if available
  if (practiceContext?.letterSignature) {
    systemPrompt += `\n\nSIGNATURE BLOCK (use at the end of letters/formal documents where a sign-off is appropriate):\n${practiceContext.letterSignature}`;
  }

  // Add harm triage context for Learning Events
  if (harmTriageResult) {
    systemPrompt += `\n\nHARM LEVEL: ${harmTriageResult}. This is a learning event with ${harmTriageResult} severity.`;
    if (harmTriageResult === 'no-harm' || harmTriageResult === 'moderate-harm') {
      systemPrompt += `\nInclude footer: "Reminder: Record this event on LFPSE if it involved actual or potential patient harm. https://record.learn-from-patient-safety-events.nhs.uk/"`;
    }
  }

  // Build user message
  let userMessage = `Generate a ${documentTypeName || 'professional document'}`;
  if (freeFormRequest) {
    userMessage += `\n\nUser request: ${freeFormRequest}`;
  }

  // Add clarifying answers
  if (clarifyingAnswers && Object.keys(clarifyingAnswers).length > 0) {
    userMessage += `\n\nUser's answers to clarifying questions:`;
    for (const [key, value] of Object.entries(clarifyingAnswers)) {
      const answerStr = Array.isArray(value) ? (value as string[]).join(', ') : value;
      if (answerStr) userMessage += `\n- ${answerStr}`;
    }
  }

  // Add supporting text
  if (supportingText) {
    userMessage += `\n\nSupporting information provided:\n${supportingText}`;
  }

  // Add file contents
  if (fileContents && fileContents.length > 0) {
    userMessage += `\n\nUploaded file contents:`;
    for (const fc of fileContents) {
      userMessage += `\n${fc}`;
    }
  }

  userMessage += `\n\nToday's date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const result = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], apiKey, 120000); // 2 min timeout for generation

  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate a concise title from the content
  let title = documentTypeName || 'Document';
  try {
    const titleResult = await callAI([
      { role: "system", content: "You are a document title generator. Given a document's content, return ONLY a short, professional title (5-10 words max). No quotes, no explanation, just the title. Use British English." },
      { role: "user", content: `Generate a title for this document:\n\n${result.content.slice(0, 1500)}` },
    ], apiKey, 15000);
    if (titleResult.content && !titleResult.error) {
      title = titleResult.content.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Keep default title on failure
  }

  return new Response(JSON.stringify({ content: result.content, title }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRefineDocument(body: any, apiKey: string) {
  const { currentContent, documentTitle, instruction } = body;

  if (!currentContent || !instruction) {
    return new Response(JSON.stringify({ error: "Missing content or instruction" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `You are a professional document editor for a UK GP practice. The user will provide a document and an edit instruction. Apply the instruction precisely and return the FULL revised document in the same format (markdown).

RULES:
- British English throughout
- Preserve the document structure and formatting
- Apply ONLY the requested changes — do not add unrequested content
- Return the complete document, not just the changed parts
- Do not wrap the output in code fences`;

  const userMessage = `Document title: ${documentTitle || 'Untitled'}

Current document:
${currentContent}

Edit instruction: ${instruction}

Return the full revised document.`;

  const result = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], apiKey, 120000);

  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ content: result.content }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
