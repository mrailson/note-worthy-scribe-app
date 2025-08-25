import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) throw new Error("OpenAI API key not configured");

    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      throw new Error("Missing required field: transcript");
    }

    // Light normalisation only (we're still a "prompt-only" solution):
    // - collapse excessive whitespace
    // - strip zero-width and control chars
    const input = transcript
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const SYSTEM_PROMPT = `
You are a **professional transcript cleaner** for UK NHS GP meetings.

Your objective:
- Remove duplicated or near-duplicated content caused by streaming/Whisper joins.
- Keep chronology and the speaker's meaning intact.
- Fix clear mistranscriptions of **known NHS terms**, keep UK spelling.
- Only minimal grammar/punctuation fixes to aid readability.
- **Do not paraphrase** beyond necessary fixes. Do not invent content.
- Output **only** the final cleaned transcript text (no headings, no commentary).

Cleaning rules (apply in order):

1) Sentence segmentation
   - Work sentence-by-sentence. Treat sentences split across lines as one if they clearly continue.
   - If a line ends mid-phrase and a near-identical complete sentence follows, keep the complete one.

2) Near-duplicate removal (Whisper joins)
   - Consider two sentences near-duplicates if they convey the same meaning with small wording changes.
   - If near-duplicates appear within ~5 sentences of each other, **keep one** (prefer the longer/clearer one) and drop the rest.
   - Examples of near-duplicates to collapse:
     • "We'll try to keep this to about half an hour…" vs "I'd like to keep this to about half an hour…"
     • "Does anyone have any urgent items to add…" vs "Any urgent items to add…"
     • "around 120 new registrations…" repeated twice with slight wording differences.

3) Fragment & filler filtering
   - Drop short stray fragments like isolated "No?" / "Okay." when they don't add content.
   - Keep genuine Q&A if the question/answer is meaningful.

4) NHS glossary fixes (case-sensitive where appropriate)
   - ARRS / ARS / ARR → **ARRS**
   - PCN DES / PCMDS / PCN DES payment / PCMDRS → **PCN DES**
   - CQC → **CQC**
   - ICB → **ICB**
   - DocMan / Docman → **Docman**
   - Systm One / System 1 / System One → **SystmOne**
   - PCN → **PCN**
   - same day → **same-day**
   - "repeat procedures" (when context is meds) → **repeat prescribing**
   - "duty doctor house" → **duty doctor hours**
   - Remove garbled tail words like "LTE" when tacked onto "frailty" ("home visiting and frailty").

5) Numbers & units
   - Keep numeric values as spoken (e.g., **12,600**, **£7,800**). Add commas/pound sign if clearly intended.

6) Tone
   - Keep the original voice. Minimal polish only. UK spelling.

Output format:
- **Plain text only.**
- Paragraphs separated by single blank lines.
- No preamble, no bullet list unless the input clearly contains one.
`;

    // Few-shot exemplars (greatly helps model consistency)
    const FEW_SHOT = `
[Example 1]
Input:
"We'll try to keep this to about half an hour if we can... First, just to check... First, just to check, does anyone have any urgent items to add to the agenda before we start? No? Okay, great, let's begin."

Output:
"We'll try to keep this to about half an hour if we can, though there are quite a few things to get through today. First, just to check, does anyone have any urgent items to add to the agenda before we start? No? Okay, great—let's begin."

[Example 2]
Input:
"Our current same day capacity is stretched already... Our current same-day capacity is stretched already, and last week we had days where we were well over the safe limits."

Output:
"Our current same-day capacity is already stretched, and last week we had days where we were well over the safe limits."

[Example 3]
Input:
"We've been trialling the new cloud-based telephony... the queuing system seems to be confusing patients. They think they're being cut off... We might need to add a clearer message or update the callback option."

Output:
"We've been trialling the new cloud-based telephony, and while call quality is better, the queuing system seems to be confusing patients. They think they're being cut off when actually they're in the queue. We might need to add a clearer message or update the callback option."

[Example 4]
Input:
"Systm One / System 1 alerts" → Output must be "SystmOne alerts".
`;

    const USER_PROMPT = `
Clean the following transcript according to the system rules. 
Return only the cleaned transcript between the delimiters.

<<<TRANSCRIPT>>
${input}
<<</TRANSCRIPT>>
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        presence_penalty: 0.0,
        frequency_penalty: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: FEW_SHOT },
          { role: "user", content: USER_PROMPT },
        ],
        // keep token budget reasonable; we only need the polished text
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", err);
      throw new Error(err?.error?.message || "OpenAI API error");
    }

    const data = await response.json();
    let cleanedTranscript: string = data?.choices?.[0]?.message?.content ?? "";

    // Final trim & sanity cleanup (remove model-added fences if any)
    cleanedTranscript = cleanedTranscript
      .replace(/^\s*```(?:text)?/i, "")
      .replace(/```$/i, "")
      .replace(/^\s*Cleaned transcript:\s*/i, "")
      .trim();

    return new Response(
      JSON.stringify({
        cleanedTranscript,
        originalLength: transcript.length,
        cleanedLength: cleanedTranscript.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in gpt-clean-transcript function:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
