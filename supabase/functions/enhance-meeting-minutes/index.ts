import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitise action item owners to prevent hallucinations
function sanitiseActionOwners(notes: string, transcript: string): string {
  if (!notes || !transcript) return notes;
  let sanitisedCount = 0;
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasExplicitAssignment = (text: string, name: string): boolean => {
    if (!text || !name) return false;
    const escaped = escapeRegExp(name);
    const nameWord = `\\b${escaped}\\b`;
    const patterns = [
      new RegExp(`${nameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
      new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${nameWord}`, 'i'),
      new RegExp(`${nameWord}.*(?:responsible|owner|lead)`, 'i'),
      new RegExp(`assign(?:ed)?\\s+to\\s+${nameWord}`, 'i')
    ];
    const firstName = name.split(/\s+/)[0];
    if (firstName && firstName !== name) {
      const firstNameWord = `\\b${escapeRegExp(firstName)}\\b`;
      const firstNamePatterns = [
        new RegExp(`${firstNameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
        new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${firstNameWord}`, 'i'),
        new RegExp(`assign(?:ed)?\\s+to\\s+${firstNameWord}`, 'i')
      ];
      if (firstNamePatterns.some(p => p.test(text))) return true;
    }
    return patterns.some(p => p.test(text));
  };
  try {
    const actionHeaderMatch = notes.match(/(?:^|\n)(?:#{1,6}\s*|\d+\.\s*)ACTION ITEMS\b[\s\S]*/i);
    if (!actionHeaderMatch) return notes;
    const afterHeader = actionHeaderMatch[0];
    const headerIdx = notes.indexOf(afterHeader);
    const tableMatch = afterHeader.match(/\n\|.*\|\n\|[-:\s|]+\|\n([\s\S]*?)(?:\n(?:#{1,6}\s|\d+\.\s|$))/);
    if (!tableMatch) return notes;
    const tableHeader = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf('\n', tableMatch[0].indexOf('\n') + 1));
    const headerCells = tableHeader.split('\n')[0].split('|').map(c => c.trim()).filter(Boolean);
    const ownerColumnIdx = headerCells.findIndex(h => /responsible|owner|lead|assignee/i.test(h));
    if (ownerColumnIdx === -1) return notes;
    const tableRows = tableMatch[1].split('\n').map(r => r.trim()).filter(r => r.startsWith('|') && r.length > 2);
    const rebuiltRows = tableRows.map(row => {
      const cells = row.split('|').map(c => c.trim());
      if (cells.length > ownerColumnIdx + 1) {
        const responsible = cells[ownerColumnIdx + 1];
        if (responsible && responsible.toUpperCase() !== 'TBC' && responsible.trim() !== '') {
          if (!hasExplicitAssignment(transcript, responsible)) {
            cells[ownerColumnIdx + 1] = 'TBC';
            sanitisedCount++;
          }
        }
      }
      return cells.join(' | ');
    });
    const beforeTable = notes.substring(0, headerIdx + (tableMatch.index || 0));
    const tableStart = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf(tableMatch[1]));
    const afterTable = afterHeader.substring((tableMatch.index || 0) + tableMatch[0].length);
    const reconstructed = beforeTable + tableStart + rebuiltRows.join('\n') + '\n' + afterTable;
    if (sanitisedCount > 0) {
      console.log(`✅ Sanitiser (enhance): set ${sanitisedCount} owner(s) to TBC`);
    }
    return reconstructed;
  } catch (error) {
    console.warn('⚠️ Error sanitising action owners:', error);
    return notes;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { originalContent, enhancementType, specificRequest, context, useTranscript, meetingId } = await req.json();

    if (!originalContent || !enhancementType) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: originalContent and enhancementType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Size guard: Check content length
    const MAX_CONTENT_LENGTH = 25000; // 25k characters max
    if (originalContent.length > MAX_CONTENT_LENGTH) {
      console.error(`❌ Content too large: ${originalContent.length} characters`);
      return new Response(
        JSON.stringify({ 
          error: `Content too large to enhance (${originalContent.length} characters). Maximum is ${MAX_CONTENT_LENGTH} characters.`,
          contentLength: originalContent.length,
          maxLength: MAX_CONTENT_LENGTH
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Enhancement request: type=${enhancementType}, content length=${originalContent.length}, meetingId=${meetingId || 'none'}`);

    let transcriptContext = '';
    const MAX_TRANSCRIPT_LENGTH = 15000; // Limit transcript context to 15k characters
    
    // Fetch meeting transcript if requested and meeting ID is provided
    if (useTranscript && meetingId && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        console.log('📋 Fetching transcript for context...');
        const { data: transcriptData, error: transcriptError } = await supabase
          .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

        if (!transcriptError && transcriptData && transcriptData.length > 0) {
          let transcript = transcriptData[0].transcript;
          if (transcript && transcript.trim()) {
            // Truncate transcript if too long
            if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
              console.log(`⚠️ Transcript too long (${transcript.length} chars), truncating to ${MAX_TRANSCRIPT_LENGTH}`);
              transcript = transcript.substring(0, MAX_TRANSCRIPT_LENGTH) + '\n\n[Transcript truncated due to length...]';
            }
            transcriptContext = `\n\nMEETING TRANSCRIPT FOR REFERENCE:\n${transcript}`;
            console.log(`✅ Fetched transcript context (${transcript.length} chars)`);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching transcript:', error);
        // Continue without transcript if there's an error
      }
    }

    // Final size check after adding transcript context
    const totalContentLength = originalContent.length + transcriptContext.length;
    if (totalContentLength > 35000) {
      console.error(`❌ Total content too large: ${totalContentLength} characters (content: ${originalContent.length}, transcript: ${transcriptContext.length})`);
      return new Response(
        JSON.stringify({ 
          error: 'Combined content and transcript too large to process. Try enhancing without transcript context.',
          totalLength: totalContentLength
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    // Define different enhancement types
    switch (enhancementType) {
      case 'make_detailed':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to take existing meeting minutes and make them more detailed and comprehensive while maintaining accuracy. Add relevant context, expand on key points, and provide more thorough explanations. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please make the following meeting minutes more detailed and comprehensive using British English spelling. Expand on key points, add relevant context, and provide more thorough explanations:\n\n${originalContent}${transcriptContext}`;
        break;

      case 'add_quotes':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to enhance meeting minutes by adding realistic and appropriate direct quotes where they would naturally occur. The quotes should be professional, contextually appropriate, and enhance the clarity of decisions and discussions. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please enhance the following meeting minutes by adding realistic direct quotes where appropriate using British English spelling. The quotes should sound natural and professional:\n\n${originalContent}${transcriptContext}`;
        break;

      case 'replace_content':
        systemPrompt = `You are an expert meeting minutes editor. Your task is to make specific replacements or modifications to meeting minutes based on user requests while maintaining the overall structure and professionalism of the document. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please modify the following meeting minutes according to this request using British English spelling: "${specificRequest}"\n\nOriginal content:\n${originalContent}${transcriptContext}`;
        break;

      case 'improve_clarity':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to improve the clarity and readability of meeting minutes while maintaining all the original information. Make the content more professional, well-organised, and easier to understand. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please improve the clarity and readability of the following meeting minutes using British English spelling. Make them more professional and well-organised:\n\n${originalContent}${transcriptContext}`;
        break;

      case 'add_structure':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to improve the structure and organisation of meeting minutes by adding proper headings, sections, and formatting while maintaining all original content. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please improve the structure and organisation of the following meeting minutes by adding proper headings, sections, and formatting using British English spelling:\n\n${originalContent}${transcriptContext}`;
        break;

      case 'make_professional':
        systemPrompt = `You are an expert meeting minutes enhancer. Transform meeting minutes into highly professional, formal business documents suitable for board meetings or official records. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please transform the following meeting minutes into a highly professional, formal business document using British English spelling:\n\n${originalContent}${transcriptContext}`;
        break;

      case 'make_concise':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to make meeting minutes more concise and to-the-point while retaining all critical information and decisions. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please make the following meeting minutes more concise while retaining all critical information using British English spelling:\n\n${originalContent}${transcriptContext}`;
        break;

      case 'add_action_items':
        systemPrompt = `You are an expert meeting minutes enhancer. Identify and highlight action items, decisions, and follow-up tasks from meeting content, organising them clearly. Use "Matters to Revisit" for any deferred or unresolved items (never use "Parking Lot"). ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).

STRICT RULES FOR ACTION ITEMS:
- ONLY list action owners if they are EXPLICITLY stated in the content/transcript
- NEVER infer or make up who is responsible
- If owner is not explicitly stated, write "TBC"
- If deadline is not explicitly stated, write "TBC"`;
        userPrompt = `Please identify and clearly organise all action items, decisions, follow-up tasks, and matters to revisit from these meeting minutes using British English spelling. Apply the strict rules above:

${originalContent}${transcriptContext}`;
        break;

      case 'nhs_format':
        systemPrompt = `You are an expert in NHS meeting documentation standards. Format meeting minutes according to NHS governance and documentation standards with proper clinical and administrative structure. Use "Matters to Revisit" for deferred items, never "Parking Lot". ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please format the following meeting minutes according to NHS governance standards using British English spelling, ensuring any deferred items are listed under "Matters to Revisit":\n\n${originalContent}${transcriptContext}`;
        break;

      case 'board_ready':
        systemPrompt = `You are an expert meeting minutes enhancer. Transform meeting content into board-ready format with executive summaries, key decisions highlighted, and professional presentation. Use "Matters to Revisit" for any deferred or follow-up items (never use "Parking Lot"). ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).`;
        userPrompt = `Please transform the following meeting minutes into board-ready format using British English spelling, ensuring deferred items are under "Matters to Revisit":\n\n${originalContent}${transcriptContext}`;
        break;

      case 'custom':
        systemPrompt = `You are an expert meeting minutes enhancer. Your task is to modify meeting minutes according to specific user requests while maintaining professionalism and accuracy. ALWAYS use British English spelling (organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme).

CRITICAL: If the original content contains HTML markup with CSS classes (such as prose, text-foreground, mb-3, font-semibold, etc.), you MUST preserve ALL HTML tags, CSS classes, and styling exactly as they appear in the original. Only modify the text content itself whilst keeping the entire HTML structure, class names, and formatting intact.`;
        userPrompt = `Please modify the following meeting minutes according to this specific request using British English spelling: "${specificRequest}"

IMPORTANT: The content below contains HTML markup with CSS classes. You must preserve ALL HTML tags, class attributes, and styling exactly as they appear. Only modify the text content whilst maintaining the complete HTML structure.

Original content:
${originalContent}${transcriptContext}`;
        break;

      default:
        throw new Error('Invalid enhancement type');
    }

    // Add context if provided
    if (context) {
      userPrompt += `\n\nAdditional context: ${context}`;
    }

    console.log('Enhancing meeting minutes with type:', enhancementType);

    const modelName = 'o4-mini-2025-04-16';
    const startedAt = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        // temperature and max_tokens removed for model compatibility
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const elapsedMs = Date.now() - startTime;
      console.error(`❌ OpenAI API error (${elapsedMs}ms):`, errorData);
      
      return new Response(
        JSON.stringify({ 
          error: `AI enhancement failed: ${errorData.error?.message || 'Unknown error'}`,
          details: errorData
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let enhancedContent = data.choices[0].message.content;

    // Apply sanitiser for add_action_items enhancement
    if (enhancementType === 'add_action_items' && transcriptContext) {
      enhancedContent = sanitiseActionOwners(enhancedContent, transcriptContext);
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`✅ Successfully enhanced meeting minutes (${elapsedMs}ms), output length: ${enhancedContent.length}`);

    return new Response(JSON.stringify({
      enhancedContent,
      processingTime: elapsedMs,
      model: modelName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    const elapsedMs = Date.now() - startTime;
    console.error(`❌ Enhancement error (${elapsedMs}ms):`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to enhance meeting minutes',
        processingTime: elapsedMs
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});