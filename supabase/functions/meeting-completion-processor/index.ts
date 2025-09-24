import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NHS terminology cleaning rules
const NHS_CLEANING_RULES = [
  { find: /\bnhs\b/gi, replace: 'NHS' },
  { find: /\bcqc\b/gi, replace: 'CQC' },
  { find: /\bqof\b/gi, replace: 'QOF' },
  { find: /\bpcn\b/gi, replace: 'PCN' },
  { find: /\bics\b/gi, replace: 'ICS' },
  { find: /\bicb\b/gi, replace: 'ICB' },
  { find: /\barrs\b/gi, replace: 'ARRS' },
  { find: /\bdes\b/gi, replace: 'DES' },
  { find: /\blmc\b/gi, replace: 'LMC' },
  { find: /\bemis\b/gi, replace: 'EMIS' },
  { find: /\bsystmone\b/gi, replace: 'SystmOne' },
  { find: /\bnice\b/gi, replace: 'NICE' },
  { find: /\bbnf\b/gi, replace: 'BNF' },
  { find: /\bmhra\b/gi, replace: 'MHRA' },
  { find: /\bukhsa\b/gi, replace: 'UKHSA' },
  { find: /\bsnomed\b/gi, replace: 'SNOMED' },
  { find: /\bckd\b/gi, replace: 'CKD' },
  { find: /\bcopd\b/gi, replace: 'COPD' },
  { find: /\bhba1c\b/gi, replace: 'HbA1c' },
  { find: /\begfr\b/gi, replace: 'eGFR' },
  { find: /\bbp\b/gi, replace: 'BP' },
  { find: /\bhca\b/gi, replace: 'HCA' },
  { find: /\bmarac\b/gi, replace: 'MARAC' },
  { find: /\bppg\b/gi, replace: 'PPG' },
  { find: /\bp c n\b/gi, replace: 'PCN' },
  { find: /\ba r r s\b/gi, replace: 'ARRS' },
  { find: /\bd e s\b/gi, replace: 'DES' },
  { find: /\boak lane\b/gi, replace: 'Oak Lane' },
  { find: /\bmetformin\b/gi, replace: 'Metformin' },
  { find: /\bamlodipine\b/gi, replace: 'Amlodipine' },
  { find: /\bsertraline\b/gi, replace: 'Sertraline' },
  // Common NHS terminology corrections
  { find: /\bcaip\b/gi, replace: 'CAIP' },
  { find: /\bcape\b/gi, replace: 'CAIP' }, // Common misheard
  { find: /\bgp\b/gi, replace: 'GP' },
  { find: /\bdna\b/gi, replace: 'DNA' },
  { find: /\bmdt\b/gi, replace: 'MDT' },
  { find: /\bccg\b/gi, replace: 'CCG' }
];

function applyNHSCleaning(text: string): string {
  let cleaned = text;
  let appliedRules = 0;
  
  for (const rule of NHS_CLEANING_RULES) {
    const before = cleaned;
    cleaned = cleaned.replace(rule.find, rule.replace);
    if (cleaned !== before) appliedRules++;
  }
  
  console.log(`🏥 Applied ${appliedRules} NHS terminology corrections`);
  return cleaned;
}

function deduplicateTranscript(text: string): string {
  // Remove repetitive phrases and words
  const lines = text.split('\n');
  const deduped: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if this line is very similar to the previous one
    const prevLine = deduped[deduped.length - 1];
    if (prevLine && similarity(line, prevLine) > 0.8) {
      continue; // Skip very similar lines
    }
    
    deduped.push(line);
  }
  
  return deduped.join('\n');
}

function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

async function cleanTranscriptWithAI(text: string, openAIApiKey: string): Promise<string> {
  console.log('🤖 Using AI to clean transcript...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert transcript cleaner for NHS/GP practice meetings. Clean and improve transcribed text while preserving original meaning.

TASKS:
- Fix speech-to-text errors and unclear words using context
- Remove excessive filler words (um, uh, you know, etc.)
- Fix punctuation and capitalisation
- Correct NHS terminology (ensure CQC, QOF, PCN, ARRS, NHS, etc. are properly capitalised)
- Remove duplicate phrases and repetitions
- Ensure medical terms are accurate
- Fix grammar whilst preserving the speaker's intended meaning

PRESERVE:
- All factual information and medical details
- Speaker's tone and intent
- Technical terms and procedures
- Numbers, dates, and proper nouns
- NHS terminology and acronyms

Return ONLY the cleaned text without any additional commentary.`
        },
        {
          role: 'user',
          content: `Clean this NHS meeting transcript:\n\n${text}`
        }
      ],
      temperature: 0.3,
      max_tokens: Math.min(Math.ceil(text.length * 1.2), 4000)
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content.trim();
}

async function generateMeetingNotes(transcript: string, meetingTitle: string, meetingDate: string, openAIApiKey: string): Promise<string> {
  console.log('📝 Generating comprehensive meeting notes...');
  
  const systemPrompt = `You are an expert meeting notes assistant for NHS/GP practice meetings. Create comprehensive, professional meeting notes from the provided transcript.

CRITICAL LANGUAGE AND FORMATTING REQUIREMENTS:
- Use British English spelling: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst, amongst, programme, fulfil, learnt
- Use British date format: 31st August 2025 (include ordinal indicators)
- Use 24-hour time format: 14:30 rather than 2:30 PM
- Follow NHS/UK business conventions
- Ensure all NHS terminology is correctly capitalised (NHS, CQC, QOF, PCN, ARRS, etc.)

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

**EXECUTIVE SUMMARY**
Write 2-3 substantial paragraphs capturing:
- Main focus areas, initiatives, or programmes discussed  
- Key decisions made and their context
- Important timelines, deadlines, or milestones
- Critical issues, concerns, or challenges raised
- Financial, operational, or strategic implications

**ATTENDEES**
- List all participants mentioned

**KEY DISCUSSION POINTS**
1. Detailed breakdown of main topics with context and outcomes
2. Important themes, initiatives, or programmes covered
3. Clinical or operational matters discussed

**DECISIONS MADE**
- Specific decisions reached with reasoning
- Policy changes or strategic directions
- Clinical protocol updates

**ACTION ITEMS**
- Specific tasks with responsible parties and deadlines
- Follow-up activities and commitments
- Implementation steps

**MATTERS TO REVISIT**
- Items deferred for future consideration
- Outstanding issues requiring follow-up
- Strategic considerations for future meetings

**NEXT STEPS & FOLLOW-UP**
- Scheduled follow-up meetings and review dates
- Planned activities or programme continuations
- Important future milestones

Focus on clinical relevance, patient care implications, and operational efficiency.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Meeting Title: ${meetingTitle}
Meeting Date: ${meetingDate}

Transcript:
${transcript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2500
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { meetingId, forceReprocess = false } = await req.json();

    console.log('🚀 Starting unified meeting completion processing for:', meetingId);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error(`Meeting not found: ${meetingError?.message || 'Unknown error'}`);
    }

    // Check if already processed (unless forcing reprocess)
    if (!forceReprocess) {
      const { data: existingSummary } = await supabase
        .from('meeting_summaries')
        .select('id')
        .eq('meeting_id', meetingId)
        .single();

      if (existingSummary) {
        console.log('📄 Meeting already processed, skipping...');
        return new Response(
          JSON.stringify({ message: 'Meeting already processed', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update meeting status
    await supabase
      .from('meetings')
      .update({ notes_generation_status: 'generating' })
      .eq('id', meetingId);

    // Get transcript from all possible sources
    const { data: transcriptResult, error: transcriptError } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    if (transcriptError) {
      throw new Error(`Failed to fetch transcript: ${transcriptError.message}`);
    }

    const transcriptData = transcriptResult?.[0];
    let rawTranscript = transcriptData?.transcript || '';
    const transcriptSource = transcriptData?.source || 'unknown';

    console.log(`📄 Found transcript from ${transcriptSource}, ${rawTranscript.length} chars`);

    if (!rawTranscript.trim()) {
      throw new Error('No transcript available for processing');
    }

    // STEP 1: Deduplicate transcript
    console.log('🔄 Step 1: Deduplicating transcript...');
    let processedTranscript = deduplicateTranscript(rawTranscript);
    console.log(`✅ Deduplication: ${rawTranscript.length} → ${processedTranscript.length} chars`);

    // STEP 2: Apply NHS terminology corrections
    console.log('🏥 Step 2: Applying NHS terminology corrections...');
    processedTranscript = applyNHSCleaning(processedTranscript);

    // STEP 3: AI-powered cleaning for grammar and clarity
    console.log('🤖 Step 3: AI-powered transcript cleaning...');
    try {
      processedTranscript = await cleanTranscriptWithAI(processedTranscript, openAIApiKey);
      console.log(`✅ AI cleaning completed: ${processedTranscript.length} chars`);
    } catch (cleanError) {
      console.warn('⚠️ AI cleaning failed, continuing with NHS-corrected transcript:', cleanError.message);
    }

    // STEP 4: Generate comprehensive meeting notes
    console.log('📝 Step 4: Generating meeting notes...');
    const meetingDate = new Date(meeting.created_at);
    const day = meetingDate.getDate();
    const ordinalSuffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedDate = `${day}${ordinalSuffix(day)} ${months[meetingDate.getMonth()]} ${meetingDate.getFullYear()}`;

    const generatedNotes = await generateMeetingNotes(
      processedTranscript,
      meeting.title || 'Meeting',
      formattedDate,
      openAIApiKey
    );

    // Extract overview for meeting record
    const overviewMatch = generatedNotes.match(/\*\*EXECUTIVE SUMMARY\*\*\s*\n(.*?)(?=\n\*\*|$)/s);
    const overview = overviewMatch ? overviewMatch[1].trim() : 'Meeting notes generated successfully';

    // Calculate word count
    const wordCount = processedTranscript.split(/\s+/).filter(word => word.length > 0).length;

    // STEP 5: Save everything to database
    console.log('💾 Step 5: Saving results to database...');

    // Update meeting record
    await supabase
      .from('meetings')
      .update({
        transcript: processedTranscript,
        notes_generation_status: 'completed',
        word_count: wordCount,
        overview: overview,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    // Save meeting summary
    if (forceReprocess) {
      await supabase
        .from('meeting_summaries')
        .delete()
        .eq('meeting_id', meetingId);
    }

    await supabase
      .from('meeting_summaries')
      .insert({
        meeting_id: meetingId,
        summary: generatedNotes,
        key_points: [],
        action_items: [],
        decisions: [],
        next_steps: []
      });

    // Save overview
    await supabase
      .from('meeting_overviews')
      .upsert({
        meeting_id: meetingId,
        overview: overview
      });

    // Mark any queue entries as completed
    await supabase
      .from('meeting_notes_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId);

    console.log('🎉 Unified meeting processing completed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Meeting processing completed successfully',
        stats: {
          originalLength: rawTranscript.length,
          cleanedLength: processedTranscript.length,
          notesLength: generatedNotes.length,
          wordCount: wordCount,
          transcriptSource: transcriptSource
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unified meeting processing failed:', error);

    // Try to update meeting status to failed if we have a meetingId
    try {
      const { meetingId } = await req.json();
      if (meetingId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('meetings')
          .update({ notes_generation_status: 'failed' })
          .eq('id', meetingId);
      }
    } catch (updateError) {
      console.error('Failed to update meeting status to failed:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});