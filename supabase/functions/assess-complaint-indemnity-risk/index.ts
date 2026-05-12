import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT_VERSION = "v1.0";
const MODEL = "google/gemini-3-flash-preview";

type RiskLevel = "green" | "amber" | "red";
type Recommendation = "no_action" | "consider_mdo" | "contact_mdo_now";
type Mdo = "mdu" | "mps" | "other" | "unknown";

interface AssessmentResult {
  risk_level: RiskLevel;
  recommendation: Recommendation;
  suggested_mdo: Mdo;
  rationale: string[];
  red_flags: string[];
  confidence: number;
}

// Heuristic floor — never let AI go below this risk
const RED_PATTERNS: { re: RegExp; flag: string }[] = [
  { re: /\b(died|death|deceased|fatal|mortality)\b/i, flag: "Patient death mentioned" },
  { re: /\b(coroner|inquest)\b/i, flag: "Coroner / inquest reference" },
  { re: /\b(solicitor|lawyer|legal action|sue|suing|litigation|claim against)\b/i, flag: "Legal action threatened or taken" },
  { re: /\b(safeguarding|child protection|vulnerable adult)\b/i, flag: "Safeguarding concern" },
  { re: /\b(GMC|NMC|CQC referral|police|professional standards)\b/i, flag: "Regulator or police involvement" },
  { re: /\b(serious harm|severe harm|permanent (injury|damage)|never event)\b/i, flag: "Serious / permanent harm" },
  { re: /\b(self[- ]?harm|suicide|overdose)\b/i, flag: "Self-harm / suicide reference" },
  { re: /\b(sepsis|stroke|cardiac arrest|cancer (missed|delayed))\b/i, flag: "Critical clinical event" },
];

const AMBER_PATTERNS: { re: RegExp; flag: string }[] = [
  { re: /\b(missed (diagnosis|fracture)|delayed diagnosis|misdiagnos)/i, flag: "Missed/delayed diagnosis" },
  { re: /\b(medication error|wrong (drug|dose|prescription)|prescribing error)\b/i, flag: "Medication / prescribing error" },
  { re: /\b(procedure|operation|injection|biopsy).{0,40}(injur|harm|complication|wrong)/i, flag: "Procedural injury" },
  { re: /\b(ombudsman|PHSO|parliamentary)\b/i, flag: "Ombudsman escalation" },
  { re: /\b(harm|injury|hospitalised|admitted to hospital)\b/i, flag: "Patient harm reported" },
  { re: /\b(consent (not|never) (given|obtained)|without consent)\b/i, flag: "Consent concern" },
  { re: /\b(referral (missed|lost|delayed)|referral not made)\b/i, flag: "Referral failure" },
  { re: /\b(test result|blood result|scan).{0,40}(missed|not (acted|reviewed)|lost|delayed)/i, flag: "Result handling failure" },
];

function heuristicFloor(text: string): { level: RiskLevel; flags: string[] } {
  const flags: string[] = [];
  let level: RiskLevel = "green";
  for (const { re, flag } of RED_PATTERNS) if (re.test(text)) { flags.push(flag); level = "red"; }
  if (level !== "red") {
    for (const { re, flag } of AMBER_PATTERNS) if (re.test(text)) { flags.push(flag); if (level === "green") level = "amber"; }
  }
  return { level, flags: Array.from(new Set(flags)) };
}

function escalate(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["green", "amber", "red"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function recForLevel(level: RiskLevel): Recommendation {
  if (level === "red") return "contact_mdo_now";
  if (level === "amber") return "consider_mdo";
  return "no_action";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { complaintId } = await req.json();
    if (!complaintId) throw new Error("complaintId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: complaint, error } = await supabase
      .from("complaints")
      .select("id, reference_number, category, subcategory, priority, complaint_title, complaint_description, staff_mentioned, location_service, incident_date, created_by")
      .eq("id", complaintId)
      .single();
    if (error || !complaint) throw new Error("Complaint not found");

    const { data: notes } = await supabase
      .from("complaint_notes")
      .select("note, is_internal, created_at")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true });

    const combinedText = [
      complaint.complaint_title,
      complaint.complaint_description,
      complaint.category,
      complaint.subcategory ?? "",
      ...(notes ?? []).map((n: any) => n.note),
    ].join("\n");

    const heur = heuristicFloor(combinedText);

    const userPrompt = `Assess the medico-legal risk to a UK GP practice from the following complaint, and recommend whether the practice should contact their Medical Defence Organisation (MDO) such as MDU, MPS or other.

Complaint reference: ${complaint.reference_number}
Category: ${complaint.category}${complaint.subcategory ? " / " + complaint.subcategory : ""}
Priority: ${complaint.priority}
Staff mentioned: ${(complaint.staff_mentioned ?? []).join(", ") || "none"}
Title: ${complaint.complaint_title}

Description:
${complaint.complaint_description}

Internal notes:
${(notes ?? []).filter((n: any) => n.is_internal).map((n: any) => "- " + n.note).join("\n") || "(none)"}

Heuristic pre-screen detected: ${heur.level.toUpperCase()}${heur.flags.length ? " — " + heur.flags.join("; ") : ""}.
You may upgrade the risk but never downgrade below the heuristic floor.

Respond with strictly valid JSON only, matching this shape:
{
  "risk_level": "green" | "amber" | "red",
  "recommendation": "no_action" | "consider_mdo" | "contact_mdo_now",
  "suggested_mdo": "mdu" | "mps" | "other" | "unknown",
  "rationale": ["short bullet", "short bullet"],
  "red_flags": ["short phrase"],
  "confidence": 0.0
}

British English. No prose outside JSON.`;

    const systemPrompt = `You are an advisory medico-legal triage assistant for a UK GP practice complaints team. You read a complaint and decide whether the practice should contact their Medical Defence Organisation.

Rules:
- Output JSON only — no markdown, no prose.
- Use British English.
- "red" = contact MDO now (death, serious harm, safeguarding, regulator, solicitor, coroner, threats of legal action).
- "amber" = consider MDO advice (missed/delayed diagnosis, medication error, procedural injury, Ombudsman, patient harm reported, consent issues).
- "green" = administrative / service complaint with no clinical harm or escalation indicators.
- Rationale: 2–4 short bullets, max ~15 words each, factual not evaluative.
- Red flags: short phrases describing detected escalation indicators.
- Confidence: 0.0–1.0.
- Always advisory: this never replaces an MDO call.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — add funds in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: AssessmentResult;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback to heuristic-only
      parsed = {
        risk_level: heur.level,
        recommendation: recForLevel(heur.level),
        suggested_mdo: "unknown",
        rationale: heur.flags.length ? heur.flags : ["No escalation indicators detected"],
        red_flags: heur.flags,
        confidence: 0.4,
      };
    }

    // Apply heuristic floor
    const finalLevel = escalate(heur.level, parsed.risk_level || "green");
    if (finalLevel !== parsed.risk_level) {
      parsed.risk_level = finalLevel;
      parsed.recommendation = recForLevel(finalLevel);
    }
    // Merge red flags
    parsed.red_flags = Array.from(new Set([...(parsed.red_flags ?? []), ...heur.flags]));
    parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5));

    // Persist
    const { data: upserted, error: upErr } = await supabase
      .from("complaint_indemnity_risk_assessments")
      .upsert(
        {
          complaint_id: complaint.id,
          risk_level: parsed.risk_level,
          recommendation: parsed.recommendation,
          suggested_mdo: parsed.suggested_mdo ?? "unknown",
          rationale: parsed.rationale ?? [],
          red_flags: parsed.red_flags ?? [],
          confidence: parsed.confidence,
          model: MODEL,
          prompt_version: PROMPT_VERSION,
          generated_at: new Date().toISOString(),
          is_stale: false,
          acknowledged_by: null,
          acknowledged_at: null,
        },
        { onConflict: "complaint_id" },
      )
      .select()
      .single();

    if (upErr) {
      console.error("Persist error:", upErr);
      throw new Error(upErr.message);
    }

    return new Response(JSON.stringify({ assessment: upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("assess-complaint-indemnity-risk error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
