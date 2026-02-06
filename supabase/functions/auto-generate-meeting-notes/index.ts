import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

// Large transcript cleaning functions
function splitTextIntoChunks(text: string, target = 3500, overlap = 200): string[] {
  if (text.length <= target) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);

    // try to end on a sentence boundary
    const boundary = text.lastIndexOf('.', end);
    if (boundary > start + target * 0.6) {
      end = boundary + 1;
    } else {
      const q = text.lastIndexOf('?', end);
      const e = text.lastIndexOf('!', end);
      const best = Math.max(q, e);
      if (best > start + target * 0.6) end = best + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function dedupeBoundary(prev: string, next: string): string {
  // Remove duplicated overlap from start of next if present
  const tail = prev.slice(-220);
  if (!tail) return next;
  const normalizedTail = tail.replace(/\s+/g, ' ').trim();
  let candidate = next;
  for (let k = 220; k >= 80; k -= 20) {
    const t = normalizedTail.slice(-k);
    const re = new RegExp('^' + escapeRegExp(t).replace(/\s+/g, '\\s+'));
    if (re.test(candidate.replace(/\s+/g, ' ').trim())) {
      // strip the matching prefix (approximate)
      const idx = candidate.toLowerCase().indexOf(t.toLowerCase());
      if (idx === 0) {
        return candidate.slice(t.length).trimStart();
      }
    }
  }
  return next;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeCleanedChunks(chunks: string[]): string {
  if (chunks.length === 0) return '';
  let out = chunks[0].trim();
  for (let i = 1; i < chunks.length; i++) {
    const cleanedNext = dedupeBoundary(out, chunks[i]);
    out = `${out}\n\n${cleanedNext.trim()}`;
  }
  return out.trim();
}

async function cleanLargeTranscript(
  rawTranscript: string,
  meetingTitle: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string> {
  const chunks = splitTextIntoChunks(rawTranscript, 3500, 200);
  const results: string[] = new Array(chunks.length);

  // Process chunks sequentially to avoid overwhelming the system
  for (let i = 0; i < chunks.length; i++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/gpt-clean-transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: chunks[i] }),
      });

      if (response.ok) {
        const data = await response.json();
        results[i] = data.cleanedTranscript || chunks[i];
      } else {
        results[i] = chunks[i]; // fallback to original chunk
      }
    } catch (error) {
      console.warn(`⚠️ Failed to clean chunk ${i + 1}/${chunks.length}:`, error);
      results[i] = chunks[i]; // fallback to original chunk
    }
  }

  return mergeCleanedChunks(results);
}

/**
 * Fuzzy deduplicate attendee names between card and transcript lists.
 * Prioritizes card attendees and adds transcript participants that don't match.
 * 
 * @param cardNames - Names from meeting_attendees table (explicit)
 * @param transcriptNames - Names from meeting.participants (detected)
 * @returns Merged list with card names first, deduplicated
 */
function fuzzyDeduplicate(cardNames: string[], transcriptNames: string[]): string[] {
  if (!transcriptNames || transcriptNames.length === 0) {
    return cardNames;
  }
  
  // Normalize function for fuzzy matching
  const normalize = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  };
  
  // Start with card names (these take priority)
  const result: string[] = [...cardNames];
  const normalizedCardNames = new Set(cardNames.map(normalize));
  
  // Add transcript names that don't fuzzy-match any card names
  for (const transcriptName of transcriptNames) {
    const normalizedTranscript = normalize(transcriptName);
    
    // Check if this transcript name fuzzy-matches any card name
    let isDuplicate = false;
    for (const normalizedCard of normalizedCardNames) {
      if (normalizedTranscript === normalizedCard) {
        isDuplicate = true;
        break;
      }
    }
    
    // Add if not a duplicate
    if (!isDuplicate) {
      result.push(transcriptName);
      normalizedCardNames.add(normalizedTranscript);
    }
  }
  
  return result;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingId, forceRegenerate = false, detailLevel = 'standard', noteType = 'standard', transcriptSource } = await req.json();
    console.log('🤖 Auto-generating notes for meeting:', meetingId, 'at detail level:', detailLevel, 'with note type:', noteType, 'using transcript source:', transcriptSource || 'auto');

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Add retry logic for race conditions - wait a moment for the meeting to be fully committed
    let meeting;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      // Get meeting details with retry logic - explicitly select context fields
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*, agenda, participants, meeting_context, meeting_location, meeting_format')
        .eq('id', meetingId)
        .maybeSingle();

      if (meetingError) {
        console.error('❌ Database error fetching meeting:', meetingError);
        throw new Error(`Database error: ${meetingError.message}`);
      }

      if (meetingData) {
        meeting = meetingData;
        break;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`⏳ Meeting not found, retrying in 2s (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('❌ Meeting not found after all retries:', meetingId);
        throw new Error(`Meeting not found with ID: ${meetingId}`);
      }
    }

    // Validate meeting has transcript data before proceeding
    const { data: initialTranscriptCheck } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });
    
    const initialTranscriptData = initialTranscriptCheck?.[0];
    const hasTranscript = initialTranscriptData?.transcript && initialTranscriptData.transcript.trim().length > 0;
    
    if (!hasTranscript) {
      console.log('⚠️ Meeting found but no transcript available yet, will retry later');
      return new Response(
        JSON.stringify({ message: 'Meeting has no transcript yet, will retry later', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if notes already exist and we're not forcing regeneration
    if (!forceRegenerate) {
      const { data: existingSummary } = await supabase
        .from('meeting_summaries')
        .select('id')
        .eq('meeting_id', meetingId)
        .single();

      if (existingSummary) {
        console.log('📝 Notes already exist for meeting, skipping generation');
        return new Response(
          JSON.stringify({ message: 'Notes already exist', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update meeting status to generating
    await supabase
      .from('meetings')
      .update({ notes_generation_status: 'generating' })
      .eq('id', meetingId);

    // Get transcript based on transcriptSource parameter
    let fullTranscript = '';
    let actualTranscriptSource = 'unknown';
    let itemCount = 0;

    if (transcriptSource === 'best_of_all') {
      // Use Best of All (3-engine merged + deduped) transcript
      console.log('📄 User requested Best of All transcript');
      const { data: meetingTranscript } = await supabase
        .from('meetings')
        .select('best_of_all_transcript')
        .eq('id', meetingId)
        .single();
      
      fullTranscript = meetingTranscript?.best_of_all_transcript || '';
      actualTranscriptSource = 'best_of_all';
      
      // Fallback to consolidated if best_of_all is empty
      if (!fullTranscript.trim()) {
        console.log('⚠️ Best of All transcript empty, falling back to consolidated');
        // Fall through to consolidated logic below
      }
    }
    
    if ((transcriptSource === 'best_of_all' && !fullTranscript.trim()) || transcriptSource === 'consolidated') {
      // Use BOTH transcripts for consolidated "Best of Both" notes generation
      console.log('📄 User requested consolidated dual-transcript mode');
      const { data: meetingTranscript } = await supabase
        .from('meetings')
        .select('whisper_transcript_text, assembly_transcript_text, live_transcript_text, title, meeting_location, meeting_format')
        .eq('id', meetingId)
        .single();
      
      const batchTranscript = meetingTranscript?.whisper_transcript_text || '';
      const liveTranscript = meetingTranscript?.assembly_transcript_text || meetingTranscript?.live_transcript_text || '';
      
      if (batchTranscript.trim() && liveTranscript.trim()) {
        // Call the consolidated notes edge function
        console.log('🔀 Calling generate-consolidated-meeting-notes with both transcripts...');
        console.log('📊 Batch:', batchTranscript.length, 'chars, Live:', liveTranscript.length, 'chars');
        
        // Fetch attendees for the consolidated notes
        const { data: cardAttendees } = await supabase
          .from('meeting_attendees')
          .select(`
            attendee:attendees (
              name,
              organization
            )
          `)
          .eq('meeting_id', meetingId);
        
        const attendeeList = cardAttendees
          ?.map(item => {
            if (item.attendee?.organization) {
              return `${item.attendee.name} (${item.attendee.organization})`;
            }
            return item.attendee?.name;
          })
          .filter(Boolean) || [];
        
        const consolidatedResponse = await fetch(`${supabaseUrl}/functions/v1/generate-consolidated-meeting-notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batchTranscript,
            liveTranscript,
            meetingId,
            meetingTitle: meeting.title,
            meetingDate: meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null,
            meetingTime: meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null,
            meetingLocation: meetingTranscript?.meeting_location,
            attendees: attendeeList,
            detailLevel
          })
        });
        
        if (consolidatedResponse.ok) {
          const consolidatedResult = await consolidatedResponse.json();
          
          if (consolidatedResult.success && consolidatedResult.content) {
            console.log('✅ Consolidated notes generated successfully');
            console.log('📊 Stats:', consolidatedResult.stats);
            
            // Save the consolidated notes to database
            const { error: updateError } = await supabase
              .from('meetings')
              .update({ 
                notes_style_3: consolidatedResult.content,
                notes_generation_status: 'completed',
                primary_transcript_source: 'consolidated'
              })
              .eq('id', meetingId);
            
            if (updateError) {
              console.error('❌ Failed to save consolidated notes:', updateError);
            }
            
            // Also save to meeting_summaries
            await supabase
              .from('meeting_summaries')
              .upsert({
                meeting_id: meetingId,
                summary: consolidatedResult.content,
                summary_type: 'consolidated',
                model_used: 'gemini-2.5-flash',
                updated_at: new Date().toISOString()
              }, { onConflict: 'meeting_id' });
            
            return new Response(
              JSON.stringify({ 
                success: true, 
                content: consolidatedResult.content,
                source: 'consolidated',
                stats: consolidatedResult.stats
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Fallback if consolidated generation failed
        console.log('⚠️ Consolidated generation failed, falling back to batch transcript');
        fullTranscript = batchTranscript;
        actualTranscriptSource = 'whisper_fallback';
      } else {
        // Not enough transcripts for consolidated mode
        console.log('⚠️ Both transcripts required for consolidated mode, falling back');
        fullTranscript = batchTranscript || liveTranscript;
        actualTranscriptSource = batchTranscript ? 'whisper_fallback' : 'assembly_fallback';
      }
    } else if (transcriptSource === 'whisper') {
      // Use Whisper (batch) transcript directly from meetings table
      console.log('📄 User requested Whisper (batch) transcript');
      const { data: meetingTranscript } = await supabase
        .from('meetings')
        .select('whisper_transcript_text')
        .eq('id', meetingId)
        .single();
      
      fullTranscript = meetingTranscript?.whisper_transcript_text || '';
      actualTranscriptSource = 'whisper';
      
      // Fallback to assembly if whisper is empty
      if (!fullTranscript.trim()) {
        console.log('⚠️ Whisper transcript empty, falling back to AssemblyAI');
        const { data: fallback } = await supabase
          .from('meetings')
          .select('assembly_transcript_text, live_transcript_text')
          .eq('id', meetingId)
          .single();
        fullTranscript = fallback?.assembly_transcript_text || fallback?.live_transcript_text || '';
        actualTranscriptSource = 'assembly_fallback';
      }
    } else if (transcriptSource === 'assembly') {
      // Use AssemblyAI (live) transcript directly from meetings table
      console.log('📄 User requested AssemblyAI (live) transcript');
      const { data: meetingTranscript } = await supabase
        .from('meetings')
        .select('assembly_transcript_text, live_transcript_text')
        .eq('id', meetingId)
        .single();
      
      fullTranscript = meetingTranscript?.assembly_transcript_text || meetingTranscript?.live_transcript_text || '';
      actualTranscriptSource = 'assembly';
      
      // Fallback to whisper if assembly is empty
      if (!fullTranscript.trim()) {
        console.log('⚠️ AssemblyAI transcript empty, falling back to Whisper');
        const { data: fallback } = await supabase
          .from('meetings')
          .select('whisper_transcript_text')
          .eq('id', meetingId)
          .single();
        fullTranscript = fallback?.whisper_transcript_text || '';
        actualTranscriptSource = 'whisper_fallback';
      }
    } else {
      // Auto mode: prefer best_of_all_transcript first, then fall back to RPC
      console.log('📄 Auto mode: checking best_of_all_transcript first...');
      const { data: boaCheck } = await supabase
        .from('meetings')
        .select('best_of_all_transcript')
        .eq('id', meetingId)
        .single();
      
      if (boaCheck?.best_of_all_transcript && boaCheck.best_of_all_transcript.trim().length > 50) {
        console.log('✅ Auto mode: using best_of_all_transcript');
        fullTranscript = boaCheck.best_of_all_transcript;
        actualTranscriptSource = 'best_of_all';
      } else {
        console.log('📄 Using auto transcript selection via get_meeting_full_transcript');
        const { data: finalTranscriptResult, error: transcriptError } = await supabase
          .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

        if (transcriptError) {
          console.error('❌ Error fetching transcript:', transcriptError);
          await supabase
            .from('meetings')
            .update({ notes_generation_status: 'failed' })
            .eq('id', meetingId);
          throw new Error(`Failed to fetch transcript: ${transcriptError.message}`);
        }

        const transcriptData = finalTranscriptResult?.[0];
        fullTranscript = transcriptData?.transcript || '';
        itemCount = transcriptData?.item_count || 0;
      }
    }
    
    console.log(`📄 Using transcript from ${actualTranscriptSource}, ${fullTranscript.length} chars`);
    
    if (!fullTranscript.trim()) {
      console.log('⚠️ No transcript found for meeting');
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
      
      throw new Error('No transcript available for notes generation');
    }

    console.log('📄 Raw transcript length:', fullTranscript.length, 'chars');

    // Fetch explicit attendees added to the meeting card with their organizations
    const { data: cardAttendees, error: attendeesError } = await supabase
      .from('meeting_attendees')
      .select(`
        attendee:attendees (
          name,
          organization
        )
      `)
      .eq('meeting_id', meetingId);

    if (attendeesError) {
      console.warn('⚠️ Error fetching meeting_attendees:', attendeesError);
    }

    // Fetch uploaded meeting documents (agenda, supporting docs, etc.)
    let documentContext = '';
    try {
      const { data: meetingDocuments, error: docsError } = await supabase
        .from('meeting_documents')
        .select('id, file_name, file_path, file_type, description')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (docsError) {
        console.warn('⚠️ Error fetching meeting_documents:', docsError);
      } else if (meetingDocuments && meetingDocuments.length > 0) {
        console.log('📄 Found', meetingDocuments.length, 'uploaded documents');
        
        // Download and extract text from text-based documents
        for (const doc of meetingDocuments) {
          if (doc.file_path) {
            const isTextBasedDoc = doc.file_type && (
              doc.file_type.startsWith('text/') ||
              doc.file_type === 'application/json' ||
              doc.file_type.includes('word') ||
              doc.file_type.includes('document') ||
              doc.file_type === 'application/pdf' // PDFs contain extractable text
            );

            if (isTextBasedDoc) {
              try {
                console.log('📥 Downloading document:', doc.file_name);
                const { data: fileData, error: downloadError } = await supabase.storage
                  .from('meeting-documents')
                  .download(doc.file_path);

                if (!downloadError && fileData) {
                  // For text files, extract content directly
                  if (doc.file_type?.startsWith('text/') || doc.file_type === 'application/json') {
                    const text = await fileData.text();
                    if (text && text.trim()) {
                      const label = doc.description || doc.file_name;
                      documentContext += `\n--- UPLOADED DOCUMENT: ${label} ---\n${text.trim()}\n`;
                      console.log('✅ Extracted text from:', doc.file_name, '(', text.length, 'chars)');
                    }
                  }
                  // For Word docs and PDFs, call extract-document-text edge function
                  else if (doc.file_type?.includes('pdf') || doc.file_type?.includes('word') || doc.file_type?.includes('document')) {
                    try {
                      console.log('📄 Extracting text from PDF/Word document:', doc.file_name);
                      
                      // Convert blob to base64 data URL
                      const arrayBuffer = await fileData.arrayBuffer();
                      const uint8Array = new Uint8Array(arrayBuffer);
                      let binary = '';
                      for (let i = 0; i < uint8Array.length; i++) {
                        binary += String.fromCharCode(uint8Array[i]);
                      }
                      const base64 = btoa(binary);
                      const mimeType = doc.file_type || 'application/octet-stream';
                      const dataUrl = `data:${mimeType};base64,${base64}`;
                      
                      // Determine file type for extraction
                      const fileType = doc.file_type?.includes('pdf') ? 'pdf' : 'powerpoint';
                      
                      // Call extract-document-text edge function
                      const supabaseUrl = Deno.env.get('SUPABASE_URL');
                      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
                      
                      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-document-text`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${supabaseServiceKey}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          fileType: fileType,
                          dataUrl: dataUrl,
                          fileName: doc.file_name
                        })
                      });
                      
                      if (extractResponse.ok) {
                        const extractResult = await extractResponse.json();
                        if (extractResult.extractedText && extractResult.extractedText.trim()) {
                          const label = doc.description || doc.file_name;
                          documentContext += `\n--- UPLOADED DOCUMENT: ${label} ---\n${extractResult.extractedText.trim()}\n`;
                          console.log('✅ Extracted text from document:', doc.file_name, extractResult.extractedText.length, 'chars');
                        } else {
                          console.warn('⚠️ No text extracted from document:', doc.file_name);
                          const label = doc.description || doc.file_name;
                          documentContext += `\n--- UPLOADED DOCUMENT: ${label} ---\n[Document uploaded but text extraction failed]\n`;
                        }
                      } else {
                        const errorText = await extractResponse.text();
                        console.warn('⚠️ Extract-document-text failed for:', doc.file_name, extractResponse.status, errorText);
                        const label = doc.description || doc.file_name;
                        documentContext += `\n--- UPLOADED DOCUMENT: ${label} ---\n[Document uploaded: ${doc.file_name}]\n`;
                      }
                    } catch (extractError) {
                      console.warn('⚠️ Error extracting text from document:', doc.file_name, extractError);
                      const label = doc.description || doc.file_name;
                      documentContext += `\n--- UPLOADED DOCUMENT: ${label} ---\n[Document uploaded: ${doc.file_name}]\n`;
                    }
                  }
                }
              } catch (docError) {
                console.warn('⚠️ Failed to download document:', doc.file_name, docError);
              }
            }
          }
        }
      }
    } catch (docsError) {
      console.warn('⚠️ Error processing meeting documents:', docsError);
    }

    // Extract names and organizations from the join result
    interface AttendeeInfo {
      name: string;
      organization?: string;
    }
    
    // ONLY use explicitly added attendees from the database
    // Do NOT extract attendees from transcript to avoid picking up names of people discussed
    const cardAttendeeDetails: AttendeeInfo[] = cardAttendees
      ?.map(item => ({
        name: item.attendee?.name,
        organization: item.attendee?.organization
      }))
      .filter((item): item is AttendeeInfo => Boolean(item.name)) || [];

    console.log('👥 Explicit attendees from database:', cardAttendeeDetails.length, cardAttendeeDetails);

    // Determine final attendee list - ONLY use explicit attendees or TBC
    let attendeeWithOrg: string[];
    if (cardAttendeeDetails.length >= 1) {
      // Format attendees with organizations
      attendeeWithOrg = cardAttendeeDetails.map(attendee => {
        if (attendee.organization) {
          return `${attendee.name} (${attendee.organization})`;
        }
        return attendee.name;
      });
      
      console.log('✅ Using explicit attendees:', attendeeWithOrg.length, attendeeWithOrg);
    } else {
      // No explicit attendees - use TBC
      attendeeWithOrg = ['TBC'];
      console.log('✅ No explicit attendees - using TBC');
    }

    // Calculate word count for the meeting
    const wordCount = fullTranscript.split(/\s+/).filter(word => word.length > 0).length;
    console.log('📊 Word count:', wordCount);

    // Smart cleaning strategy: skip for small/medium transcripts
    let cleanedTranscript = fullTranscript;
    let transcriptUsed = 'raw';
    const transcriptLength = fullTranscript.length;
    
    console.log('📊 Transcript length:', transcriptLength, 'chars (~', Math.round(transcriptLength / 4), 'words)');
    
    // Only clean very large transcripts (>500K chars)
    // Gemini Flash can handle up to ~2M tokens, so most transcripts don't need cleaning
    if (transcriptLength < 500000) {
      console.log('⚡ Skipping cleaning - transcript within Gemini context window');
      cleanedTranscript = fullTranscript;
      transcriptUsed = 'raw-optimized';
    } else {
      // Very large transcript - use cleaning
      try {
        console.log('🧹 Large transcript detected (>500K chars), using Lovable AI cleaning...');
        cleanedTranscript = await cleanLargeTranscript(fullTranscript, meeting.title, supabaseUrl, supabaseServiceKey);
        transcriptUsed = 'lovable-cleaned';
        console.log('✅ Cleaning completed:', fullTranscript.length, '→', cleanedTranscript.length, 'chars');
      } catch (cleanError) {
        console.warn('⚠️ Transcript cleaning failed, using original:', cleanError.message);
        cleanedTranscript = fullTranscript;
        transcriptUsed = 'raw-fallback';
      }
    }

    console.log('📄 Using', transcriptUsed, 'transcript for notes generation');

    // Detail level instructions for note generation
    const detailInstructions: Record<string, string> = {
      'brief': `
DETAIL LEVEL: BRIEF
- Focus ONLY on key decisions and action items
- Executive summary: 1-2 sentences maximum
- Discussion summary: Maximum 3 bullet points
- Skip the Background section
- Keep total notes to approximately 300 words`,
      
      'summary': `
DETAIL LEVEL: SUMMARY
- Concise coverage of main discussion points
- Executive summary: 2-3 sentences
- Discussion summary: 4-5 key points only
- Brief background context
- Keep total notes to approximately 500 words`,
      
      'standard': `
DETAIL LEVEL: STANDARD
- Complete meeting notes with all relevant details
- Follow the full format as specified
- Include all sections with appropriate detail
- Keep total notes to approximately 800 words`,
      
      'detailed': `
DETAIL LEVEL: DETAILED
- Comprehensive notes with full context
- Expanded executive summary with key quotes
- Thorough discussion of all points raised
- Include nuances and alternative viewpoints mentioned
- Keep total notes to approximately 1200 words`,
      
      'full': `
DETAIL LEVEL: FULL
- Exhaustive documentation of the meeting
- Include relevant quotes from participants
- Document all discussion threads completely
- Include timestamps for major discussion shifts
- Capture all context, concerns, and considerations
- No word limit - be comprehensive`
    };

    const selectedDetailInstruction = detailInstructions[detailLevel] || detailInstructions['standard'];
    console.log('📊 Using detail level:', detailLevel);

    // Note type instructions for different output formats
    const noteTypeInstructions: Record<string, string> = {
      'standard': `
NOTE TYPE: STANDARD PROFESSIONAL
- Use the default format structure as specified
- Balanced coverage of all meeting elements
- Professional but accessible language`,

      'nhs-formal': `
NOTE TYPE: NHS FORMAL GOVERNANCE
- Strict adherence to NHS governance language standards
- Suitable for ICB circulation, CQC review, Board packs
- Use formal terminology: "The meeting noted...", "It was resolved that...", "Members agreed..."
- Include explicit risk statements and compliance references
- Reference relevant NHS policies or frameworks where applicable
- Structure with clear governance headers: DECISIONS, RISKS, ESCALATIONS
- Use passive voice throughout for formality
- Include quorum confirmation if attendance suggests it
- Add "For Information", "For Decision", "For Approval" markers where appropriate`,

      'clinical': `
NOTE TYPE: CLINICAL MEETING NOTES
- Use clinical terminology appropriate for healthcare professionals
- Structure using clinical frameworks where relevant (SOAP, MDT format)
- Highlight patient pathways, clinical outcomes, and care decisions
- Include sections for: Clinical Discussions, Patient-Related Actions, Safety Considerations
- Reference clinical guidelines or NICE recommendations if mentioned
- Use appropriate clinical abbreviations (define on first use)
- Include safety netting advice and red flags where clinically relevant
- Structure around clinical decision-making processes`,

      'action-focused': `
NOTE TYPE: ACTION-FOCUSED SUMMARY
- Prioritise decisions made and actions agreed
- Minimal background/context - focus on outcomes
- Lead with the ACTION ITEMS table prominently
- Brief bullet points for key decisions only
- Omit detailed discussion unless directly tied to an action
- Clear ownership and deadlines for every action
- Group actions by priority (High → Medium → Low)
- Include a "Quick Reference" section at the top with counts: X decisions, Y actions, Z deadlines
- Skip narrative sections - this is for busy executives who need to act`,

      'educational': `
NOTE TYPE: EDUCATIONAL/CPD FORMAT
- Structure around learning objectives and outcomes
- Include sections: Learning Objectives, Key Concepts Discussed, Discussion Points, Reflection Questions
- Highlight CPD-relevant content and learning takeaways
- Summarise educational content in digestible format
- Include suggested further reading or resources if mentioned in the meeting
- Add a "Key Takeaways" summary section at the end
- Note any training requirements or competency gaps identified
- Format suitable for inclusion in CPD portfolios and training records
- Include hours that could count towards CPD if the meeting was educational`
    };

    const selectedNoteTypeInstruction = noteTypeInstructions[noteType] || noteTypeInstructions['standard'];
    console.log('📊 Using note type:', noteType);

    // Generate notes using Lovable AI
    let systemPrompt = `You are an expert meeting notes assistant. Create comprehensive, professional meeting notes from ANY provided transcript content.

CRITICAL INSTRUCTIONS:
- ALWAYS generate structured business meeting notes regardless of the content type (meetings, discussions, educational content, documentaries, etc.)
- Transform any audio/video transcript into professional business-style meeting notes
- Extract business-relevant information, decisions, action items, and discussion points from any content
- Never refuse to generate notes based on content type - treat all content as meeting material`;

    // Add raw transcript handling note if cleaning was skipped
    if (transcriptUsed === 'raw-optimized') {
      systemPrompt += `

NOTE ON TRANSCRIPT QUALITY:
- This transcript may contain minor speech recognition artifacts, duplicates, or fragments
- Intelligently filter out obvious duplicates and fragments whilst preserving all meaningful content
- Focus on extracting the core business information and decisions from the content`;
    }

    systemPrompt += `

CRITICAL LANGUAGE AND FORMATTING REQUIREMENTS:
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: Wednesday 31st August 2025 (including day of week)
- Use 24-hour time format where appropriate: 14:30 rather than 2:30 PM
- Follow NHS/UK business conventions for professional language and formatting
- Use £ symbol positioning following UK conventions

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

CRITICAL: Start your response immediately with "# MEETING DETAILS" - do NOT include any title, date, or text before this first header.

# MEETING DETAILS

**Meeting Title: [exact title from metadata - use larger bold font]**
Date: [full British format with day of week]
Time: [24-hour GMT format from recording start time if not otherwise specified]
Location: [from authoritative context - DO NOT CHANGE THIS]

CRITICAL FORMAT: 
- Meeting Title MUST be bold and larger (use **Meeting Title:** format)
- Write each field on its own line starting with the label directly (no bullets, no dashes, no symbols)
Example:
**Meeting Title: Strategic Planning Review**
Date: Wednesday 15th October 2025
Time: 14:30 GMT
Location: Oak Lane Medical Practice

# EXECUTIVE SUMMARY
Write 1 concise paragraph (3-4 sentences maximum) that captures the essence of the content:
- Main focus areas and key decisions made
- Critical timelines or issues raised
- One distinguishing detail that makes this meeting memorable

# ATTENDEES
- [Name] (Organisation) - if organization is known from context
- [Name] - if organization is not known
(List each attendee on a separate bullet point. Include their organization in parentheses only if it is provided in the authoritative context)

# DISCUSSION SUMMARY

Background
[Write a context-setting paragraph explaining what led to this meeting and the key topics to be addressed]

Key Points
1. [First major discussion point with full context and outcomes]

2. [Second major discussion point with details]

3. [Continue with all significant discussion items]

# ACTION ITEMS
| Action | Responsible Party | Deadline | Priority |
|--------|-------------------|----------|----------|
| [Specific task description] | [Person's name OR "TBC" if not explicitly mentioned] | [Date/timeframe OR "TBC" if not specified] | High/Medium/Low |
| [Next action item] | [Person's name OR "TBC" if not explicitly mentioned] | [Date/timeframe OR "TBC" if not specified] | High/Medium/Low |

CRITICAL: For Action Items:
- ONLY include a person's name in "Responsible Party" if they were EXPLICITLY mentioned in the transcript as being responsible for that specific action
- NEVER infer, assume, or make up who should be responsible
- If the responsible party is not explicitly stated, write "TBC" (To Be Confirmed)
- If a deadline is not explicitly mentioned, write "TBC"
- Do NOT assign actions to people based on their role or position unless explicitly stated in the transcript

(Format as a proper markdown table with these exact column headers)

# OPEN ITEMS & RISKS
- [Items deferred or requiring future consideration with context]
- [Outstanding issues or unresolved questions that need follow-up]
- [Strategic considerations for future meetings or decisions]

# NEXT MEETING
[State the next meeting date if mentioned, or write "To be determined" if not specified]

CRITICAL FORMATTING RULES:
- Use # (level 1 headers) for ALL main sections
- Start document with a specific descriptive title
- Include day of week in all dates (e.g., "Wednesday 15th October 2025")
- ACTION ITEMS MUST be a properly formatted markdown table with pipes (|)
- Do not use ## (level 2 headers) for main sections
- Respect the authoritative location provided - never contradict it

Keep the executive summary concise and focused - maximum 3-4 sentences that quickly convey the meeting's purpose and key outcomes.

═══════════════════════════════════════════════════════════════════════════════
TONE OPTIMISER v4.0 — NHS GOVERNANCE-SAFE REQUIREMENTS (APPLY DURING GENERATION)
═══════════════════════════════════════════════════════════════════════════════

You MUST transform the transcript into a fully governance-safe, diplomatically worded document that contains no personal identifiers, no emotional language, no adversarial tone, no metaphors, and no informal expressions, while strictly preserving the factual meaning, decisions, actions, and risks.

🔹 1. Remove adversarial, political, or critical language
Replace any wording implying: blame, misconduct, financial motives, organisational conflict, aggression, "takeovers", "redundancy" or "uselessness", criticism of PML, NHFT, ICB, or any partner organisation.
Rewrite into neutral alternatives: "members discussed concerns regarding...", "operational challenges were noted...", "potential future organisational changes were discussed..."

🔹 2. Remove metaphors, idioms, or vivid/dramatic speech
Replace phrases like "wolf ready to pounce", "catch 22", "lip service", "playing both sides" with "members expressed concern about...", "noted constraints...", "discussed the need to maintain constructive engagement..."

🔹 3. Remove informal quotations or conversational fragments
Convert "more money, less hours", "Super 10", "unprofessional behaviour" into "the candidate expressed a preference for alternative working arrangements", "feedback highlighted opportunities to broaden the scope of practice"

🔹 4. Remove personal identifiers or sensitive references
Replace staff names in performance discussions, family relationships, private circumstances with role-based descriptors: "a pharmacist", "a candidate for the role", "an FCP". Never include personal health, behaviour, relationships, or quotes about individuals.

🔹 5. Recast performance/capability issues using neutral governance language
"failed a prescribing course" → "has not yet completed the prescribing qualification"
"lack of holistic care" → "feedback indicated opportunities to broaden the approach"
"displayed unprofessional behaviour" → "areas for development were noted"

🔹 6. Neutralise strong opinions or emotional tone
Replace "significant frustration", "severe concerns", "negative experiences", "threat to autonomy" with "operational challenges were noted", "members expressed concerns", "previous issues were acknowledged"

🔹 7. Maintain strict governance style
Use: "members discussed...", "the group noted...", "concerns were raised...", "options were explored...", "it was agreed that..."
Avoid: informal language, emotive verbs (criticised, blamed, argued), speculation or assumptions

🔹 8. Preserve structure and factual content
Do NOT remove: decisions, actions, dates, financial figures, estates/legal/contracting details, workforce details, risks. Only adjust phrasing.

🔹 9. Final output must be suitable for:
NHS Board Packs, ICB circulation, sharing with NHFT or PML, FOI response, CQC review

═══════════════════════════════════════════════════════════════════════════════

${selectedNoteTypeInstruction}

${selectedDetailInstruction}`;

    // Format date in British format with day of week
    const meetingDate = new Date(meeting.created_at);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[meetingDate.getDay()];
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
    const formattedDate = `${dayOfWeek} ${day}${ordinalSuffix(day)} ${months[meetingDate.getMonth()]} ${meetingDate.getFullYear()}`;

    // Build authoritative context information from meeting metadata
    let locationContext = '';
    if (meeting.meeting_format === 'teams') {
      locationContext = '- Location: Online (Microsoft Teams)\n';
    } else if (meeting.meeting_format === 'hybrid') {
      locationContext = meeting.meeting_location 
        ? `- Location: ${meeting.meeting_location} and Online (Hybrid)\n`
        : '- Location: Hybrid (Online + on-site)\n';
    } else if (meeting.meeting_format === 'face-to-face' && meeting.meeting_location) {
      locationContext = `- Location: ${meeting.meeting_location}\n`;
    }

    const contextInfo = `**MEETING CONTEXT (AUTHORITATIVE - DO NOT CONTRADICT):**
${meeting.agenda ? `- Agenda: ${meeting.agenda}\n` : ''}${attendeeWithOrg.length ? `- Attendees: ${attendeeWithOrg.join(', ')}\n` : ''}${locationContext}${meeting.meeting_format ? `- Format: ${meeting.meeting_format === 'teams' ? 'MS Teams' : meeting.meeting_format === 'hybrid' ? 'Hybrid' : 'Face to Face'}\n` : ''}${meeting.meeting_context ? `- Additional Context: ${JSON.stringify(meeting.meeting_context)}\n` : ''}
**CRITICAL INSTRUCTION: The location and format above are AUTHORITATIVE. Do not infer, state, or imply any different location even if the transcript mentions other places. Transcript location mentions are for context only.**
**IMPORTANT: Use the exact attendee names provided above. Do not modify spellings.**
${documentContext ? `\n**UPLOADED SUPPORTING DOCUMENTS:**${documentContext}\n` : ''}`;

    // Format meeting date for title context
    const formattedMeetingDate = meeting.start_time 
      ? new Date(meeting.start_time).toLocaleDateString('en-GB', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : undefined;

    // Get document names for title context
    let uploadedDocuments: Array<{ file_name: string }> | undefined;
    try {
      const { data: docs } = await supabase
        .from('meeting_documents')
        .select('file_name')
        .eq('meeting_id', meetingId)
        .limit(5);
      uploadedDocuments = docs || undefined;
    } catch (docErr) {
      console.warn('⚠️ Could not fetch document names for title:', docErr);
    }

    // Generate descriptive meeting title FIRST using the transcript so we can use it in the notes
    let generatedTitle = meeting.title;
    try {
      console.log('🏷️ Generating descriptive meeting title before notes...');
      const { data: titleResult, error: titleError } = await supabase.functions.invoke(
        'generate-meeting-title',
        {
          body: { 
            transcript: cleanedTranscript,
            currentTitle: meeting.title,
            attendees: attendeeWithOrg,
            agenda: meeting.agenda,
            meetingFormat: meeting.meeting_format,
            meetingDate: formattedMeetingDate,
            documentNames: uploadedDocuments?.map(d => d.file_name)
          }
        }
      );

      if (titleError) {
        console.warn('⚠️ Title generation failed:', titleError.message);
      } else if (titleResult?.title) {
        generatedTitle = titleResult.title;
        console.log('✅ Generated title:', generatedTitle);
      }
    } catch (titleError) {
      console.warn('⚠️ Title generation error, keeping original title:', titleError.message);
    }

    // Format start time in GMT 24-hour format
    const startTime = meeting.start_time ? new Date(meeting.start_time) : new Date(meeting.created_at);
    const hours = String(startTime.getUTCHours()).padStart(2, '0');
    const minutes = String(startTime.getUTCMinutes()).padStart(2, '0');
    const formattedStartTime = `${hours}:${minutes} GMT`;

    const userPrompt = `Meeting Title: ${generatedTitle}
Meeting Date: ${formattedDate}
Recording Start Time: ${formattedStartTime}
Duration: ${meeting.duration_minutes || 'Not specified'} minutes

${contextInfo}
Transcript:
${cleanedTranscript}`;

    console.log('🔧 Using Lovable AI with google/gemini-2.5-flash');
    console.log('📊 System prompt length:', systemPrompt.length, 'chars');
    console.log('📊 User prompt length:', userPrompt.length, 'chars');
    
    // Create AbortController with 2 minute timeout for AI generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
    
    let generatedNotes = '';
    
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 8000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('📡 Lovable AI response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Lovable AI API error:', response.status, errorData);
        
        // Handle specific error cases
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error('Insufficient AI credits. Please add credits to your workspace.');
        }
        if (response.status === 413) {
          throw new Error('Transcript too large. Please try cleaning the transcript first.');
        }
        
        throw new Error(`Lovable AI API error: ${response.status} - ${errorData}`);
      }

      // Safely parse response - handle empty or malformed JSON
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        console.error('❌ Lovable AI returned empty response body');
        throw new Error('Lovable AI returned an empty response. Please try again.');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse Lovable AI response:', responseText.substring(0, 500));
        throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
      }
      console.log('📦 Lovable AI response data:', JSON.stringify(data).substring(0, 500));
      
      generatedNotes = data.choices?.[0]?.message?.content || '';
      
      if (!generatedNotes || generatedNotes.trim().length === 0) {
        console.error('⚠️ Lovable AI returned empty content!');
        console.error('Response structure:', JSON.stringify(data));
        throw new Error('Lovable AI returned empty content. This may indicate an API configuration issue.');
      }

      console.log('✅ Generated notes length:', generatedNotes.length, 'chars');
      console.log('📝 Generated preview:', generatedNotes.substring(0, 200));
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('⏱️ AI generation timed out after 2 minutes');
        throw new Error('AI generation timed out. Please try with a shorter transcript or contact support.');
      }
      throw fetchError;
    }

    // Post-process ACTION ITEMS to enforce explicit ownership only
    try {
      const transcriptForCheck = typeof fullTranscript === 'string' ? fullTranscript : '';
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hasExplicitAssignment = (transcript: string, name: string): boolean => {
        if (!transcript || !name) return false;
        const escaped = escapeRegExp(name);
        const nameWord = `\\b${escaped}\\b`;
        const patterns = [
          new RegExp(`${nameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
          new RegExp(`(?:owner|responsible|lead)\\s*[:\\-]\\s*${nameWord}`, 'i'),
          new RegExp(`${nameWord}.*(?:responsible|owner|lead)`, 'i'),
          new RegExp(`assign(?:ed)?\\s+to\\s+${nameWord}`, 'i')
        ];
        return patterns.some((p) => p.test(transcript));
      };

      const headerIdx = generatedNotes.indexOf('# ACTION ITEMS');
      if (headerIdx !== -1) {
        const afterHeader = generatedNotes.slice(headerIdx);
        const tableMatch = afterHeader.match(/\n\|.*\|\n\|[-\s|]+\|\n([\s\S]*?)(?:\n(?=#)|$)/);
        if (tableMatch) {
          const tableRows = tableMatch[1]
            .split('\n')
            .map((r) => r.trim())
            .filter((r) => r.startsWith('|'));

          const rebuilt = tableRows.map((row) => {
            const cells = row.split('|').map((c) => c.trim());
            // Expect: ['', Action, Responsible Party, Deadline, Priority, '']
            if (cells.length >= 6) {
              const responsible = cells[2];
              if (responsible && responsible.toUpperCase() !== 'TBC') {
                if (!hasExplicitAssignment(transcriptForCheck, responsible)) {
                  cells[2] = 'TBC';
                }
              }
              return '|' + cells.slice(1, cells.length - 1).join(' | ') + ' |';
            }
            return row;
          }).join('\n');

          const before = generatedNotes.slice(0, headerIdx);
          const afterTable = afterHeader.replace(tableMatch[1], rebuilt);
          generatedNotes = before + afterTable;
        }
      }
    } catch (ppErr) {
      console.warn('⚠️ Post-process of ACTION ITEMS failed:', ppErr);
    }

    // v4.0 Governance rules now embedded directly in Gemini prompt above
    // This eliminates 75+ second GPT-5 delay and preserves markdown formatting
    console.log('✅ Governance tone v4.0 applied via Gemini prompt (no GPT-5 post-processing needed)');

    // Extract overview from the generated notes (first section after "EXECUTIVE SUMMARY")
    // Match both markdown heading and bold format
    const overviewMatch = generatedNotes.match(/(?:\*\*EXECUTIVE SUMMARY\*\*|# EXECUTIVE SUMMARY)\s*\n(.*?)(?=\n(?:#|\*\*)|$)/s);
    const overview = overviewMatch ? overviewMatch[1].trim() : 'Overview not available';

    // Save or update notes in database - handle forceRegenerate properly
    if (forceRegenerate) {
      // Delete existing record first, then insert new one
      await supabase
        .from('meeting_summaries')
        .delete()
        .eq('meeting_id', meetingId);
    }

    const { error: summaryError } = await supabase
      .from('meeting_summaries')
      .insert({
        meeting_id: meetingId,
        summary: generatedNotes,
        key_points: [],
        action_items: [],
        decisions: [],
        next_steps: []
      });

    if (summaryError) {
      console.error('❌ Error saving summary:', summaryError);
      throw summaryError;
    }

    // Extract and store action items immediately after notes are saved
    try {
      console.log('📋 Extracting action items from generated notes...');
      
      // Check if action items already exist for this meeting (avoid duplicates on regeneration)
      const { data: existingItems } = await supabase
        .from('meeting_action_items')
        .select('id')
        .eq('meeting_id', meetingId)
        .limit(1);
      
      if (existingItems && existingItems.length > 0) {
        console.log('⚠️ Action items already exist for this meeting, skipping extraction');
      } else {
        // Parse action items from the generated notes
        const actionItemsToInsert: Array<{
          meeting_id: string;
          user_id: string;
          action_text: string;
          assignee_name: string;
          assignee_type: 'tbc' | 'custom';
          due_date: string;
          due_date_actual: string | null;
          priority: 'High' | 'Medium' | 'Low';
          status: 'Open';
          sort_order: number;
        }> = [];
        
        const seenTexts = new Set<string>();
        
        // Calculate actual due date from quick pick values
        const calculateActualDueDate = (quickPick: string): string | null => {
          const today = new Date();
          switch (quickPick) {
            case 'End of Week': {
              const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
              const friday = new Date(today);
              friday.setDate(today.getDate() + daysUntilFriday);
              return friday.toISOString().split('T')[0];
            }
            case 'End of Month': {
              const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              return lastDay.toISOString().split('T')[0];
            }
            case 'End of Next Month': {
              const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
              return lastDayNextMonth.toISOString().split('T')[0];
            }
            case 'ASAP': {
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              return tomorrow.toISOString().split('T')[0];
            }
            case 'By Next Meeting':
            case 'TBC':
              return null;
            default: {
              const parsed = Date.parse(quickPick);
              if (!Number.isNaN(parsed)) {
                return new Date(parsed).toISOString().split('T')[0];
              }
              return null;
            }
          }
        };
        
        // Method 1: Parse markdown TABLE format under an "Action Items" heading
        const tableMatch = generatedNotes.match(
          /#{1,3}\s*(?:ACTION\s+ITEMS|Action\s+Items)\s*\n\|[^\n]+\|\s*\n\|[-|\s:]+\|\s*\n([\s\S]*?)(?=\n#{1,3}\s+|\n\n#{1,3}\s+|$)/i
        );
        
        if (tableMatch && tableMatch[1]) {
          const tableRows = tableMatch[1].split('\n').filter((line: string) => line.trim().startsWith('|'));
          
          for (const row of tableRows) {
            const cells = row.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
            if (cells.length >= 4) {
              const [actionText, assignee, deadline, priority] = cells;
              
              // Skip if action text is too short or is a header
              if (actionText.length < 10 || actionText.match(/^Action$/i)) continue;
              
              // Normalise and dedupe
              const normalizedText = actionText.toLowerCase().replace(/[^\w\s]/g, '').trim();
              if (seenTexts.has(normalizedText)) continue;
              seenTexts.add(normalizedText);
              
              const dueDate = deadline || 'TBC';
              const priorityValue = (priority?.match(/High|Medium|Low/i)?.[0] as 'High' | 'Medium' | 'Low') || 'Medium';
              
              actionItemsToInsert.push({
                meeting_id: meetingId,
                user_id: meeting.user_id,
                action_text: actionText,
                assignee_name: assignee || 'TBC',
                assignee_type: (assignee && assignee !== 'TBC') ? 'custom' : 'tbc',
                due_date: dueDate,
                due_date_actual: calculateActualDueDate(dueDate),
                priority: priorityValue,
                status: 'Open',
                sort_order: actionItemsToInsert.length,
              });
            }
          }
        }
        
        // Method 2: Parse bullet point format (fallback if no table found)
        if (actionItemsToInsert.length === 0) {
          const bulletMatch = generatedNotes.match(/#{1,3}\s*(?:ACTION ITEMS|Action Items)\s*\n([\s\S]*?)(?=\n#{1,3}\s+[A-Z]|$)/i);
          if (bulletMatch) {
            const section = bulletMatch[1] || bulletMatch[0];
            const lines = section.split('\n');
            
            for (const line of lines) {
              const match = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.+)/);
              if (match && match[1].trim()) {
                const rawText = match[1].trim();
                
                // Skip header-like lines
                if (rawText.match(/^\*\*[^*]+\*\*:?\s*$/)) continue;
                if (rawText.match(/^(?:Action Items|Actions|Completed|Open|High Priority|Medium Priority|Low Priority)/i)) continue;
                if (rawText.length < 10) continue;
                
                // Parse out assignee, due date, priority from text
                let actionText = rawText;
                let assignee = 'TBC';
                let dueDate = 'TBC';
                let priority: 'High' | 'Medium' | 'Low' = 'Medium';
                
                const assigneeMatch = rawText.match(/(?:—|–|-)\s*@?([A-Za-z\s.]+?)(?:\s*[\[(]|$)/i) ||
                                      rawText.match(/\((?:Assigned to|Owner|Lead):\s*([^)]+)\)/i);
                if (assigneeMatch) {
                  assignee = assigneeMatch[1].trim();
                  actionText = actionText.replace(assigneeMatch[0], '').trim();
                }
                
                const dueDateMatch = rawText.match(/\((End of Week|End of Month|By Next Meeting|ASAP|TBC)\)/i) ||
                                     rawText.match(/\[(End of Week|End of Month|By Next Meeting|ASAP|TBC)\]/i);
                if (dueDateMatch) {
                  dueDate = dueDateMatch[1].trim();
                  actionText = actionText.replace(dueDateMatch[0], '').trim();
                }
                
                const priorityMatch = rawText.match(/\[(High|Medium|Low)\]/i);
                if (priorityMatch) {
                  priority = priorityMatch[1] as 'High' | 'Medium' | 'Low';
                  actionText = actionText.replace(priorityMatch[0], '').trim();
                }
                
                actionText = actionText.replace(/[—–-]\s*$/, '').trim();
                
                const normalizedText = actionText.toLowerCase().replace(/[^\w\s]/g, '').trim();
                if (seenTexts.has(normalizedText) || normalizedText.length < 10) continue;
                seenTexts.add(normalizedText);
                
                actionItemsToInsert.push({
                  meeting_id: meetingId,
                  user_id: meeting.user_id,
                  action_text: actionText,
                  assignee_name: assignee,
                  assignee_type: assignee === 'TBC' ? 'tbc' : 'custom',
                  due_date: dueDate,
                  due_date_actual: calculateActualDueDate(dueDate),
                  priority: priority,
                  status: 'Open',
                  sort_order: actionItemsToInsert.length,
                });
              }
            }
          }
        }
        
        // Insert extracted action items
        if (actionItemsToInsert.length > 0) {
          console.log(`📋 Inserting ${actionItemsToInsert.length} extracted action items`);
          const { error: actionError } = await supabase
            .from('meeting_action_items')
            .insert(actionItemsToInsert);
          
          if (actionError) {
            console.warn('⚠️ Failed to insert action items:', actionError.message);
          } else {
            console.log('✅ Action items extracted and stored successfully');
          }
        } else {
          console.log('📋 No action items found in generated notes');
        }
      }
    } catch (actionError: any) {
      console.warn('⚠️ Action items extraction failed (non-fatal):', actionError.message);
    }

    // Generate AI overview using the dedicated function
    let aiOverview = overview; // fallback to extracted overview
    try {
      console.log('🎯 Generating AI overview...');
      const { data: overviewResult, error: overviewError } = await supabase.functions.invoke(
        'generate-meeting-overview',
        {
          body: { 
            meetingId: meetingId,
            meetingTitle: generatedTitle, // Use the generated title
            meetingNotes: generatedNotes
          }
        }
      );

      if (overviewError) {
        console.warn('⚠️ AI overview generation failed:', overviewError.message);
      } else if (overviewResult?.overview) {
        aiOverview = overviewResult.overview;
        console.log('✅ AI overview generated:', aiOverview);
      }
    } catch (overviewError) {
      console.warn('⚠️ AI overview generation error, using extracted overview:', overviewError.message);
    }

    // Update meeting with completion status, word count, AI overview, and generated title
    await supabase
      .from('meetings')
      .update({ 
        notes_generation_status: 'completed',
        word_count: wordCount,
        overview: aiOverview,
        title: generatedTitle
      })
      .eq('id', meetingId);

    // Also save overview to meeting_overviews table for consistency
    await supabase
      .from('meeting_overviews')
      .upsert({
        meeting_id: meetingId,
        overview: aiOverview
      });

    // Update queue status if exists
    await supabase
      .from('meeting_notes_queue')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId);

    console.log('🎉 Successfully generated and saved meeting notes');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Meeting notes generated successfully',
        notesLength: generatedNotes.length,
        content: generatedNotes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in auto-generate-meeting-notes:', error.message);
    console.error('❌ Full error details:', error);
    
    // Try to update status to failed if we have meetingId
    try {
      const requestClone = req.clone();
      const { meetingId } = await requestClone.json().catch(() => ({}));
      if (meetingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('meetings')
          .update({ 
            notes_generation_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);

        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId);
          
        console.log('✅ Updated meeting status to failed for:', meetingId);
      }
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});