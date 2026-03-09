import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, context, conversationHistory } = await req.json();

    if (!question || !question.trim()) {
      throw new Error('Question is required');
    }

    // Get Lovable API key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `CRITICAL: You are analysing an uploaded document. You must ONLY state facts explicitly written in the document. Never guess, infer, or supplement with general knowledge.

Before providing any analysis:
1. State the exact document title as written
2. State how many pages you can see
3. State the first and last section headings visible

If you cannot read the document content, say: "I was unable to read this document. Please try re-uploading or converting to a different format."

When referencing details, cite the exact section/clause number. Never fabricate section titles or reference numbers. If you cannot find something, say so explicitly rather than guessing.

At the end of your response, include:
"Document coverage: [X] pages read. Sections covered: [list sections]."

You are a helpful AI assistant that answers questions about uploaded documents. 
You have access to the following document content:

${context || 'No documents uploaded yet.'}

ADDITIONAL DOCUMENT RULES:
1. ONLY state facts that are explicitly written in the document. If a section or detail is not visible to you, say "This section is not visible in the document provided" — do NOT guess or fill in from general knowledge.
2. When citing details, always reference the exact section number, clause number, or page where you found the information (e.g. "Section 3.7.7 states..." or "Page 45, Standing Order 4.7.1 specifies...").
3. NEVER invent section titles, rule numbers, or clause references. If you are unsure of a section number, say "the document states" without fabricating a reference.
4. If asked about content you cannot see in the document, respond with: "I cannot find information about [topic] in the pages visible to me. This may be in a section I cannot access, or it may not be covered in this document."
5. Do NOT supplement the document's content with general knowledge or typical wording. Your response must be based SOLELY on what is written in THIS specific document.

Use British English spelling. Be concise and helpful.`
      },
      ...(conversationHistory || []),
      {
        role: 'user',
        content: question
      }
    ];

    // Call Lovable AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        temperature: 0.7,
        max_completion_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('Credits exhausted. Please add credits to your Lovable workspace.');
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.';

    return new Response(
      JSON.stringify({ answer }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in document-qa-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process question' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
