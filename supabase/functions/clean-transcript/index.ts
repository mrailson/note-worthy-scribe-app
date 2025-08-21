import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Simple duplicate word removal function
 * Only removes exact duplicate words that appear consecutively
 */
function removeDuplicateWords(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  console.log('🔍 Starting deduplication process');
  console.log('🔍 Input length:', text.length);
  
  // Split into words while preserving spaces and punctuation context
  const words = text.split(/(\s+)/); // This preserves whitespace in the array
  const result: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const currentWord = words[i];
    
    // Always keep whitespace and punctuation
    if (/^\s+$/.test(currentWord)) {
      result.push(currentWord);
      continue;
    }
    
    // For actual words, check for consecutive duplicates
    const prevWord = i > 1 ? words[i - 2] : null; // Skip whitespace
    const normalizedCurrent = currentWord.toLowerCase().replace(/[^\w]/g, '');
    const normalizedPrev = prevWord ? prevWord.toLowerCase().replace(/[^\w]/g, '') : null;
    
    // Only skip if it's an exact duplicate of the previous word
    if (normalizedCurrent && normalizedPrev && normalizedCurrent === normalizedPrev && normalizedCurrent.length > 2) {
      console.log('🔍 Removing duplicate word:', currentWord);
      continue;
    }
    
    result.push(currentWord);
  }
  
  let cleaned = result.join('');
  
  // Remove common repeated phrases that are obviously duplicated
  const commonDuplicates = [
    /(\b[Tt]his meeting is being recorded\b.*?)(\b[Tt]his meeting is being recorded\b)/gi,
    /(\b[Tt]his is a recording of the meeting\b.*?)(\b[Tt]his is a recording of the meeting\b)/gi,
    /(\b[Tt]his is a recording\b.*?)(\b[Tt]his is a recording\b)/gi,
  ];
  
  commonDuplicates.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '$1');
  });
  
  // Clean up multiple spaces but preserve single spaces
  cleaned = cleaned.replace(/[ ]{3,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  console.log('🔍 Deduplication complete');
  console.log('🔍 Output length:', cleaned.length);
  console.log('🔍 Reduction:', text.length - cleaned.length, 'characters');
  
  return cleaned.trim();
}

/**
 * Remove only obvious phrase repetitions
 */
function removeRepeatedPhrases(text: string): string {
  // Split into sentences
  const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
  const result: string[] = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const current = sentences[i].trim().toLowerCase();
    
    // Skip if it's just punctuation
    if (/^[.!?]+$/.test(current)) {
      result.push(sentences[i]);
      continue;
    }
    
    // Check if this sentence is a near-duplicate of the previous one
    let isDuplicate = false;
    for (let j = Math.max(0, i - 4); j < i; j++) {
      const previous = sentences[j].trim().toLowerCase();
      if (previous.length > 10 && current.length > 10) {
        // Calculate similarity
        const similarity = calculateSimilarity(current, previous);
        if (similarity > 0.85) {
          console.log('🔍 Removing duplicate phrase:', sentences[i].substring(0, 50));
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      result.push(sentences[i]);
    }
  }
  
  return result.join('');
}

/**
 * Simple similarity calculation
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawTranscript, meetingTitle } = await req.json();

    if (!rawTranscript) {
      throw new Error('Missing required field: rawTranscript');
    }

    console.log('🧹 Cleaning transcript for:', meetingTitle || 'Meeting');
    console.log('🧹 Input transcript length:', rawTranscript.length);
    console.log('🧹 Input transcript preview:', rawTranscript.substring(0, 200));

    // Step 1: Remove duplicate words
    let cleaned = removeDuplicateWords(rawTranscript);
    
    // Step 2: Remove repeated phrases
    cleaned = removeRepeatedPhrases(cleaned);
    
    console.log('🧹 Successfully cleaned transcript');
    console.log('🧹 Output transcript length:', cleaned.length);
    console.log('🧹 Output transcript preview:', cleaned.substring(0, 200));
    console.log('🧹 Compression ratio:', ((rawTranscript.length - cleaned.length) / rawTranscript.length * 100).toFixed(1) + '%');

    return new Response(JSON.stringify({ 
      cleanedTranscript: cleaned,
      originalLength: rawTranscript.length,
      cleanedLength: cleaned.length,
      compressionRatio: ((rawTranscript.length - cleaned.length) / rawTranscript.length * 100).toFixed(1) + '%'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in clean-transcript function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});