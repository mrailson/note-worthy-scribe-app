import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    const payload = await req.json();
    const transcript = payload?.transcript;
    const chunkSize = Math.max(200, Math.min(2000, Number(payload?.chunkSize || payload?.options?.chunkSize || 1000)));
    if (!transcript) {
      throw new Error('Missing required field: transcript');
    }

    console.log('🧹 Lovable AI transcript cleaning, length:', transcript.length);

    // Helper functions for chunking
    const splitIntoSentences = (text: string): string[] => {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (!normalized) return [];
      const parts = normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/g);
      return parts.filter((s) => s && s.trim().length > 0);
    };

    const chunkByWords = (text: string, maxWords: number): string[] => {
      const words = text.trim().split(/\s+/);
      const chunks: string[] = [];
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
      }
      return chunks;
    };

    // Create chunks ~chunkSize words, preferring sentence boundaries
    const sentences = splitIntoSentences(transcript);
    let chunks: string[] = [];
    if (sentences.length > 1) {
      let current: string[] = [];
      let count = 0;
      for (const s of sentences) {
        const w = s.trim().split(/\s+/).filter(Boolean).length;
        if (count + w > chunkSize && current.length > 0) {
          chunks.push(current.join(' ').trim());
          current = [s];
          count = w;
        } else {
          current.push(s);
          count += w;
        }
      }
      if (current.length) chunks.push(current.join(' ').trim());
    } else {
      chunks = chunkByWords(transcript, chunkSize);
    }

    console.log(`🧩 Chunking transcript into ${chunks.length} parts (chunkSize≈${chunkSize} words)`);

    const systemMessage = 'You are a transcript cleaner. Delete duplicates/fragments only, no paraphrasing. Format into paragraphs with blank lines between.';
    const cleanedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const instructions = `
You will receive chunk ${i + 1} of ${chunks.length} from an NHS GP meeting transcript.

Rules:
- Remove duplicate/near-duplicate text and stray fragments (e.g., clipped starts).
- Preserve meaning and order exactly as spoken.
- Format into readable paragraphs with a BLANK LINE between paragraphs.
- Do NOT paraphrase, summarize, add headings, or add transitions.
- Keep NHS terms exactly: "ARRS", "PCN DES", "SystmOne", "Docman", "CQC compliance", "QOF".

Chunk:
${chunk}

Cleaned chunk:
`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: instructions }
          ],
          max_completion_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Lovable AI error (chunk ${i + 1}/${chunks.length}):`, errorData);
        throw new Error(`Lovable AI error on chunk ${i + 1}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const normalized = raw.replace(/\r\n/g, '\n').trim().replace(/\n{3,}/g, '\n\n');
      cleanedChunks.push(normalized);
    }

    const merged = cleanedChunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

    console.log('✅ Lovable AI cleaning completed', {
      chunks: chunks.length,
      chunkSize,
      inputLength: transcript.length,
      outputLength: merged.length
    });

    return new Response(JSON.stringify({ 
      cleanedTranscript: merged,
      originalLength: transcript.length,
      cleanedLength: merged.length,
      chunks: chunks.length,
      chunkSize
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-clean-transcript function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});