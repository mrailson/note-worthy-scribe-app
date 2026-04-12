const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: hasRole } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "system_admin",
    });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { document_id, document_text } = await req.json();
    if (!document_id || !document_text) {
      return new Response(JSON.stringify({ error: "Missing document_id or document_text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate to ~30k chars to stay within context limits
    const truncated = document_text.slice(0, 30000);

    // Call Claude for summarisation
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a medical knowledge assistant. Extract from this NHS primary care document: a 2-3 sentence summary, and up to 6 key points as a JSON array. Return ONLY valid JSON: { "summary": "string", "key_points": ["string"] }`,
        messages: [{ role: "user", content: truncated }],
      }),
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      console.error("Claude API error:", err);
      // Update status to error
      await serviceClient
        .from("kb_documents")
        .update({ status: "error" })
        .eq("id", document_id);
      return new Response(JSON.stringify({ error: "AI summarisation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResp.json();
    const aiText = claudeData.content?.[0]?.text ?? "";

    // Parse JSON from Claude response
    let summary = "";
    let keyPoints: string[] = [];
    try {
      // Try to extract JSON from response (Claude sometimes wraps in markdown)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        summary = parsed.summary || "";
        keyPoints = Array.isArray(parsed.key_points) ? parsed.key_points : [];
      }
    } catch (e) {
      console.error("Failed to parse Claude JSON:", e, aiText);
      summary = aiText.slice(0, 500);
    }

    // Update kb_documents with summary and key_points
    const { error: updateError } = await serviceClient
      .from("kb_documents")
      .update({
        summary,
        key_points: keyPoints,
        status: "indexed",
      })
      .eq("id", document_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update document" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also store the document text as chunks for search
    const chunkSize = 2000;
    const chunks: { document_id: string; content: string; chunk_index: number }[] = [];
    for (let i = 0; i < truncated.length; i += chunkSize) {
      chunks.push({
        document_id,
        content: truncated.slice(i, i + chunkSize),
        chunk_index: Math.floor(i / chunkSize),
      });
    }

    if (chunks.length > 0) {
      // Delete existing chunks first
      await serviceClient.from("kb_chunks").delete().eq("document_id", document_id);
      // Insert new chunks
      const { error: chunkError } = await serviceClient.from("kb_chunks").insert(chunks);
      if (chunkError) {
        console.error("Chunk insert error:", chunkError);
      }
    }

    return new Response(JSON.stringify({ success: true, summary, key_points: keyPoints }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-summarise error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
