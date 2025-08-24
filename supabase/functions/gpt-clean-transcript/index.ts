import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");          // optional (2nd pass)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // needed to read table

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CleanOptions = {
  finalThreshold?: number;
  finalWindow?: number;
  use_llm?: boolean;
};

type CorrectionRow = {
  id: string;
  user_id: string | null;
  practice_id?: string | null; // add this column if you want practice scoping
  incorrect_term: string;
  correct_term: string;
  context_phrase?: string | null;
  is_global: boolean;
  usage_count?: number | null;
};

const correctionsCache = new Map<string, { ts: number; rows: CorrectionRow[] }>();
const CACHE_TTL_MS = 60_000; // 1 minute

// ---------------- Deterministic cleaner (same as before) ----------------

function normWS(t: string) { return t.replace(/\s+/g, " ").trim(); }

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[A-Z""('[])/)
    .map(s => s.trim())
    .filter(Boolean);
}
function joinHalfSentences(sents: string[]): string[] {
  const out: string[] = [];
  for (const s of sents) {
    if (!out.length) { out.push(s); continue; }
    const prev = out[out.length - 1];
    const prevOpen = !/[.!?…]$/.test(prev);
    const startsLower = /^[a-z""(]/.test(s);
    if (prevOpen && startsLower) out[out.length - 1] = (prev + " " + s).replace(/\s+/g, " ");
    else out.push(s);
  }
  return out;
}
function grams(text: string, n: number): Set<string> {
  const w = text.toLowerCase().split(/\s+/);
  const set = new Set<string>();
  for (let i = 0; i <= w.length - n; i++) set.add(w.slice(i, i + n).join(" "));
  return set;
}
function jacc(A: Set<string>, B: Set<string>): number {
  const inter = [...A].filter(x => B.has(x)).length;
  const uni = new Set([...A, ...B]).size || 1;
  return inter / uni;
}
function sim(a: string, b: string): number {
  return Math.max(jacc(grams(a, 2), grams(b, 2)), jacc(grams(a, 3), grams(b, 3)));
}
function dedupeSentences(text: string, threshold: number, window: number): string {
  const sents = splitSentences(text);
  const out: string[] = [];
  for (const s of sents) {
    const recent = out.slice(-window);
    const isDup = recent.some(r => sim(r, s) >= threshold);
    if (!isDup) out.push(s);
  }
  return out.join(" ");
}
function applyNHSCorrections(text: string): string {
  const fixes: Array<[RegExp, string]> = [
    [/\bARS\b/gi, "ARRS"], [/\bIRS\b/gi, "ARRS"], [/\bARRS\b/gi, "ARRS"],
    [/\bPCN\s*DES\b/gi, "PCN DES"], [/\bPCM\s*D(AS|ES)?\b/gi, "PCN DES"],
    [/\bIIF\b/gi, "IIF"], [/\bQOF\b/gi, "QOF"], [/\bICB\b/gi, "ICB"], [/\bCQC\b/gi, "CQC"],
    [/\bDoc\s*man\b/gi, "Docman"], [/\bSystem\s*One\b/gi, "SystmOne"], [/\bSyst(?:em)?\s*1\b/gi, "SystmOne"],
    [/\bNHS app\b/gi, "NHS App"],
    [/\bcall\s*cues\b/gi, "call queues"], [/\bcool\s*cues\b/gi, "call queues"], [/\bcall\s+que+e?s?\b/gi, "call queues"],
    [/\bsalary doctor\b/gi, "salaried doctor"], [/\bsalarictor\b/gi, "salaried doctor"],
    [/\bsmiles\b/gi, "SMRs"], [/\bsame day\b/gi, "same-day"], [/\bneighbo(u)?rhood\b/gi, "neighbourhood"],
    [/\bdocument workflow\b/gi, "Docman workflow"], [/\bstudy evil\b/gi, "study leave"], [/\bred(u|)ctions\b/gi, "redactions"],
    [/\bfridge(s)?\b/gi, "fridges"],
    [/\bfastest paramedic\b/gi, "pharmacist paramedic"],
    [/\bfundamental health practitioner\b/gi, "first contact mental health practitioner"],
    [/\bSystem 1\b/g, "SystmOne"]
  ];
  let out = text;
  for (const [pat, rep] of fixes) out = out.replace(pat, rep);
  return out;
}
function microTidy(text: string): string {
  return text
    .replace(/\b(No\?\s+){2,}/gi, "No? ")
    .replace(/\s+,/g, ",")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function finalPolish(text: string): string {
  return text
    .replace(/(\baround\s+120 new registrations[^.]*\.)\s+\1/gi, "$1")
    .replace(/(list size is now just over\s*12,?600[^.]*\.)\s+\1/gi, "$1")
    .replace(/(we can'?t create more same-?day appointments[^.]*\.)\s+\1/gi, "$1")
    .trim();
}

// ---------------- Custom glossary (DB) ----------------

// Preserve casing of replacement to match source token style
function preserveCase(replacement: string, source: string): string {
  if (source.toUpperCase() === source) return replacement.toUpperCase();
  if (source.toLowerCase() === source) return replacement.toLowerCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// Safer than \b for hyphenated/numbered terms
const WB = String.raw`(?<![A-Za-z0-9])`;
const WE = String.raw`(?![A-Za-z0-9])`;

function buildRegex(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${WB}${esc}${WE}`, "gi");
}

async function fetchCorrections(practiceId?: string, userId?: string): Promise<CorrectionRow[]> {
  const key = `${practiceId || "_"}|${userId || "_"}`;
  const now = Date.now();
  const cached = correctionsCache.get(key);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.rows;

  const url = new URL(`/rest/v1/medical_term_corrections`, supabaseUrl);
  // Build OR filter: global OR practice OR user
  // If you don't have practice_id column, drop that part.
  const orParts = [`is_global.eq.true`];
  if (practiceId) orParts.push(`practice_id.eq.${practiceId}`);
  if (userId) orParts.push(`user_id.eq.${userId}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("or", `(${orParts.join(",")})`);
  url.searchParams.set("order", "usage_count.desc.nullslast");

  const resp = await fetch(url.toString(), {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });

  if (!resp.ok) {
    console.error("Failed to fetch corrections:", await resp.text());
    correctionsCache.set(key, { ts: now, rows: [] });
    return [];
  }

  const rows = await resp.json() as CorrectionRow[];
  console.log(`🔄 Loaded ${rows.length} corrections for practice:${practiceId}, user:${userId}`);
  correctionsCache.set(key, { ts: now, rows });
  return rows;
}

function applyUserCorrections(
  text: string,
  rows: CorrectionRow[],
): string {
  if (!rows?.length) return text;
  let out = text;
  let appliedCount = 0;

  for (const row of rows) {
    const from = row.incorrect_term?.trim();
    const to = row.correct_term?.trim();
    if (!from || !to) continue;
    // Avoid over-correcting single-letter "terms"
    if (from.length < 2) continue;

    const re = buildRegex(from);
    const initialText = out;

    if (row.context_phrase && row.context_phrase.trim().length >= 3) {
      // Only replace if context appears within ±80 chars
      const ctx = row.context_phrase.trim();
      const ctxRe = new RegExp(ctx.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      out = out.replace(re, (m, ...rest) => {
        const offset = (rest[rest.length - 2] as number) ?? 0;
        const windowStart = Math.max(0, offset - 80);
        const windowEnd = Math.min(out.length, offset + m.length + 80);
        const window = out.slice(windowStart, windowEnd);
        return ctxRe.test(window) ? preserveCase(to, m) : m;
      });
    } else {
      out = out.replace(re, (m) => preserveCase(to, m));
    }
    
    if (out !== initialText) {
      appliedCount++;
      console.log(`✅ Applied correction: "${from}" → "${to}"${row.context_phrase ? ` (context: "${row.context_phrase}")` : ''}`);
    }
  }
  
  console.log(`📝 Applied ${appliedCount}/${rows.length} custom corrections`);
  return out;
}

// ---------------- Optional LLM 2nd pass ----------------

async function maybeLLMSecondPass(cleaned: string): Promise<string> {
  if (!openAIApiKey) return cleaned;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a transcript de-duplicator. Remove remaining duplicates only. Do not paraphrase or invent content." },
        { role: "user", content: `Transcript:\n${cleaned}\n\nReturn the transcript with duplicates removed. Do not add or change words.` }
      ],
      temperature: 0,
      max_completion_tokens: 4000
    }),
  });
  if (!resp.ok) return cleaned;
  const data = await resp.json();
  const out = data?.choices?.[0]?.message?.content;
  return typeof out === "string" ? out.trim() : cleaned;
}

// ---------------- HTTP handler ----------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const transcript: string | undefined = body?.transcript;
    const options: CleanOptions | undefined = body?.options;
    const practiceId: string | undefined = body?.practiceId;
    const userId: string | undefined = body?.userId;

    if (!transcript || !transcript.trim()) throw new Error("Missing required field: transcript");

    const startLen = transcript.length;
    const thresh = options?.finalThreshold ?? 0.97;
    const win = options?.finalWindow ?? 15;
    const useLLM = options?.use_llm === true;

    console.log(`🧹 Deterministic cleaning transcript, length: ${startLen}, threshold: ${thresh}, window: ${win}, useLLM: ${useLLM}, practice: ${practiceId}, user: ${userId}`);

    // 1) Normalize
    let text = normWS(transcript);

    // 2) Join halves, strict dedupe
    const joined = joinHalfSentences(splitSentences(text)).join(" ");
    let deduped = dedupeSentences(joined, thresh, win);

    // 3) NHS corrections
    deduped = applyNHSCorrections(deduped);

    // 4) Per-practice/user corrections
    const rows = await fetchCorrections(practiceId, userId);
    let corrected = applyUserCorrections(deduped, rows);

    // 5) Tidy/polish
    let cleaned = finalPolish(microTidy(corrected));

    // 6) Optional LLM sweep (off by default)
    if (useLLM) {
      console.log("🤖 Running optional GPT second pass");
      cleaned = await maybeLLMSecondPass(cleaned);
    }

    console.log(`✅ Cleaning completed, output length: ${cleaned.length}, reduction: ${((1 - cleaned.length / startLen) * 100).toFixed(1)}%, custom corrections: ${rows.length}`);

    return new Response(JSON.stringify({
      cleanedTranscript: cleaned,
      originalLength: startLen,
      cleanedLength: cleaned.length,
      usedLLM: !!useLLM,
      appliedCustomCorrections: rows.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("Cleaner error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});