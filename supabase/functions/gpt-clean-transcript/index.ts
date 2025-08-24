import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY"); // optional now

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CleanOptions = {
  // live/final knobs
  liveThreshold?: number;   // not used here, but left for future
  liveWindow?: number;      // —
  finalThreshold?: number;  // similarity threshold 0..1
  finalWindow?: number;     // sentences to look back
  use_llm?: boolean;        // optional second pass (default false)
};

function normWS(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  // sentence end punctuation + next starts with likely sentence starter
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
    if (prevOpen && startsLower) {
      out[out.length - 1] = (prev + " " + s).replace(/\s+/g, " ");
    } else {
      out.push(s);
    }
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
    // Schemes / acronyms
    [/\bARS\b/gi, "ARRS"],
    [/\bIRS\b/gi, "ARRS"],
    [/\bARRS\b/gi, "ARRS"],
    [/\bPCN\s*DES\b/gi, "PCN DES"],
    [/\bPCM\s*D(AS|ES)?\b/gi, "PCN DES"],
    [/\bIIF\b/gi, "IIF"],
    [/\bQOF\b/gi, "QOF"],
    [/\bICB\b/gi, "ICB"],
    [/\bCQC\b/gi, "CQC"],
    // Systems / platforms
    [/\bDoc\s*man\b/gi, "Docman"],
    [/\bSystem\s*One\b/gi, "SystmOne"],
    [/\bSyst(?:em)?\s*1\b/gi, "SystmOne"],
    [/\bNHS app\b/gi, "NHS App"],
    // Common mis-hears seen in your data
    [/\bcall\s*cues\b/gi, "call queues"],
    [/\bcool\s*cues\b/gi, "call queues"],
    [/\bcall\s+que+e?s?\b/gi, "call queues"],
    [/\bsalary doctor\b/gi, "salaried doctor"],
    [/\bsalarictor\b/gi, "salaried doctor"],
    [/\bsmiles\b/gi, "SMRs"],
    [/\bsame day\b/gi, "same-day"],
    [/\bneighbo(u)?rhood\b/gi, "neighbourhood"],
    [/\bdocument workflow\b/gi, "Docman workflow"],
    [/\bstudy evil\b/gi, "study leave"],
    [/\bred(u|)ctions\b/gi, "redactions"],
    [/\bfridge(s)?\b/gi, "fridges"],
    // A few context-y ones from samples
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

async function maybeLLMSecondPass(cleaned: string): Promise<string> {
  if (!openAIApiKey) return cleaned;

  const system = "You are a transcript de-duplicator. Remove any remaining duplicated lines. Do not paraphrase or invent facts. Keep order, keep content. Only delete duplicates.";
  const user = `Transcript:\n${cleaned}\n\nReturn the transcript with duplicates removed.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_completion_tokens: 4000,
      temperature: 0
    }),
  });

  if (!resp.ok) {
    // If LLM fails, just return deterministic result
    return cleaned;
  }
  const data = await resp.json();
  const out = data?.choices?.[0]?.message?.content;
  if (!out || typeof out !== "string") return cleaned;
  return out.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, options }: { transcript?: string; options?: CleanOptions } = await req.json();
    if (!transcript || !transcript.trim()) {
      throw new Error("Missing required field: transcript");
    }

    const startLen = transcript.length;
    const thresh = options?.finalThreshold ?? 0.97;
    const win = options?.finalWindow ?? 15;
    const useLLM = options?.use_llm === true; // default false

    console.log(`🧹 Deterministic cleaning transcript, length: ${startLen}, threshold: ${thresh}, window: ${win}, useLLM: ${useLLM}`);

    // 1) Normalise
    let text = normWS(transcript);

    // 2) Join split halves
    const joined = joinHalfSentences(splitSentences(text)).join(" ");

    // 3) Strict dedupe
    let deduped = dedupeSentences(joined, thresh, win);

    // 4) NHS corrections
    deduped = applyNHSCorrections(deduped);

    // 5) Micro tidy
    let cleaned = finalPolish(microTidy(deduped));

    // 6) Optional GPT pass AFTER deterministic clean
    if (useLLM) {
      console.log("🤖 Running optional GPT second pass");
      cleaned = await maybeLLMSecondPass(cleaned);
    }

    console.log(`✅ Cleaning completed, output length: ${cleaned.length}, reduction: ${((1 - cleaned.length / startLen) * 100).toFixed(1)}%`);

    return new Response(JSON.stringify({
      cleanedTranscript: cleaned,
      originalLength: startLen,
      cleanedLength: cleaned.length,
      usedLLM: !!useLLM,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Cleaner error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});