import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const { mode = "run", q } = payload as { mode?: string; q?: string };

    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Supabase service configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (mode === "query") {
      if (!perplexityKey) {
        return new Response(
          JSON.stringify({ success: false, error: "PERPLEXITY_API_KEY not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const query = (q || '').toString().slice(0, 500);
      const prompt = `Search the web now for the latest reliable announcements and news about: ${query}.
Rules:
- Prioritise authoritative UK sources (DHSC, NHS England, gov.uk, Parliament, official social posts) and reputable outlets.
- Return a concise HTML list where each item contains: <a href="URL">Title</a> — Source — Publication date — 1–2 sentence summary.
- UK English, neutral tone, no code fences.`;
      const resp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            { role: "system", content: "Be precise and concise. Return only clean HTML, no code fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 1600,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: "month",
          frequency_penalty: 1,
          presence_penalty: 0,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Perplexity API error: ${txt}`);
      }
      const data = await resp.json();
      let html: string = data?.choices?.[0]?.message?.content || '';
      html = html.replace(/^```html\n?|```$/g, '').trim();
      return new Response(
        JSON.stringify({ success: true, title: `Web results for: ${query}`, html }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (mode === "latest") {
      const { data, error } = await supabase
        .from("curated_news_pages")
        .select("id, title, html, created_at, digest_date")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, page: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // mode: run (default) - call Perplexity to generate curated HTML digest
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ success: false, error: "PERPLEXITY_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a news curator for GP practice managers in Northamptonshire, UK. Your task is to search the web and retrieve the 10 most relevant and recent news articles from today about:
- NHS Primary Care
- GP Practices
- Primary Care Networks (PCNs)
- Community services affecting GP workload
- NHS England and ICB announcements relevant to Northamptonshire
- Health policy changes impacting general practice
- Local health and social care developments

Rules:
1. Prioritise stories that directly affect Northamptonshire or East Midlands practices.
2. Include important national primary care news only if it has clear local impact or guidance implications.
3. For each article, output:
   - Title (as a clickable link)
   - Short summary (2–3 sentences, plain English)
   - Publication date
   - Source name
4. Group the articles into two sections:
   **Local / Northamptonshire News** and **National but Relevant to Local Practices**.
5. Ensure summaries are concise, neutral, and practical — focus on why a practice manager should care.
6. Exclude irrelevant topics, press releases without substance, and duplicate reports.
7. Format the output in clean HTML ready for embedding, using <h2> for section headings and <ul><li> for articles.`;

    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          { role: "system", content: "Be precise and concise. Return only clean HTML, no code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: "month",
        frequency_penalty: 1,
        presence_penalty: 0,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Perplexity API error: ${txt}`);
    }

    const data = await resp.json();
    let html: string = data?.choices?.[0]?.message?.content || "";
    html = html.replace(/^```html\n?|```$/g, "").trim();

    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: "Empty response from Perplexity" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = "Northamptonshire GP News";
    const { error: insertError } = await supabase
      .from("curated_news_pages")
      .insert({ title, html });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, title, html }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in nhs-gp-news function:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error?.message || error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
