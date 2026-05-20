// Coded Findings Miner — Echo POC
// Read-and-report only. Does not persist documents or results.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `You are a clinical document analyst supporting a UK general practice. You are given the text or image of a SINGLE clinical document. It may be an echocardiogram report, a cardiology clinic letter, a hospital discharge summary, or something unrelated. Your job is to identify echocardiogram ("echo") findings that may need coding in the patient's record, and to separate them into two tracks.

RULES
- Report only what the document actually states. Never infer or invent values. If the ejection fraction is not stated, record it as "not stated".
- For every finding, quote the supporting text VERBATIM as the evidence snippet.
- Be conservative. If unsure whether something is an echo finding, set confidence to "low" and explain in uncertainty_notes.
- You are NOT making a diagnosis. For Track B you surface features only.
- Do NOT output any SNOMED code or concept ID. You classify findings only; the application will attach the verified code. If a finding does not fit any finding_key in the list, return finding_key: "other" with a short description in the "finding" field.

TRACK A — clearly stated, codeable findings
Structural or functional abnormalities the document states plainly. For each, return finding_key from this FIXED list ONLY:
  lvsd, lv_dilatation, rwma, lvh, mitral_regurg, aortic_stenosis, aortic_regurg, tricuspid_regurg
Also return severity as one of: none, mild, moderate, severe.

TRACK B — HFpEF pattern (evaluate, do NOT code)
The document describes a preserved or near-normal ejection fraction (typically LVEF >= 50%) TOGETHER WITH features of diastolic dysfunction or raised filling pressures — e.g. impaired LV relaxation, grade I-III diastolic dysfunction, elevated E/e' ratio, raised left atrial volume index (LAVI), restrictive filling pattern. For each, return finding_key as one of: diastolic_dysfunction, hfpef_pattern. Surface the pattern and recommend the clinician consider HFpEF assessment and SGLT2 inhibitor therapy where appropriate.

OUTPUT
Return ONLY valid JSON, no preamble, no markdown, in exactly this schema:
{
  "document_type": "echo report | clinic letter | discharge summary | other",
  "contains_echo_findings": true,
  "patient": {
    "name": "string or null",
    "date_of_birth": "string or null",
    "nhs_number": "string or null",
    "hospital_number": "string or null",
    "address": "string or null",
    "gender": "string or null"
  },
  "echo_date": "string or null",
  "reporting_site": "string or null",
  "lvef": {
    "value": "string or null",
    "category": "preserved | mildly reduced | moderately reduced | severely reduced | not stated"
  },
  "track_a_findings": [
    {
      "finding_key": "lvsd | lv_dilatation | rwma | lvh | mitral_regurg | aortic_stenosis | aortic_regurg | tricuspid_regurg | other",
      "finding": "short description (required if finding_key is 'other')",
      "severity": "none | mild | moderate | severe",
      "evidence_snippet": "verbatim text from the document",
      "confidence": "high | medium | low"
    }
  ],
  "track_b_flags": [
    {
      "finding_key": "diastolic_dysfunction | hfpef_pattern",
      "pattern": "string",
      "evidence_snippet": "verbatim text from the document",
      "rationale": "why this suggests HFpEF",
      "recommended_action": "Consider HFpEF assessment; SGLT2i where appropriate",
      "confidence": "high | medium | low"
    }
  ],
  "summary": "one-line plain-English summary of what was found",
  "uncertainty_notes": "any caveats, or empty string"
}

For "patient", extract demographic details verbatim from the document header/banner if present. Use null for any field not stated. Format NHS number with spaces (e.g. "123 456 7890") if present. Format date_of_birth as DD/MM/YYYY where possible.`;

function extractJson(raw: string): any {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

function tryParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return extractJson(raw);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const kind: "text" | "pdf" | "image" = body?.kind;
    const content: string = body?.content;
    const mediaType: string | undefined = body?.mediaType;

    if (!kind || !content) {
      return new Response(JSON.stringify({ error: "Missing kind or content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip any data URL prefix defensively
    const rawBase64 = content.replace(/^data:[^;]+;base64,/, "");

    let contentBlocks: any[];
    if (kind === "text") {
      contentBlocks = [
        {
          type: "text",
          text: `${content.slice(0, 60000)}\n\nAnalyse this document and return the JSON.`,
        },
      ];
    } else if (kind === "pdf") {
      contentBlocks = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: rawBase64 },
        },
        { type: "text", text: "Analyse this document and return the JSON." },
      ];
    } else if (kind === "image") {
      const mt = mediaType || "image/png";
      contentBlocks = [
        {
          type: "image",
          source: { type: "base64", media_type: mt, data: rawBase64 },
        },
        { type: "text", text: "Analyse this document and return the JSON." },
      ];
    } else {
      return new Response(JSON.stringify({ error: "Invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Anthropic error:", resp.status, errText);
      return new Response(
        JSON.stringify({ error: `Anthropic returned ${resp.status}`, detail: errText.slice(0, 1000) }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const text: string = (data?.content ?? [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    let parsed: any;
    try {
      parsed = tryParse(text);
    } catch {
      try {
        parsed = extractJson(text);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "Model returned invalid JSON", raw: text.slice(0, 1000) }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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
