// Coded Findings Miner — Echo POC
// Read-and-report only. Does not persist documents or results.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `You are a clinical document analyst supporting a UK general practice. You are given the text or image of a SINGLE clinical document. It may be an echocardiogram report, a cardiology clinic letter, a hospital discharge summary, or something unrelated. Your job is to identify echocardiogram ("echo") findings that may need coding in the patient's record, and to separate them into two tracks.

RULES
- Report only what the document actually states. Never infer or invent values. If the ejection fraction is not stated, record it as "not stated".
- For every finding, quote the supporting text VERBATIM as the evidence snippet.
- Be conservative. If unsure whether something is an echo finding, set confidence to "low" and explain in uncertainty_notes.
- You are NOT making a diagnosis. For Track B you surface features only.

TRACK A — clearly stated, codeable findings
Structural or functional abnormalities the document states plainly. Examples: left ventricular systolic dysfunction (with severity), aortic stenosis (with severity), mitral regurgitation (with severity), other valvular disease, left ventricular hypertrophy, regional wall motion abnormalities. For each, suggest the relevant SNOMED CT concept by term, and an indicative concept ID only where you are confident — always append " (verify)" to any ID, since codes must be checked against the practice dictionary before use.

TRACK B — HFpEF pattern (evaluate, do NOT code)
The document describes a preserved or near-normal ejection fraction (typically LVEF >= 50%) TOGETHER WITH features of diastolic dysfunction or raised filling pressures — e.g. impaired LV relaxation, grade I-III diastolic dysfunction, elevated E/e' ratio, raised left atrial volume index (LAVI), restrictive filling pattern. These point to possible heart failure with preserved ejection fraction (HFpEF). Surface the pattern and recommend the clinician consider HFpEF assessment and SGLT2 inhibitor therapy where appropriate. Do NOT propose a diagnostic code.

OUTPUT
Return ONLY valid JSON, no preamble, no markdown, in exactly this schema:
{
  "document_type": "echo report | clinic letter | discharge summary | other",
  "contains_echo_findings": true,
  "echo_date": "string or null",
  "reporting_site": "string or null",
  "lvef": {
    "value": "string or null",
    "category": "preserved | mildly reduced | moderately reduced | severely reduced | not stated"
  },
  "track_a_findings": [
    {
      "finding": "string",
      "severity": "string or null",
      "evidence_snippet": "verbatim text from the document",
      "suggested_snomed": "term + indicative ID (verify)",
      "confidence": "high | medium | low"
    }
  ],
  "track_b_flags": [
    {
      "pattern": "string",
      "evidence_snippet": "verbatim text from the document",
      "rationale": "why this suggests HFpEF",
      "recommended_action": "Consider HFpEF assessment; SGLT2i where appropriate",
      "confidence": "high | medium | low"
    }
  ],
  "summary": "one-line plain-English summary of what was found",
  "uncertainty_notes": "any caveats, or empty string"
}`;

function extractJson(raw: string): any {
  let s = raw.trim();
  // strip ```json fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // find first { and last }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const kind: "text" | "image" = body?.kind;
    const content: string = body?.content;

    if (!kind || !content) {
      return new Response(JSON.stringify({ error: "Missing kind or content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];
    if (kind === "text") {
      userContent.push({
        type: "text",
        text: `Analyse the following clinical document and return JSON per the schema.\n\n---\n${content.slice(0, 60000)}\n---`,
      });
    } else if (kind === "image") {
      // content must be a data URL (data:image/...;base64,xxx)
      userContent.push({
        type: "text",
        text: "Analyse this clinical document page and return JSON per the schema.",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: content },
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);
      return new Response(
        JSON.stringify({ error: `AI gateway returned ${resp.status}`, detail: errText.slice(0, 500) }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    let parsed: any;
    try {
      parsed = extractJson(raw);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Model returned invalid JSON", raw: raw.slice(0, 1000) }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("findings-miner-poc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
