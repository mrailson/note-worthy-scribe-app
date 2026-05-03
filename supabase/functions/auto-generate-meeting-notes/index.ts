import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

// ─────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for first-pass meeting note generation.
//
// Every input path (live recording, mobile, file upload, transcript paste,
// Plaud webhook, offline sync, mobile email, …) funnels into THIS edge
// function with no caller-supplied modelOverride; the default chosen here
// is therefore what users actually see on the first auto-generated note.
//
// To change the default, EITHER:
//   (a) update the `MEETING_PRIMARY_MODEL` row in `system_settings`
//       (instant, no redeploy — admin-flippable via /admin/llm-diagnostics), OR
//   (b) edit the constant below and redeploy (used as the fallback when the
//       DB row is missing or holds a value not in ALLOWED_PRIMARY_MODELS).
//
// Decided May 2026 after model comparison: Sonnet 4.6 at standard tier is
// the only configuration that produces governance-grade output across the
// full range of input transcripts. Gemini 3 Flash and Pro both fabricated
// attendees / owners / deadlines on the IHO test corpus.
// ─────────────────────────────────────────────────────────────────────────
const DEFAULT_GENERATION_MODEL = 'claude-sonnet-4-6';
const DEFAULT_DETAIL_TIER = 'standard' as const;
const ALLOWED_PRIMARY_MODELS = ['claude-sonnet-4-6', 'gemini-3-flash', 'gemini-3.1-pro'];

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
  // Use large chunks (~12k tokens) to minimise API calls — max 3-4 chunks even for long meetings
  const chunks = splitTextIntoChunks(rawTranscript, 45000, 500);
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

/**
 * Auto-detect meeting format from transcript content.
 * Returns 'teams', 'hybrid', or 'face-to-face'.
 */
function detectMeetingFormat(transcript: string): 'teams' | 'hybrid' | 'face-to-face' {
  const lower = transcript.toLowerCase();
  
  const virtualSignals = [
    'you\'re on mute', 'you\'re muted', 'can you unmute', 'unmute yourself',
    'share my screen', 'share your screen', 'can you see my screen', 'screen sharing',
    'i\'ll share the', 'drop off the call', 'drop off now', 'join the call',
    'joined the meeting', 'left the meeting', 'teams meeting', 'zoom meeting',
    'zoom call', 'on the call', 'dial in', 'connection issues', 'internet connection',
    'camera on', 'camera off', 'turn your camera', 'can you hear me', 'audio issues',
    'breakout room', 'waiting room', 'raise your hand', 'put in the chat',
    'type in the chat', 'chat function', 'recording this meeting', 'teams is',
    'i\'m going to leave the', 'kicked off the call', 'logging off', 'signing off',
    'i\'ll hang up', 'can everyone hear', 'you\'re breaking up', 'frozen screen',
    'your mic', 'microphone', 'webcam', 'virtual background', 'bandwidth', 'laggy', 'lagging',
  ];
  
  const faceToFaceSignals = [
    'pass that round', 'pass the', 'hand out', 'take a seat', 'sit down',
    'whiteboard', 'flip chart', 'on the board', 'walk over', 'room temperature',
    'close the door', 'coffee', 'tea and coffee', 'shall we take a break',
    'comfort break', 'grab a seat',
  ];
  
  let virtualScore = 0;
  let faceToFaceScore = 0;
  
  for (const signal of virtualSignals) {
    const regex = new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lower.match(regex);
    if (matches) {
      virtualScore += Math.min(matches.length, 3);
    }
  }
  
  for (const signal of faceToFaceSignals) {
    const regex = new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lower.match(regex);
    if (matches) {
      faceToFaceScore += Math.min(matches.length, 3);
    }
  }
  
  console.log(`📍 Format detection — Virtual: ${virtualScore}, Face-to-face: ${faceToFaceScore}`);
  
  if (virtualScore >= 3 && faceToFaceScore >= 3) return 'hybrid';
  if (virtualScore >= 3 && virtualScore > faceToFaceScore * 2) return 'teams';
  if (faceToFaceScore >= 3 && faceToFaceScore > virtualScore * 2) return 'face-to-face';
  if (virtualScore >= 2) return 'teams';
  return 'face-to-face';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normaliseTranscriptSourceForMeeting = (source: string | null | undefined): string | null => {
  const raw = (source || '').toLowerCase().trim();
  if (!raw) return null;
  if (raw === 'best_of_all') return 'best_of_all';
  if (raw === 'consolidated') return 'consolidated';
  if (raw.includes('whisper') || raw === 'meetings_consolidated') return 'whisper';
  if (raw.includes('assembly') || raw.includes('live')) return 'assembly';
  if (raw.includes('deepgram')) return 'deepgram';
  if (raw.includes('meeting_transcription_chunks') || raw.includes('meeting_transcripts') || raw.includes('transcription_chunks')) return 'whisper';
  return null;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: Record<string, any> = {};
  let meetingId: string | undefined;

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    requestBody = await req.json();
    const {
      meetingId: parsedMeetingId,
      forceRegenerate = false,
      detailLevel = 'standard',
      noteType = 'standard',
      transcriptSource,
      skipQc = false,
      premiumPin,
      forceGenerate = false,
      forceSingleShot = false,
    } = requestBody;
    // detailTier is the user-facing output-length selector (Concise/Standard/Detailed).
    // It is independent of the legacy `detailLevel` parameter and only injects a
    // length directive into the system prompt. Default: DEFAULT_DETAIL_TIER (standard).
    const ALLOWED_DETAIL_TIERS = ['concise', 'standard', 'detailed'] as const;
    type DetailTier = typeof ALLOWED_DETAIL_TIERS[number];
    const rawDetailTier = typeof requestBody.detailTier === 'string' ? requestBody.detailTier.toLowerCase() : DEFAULT_DETAIL_TIER;
    const detailTier: DetailTier = (ALLOWED_DETAIL_TIERS as readonly string[]).includes(rawDetailTier)
      ? (rawDetailTier as DetailTier)
      : DEFAULT_DETAIL_TIER;
    console.log(`🎚️ [detailTier] received='${requestBody.detailTier}' → resolved='${detailTier}' (forceRegenerate=${forceRegenerate}, model=${requestBody.modelOverride ?? 'server-default'})`);
    // Suffix model identifier so docx footer reads e.g. "claude-sonnet-4-6 (detailed)".
    // Standard tier is the historical baseline so we don't add a suffix for it.
    const stampModelWithTier = (model: string | null | undefined): string =>
      detailTier === 'standard' || !model ? (model || 'unknown') : `${model} (${detailTier})`;
    // When the user explicitly requested a single-shot Sonnet pass via the
    // "Regenerate with Sonnet" refine button, mark the saved model with a
    // `+refined` suffix so the badge can display "Claude Sonnet 4.6 · refined"
    // and downstream tooling can distinguish it from the default chunked path.
    const stampModelForRefine = (model: string | null | undefined): string => {
      const base = stampModelWithTier(model);
      if (!requestBody.forceSingleShot) return base;
      // Only mark as refined when we actually went through the single-shot
      // path (i.e. chunked path didn't produce these notes). Adding the suffix
      // to a Haiku-chunked output would be misleading.
      if (typeof base === 'string' && base.includes('+chunked-haiku')) return base;
      return `${base}+refined`;
    };
    // Resolve operational primary model. Read MEETING_PRIMARY_MODEL from
    // system_settings so admins can flip the default instantly via
    // /admin/llm-diagnostics; fall back to DEFAULT_GENERATION_MODEL (top of file)
    // if the row is missing or holds a value not in ALLOWED_PRIMARY_MODELS.
    let configuredPrimaryModel: string = DEFAULT_GENERATION_MODEL;
    try {
      const { data: settingRow } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'MEETING_PRIMARY_MODEL')
        .maybeSingle();
      const v = settingRow?.setting_value;
      const candidate = typeof v === 'string' ? v : (typeof v === 'object' && v !== null ? String(v) : '');
      if (ALLOWED_PRIMARY_MODELS.includes(candidate)) {
        configuredPrimaryModel = candidate;
      }
    } catch (settingErr) {
      console.warn(`⚠️ Could not read MEETING_PRIMARY_MODEL setting, defaulting to ${DEFAULT_GENERATION_MODEL}:`, settingErr);
    }
    let modelOverride: string = requestBody.modelOverride ?? configuredPrimaryModel;
    const isFirstPassDefault = !requestBody.modelOverride;
    console.log(`🧭 [model-resolution] firstPassDefault=${isFirstPassDefault} configured='${configuredPrimaryModel}' caller='${requestBody.modelOverride ?? '(none)'}' → final='${modelOverride}'`);
    meetingId = parsedMeetingId;

    // Server-side PIN gate for premium models. Pro is now the default and is
    // intentionally NOT pin-gated (canonical path). Other premium overrides remain gated.
    const PREMIUM_REGEN_PIN = '1045';
    const PREMIUM_MODELS = ['gemini-2.5-flash'];
    if (PREMIUM_MODELS.includes(modelOverride)) {
      if (premiumPin !== PREMIUM_REGEN_PIN) {
        return new Response(
          JSON.stringify({ error: 'Premium model requires valid PIN' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('🤖 Auto-generating notes for meeting:', meetingId, 'at detail level:', detailLevel, 'with note type:', noteType, 'using transcript source:', transcriptSource || 'auto', 'and model:', modelOverride);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // ============================================================================
    // Pipeline test sub-stage timing — fire-and-forget timestamp writer.
    // Each call updates a single TIMESTAMPTZ column on the meetings row without
    // awaiting, so it never blocks the orchestrator's main path. The watcher in
    // /admin/pipeline-test mirrors these onto pipeline_test_runs for analysis.
    // Errors are swallowed (logged) — instrumentation must never break generation.
    // ============================================================================
    const stamp = (column: string) => {
      supabase
        .from('meetings')
        .update({ [column]: new Date().toISOString() })
        .eq('id', meetingId)
        .then(() => {}, (err: any) => console.warn(`⚠️ stamp(${column}) failed:`, err?.message));
    };

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

    // Primary model is now governed by the MEETING_PRIMARY_MODEL setting
    // (resolved above into `configuredPrimaryModel`). Explicit caller overrides
    // via Settings/regenerate dropdown still win — we only use the configured
    // default when the caller didn't specify a model. Duration-based routing
    // has been removed: Flash is now fast enough that there's no Pro upside
    // worth the timeout risk on long meetings.
    const rawClientModel = requestBody.modelOverride;
    const callerSpecifiedModel =
      rawClientModel !== undefined &&
      rawClientModel !== null &&
      rawClientModel !== '';
    if (!callerSpecifiedModel) {
      console.log(`🎯 Using configured primary model: ${configuredPrimaryModel}`);
    } else {
      console.log(`🎯 Using caller-specified model: ${modelOverride}`);
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

        // Even when skipping notes, ensure the meeting has a descriptive title
        const genericTitlePatterns = [
          /^Meeting\s*-\s*\w{3},/i,
          /^Meeting\s*-\s*\w+day/i,
          /^Meeting\s*-\s*\d{1,2}(st|nd|rd|th)/i,
          /^New\s+Meeting/i,
          /^Untitled/i,
          /^Meeting\s+\d+$/i,
          /^Meeting$/i,
          /^Mobile Recording\b/i,
          /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i,
        ];
        const currentTitle = meeting.title?.trim() || '';
        const isGenericTitle = genericTitlePatterns.some(p => p.test(currentTitle));

        if (isGenericTitle) {
          console.log('🏷️ Title is still generic despite notes existing, triggering title generation:', currentTitle);
          try {
            const transcript = initialTranscriptData?.transcript || '';
            const { data: titleResult, error: titleError } = await supabase.functions.invoke(
              'generate-meeting-title',
              {
                body: {
                  transcript: transcript.substring(0, 10000),
                  currentTitle: meeting.title,
                  meetingId: meetingId
                }
              }
            );
            if (!titleError && titleResult?.title && titleResult.title !== meeting.title) {
              await supabase
                .from('meetings')
                .update({ title: titleResult.title })
                .eq('id', meetingId);
              console.log('✅ Meeting title updated on early-exit path:', titleResult.title);
            }
          } catch (titleErr) {
            console.warn('⚠️ Title generation on early-exit failed (non-fatal):', titleErr);
          }
        }

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
        
        // Also fetch Deepgram transcript if available for cross-reference
        let deepgramText = '';
        try {
          const { data: dgData } = await supabase
            .from('meetings')
            .select('deepgram_transcript_text')
            .eq('id', meetingId)
            .single();
          deepgramText = dgData?.deepgram_transcript_text || '';
          if (deepgramText) console.log(`📊 Deepgram transcript available: ${deepgramText.length} chars`);
        } catch (e) {
          console.log('📊 No Deepgram transcript column or data available');
        }

        const consolidatedResponse = await fetch(`${supabaseUrl}/functions/v1/generate-consolidated-meeting-notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batchTranscript,
            liveTranscript,
            deepgramTranscript: deepgramText,
            hasSpeakerLabels: /\[Speaker [A-Z]\]/i.test(liveTranscript || ''),
            meetingId,
            meetingTitle: meeting.title,
            meetingDate: meeting.start_time ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(meeting.start_time)) : null,
            meetingTime: meeting.start_time ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).format(new Date(meeting.start_time)) : null,
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
            
            // Save the consolidated notes to database. We also stamp
            // notes_model_used so the docx footer's model provenance reflects
            // the override that was supplied for THIS regenerate (defence in
            // depth — the consolidated function is currently absent on disk,
            // but if it ever returns ok=true we must not leave a stale stamp).
            const { error: updateError } = await supabase
              .from('meetings')
              .update({ 
                notes_style_3: consolidatedResult.content,
                notes_generation_status: 'completed',
                primary_transcript_source: 'consolidated',
                notes_model_used: stampModelWithTier(modelOverride || 'consolidated'),
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
                key_points: [],
                action_items: [],
                decisions: [],
                next_steps: [],
                ai_generated: true,
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
        .select('best_of_all_transcript, whisper_transcript_text, assembly_transcript_text, live_transcript_text')
        .eq('id', meetingId)
        .single();
      
      if (boaCheck?.best_of_all_transcript && boaCheck.best_of_all_transcript.trim().length > 50) {
        console.log('✅ Auto mode: using best_of_all_transcript with cross-reference');
        
        // Use best_of_all as the primary, but append a cross-reference section
        // from the other engines so the AI can resolve ambiguities
        const whisperText = boaCheck.whisper_transcript_text?.trim() || '';
        const assemblyText = (boaCheck.assembly_transcript_text || boaCheck.live_transcript_text || '').trim();
        
        // Only add cross-reference if we have a second source and it's meaningfully different
        const hasSecondSource = assemblyText.length > 100 || whisperText.length > 100;
        
        if (hasSecondSource && whisperText.length > 100 && assemblyText.length > 100) {
          // Sample sections from the alternative sources for cross-referencing
          // Take first 2K + last 2K from whichever source best_of_all isn't primarily based on
          const crossRefSource = assemblyText; // Assembly is the most different from Whisper-heavy best_of_all
          const crossRefSample = crossRefSource.length <= 4000 
            ? crossRefSource 
            : crossRefSource.substring(0, 2000) + '\n\n[...]\n\n' + crossRefSource.substring(crossRefSource.length - 2000);
          
          fullTranscript = boaCheck.best_of_all_transcript + 
            '\n\n═══ CROSS-REFERENCE: LIVE TRANSCRIPT EXCERPT (use only to clarify names, terms, or intent — do NOT introduce new topics from this section) ═══\n\n' + 
            crossRefSample;
          
          console.log(`📊 Cross-reference added: ${crossRefSample.length} chars from live transcript`);
        } else {
          fullTranscript = boaCheck.best_of_all_transcript;
        }
        
        actualTranscriptSource = 'best_of_all';
      } else {
        // best_of_all not ready yet — wait briefly in case consolidation is still running
        // Skip the 5s consolidation-wait for pipeline-test meetings — they synthesise
        // their transcript up-front and will never have best_of_all populated, so the
        // wait is pure dead time on every test run.
        if (meeting.import_source === 'pipeline_test') {
          console.log('⏩ pipeline_test meeting — skipping best_of_all consolidation wait');
        } else {
          console.log('⏳ best_of_all not found, waiting 5s for consolidation to complete...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Retry once
        const { data: boaRetry } = await supabase
          .from('meetings')
          .select('best_of_all_transcript, whisper_transcript_text, assembly_transcript_text, live_transcript_text')
          .eq('id', meetingId)
          .single();
        
        if (boaRetry?.best_of_all_transcript && boaRetry.best_of_all_transcript.trim().length > 50) {
          console.log('✅ best_of_all arrived after retry');
          fullTranscript = boaRetry.best_of_all_transcript;
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
          actualTranscriptSource = normaliseTranscriptSourceForMeeting(transcriptData?.source) || 'whisper';
          itemCount = transcriptData?.item_count || 0;
        }
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

    // Strip "Meeting transcript." placeholder noise injected by failed-chunk fallbacks.
    // Sonnet/Gemini ignore it; GPT-5.2 is stricter and refuses transcripts that open
    // with 100+ identical placeholder lines. Collapse 2+ consecutive occurrences entirely.
    {
      const beforeLen = fullTranscript.length;
      const cleaned = fullTranscript
        .replace(/(?:\s*Meeting transcript\.\s*){2,}/gi, ' ')
        .trim();
      if (cleaned.length !== beforeLen) {
        const removed = beforeLen - cleaned.length;
        console.log(`🧹 Stripped ${removed} chars of "Meeting transcript." placeholder noise (${beforeLen} → ${cleaned.length})`);
        fullTranscript = cleaned;
      }
    }

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
    // Stage 2 — uploaded documents extracted (or skipped if none).
    stamp('notes_documents_loaded_at');

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
    // Stage 1 — meeting + transcript loaded.
    stamp('notes_meeting_loaded_at');

    // ─── PIPELINE GUARD: minimum-content check ────────────────────────────
    // Prevents the LLM from hallucinating meeting content from very short or
    // non-meeting recordings (e.g. game-show audio, test recordings, brief
    // background noise). Bypassed when the caller passes forceGenerate: true.
    const MIN_TRANSCRIPT_WORDS = 100;
    // Still computed for diagnostic logging in the LLM-refusal path below.
    const meetingDurationSeconds = meeting.duration_minutes != null
      ? Math.round(Number(meeting.duration_minutes) * 60)
      : null;
    if (!forceGenerate) {
      const transcriptTooShort = wordCount < MIN_TRANSCRIPT_WORDS;
      if (transcriptTooShort) {
        const skipReason: 'transcript_too_short' = 'transcript_too_short';

        console.log(`⛔ Pipeline guard: insufficient content (${skipReason}) — words=${wordCount}`);

        const friendlyMessage = `# Recording too short for meeting notes\n\nThis recording is too short to generate meeting notes (${wordCount} words). Meeting notes work best on substantive recordings of around 100 words or more.\n\nIf this recording is genuinely a meeting, please use the **Override and generate anyway** button on the meeting card, or contact support.\n\n---\n\n*Notewell AI declined to generate notes to avoid hallucinating content from a recording that does not appear to be a meeting.*`;

        try {
          await supabase.from('meeting_summaries').upsert({
            meeting_id: meetingId,
            summary: friendlyMessage,
            generation_metadata: {
              status: 'insufficient_content',
              reason: skipReason,
              transcript_word_count: wordCount,
              guard: 'pipeline',
            },
            ai_generated: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'meeting_id' });

          await supabase.from('meetings').update({
            notes_style_3: friendlyMessage,
            notes_generation_status: 'insufficient_content',
            notes_model_used: 'none',
            word_count: wordCount,
            updated_at: new Date().toISOString(),
          }).eq('id', meetingId);

          await supabase.from('meeting_notes_queue').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }).eq('meeting_id', meetingId);
        } catch (saveErr) {
          console.warn('⚠️ Failed to persist insufficient-content state:', saveErr);
        }

        try {
          await supabase.from('meeting_generation_log').insert({
            meeting_id: meetingId,
            primary_model: 'none',
            actual_model_used: 'none',
            fallback_count: 0,
            generation_ms: 0,
            skip_reason: skipReason,
            detected_content_type: skipReason,
            transcript_word_count: wordCount,
            duration_seconds: meetingDurationSeconds,
            transcript_snippet: fullTranscript.slice(0, 200),
            detail_tier: detailTier,
          });
        } catch (logErr) {
          console.warn('⚠️ Failed to log insufficient-content event:', logErr);
        }

        return new Response(JSON.stringify({
          status: 'insufficient_content',
          reason: skipReason,
          transcript_word_count: wordCount,
          duration_seconds: meetingDurationSeconds,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      console.log('⚠️ forceGenerate=true — bypassing pipeline guard');
    }

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

    // Auto-detect meeting format if user didn't explicitly set it (default is 'face-to-face')
    if (meeting.meeting_format === 'face-to-face' || !meeting.meeting_format) {
      const detectedFormat = detectMeetingFormat(cleanedTranscript);
      if (detectedFormat !== 'face-to-face') {
        console.log(`📍 Auto-detected meeting format: ${detectedFormat} (was: ${meeting.meeting_format || 'not set'})`);
        
        const { error: formatUpdateError } = await supabase
          .from('meetings')
          .update({ meeting_format: detectedFormat })
          .eq('id', meetingId);
        
        if (formatUpdateError) {
          console.warn('⚠️ Failed to update meeting format:', formatUpdateError.message);
        } else {
          meeting.meeting_format = detectedFormat;
          console.log(`✅ Meeting format updated to: ${detectedFormat}`);
        }
      } else {
        console.log('📍 Format detection confirms face-to-face (or no clear signals)');
      }
    }

    console.log('📄 Using', transcriptUsed, 'transcript for notes generation');

    // ============= APPLY PERSISTENT NAME/TERM CORRECTIONS =============
    // Load corrections from the database (user-specific + global + practice-level)
    let correctionsApplied = 0;
    let correctionsList: Array<{ incorrect: string; correct: string }> = [];
    try {
      console.log('📋 Loading term corrections...');
      
      // Fetch all applicable corrections: user's own, global, and practice-level
      const { data: corrections, error: corrError } = await supabase
        .from('medical_term_corrections')
        .select('incorrect_term, correct_term, usage_count')
        .or(`user_id.eq.${meeting.user_id},is_global.eq.true${meeting.practice_id ? `,practice_id.eq.${meeting.practice_id}` : ''}`)
        .order('usage_count', { ascending: false });
      
      if (corrError) {
        console.warn('⚠️ Failed to load corrections:', corrError.message);
      } else if (corrections && corrections.length > 0) {
        console.log(`📋 Loaded ${corrections.length} term corrections`);
        
        // Store for AI prompt injection
        correctionsList = corrections.map(c => ({ 
          incorrect: c.incorrect_term, 
          correct: c.correct_term 
        }));
        
        // Apply corrections directly to the transcript text
        for (const correction of corrections) {
          const incorrectTerm = correction.incorrect_term.trim();
          const correctTerm = correction.correct_term.trim();
          
          // Case-insensitive word boundary replacement
          const regex = new RegExp(
            `\\b${incorrectTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 
            'gi'
          );
          
          const before = cleanedTranscript;
          cleanedTranscript = cleanedTranscript.replace(regex, (match) => {
            // Preserve case: if original is capitalised, capitalise replacement
            if (match[0] === match[0].toUpperCase() && match.slice(1) === match.slice(1).toLowerCase()) {
              return correctTerm.charAt(0).toUpperCase() + correctTerm.slice(1);
            }
            if (match === match.toUpperCase()) {
              return correctTerm.toUpperCase();
            }
            return correctTerm;
          });
          
          if (cleanedTranscript !== before) {
            correctionsApplied++;
          }
        }
        
        console.log(`✅ Applied corrections to transcript (${correctionsApplied} terms matched)`);
      } else {
        console.log('📋 No term corrections found for this user/practice');
      }
    } catch (correctionError) {
      console.warn('⚠️ Correction loading failed (non-fatal):', correctionError);
    }

    // Detail level instructions for note generation
    const detailInstructions: Record<string, string> = {
      'brief': `
[INTERNAL — do not include this header in the output] Detail target: BRIEF
- Focus ONLY on key decisions and action items
- Executive summary: 1-2 sentences maximum
- Discussion summary: Maximum 3 key points, each with Agreed line only (skip Context, Discussion, and Implication sub-sections)
- Replace "Meeting Purpose" with a single sentence
- Skip DECISIONS REGISTER section (covered in key points)
- Keep total notes to approximately 300 words`,
      
      'summary': `
[INTERNAL — do not include this header in the output] Detail target: SUMMARY
- Concise coverage of main discussion points
- Executive summary: 2-3 sentences
- Discussion summary: 4-5 key points with Context and Agreed sub-sections only (skip Discussion and Implication to save space)
- Keep total notes to approximately 500 words`,
      
      'standard': `
[INTERNAL — do not include this header in the output] Detail target: STANDARD
- Complete meeting notes with all relevant details
- Follow the full format as specified
- Include all sections with appropriate detail
- Keep total notes to approximately 800 words`,
      
      'detailed': `
[INTERNAL — do not include this header in the output] Detail target: DETAILED
- Comprehensive notes with full context
- Expanded executive summary with key quotes
- Thorough discussion of all points raised
- Include nuances and alternative viewpoints mentioned
- Keep total notes to approximately 1200 words`,
      
      'full': `
[INTERNAL — do not include this header in the output] Detail target: FULL
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
IMPORTANT: Do NOT use Context/Discussion/Agreed/Implication sub-headings.
Instead, use traditional key points where each topic is its own markdown heading:

KEY POINTS format — produce topic sections in EXACTLY this layout:
### [Topic Heading on its own line]

[Body paragraph starts here AFTER A BLANK LINE. One or two concise paragraphs covering what was discussed and what was decided. Keep it tight — no more than 4-5 sentences per point.]

### [Next Topic Heading on its own line]

[Body paragraph after a blank line.]

CRITICAL FORMATTING RULES for Key Points:
- Each topic title MUST be a level-3 markdown heading (### Topic Name) on its own line. The DOCX exporter relies on this to apply the blue Heading 3 style.
- Do NOT use inline bold (e.g. "**Topic Name** body text...") for topic titles. Inline bold renders as body text and loses the heading style.
- Do NOT use numbered lists (e.g. "1. **Topic**") for topic titles — use ### headings instead.
- There MUST be a completely blank line between the ### heading and the body paragraph beneath it.
- Do NOT put any body content on the same line as the heading.

Additional rules:
- Balanced professional language — formal but accessible
- Include a Decisions Register section
- Include Open Items & Risks section
- Full action items with owners and deadlines
- Suitable for general practice meetings, PCN meetings, team meetings`,

      'nhs-formal': `
NOTE TYPE: NHS FORMAL GOVERNANCE
This is a shorter, more formal style preferred for board packs and governance circulation.
IMPORTANT: For this note type, use a SIMPLER discussion structure. Do NOT use the Context/Discussion/Agreed/Implication sub-headings.
Instead, use key points where each topic is its own markdown heading:

KEY POINTS format:
### [Topic Heading]

[One or two concise paragraphs covering what was discussed and what was decided. Use formal passive voice: "The meeting noted...", "It was resolved that...", "Members agreed...". Keep it tight — no more than 4-5 sentences per point.]

CRITICAL: Each topic title MUST be a level-3 markdown heading (### Topic Name) on its own line, followed by a blank line, then the body paragraph. Do NOT use inline bold (e.g. "**Topic** body...") — the DOCX exporter relies on ### to apply the blue Heading 3 style.

Additional NHS Formal rules:
- Use formal NHS governance language throughout
- Suitable for ICB circulation, CQC review, Board packs
- Use passive voice: "The meeting noted...", "It was resolved that...", "Members agreed..."
- Include explicit risk statements
- Structure with clear governance headers: DECISIONS (using RESOLVED/AGREED/NOTED labels), RISKS, ESCALATIONS
- Add "For Information", "For Decision", "For Approval" markers where appropriate
- Include quorum confirmation if attendance suggests it
- Keep action items formal with clear ownership
- This style is deliberately more concise than Standard — aim for approximately 60% of the word count`,

      'clinical': `
NOTE TYPE: CLINICAL TEAM MEETING
Structured for MDT, clinical governance, or clinical team meetings.
- Use clinical terminology appropriate for healthcare professionals
- Structure discussion points using an adapted SOAP framework where relevant:
  **Situation:** What was presented / the clinical scenario
  **Background:** Relevant history, guidelines, or data
  **Assessment:** Clinical discussion, differing views, risk assessment
  **Plan:** Agreed clinical actions, pathways, safety netting
- Highlight patient pathways, clinical outcomes, and care decisions
- Include a separate SAFETY CONSIDERATIONS section for any patient safety items raised
- Reference clinical guidelines (NICE, BNF, local pathways) if mentioned
- Use appropriate clinical abbreviations (define on first use)
- Include red flags and safety netting advice where clinically relevant
- Action items should distinguish between clinical actions and administrative actions
- Suitable for clinical governance records and CQC evidence`,

      'action-focused': `
NOTE TYPE: ACTION-FOCUSED EXECUTIVE SUMMARY
Designed for busy executives who need to act, not read.
IMPORTANT: Drastically reduce narrative. This should be the shortest note type.

Structure:
1. QUICK REFERENCE box at the top: "X decisions made | Y actions assigned | Z deadlines this month"
2. DECISIONS — bullet list of every decision, one line each, prefixed with **[RESOLVED]**, **[AGREED]**, or **[NOTED]** label, bold the outcome
3. ACTION ITEMS — the full action table with owners and deadlines (this is the PRIMARY content)
4. KEY CONTEXT — only 2-3 sentences of background, maximum, for each major topic. Only include context that is essential to understand the actions.
5. RISKS — bullet list only if there are genuine risks or blockers

Rules:
- Lead with actions and decisions, not discussion
- No detailed discussion summaries — if it didn't result in a decision or action, skip it
- Clear ownership and deadlines for every action — chase any that are TBC
- Maximum 1 page of content (excluding the action table)
- This style should be approximately 40% of Standard word count`,

      'educational': `
NOTE TYPE: EDUCATIONAL / CPD SESSION NOTES
Structured for training sessions, educational meetings, significant event analyses, and CPD activities.

Structure:
1. SESSION OVERVIEW — title, facilitator/presenter, date, duration
2. LEARNING OBJECTIVES — what the session aimed to achieve (extract from discussion or infer)
3. KEY LEARNING POINTS — the main educational content, structured as numbered takeaways
   For each point: what was taught/discussed and why it matters for practice
4. DISCUSSION & REFLECTION — key questions raised, different perspectives shared, areas of uncertainty
5. PRACTICE IMPLICATIONS — how this learning should change day-to-day clinical or operational practice
6. ACTION POINTS — specific follow-up actions (e.g., update protocols, share with team, further reading)
7. CPD STATEMENT — a brief reflective summary suitable for a CPD portfolio entry:
   "This [duration] session on [topic] covered [key areas]. Key learning included [1-2 points]. 
   I will apply this by [specific change]. This session contributes approximately [X] hours of CPD."

Rules:
- Frame everything through a learning lens — what can be taken away and applied
- Include suggested further reading or resources if mentioned
- Note any training requirements or competency gaps identified
- Suitable for CPD portfolios, training records, and appraisal evidence`,

      'ageing-well': `
NOTE TYPE: AGEING WELL – COMPLEX FRAILTY REVIEW (UK GP)

IMPORTANT: For this note type, COMPLETELY IGNORE the standard meeting notes format above.
Instead, generate an exceptionally comprehensive clinical record using ONLY the structure and rules below.

ROLE & TONE:
You are acting as a UK GP with specialist interest in Older Adults / Frailty.
Writing defensive, CQC-ready, medico-legal clinical notes.
Using British English, NHS terminology, and professional GP narrative style.
Writing notes intended for EMIS or SystmOne, not patient-facing prose.
Do not summarise briefly. Err heavily on the side of over-documentation.

CONTEXT & ASSUMPTIONS:
Assume the patient is elderly, frail, multi-morbid.
The review is planned, extended, and holistic.
Multiple issues were discussed even if not all are explicitly stated.
The clinician expects depth, nuance, and clinical reasoning.
If information is not explicitly stated, document it as:
"Explored / discussed – no concerns raised"
"Denies / not reported during review"
"To be clarified at follow-up"

STRUCTURE (MANDATORY – use ONLY these two sections):

History

Medical History Review (Comprehensive)
For each long-term condition: Diagnosis, Current stability, Symptoms discussed, Impact on function, Red flags explicitly excluded.
Include: Cardiovascular, Respiratory, Neurological, Endocrine, Renal, Musculoskeletal, Mental health, Sensory (vision/hearing), Continence issues.

Medication Review (Polypharmacy-Focused)
Full medication reconciliation. Adherence, understanding, practical issues. Side-effects explicitly explored.
Anticholinergic burden / sedation / falls risk. PRN use. OTC / supplements.
Changes made, stopped, or considered. Rationale for continuing high-risk meds if applicable.
Document clinical reasoning, not just outcomes.

Cognitive & Mental Health Assessment
Memory concerns explored (patient and carer perspective). Orientation, attention, executive function (informal clinical assessment).
Mood, anxiety, apathy, loneliness. Delirium risk factors. Capacity considerations if relevant.
Any safeguarding or vulnerability concerns.



Plan

Management Plan
Clear, itemised plan. Who is responsible for each action. Timescales. Monitoring arrangements. Follow-up plans.

Patient & Carer Understanding
What was explained. Level of understanding. Agreement with plan. Concerns raised.

Time & Complexity Statement
Include: "This was a prolonged and complex Ageing Well review involving multiple comorbidities, polypharmacy, functional assessment, and anticipatory care planning. Total clinician time exceeded standard consultation length."

STYLE RULES (VERY IMPORTANT):
- Use full clinical sentences
- Avoid bullet-point minimalism
- Include negative findings
- Include clinical reasoning
- Document what was considered, not just what was done
- Write as if the notes may be read at CQC, coroner's court, or complaint review

OUTPUT FORMAT:
- Use ONLY two sections: History and Plan, separated by three blank lines
- Plain clinical text only
- No emojis
- No markdown beyond headings
- No tables
- No summarisation
- Length is not capped

FINAL INSTRUCTION:
If the consultation lasted two hours, the notes should look like two hours of work.`
    };

    const selectedNoteTypeInstruction = noteTypeInstructions[noteType] || noteTypeInstructions['standard'];
    console.log('📊 Using note type:', noteType);

    // Only enforce Context/Discussion/Agreed/Implication structure for Standard note type
    const formatCheckBlock = noteType === '__structured__' ? `
═══ MANDATORY FORMAT CHECK ═══
EVERY key point above MUST use these EXACT bold sub-headings on their own lines. This is NOT optional:

   **Context:** [text]

   **Discussion:** [text]

   **Agreed:** [text]

   **Implication:** [text]

If ANY key point is written as a plain paragraph without these four bold sub-headings, your output is INCORRECT. Go back and restructure it.
A key point that is just a paragraph of text is WRONG. It MUST have the four labelled sections.
The **Agreed:** line is the single most important line in the entire document — make the outcome absolutely explicit and specific.
═══ END FORMAT CHECK ═══` : `
═══ FORMAT NOTE ═══
For this note type, use the structure specified in the NOTE TYPE instructions above.
Do NOT use Context/Discussion/Agreed/Implication sub-headings unless the NOTE TYPE instructions explicitly require them.
Follow the NOTE TYPE format EXACTLY as specified — it takes priority over any other structural instructions in this prompt.
═══ END FORMAT NOTE ═══`;

    const keyPointsTemplate = noteType === '__structured__' ? `
1. **[Topic Heading]**

   **Context:** [One sentence — why this topic was raised, what triggered the discussion]

   **Discussion:** [2-4 sentences covering the key positions, figures, and concerns raised. Include specific numbers, names, and quotes where the transcript supports them. Weight the detail by how much discussion time the topic received — longer debates deserve fuller coverage.]

   **Agreed:** [One sentence stating the outcome in bold. What was decided, agreed, or resolved? If no decision was reached, state "No formal decision was reached — to be revisited at [next meeting/date]."]

   **Implication:** [One sentence — what this means going forward for practices, patients, or the organisation]

2. **[Next Topic Heading]**

   **Context:** [...]
   **Discussion:** [...]
   **Agreed:** [...]
   **Implication:** [...]

(Continue for all significant discussion items, typically 3-8 topics per meeting)` : `
Follow the structure specified in the NOTE TYPE instructions above for each key point.
(Continue for all significant discussion items, typically 3-8 topics per meeting)`;

    const discussionQualityRules = noteType === '__structured__' ? `
DISCUSSION POINT QUALITY RULES:
- Weight each key point's detail by how much discussion time it received in the transcript. If a governance debate dominates 40 minutes of a 60-minute meeting, it should be the longest and most detailed point — not given equal weight to a 2-minute operational update.
- Every key point MUST have all four sub-sections: Context, Discussion, Agreed, and Implication. Do not skip any.
- The "Agreed" line is the most important part of each key point — a reader skimming the notes should be able to read ONLY the "Agreed" lines and understand every outcome from the meeting.
- Bold the "Agreed" line content (not just the label) for visual scanning: **Agreed: Tom will attend the board meeting on 18th March to represent PCN concerns.**
- Do NOT pad short topics with filler. If a topic was a brief update with no discussion, it's fine for the Discussion section to be one sentence.
- If there were opposing views or concerns raised, capture them briefly: "Members expressed concern that..." or "Sam noted that..." — but keep it governance-safe per the tone rules.
- Include specific figures, percentages, pound amounts, dates, and names wherever the transcript contains them. These are what make notes useful vs generic.
- NEVER start a discussion point with "The group discussed..." or "Members talked about..." — lead with the substance: "LD health check completion rates have risen from 60.5% to 78.5%."` : `
DISCUSSION POINT QUALITY RULES:
- Follow the NOTE TYPE format instructions above — they take priority over any other structural guidance.
- Weight each key point's detail by how much discussion time it received in the transcript.
- Include specific figures, percentages, pound amounts, dates, and names wherever the transcript contains them.
- NEVER start a discussion point with "The group discussed..." — lead with the substance.
- Do NOT pad short topics with filler.`;

    const finalChecklist = noteType === '__structured__' ? `
═══ FINAL OUTPUT CHECKLIST — VERIFY BEFORE RESPONDING ═══
Before returning your response, check:
1. Does EVERY key point under DISCUSSION SUMMARY have bold **Context:**, **Discussion:**, **Agreed:**, and **Implication:** sub-headings? If not, fix it now.
2. Is there a # DECISIONS REGISTER section with every entry labelled **[RESOLVED]**, **[AGREED]**, or **[NOTED]**? If not, add it now.
3. Does the EXECUTIVE SUMMARY contain BOTH a paragraph AND bullet points? If no bullets, add 3-5 now.
4. Are action items specific deliverables with clear end points (not monitoring tasks or ongoing responsibilities)?
If any check fails, fix it before returning.
═══ END CHECKLIST ═══` : `
═══ FINAL OUTPUT CHECKLIST ═══
Before returning your response, check:
1. Have you followed the NOTE TYPE format instructions exactly?
2. Are action items specific deliverables with clear end points?
3. Is British English spelling used throughout?
If any check fails, fix it before returning.
═══ END CHECKLIST ═══`;

    // Format date in British format with day of week (moved up — needed by systemPrompt below)
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
    const meetingYear = meetingDate.getFullYear();

    // Build a single consolidated system prompt. Previous version was ~30,000
    // chars across multiple concatenated blocks with heavy duplication, which
    // pushed Sonnet 4.6 generation latency past the 90s edge-function timeout
    // on transcripts >5,000 words. May 2026 rewrite — see commit history for
    // the full archaeology.
    let systemPrompt = `You are a professional meeting notes assistant for NHS primary care. Produce governance-grade meeting notes from the provided transcript.

═══════════════════════════════════════════════════════════════════════════════
DATE CONTEXT
═══════════════════════════════════════════════════════════════════════════════
The meeting date is ${formattedDate} (year ${meetingYear}). Resolve all relative dates ("next month", "the 21st", "Friday") against this date. Never use a year earlier than ${meetingYear} unless the transcript explicitly says so. When in doubt, use ${meetingYear}.

═══════════════════════════════════════════════════════════════════════════════
NON-MEETING CHECK (run first)
═══════════════════════════════════════════════════════════════════════════════
If the transcript is not a genuine meeting (entertainment, casual chat, test recording, background noise, or under ~300 words of substantive content), respond with EXACTLY this JSON and nothing else:
{ "is_meeting": false, "detected_content_type": "<entertainment|casual_conversation|test_recording|too_short|unclear>", "explanation": "<one sentence>" }

Never invent a meeting from non-meeting content.

═══════════════════════════════════════════════════════════════════════════════
LANGUAGE AND TERMINOLOGY
═══════════════════════════════════════════════════════════════════════════════
British English throughout: organised, realise, colour, centre, programme, whilst, amongst, fulfil, learnt, analyse, behaviour. UK date format with day of week ("Wednesday 31st August 2026"). 24-hour time with BST/GMT label. £ before figures.

NHS acronyms — do NOT expand unless the transcript itself does so: PML, NRES, NMoC, ICB, MNP, IHO, AFT, LMC, BMA, GMS, PCN, PCSE, ARRS, DES, LES, SDA, SNO, NHFT, NGH, KGH, CSO, GPAD, CAIP, NMC, GMC, MHRA, CQC, DSPT, ICS, DPIA, MOU, GDPR, BST, GMT, GPA, EA, ENN, ITP, LFPSE, FCP, ACP, SPLW, PLT, MDT, PAC.

Common transcription corrections to apply silently when context is clear: "BNA" → "BMA", "lobotomy" → "phlebotomy" (in clinical contexts), "GMC contract" → "GMS contract", phonetic mishearings of "Towcester" / "Brackley" / "Notewell".

═══════════════════════════════════════════════════════════════════════════════
ANTI-FABRICATION
═══════════════════════════════════════════════════════════════════════════════
Where the transcript is unclear, write "TBC" — never invent. Specifically:
- Dates: if a date is vague ("Thursday in May", "next month"), write the phrase as spoken with "(date TBC)". Only resolve dates that are actually specific.
- Times: if not stated, write "Not specified". Never default to "14:00" or similar.
- Attendees: list only those explicitly named or in the authoritative context. Do not infer from speakers being mentioned.
- Action owners: assign a name only when the transcript explicitly states the person committed to the task. Do not infer ownership from role, mention, or "as Julian said". For "invite [X] to the next meeting", the OWNER is whoever is doing the inviting (often TBC), not the invitee.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (the DOCX exporter parses these headers — keep them exact)
═══════════════════════════════════════════════════════════════════════════════

Start your response immediately with "# MEETING DETAILS". No title or preamble before it.

# MEETING DETAILS
Date: [British format with day of week]
Time: [24-hour with BST/GMT]
Location: [from authoritative context — never override]

(Each field on its own line, no bullets. Do not emit a Title field — it is rendered separately.)

# EXECUTIVE SUMMARY
One paragraph, 3-4 sentences. Cover: main focus, key decisions, critical timelines or risks, one distinguishing detail.

# ATTENDEES
- [Name] (Organisation/Role) — if known from authoritative context
- [Name] — if organisation unknown

# DISCUSSION SUMMARY

**Meeting Purpose:** [one sentence]

Key Points

${keyPointsTemplate}

${discussionQualityRules}

# DECISIONS REGISTER
Categorise every decision using exactly one of these labels:
- **RESOLVED** — formal vote took place (moved, seconded, carried). Use only when the transcript contains explicit voting language.
- **AGREED** — clear consensus reached. Test: someone proposed a specific course of action AND either others endorsed it or the chair summarised it as the position with discussion moving on. Informal agreement counts.
- **NOTED** — matter was discussed or reported on, no specific action agreed. Also use when an officer is informing the committee of a decision taken elsewhere.

If unsure between AGREED and NOTED, use NOTED. Never infer agreement from absence of disagreement.

Format: - **[RESOLVED/AGREED/NOTED]** [What was decided — one line, with who/what/when if known]

(If no decisions: "No formal decisions were recorded in this meeting")

# ACTION ITEMS
| Action | Owner | Deadline |
|--------|-------|----------|
| [Specific deliverable] | [Name OR "TBC"] | [Date OR "TBC"] |

Columns must appear in this exact order. Never use "Responsible Party" instead of "Owner". No Priority column.

ACTION CAPTURE RULES:
- Scan the ENTIRE transcript, especially AOB, "next steps", closing remarks, and the final third.
- Capture as actions: "I'll take that away", "let me come back to you", "I'll follow up", "[Name] to [verb]", "next meeting we should…", "invite X to the next meeting".
- Owner-bearing items in the Decisions Register or Next Meeting section MUST also appear here. Decisions and actions are not mutually exclusive.
- Maximum 8 actions. Prefer NEW actions over carried-forward ones.
- Exclude: ongoing responsibilities ("continue to monitor"), vague statements without commitment ("consider options"), and items with no identifiable owner.
- If unclear whether something is an action, capture it with deadline = TBC.

# OPEN ITEMS & RISKS
- Items deferred or requiring future consideration
- Outstanding issues or unresolved questions
- Strategic considerations for future meetings

# NEXT MEETING
[Date if mentioned, otherwise "To be determined"]

═══════════════════════════════════════════════════════════════════════════════
GOVERNANCE TONE
═══════════════════════════════════════════════════════════════════════════════
Output must be suitable for NHS Board Packs, ICB circulation, FOI response, and CQC review — while preserving operational substance and named concerns.

- Replace staff names in performance/capability/private contexts with role descriptors ("a pharmacist", "an FCP"). Never include personal health, behaviour, or relationship detail about named individuals.
- Recast performance language in neutral governance terms ("areas for development were noted", "has not yet completed the qualification").
- Preserve operational concerns, financial figures, and named conflicts of interest with attribution. "Disposer is rubbish, 40 minute wait" → "Members noted operational concerns with the Disposer pathway, including reported wait times of approximately 40 minutes." Do not sanitise to the point of erasure.
- Translate metaphors to literal meaning rather than dropping them.
- Use indirect speech, not quotation marks around informal speech.
- Neutralise emotional intensity but keep the content that triggered it.
- Use governance verbs: "members discussed", "concerns were raised", "it was agreed that", "clarification was sought".
- NEVER drop: decisions, actions, dates, financial figures, estates/legal/contracting details, workforce numbers, named risks, conflicts of interest.

═══════════════════════════════════════════════════════════════════════════════
FORMATTING RULES (DOCX exporter depends on these)
═══════════════════════════════════════════════════════════════════════════════
- Top-level sections use # (level-1 markdown headers).
- Topic headings inside Discussion Summary use ### (level-3 headers) on their own line, blank line, then body. Do NOT use inline bold for topic titles — the DOCX exporter relies on ### to apply Heading 3 style.
- Action Items must be a markdown table with pipes.
- Never use ## for main sections.

${selectedNoteTypeInstruction}

${detailTier === 'standard' ? selectedDetailInstruction : ''}
${detailTier === 'concise' ? '\nLENGTH: Concise tier — target 600-900 words. Limit each section to 2-3 sentences. Prefer bullets over prose. Decisions, actions, figures, named risks must still be captured verbatim — only narrative density is reduced.\n' : ''}${detailTier === 'detailed' ? '\nLENGTH: Detailed tier — target 2,000-3,500 words. Use full prose with operational texture, specific figures, attributed quotes-as-paraphrase, and the substance of debate. Every additional sentence must add a fact, attribution, figure, or operational context. Aim for at least 2,000 words.\n' : ''}

CROSS-REFERENCE HANDLING: If the transcript includes a "CROSS-REFERENCE" section, treat it as secondary. Use the primary transcript as source of truth for all facts and decisions. Use cross-reference only to clarify unclear names or resolve ambiguous terms. Never introduce a topic, decision, or action that only appears in the cross-reference.${transcriptUsed === 'raw-optimized' ? '\n\nTRANSCRIPT QUALITY NOTE: This transcript may contain minor speech recognition artefacts, duplicates, or fragments. Filter obvious duplicates whilst preserving meaningful content.' : ''}`;

    // Append corrections list if any
    if (correctionsList.length > 0) {
      const topCorrections = correctionsList.slice(0, 50);
      const correctionsBlock = topCorrections
        .map(c => `"${c.incorrect}" → "${c.correct}"`)
        .join('\n');
      systemPrompt += `

KNOWN CORRECTIONS — apply these and similar phonetic variations throughout:
${correctionsBlock}`;
    }

    // Diagnostic
    const tierMarkerPresent = systemPrompt.includes('LENGTH: Concise tier')
      || systemPrompt.includes('LENGTH: Detailed tier');
    console.log(`🎚️ [detailTier] prompt-assembled tier='${detailTier}' directiveInPrompt=${tierMarkerPresent} promptLength=${systemPrompt.length} (target <10,000)`);





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

    // Format meeting date for title context (Europe/London, BST/GMT-aware)
    const formattedMeetingDate = meeting.start_time
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(meeting.start_time))
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
            documentNames: uploadedDocuments?.map(d => d.file_name),
            meetingId: meetingId
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
    // Stage 3 — title generation complete (success or skipped).
    stamp('notes_title_generated_at');

    // Format start time in UK local time (BST/GMT) so the label tracks the actual timezone.
    // CRITICAL: Only mark these as authoritative if the meeting record actually has an
    // explicit start_time AND it differs materially from created_at. Several import paths
    // (notably the Plaud webhook when recordedAt is missing) set start_time = now() at
    // import time, which the model then dutifully renders as "14:00 GMT" etc.
    // Heuristic: if start_time is within 5 minutes of created_at, assume it was auto-set
    // at import and treat it as not specified.
    const createdTime = new Date(meeting.created_at);
    const rawStartTime = meeting.start_time ? new Date(meeting.start_time) : null;
    const startTimeDiffMinutes = rawStartTime
      ? Math.abs(rawStartTime.getTime() - createdTime.getTime()) / 60_000
      : Infinity;
    const hasExplicitStartTime = !!rawStartTime && startTimeDiffMinutes > 5;
    const startTime = hasExplicitStartTime ? rawStartTime! : createdTime;
    const formattedStartTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(startTime);
    if (!hasExplicitStartTime && rawStartTime) {
      console.log(`📅 start_time (${rawStartTime.toISOString()}) within 5 min of created_at (${createdTime.toISOString()}) — treating as auto-set, not authoritative`);
    }

    // Soft-hint extractor: scan title, agenda, and uploaded document filenames for a
    // human-written date (e.g. "1 May 2026", "01-05-2026", "2026-05-01"). If we find one
    // that differs from start_time by >=1 day, surface it as a hint so the model can flag
    // the divergence rather than silently rendering the (possibly wrong) DB start_time.
    const extractFirstDate = (text: string | null | undefined): { iso: string; label: string } | null => {
      if (!text) return null;
      const monthLookup: Record<string, number> = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
        sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
      };
      const monthIdx = (m: string): number | undefined => monthLookup[m.toLowerCase()];
      // 1) "1 May 2026" / "01 May 2026" / "1st May 2026"
      const m1 = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i);
      if (m1) {
        const d = parseInt(m1[1], 10);
        const mo = monthIdx(m1[2]);
        const y = parseInt(m1[3], 10);
        if (mo !== undefined) return { iso: `${y}-${String(mo + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, label: `${d} ${m1[2]} ${y}` };
      }
      // 2) ISO "2026-05-01"
      const m2 = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
      if (m2) return { iso: `${m2[1]}-${m2[2]}-${m2[3]}`, label: `${m2[3]}/${m2[2]}/${m2[1]}` };
      // 3) UK "01/05/2026" or "01-05-2026" (assume DD/MM/YYYY for UK)
      const m3 = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
      if (m3) {
        const d = parseInt(m3[1], 10), mo = parseInt(m3[2], 10), y = parseInt(m3[3], 10);
        if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
          return { iso: `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`, label: `${d}/${mo}/${y}` };
        }
      }
      return null;
    };

    const candidateSources: Array<{ source: string; text: string | null | undefined }> = [
      { source: 'title',   text: generatedTitle },
      { source: 'agenda',  text: meeting.agenda },
      ...(uploadedDocuments?.map(d => ({ source: 'filename', text: d.file_name })) ?? []),
    ];
    let dateHint: { iso: string; label: string; source: string } | null = null;
    for (const c of candidateSources) {
      const found = extractFirstDate(c.text);
      if (found) { dateHint = { ...found, source: c.source }; break; }
    }
    // Only surface the hint if it materially differs from start_time (>=1 day apart).
    const startIsoDate = startTime.toISOString().slice(0, 10);
    const hintDiffersFromStart = dateHint && dateHint.iso !== startIsoDate;

    const recordingStartLine = hasExplicitStartTime
      ? `Recording Start Time: ${formattedStartTime}`
      : `Recording Start Time: Not specified in source — leave the Time field as "Not specified" in the output. Do NOT use the system import timestamp.`;

    let meetingDateLine: string;
    if (!hasExplicitStartTime) {
      meetingDateLine = `Meeting Date: ${formattedDate}  (year = ${meetingYear} — NOTE: this is the system import date, not a confirmed meeting date. If the transcript, filename, or agenda mentions a different date, prefer that. Use the year above only to resolve bare/relative dates.)`;
    } else if (hintDiffersFromStart && dateHint) {
      meetingDateLine = `Meeting Date: ${formattedDate}  (year = ${meetingYear} — system-recorded start date. NOTE: the meeting ${dateHint.source} suggests "${dateHint.label}" which may be the actual meeting date. If the transcript explicitly confirms one of these, use that; otherwise prefer the ${dateHint.source} date and append "(verify)" in the Date field.)`;
    } else {
      meetingDateLine = `Meeting Date: ${formattedDate}  (year = ${meetingYear} — resolve all bare/relative dates against this)`;
    }


    const userPrompt = `Meeting Title: ${generatedTitle}
${meetingDateLine}
${recordingStartLine}
Duration: ${meeting.duration_minutes || 'Not specified'} minutes

${contextInfo}

Transcript:
${cleanedTranscript}`;

    console.log('🔧 Using selected model for manual regeneration:', modelOverride);
    console.log('📊 System prompt length:', systemPrompt.length, 'chars');
    console.log('📊 User prompt length:', userPrompt.length, 'chars');
    // Stage 4 — system + user prompts fully assembled, ready to call the model.
    stamp('notes_prompt_assembled_at');

    // ============= CHUNKED MAP-REDUCE PATH (long transcripts only) =============
    // Triggered for transcripts >15,000 chars on Claude path (≈ 15 minutes of
    // meeting audio). Map step uses claude-haiku-4-5 in parallel; reduce step
    // uses claude-sonnet-4-6. Single-shot path below remains the fallback if
    // this errors out, and the user can also explicitly bypass it via
    // `forceSingleShot: true` (the "Regenerate with Sonnet" refine button).
    const CHUNK_THRESHOLD_CHARS = 15000;
    const CHUNK_SIZE = 30000;
    const CHUNK_OVERLAP = 500;
    const CHUNK_CONCURRENCY = 1; // Sequential — Sonnet merge is expensive, no need to fan out

    const notesGenStart = Date.now();
    let generatedNotes = '';
    let modelUsed = modelOverride;

    // Chunking is only used for Sonnet/Haiku Claude models. Gemini 3.1 Pro and
    // Gemini 2.5 Flash (1M context) handle long transcripts single-shot.
    // The refine flow (`forceSingleShot`) explicitly skips chunking even on
    // long transcripts so the user gets a clean independent Sonnet pass.
    const useChunking = !forceSingleShot && (
      modelOverride.startsWith('claude-sonnet-') ||
      modelOverride.startsWith('claude-haiku-')
    ) && cleanedTranscript.length > CHUNK_THRESHOLD_CHARS;

    if (forceSingleShot) {
      console.log(`✋ forceSingleShot=true — bypassing chunked path (transcript ${cleanedTranscript.length} chars)`);
    }

    if (useChunking) {
      try {
        console.log(`🧩 Chunked path: ${cleanedTranscript.length} chars > ${CHUNK_THRESHOLD_CHARS}, splitting…`);
        const chunks = splitTextIntoChunks(cleanedTranscript, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`🧩 ${chunks.length} chunks; concurrency=${CHUNK_CONCURRENCY}`);

        const summaries: string[] = new Array(chunks.length);
        let cursor = 0;
        const worker = async () => {
          while (true) {
            const i = cursor++;
            if (i >= chunks.length) break;
            const { data, error } = await supabase.functions.invoke('summarize-transcript-chunk', {
              body: { text: chunks[i], meetingTitle: generatedTitle, chunkIndex: i, totalChunks: chunks.length, detailLevel: 'standard', meetingDate: formattedDate, meetingYear },
            });
            if (error) {
              console.warn(`🧩 chunk ${i} invoke error: ${error.message ?? error}`);
              summaries[i] = `_[unsummarised excerpt — chunk ${i + 1}/${chunks.length}, reason: invoke error]_\n\n${chunks[i].slice(0, 1800)}`;
            } else {
              summaries[i] = data?.summary || `_[unsummarised excerpt — chunk ${i + 1}/${chunks.length}, reason: empty]_\n\n${chunks[i].slice(0, 1800)}`;
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, worker));

        console.log('🧩 All chunks summarised; invoking merge-meeting-minutes…');
        const { data: merged, error: mergeErr } = await supabase.functions.invoke('merge-meeting-minutes', {
          body: { summaries, meetingTitle: generatedTitle, meetingDate: formattedDate, meetingTime: formattedStartTime, detailLevel: 'standard' },
        });
        if (mergeErr) throw new Error(`merge-meeting-minutes failed: ${mergeErr.message ?? mergeErr}`);
        generatedNotes = merged?.meetingMinutes || '';
        if (!generatedNotes.trim()) throw new Error('merge step returned empty content');
        modelUsed = `${modelOverride}+chunked-haiku`;
        console.log(`✅ Chunked path complete in ${Date.now() - notesGenStart}ms, ${generatedNotes.length} chars`);
      } catch (chunkedErr: any) {
        console.warn(`⚠️ Chunked path failed (${chunkedErr.message}); falling through to single-shot.`);
        generatedNotes = '';
      }
    }

    // Single-shot path with automatic fallback chain.
    // Primary model is whatever modelOverride resolves to; if it fails (timeout, 5xx, empty),
    // we automatically retry with the next model in the chain. This protects against
    // transient Pro outages and Google-wide incidents.
    const skipSingleShot = generatedNotes.trim().length > 0;
    let extractionReasoningTrace: string | null = null;
    let extractedActionCount: number | null = null;
    let decisionCount: number | null = null;
    let nextMeetingItemCount: number | null = null;
    let crossSectionCheckPerformed = false;

    const stripExtractionReasoningTrace = (notes: string): string => {
      if (!notes) return notes;
      const traceMatch = notes.match(/<!--\s*ACTION_EXTRACTION_REASONING_TRACE_START([\s\S]*?)ACTION_EXTRACTION_REASONING_TRACE_END\s*-->/i);
      if (traceMatch) {
        extractionReasoningTrace = traceMatch[1].trim().slice(0, 12000);
        crossSectionCheckPerformed = /re-?scanned?\s+the\s+Decisions\s+Register|cross-?section\s+check|Next\s+Meeting\s+sections/i.test(extractionReasoningTrace);
        return notes.replace(traceMatch[0], '').replace(/^\s+/, '').trim();
      }
      crossSectionCheckPerformed = /I\s+have\s+re-?scanned?\s+the\s+Decisions\s+Register|cross-?section\s+check\s*:/i.test(notes);
      return notes;
    };

    const countMarkdownTableRows = (section: string): number => section
      .split('\n')
      .filter((line) => line.trim().startsWith('|'))
      .filter((line) => !/\|[-:\s|]+\|/.test(line))
      .filter((line) => !/\b(action|owner|deadline|decision|status|date|item)\b/i.test(line))
      .length;

    const extractSection = (notes: string, headingPattern: string): string => {
      const match = notes.match(new RegExp(`#{1,3}\\s*(?:${headingPattern})\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s+|$)`, 'i'));
      return match?.[1] || '';
    };

    const countBulletsOrLines = (section: string, emptyPattern: RegExp): number => {
      const trimmed = section.trim();
      if (!trimmed || emptyPattern.test(trimmed)) return 0;
      if (trimmed.includes('|')) return countMarkdownTableRows(trimmed);
      const bulletCount = trimmed.split('\n').filter((line) => /^\s*(?:[-*•]|\d+\.)\s+\S/.test(line)).length;
      return bulletCount || 1;
    };

    const collectExtractionDiagnostics = (notes: string) => {
      const actionSection = extractSection(notes, 'ACTION\\s+ITEMS|Action\\s+Items');
      const decisionSection = extractSection(notes, 'DECISIONS\\s+REGISTER|Decisions\\s+Register');
      const nextMeetingSection = extractSection(notes, 'NEXT\\s+MEETING|Next\\s+Meeting');

      extractedActionCount = countBulletsOrLines(actionSection, /no\s+(action\s+items|actions)\s+(were\s+)?recorded/i);
      decisionCount = countBulletsOrLines(decisionSection, /no\s+(formal\s+)?decisions\s+(were\s+)?recorded/i);
      nextMeetingItemCount = countBulletsOrLines(nextMeetingSection, /to\s+be\s+determined|not\s+(mentioned|specified|confirmed)/i);
    };

    // ─── Timeout + fallback chain ──────────────────────────────────────────
    // AUTO PATH (no caller modelOverride):
    //   - 30s per attempt
    //   - Multi-step fallback chain across providers
    //
    // OVERRIDE PATH (caller specified modelOverride in the request body):
    //   - 90s per attempt (Sonnet / GPT on long governance transcripts need it)
    //   - no automatic fallback: a failed requested model must surface to the user
    //     instead of silently producing notes with a different footer/model.
    // Bumped 30s→90s: 14k-word governance transcripts on Flash + fallback chain
    // were timing out before any model could stream. 90s gives Flash room to
    // complete and still leaves headroom for the fallback chain within Edge limits.
    const AUTO_PER_ATTEMPT_TIMEOUT_MS = 90_000;
    // Detailed tier on long governance transcripts can push Sonnet/GPT past 90s.
    // 180s gives headroom; same-model retry still bounded so worst case ~6 minutes.
    const OVERRIDE_PER_ATTEMPT_TIMEOUT_MS = 180_000;
    const PER_ATTEMPT_TIMEOUT_MS = callerSpecifiedModel
      ? OVERRIDE_PER_ATTEMPT_TIMEOUT_MS
      : AUTO_PER_ATTEMPT_TIMEOUT_MS;
    const buildFallbackChain = (primary: string): string[] => {
      // Caller-specified models are audit comparisons: do not substitute another model.
      // Allow ONE same-model retry to absorb transient network blips (timeout / 5xx / 429).
      // The catch block below decides whether the retry actually fires based on error class.
      if (callerSpecifiedModel) {
        return [primary, primary];
      }
      // First-pass auto-default: when MEETING_PRIMARY_MODEL is Sonnet (current
      // operational policy), behave like an override — Sonnet retry only, no
      // silent substitution to a different provider. Quality has been validated
      // for Sonnet at standard tier; Flash/Pro fabricate, so falling back to
      // them on transient Sonnet errors would degrade output without the user
      // knowing. A permanent Sonnet failure must surface as a real error.
      if (primary === 'claude-sonnet-4-6') {
        return ['claude-sonnet-4-6', 'claude-sonnet-4-6'];
      }
      if (primary === 'gemini-3-flash') {
        return ['gemini-3-flash', 'gemini-3.1-pro', 'gemini-2.5-pro', 'gpt-5'];
      }
      if (primary === 'gemini-3.1-pro' || primary === 'gemini-3.1-pro-preview') {
        return ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-2.5-pro', 'gpt-5'];
      }
      return [primary];
    };
    const chain = buildFallbackChain(modelOverride);
    const failureReasons: Array<{ model: string; reason: string }> = [];
    let actualModelUsed = modelOverride;
    let fallbackCount = 0;
    // Diagnostic capture for Gemini Pro attempts (read by /admin/llm-diagnostics)
    let proStatusCode: number | null = null;
    let proElapsedMs: number | null = null;
    let proErrorMessage: string | null = null;
    let fallbackReason: string | null = null;

    // Helper: run a single model attempt. Returns notes string on success, throws on failure.
    const runAttempt = async (modelKey: string): Promise<string> => {
      // Single per-attempt timeout for all models. Flash returns in ~1–2s, so 30s
      // is generous; Pro/2.5-pro/gpt-5 fallbacks share the same budget.
      const timeoutMs = PER_ATTEMPT_TIMEOUT_MS;
      const attemptController = new AbortController();
      const attemptTimeout = setTimeout(() => attemptController.abort(), timeoutMs);
      try {
        let notes = '';
        if (modelKey.startsWith('claude-') || modelKey === 'sonnet-4.6') {
          const claudeModel = modelKey === 'sonnet-4.6' ? 'claude-sonnet-4-6' : modelKey;
          console.log(`🧠 [attempt] Claude model: ${claudeModel} (streaming)`);
          const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
          if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
              'accept': 'text/event-stream',
            },
            body: JSON.stringify({
              model: claudeModel,
              max_tokens: 8000,
              stream: true,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
            signal: attemptController.signal,
          });
          // Stage 5 — request dispatched, headers received (covers TLS + Anthropic queue time).
          stamp('notes_request_dispatched_at');
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Anthropic ${response.status}: ${errorData.substring(0, 300)}`);
          }
          if (!response.body) {
            throw new Error('Anthropic returned no response body for streaming request');
          }
          // SSE reader loop. Anthropic's streaming format emits lines like:
          //   event: content_block_delta
          //   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
          // We accumulate text_delta chunks into `notes` and stamp first-token + stream-complete.
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let firstDeltaWritten = false;
          let sawMessageStop = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              // Process complete SSE events (separated by blank lines).
              let sepIdx: number;
              while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, sepIdx);
                buffer = buffer.slice(sepIdx + 2);
                let dataLine = '';
                for (const line of rawEvent.split('\n')) {
                  if (line.startsWith('data:')) dataLine += line.slice(5).trim();
                }
                if (!dataLine) continue;
                let payload: any;
                try { payload = JSON.parse(dataLine); } catch { continue; }
                const eventType = payload?.type;
                if (eventType === 'content_block_delta') {
                  const delta = payload?.delta;
                  if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                    // Only stamp first-token on a delta that actually carries text.
                    // Anthropic occasionally emits a zero-length text_delta right after
                    // content_block_start, which would falsely register as <2ms TTFT.
                    if (!firstDeltaWritten && delta.text.length > 0) {
                      firstDeltaWritten = true;
                      // Stage 6 — model time-to-first-token.
                      stamp('notes_first_delta_at');
                    }
                    notes += delta.text;
                  }
                } else if (eventType === 'message_stop') {
                  sawMessageStop = true;
                } else if (eventType === 'error') {
                  const errMsg = payload?.error?.message || JSON.stringify(payload?.error || payload);
                  throw new Error(`Anthropic stream error: ${errMsg.substring(0, 300)}`);
                }
              }
            }
          } finally {
            try { reader.releaseLock(); } catch { /* ignore */ }
          }
          // Stage 7 — stream complete (pure model generation time).
          stamp('notes_stream_complete_at');
          console.log(`✅ Sonnet stream complete: chars=${notes.length}, message_stop=${sawMessageStop}`);
        } else if (modelKey === 'gpt-5.2' || modelKey === 'openai-flagship') {
          // OpenAI GPT-5.2 — current flagship on the Lovable AI Gateway, used
          // as a third-provider option alongside Sonnet 4.6 and Gemini.
          console.log('🧠 [attempt] OpenAI gpt-5.2 via gateway');
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'openai/gpt-5.2',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_completion_tokens: 8000,
            }),
            signal: attemptController.signal,
          });
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Gateway gpt-5.2 ${response.status}: ${errorData.substring(0, 300)}`);
          }
          const data = await response.json();
          notes = data.choices?.[0]?.message?.content || '';
        } else if (modelKey === 'gpt-5') {
          // OpenAI provider via Lovable AI Gateway — different-provider fallback
          // protects against Google-wide outages.
          console.log('🧠 [attempt] OpenAI gpt-5 via gateway');
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'openai/gpt-5',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_completion_tokens: 8000,
            }),
            signal: attemptController.signal,
          });
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Gateway gpt-5 ${response.status}: ${errorData.substring(0, 300)}`);
          }
          const data = await response.json();
          notes = data.choices?.[0]?.message?.content || '';
        } else {
          // Gemini routing.
          //   'gemini-3.1-pro' / 'gemini-3.1-pro-preview' → google/gemini-3.1-pro-preview (default)
          //   'gemini-2.5-pro' → google/gemini-2.5-pro (stable fallback)
          //   'gemini-2.5-flash' → google/gemini-2.5-flash (premium long-context override)
          //   'gemini-3-flash' or anything else → google/gemini-3-flash-preview
          let geminiModel = 'google/gemini-3-flash-preview';
          if (modelKey === 'gemini-3.1-pro' || modelKey === 'gemini-3.1-pro-preview') {
            geminiModel = 'google/gemini-3.1-pro-preview';
          } else if (modelKey === 'gemini-2.5-pro') {
            geminiModel = 'google/gemini-2.5-pro';
          } else if (modelKey === 'gemini-2.5-flash') {
            geminiModel = 'google/gemini-2.5-flash';
          }
          console.log(`🧠 [attempt] Gemini model: ${geminiModel}`);
          const isPro = modelKey === 'gemini-3.1-pro' || modelKey === 'gemini-3.1-pro-preview';
          const proStart = isPro ? Date.now() : 0;
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: geminiModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_completion_tokens: 8000,
            }),
            signal: attemptController.signal,
          });
          if (isPro) {
            proStatusCode = response.status;
            proElapsedMs = Date.now() - proStart;
          }
          if (!response.ok) {
            const errorData = await response.text();
            if (isPro) proErrorMessage = `HTTP ${response.status}: ${errorData.substring(0, 500)}`;
            // 429 and 402 are user-facing — surface immediately rather than silently fall back.
            if (response.status === 429) throw new Error('RATE_LIMIT: Rate limit exceeded. Please wait a moment and try again.');
            if (response.status === 402) throw new Error('CREDITS: Insufficient AI credits. Please add credits to your workspace.');
            if (response.status === 413) throw new Error(`Lovable AI 413: Transcript too large.`);
            throw new Error(`Lovable AI ${response.status}: ${errorData.substring(0, 300)}`);
          }
          const responseText = await response.text();
          if (!responseText || responseText.trim().length === 0) {
            if (isPro) proErrorMessage = 'Empty response body';
            throw new Error('Lovable AI returned empty response body');
          }
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseErr: any) {
            if (isPro) proErrorMessage = `Parse error: ${parseErr?.message || 'invalid JSON'}`;
            throw parseErr;
          }
          notes = data.choices?.[0]?.message?.content || '';
        }
        if (!notes || notes.trim().length === 0) {
          throw new Error('AI returned empty content');
        }
        // Stamp first-token time on the meeting (used by /admin/pipeline-test and
        // useful in production for slow-response diagnostics). Non-streaming providers
        // approximate this as the moment the response body is fully received.
        // We await this — fire-and-forget promises get killed when the edge function
        // returns its response, which previously left this column NULL on completed runs.
        try {
          await supabase
            .from('meetings')
            .update({ notes_first_delta_at: new Date().toISOString() })
            .eq('id', meetingId)
            .is('notes_first_delta_at', null);
        } catch (stampErr) {
          console.warn('⚠️ Failed to stamp notes_first_delta_at:', stampErr);
        }
        return notes;
      } finally {
        clearTimeout(attemptTimeout);
      }
    };

    if (!skipSingleShot) {
      let lastError: Error | null = null;
      // Classify an error as transient (worth a same-model retry) vs permanent.
      // Transient: timeout, 408, 429, 5xx, network/abort. Permanent: other 4xx (auth, bad request, content policy).
      const isTransientError = (err: any): boolean => {
        if (err?.name === 'AbortError') return true;
        const msg: string = typeof err?.message === 'string' ? err.message : String(err ?? '');
        // Match "Provider 408: ...", "Anthropic 429: ...", "Lovable AI 503: ...", "Gateway gpt-5.2 502: ..."
        const statusMatch = msg.match(/\b(\d{3})\b/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1], 10);
          if (status === 408 || status === 429 || status >= 500) return true;
          // Any other 4xx is permanent (auth, validation, content policy, etc.)
          if (status >= 400 && status < 500) return false;
        }
        // Network-level failures with no HTTP status — treat as transient.
        if (/network|fetch failed|ECONN|ETIMEDOUT|socket hang up/i.test(msg)) return true;
        // Empty body / parse errors — also worth one retry.
        if (/empty response|invalid JSON|parse error/i.test(msg)) return true;
        return false;
      };

      for (let i = 0; i < chain.length; i++) {
        const attemptModel = chain[i];
        const isSameModelRetry = callerSpecifiedModel && i > 0 && chain[i] === chain[i - 1];
        // For same-model retries on the override path, give the upstream provider a brief
        // breather (especially helpful for 429 rate limits and transient 5xx).
        if (isSameModelRetry) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        const attemptStart = Date.now();
        let attemptStatus: 'success' | 'timeout' | 'error' = 'error';
        let attemptReason: string | null = null;
        try {
          console.log(`🔁 Attempt ${i + 1}/${chain.length}: ${attemptModel}${callerSpecifiedModel ? (isSameModelRetry ? ` (override path, ${PER_ATTEMPT_TIMEOUT_MS / 1000}s, same-model retry)` : ` (override path, ${PER_ATTEMPT_TIMEOUT_MS / 1000}s)`) : ' (auto path, 30s)'}`);
          generatedNotes = await runAttempt(attemptModel);
          actualModelUsed = attemptModel;
          fallbackCount = i;
          modelUsed = attemptModel;
          attemptStatus = 'success';
          if (i > 0) {
            console.log(`⚡ ${isSameModelRetry ? 'Same-model retry' : 'Fallback'} succeeded with ${attemptModel} (primary attempt failed)`);
          }
          // Per-attempt log row for the override path so the audit trail covers
          // both attempts (primary + same-model retry). Auto path keeps its
          // single summary row at the end (existing behaviour).
          if (callerSpecifiedModel) {
            try {
              await supabase.from('meeting_generation_log').insert({
                meeting_id: meetingId,
                primary_model: chain[0] || modelOverride,
                actual_model_used: attemptModel,
                fallback_count: i,
                generation_ms: Date.now() - attemptStart,
                failure_reasons: null,
                fallback_reason: isSameModelRetry ? 'same_model_retry' : null,
                detail_tier: detailTier,
              });
            } catch (logErr) {
              console.warn('⚠️ Failed to log override-path attempt (non-blocking):', logErr);
            }
          }
          break;
        } catch (err: any) {
          const isAbort = err?.name === 'AbortError';
          attemptStatus = isAbort ? 'timeout' : 'error';
          const reason = isAbort
            ? `timeout after ${Math.round(PER_ATTEMPT_TIMEOUT_MS / 1000)}s`
            : (err?.message || 'unknown error');
          attemptReason = reason;
          console.warn(`⚠️ Attempt ${i + 1} (${attemptModel}) failed: ${reason}`);
          failureReasons.push({ model: attemptModel, reason });
          // Per-attempt failure log for override path.
          if (callerSpecifiedModel) {
            try {
              await supabase.from('meeting_generation_log').insert({
                meeting_id: meetingId,
                primary_model: chain[0] || modelOverride,
                actual_model_used: attemptModel,
                fallback_count: i,
                generation_ms: Date.now() - attemptStart,
                failure_reasons: [{ model: attemptModel, reason, status: attemptStatus }],
                fallback_reason: isSameModelRetry ? 'same_model_retry_failed' : attemptStatus,
                detail_tier: detailTier,
              });
            } catch (logErr) {
              console.warn('⚠️ Failed to log override-path attempt failure (non-blocking):', logErr);
            }
          }
          // Capture Pro-specific diagnostics (only the first Pro attempt — index 0).
          const isPro = attemptModel === 'gemini-3.1-pro' || attemptModel === 'gemini-3.1-pro-preview';
          if (isPro && fallbackReason === null) {
            if (isAbort) {
              fallbackReason = 'timeout';
              if (proErrorMessage === null) proErrorMessage = reason;
              if (proStatusCode === null) proStatusCode = 0;
            } else if (typeof err?.message === 'string' && err.message.startsWith('Lovable AI ')) {
              fallbackReason = 'http_error';
              if (proErrorMessage === null) proErrorMessage = err.message.substring(0, 500);
            } else if (typeof err?.message === 'string' && /JSON|parse/i.test(err.message)) {
              fallbackReason = 'parse_error';
              if (proErrorMessage === null) proErrorMessage = err.message.substring(0, 500);
            } else {
              fallbackReason = 'other';
              if (proErrorMessage === null) proErrorMessage = (err?.message || String(err)).substring(0, 500);
            }
          }
          lastError = err instanceof Error ? err : new Error(String(err));
          // Surface CREDITS errors immediately — no point retrying. RATE_LIMIT (429) IS retried once.
          if (typeof err?.message === 'string' && err.message.startsWith('CREDITS:')) {
            throw new Error(err.message.replace(/^CREDITS:\s*/, ''));
          }
          // Override path: if the error is non-transient (e.g. 400/401/403 content policy or auth),
          // don't waste a retry — fail fast with a clear message.
          if (callerSpecifiedModel && !isTransientError(err)) {
            console.warn(`⛔ Non-transient error on override path — skipping same-model retry.`);
            break;
          }
        }
      }
      if (!generatedNotes || generatedNotes.trim().length === 0) {
        console.error('❌ All fallback attempts exhausted');
        // Build a clearer error for caller-specified models so the toast can say
        // "Sonnet 4.6 failed after N attempts: <reason>".
        if (callerSpecifiedModel) {
          const attempts = failureReasons.length;
          const lastReason = failureReasons[failureReasons.length - 1]?.reason || (lastError?.message ?? 'unknown error');
          throw new Error(`${modelOverride} failed after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${lastReason}`);
        }
        throw lastError || new Error('All AI generation attempts failed');
      }

      // Repair malformed "## Heading | col | col |" lines emitted by the AI by splitting
      // the heading from the table header onto separate lines.
      generatedNotes = generatedNotes.replace(
        /^(#{1,6}\s+[A-Za-z][A-Za-z0-9\s&]*?)\s+(\|\s*[A-Za-z].*\|)\s*$/gm,
        '$1\n\n$2'
      );

      generatedNotes = stripExtractionReasoningTrace(generatedNotes);
      collectExtractionDiagnostics(generatedNotes);

      console.log('✅ Generated notes length:', generatedNotes.length, 'chars', '| model:', actualModelUsed, '| fallbacks:', fallbackCount);
    }

    if (skipSingleShot) {
      generatedNotes = stripExtractionReasoningTrace(generatedNotes);
      collectExtractionDiagnostics(generatedNotes);
    }

    // ─── LLM REFUSAL DETECTION ────────────────────────────────────────────
    // The system prompt instructs the model to return a strict JSON refusal
    // ({ "is_meeting": false, ... }) when the transcript is not a meeting.
    // Detect that and surface the same friendly message as the pipeline guard.
    if (!forceGenerate) {
      try {
        const trimmed = generatedNotes.trim();
        const jsonCandidate = trimmed.startsWith('```')
          ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
          : trimmed;
        if (jsonCandidate.startsWith('{') && jsonCandidate.includes('"is_meeting"')) {
          const parsed = JSON.parse(jsonCandidate);
          if (parsed && parsed.is_meeting === false) {
            const detectedType: string = typeof parsed.detected_content_type === 'string'
              ? parsed.detected_content_type
              : 'unclear';
            const explanation: string = typeof parsed.explanation === 'string'
              ? parsed.explanation
              : 'Content does not appear to be a meeting.';

            console.log(`⛔ LLM refusal: detected_content_type=${detectedType} — ${explanation}`);

            const friendlyMessage = `# This recording does not appear to be a meeting\n\nNotewell AI evaluated the transcript and concluded the content type is **${detectedType}**.\n\n> ${explanation}\n\nNo meeting notes have been generated to avoid hallucinating content. If this recording is genuinely a meeting, please use the **Override and generate anyway** button on the meeting card, or contact support.\n\n---\n\n*Recording details: ${meetingDurationSeconds ?? '—'} seconds, ${wordCount} words.*`;

            try {
              await supabase.from('meeting_summaries').upsert({
                meeting_id: meetingId,
                summary: friendlyMessage,
                generation_metadata: {
                  status: 'insufficient_content',
                  reason: 'llm_refused_non_meeting',
                  detected_content_type: detectedType,
                  explanation,
                  transcript_word_count: wordCount,
                  duration_seconds: meetingDurationSeconds,
                  guard: 'llm',
                },
                ai_generated: false,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'meeting_id' });

              await supabase.from('meetings').update({
                notes_style_3: friendlyMessage,
                notes_generation_status: 'insufficient_content',
                notes_model_used: stampModelWithTier(actualModelUsed),
                word_count: wordCount,
                updated_at: new Date().toISOString(),
              }).eq('id', meetingId);

              await supabase.from('meeting_notes_queue').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
              }).eq('meeting_id', meetingId);
            } catch (saveErr) {
              console.warn('⚠️ Failed to persist LLM-refusal state:', saveErr);
            }

            try {
              await supabase.from('meeting_generation_log').insert({
                meeting_id: meetingId,
                primary_model: chain[0] || modelOverride,
                actual_model_used: actualModelUsed,
                fallback_count: fallbackCount,
                generation_ms: Date.now() - notesGenStart,
                skip_reason: 'llm_refused_non_meeting',
                detected_content_type: detectedType,
                transcript_word_count: wordCount,
                duration_seconds: meetingDurationSeconds,
                transcript_snippet: fullTranscript.slice(0, 200),
                detail_tier: detailTier,
              });
            } catch (logErr) {
              console.warn('⚠️ Failed to log LLM refusal:', logErr);
            }

            return new Response(JSON.stringify({
              status: 'insufficient_content',
              reason: 'llm_refused_non_meeting',
              detected_content_type: detectedType,
              explanation,
              transcript_word_count: wordCount,
              duration_seconds: meetingDurationSeconds,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      } catch (parseErr) {
        // Not JSON — proceed normally
      }
    }

    // Log generation outcome to meeting_generation_log (admin-readable monitoring).
    // Non-blocking — log failure must not break note generation.
    try {
      await supabase.from('meeting_generation_log').insert({
        meeting_id: meetingId,
        primary_model: chain[0] || modelOverride,
        actual_model_used: actualModelUsed,
        fallback_count: fallbackCount,
        generation_ms: Date.now() - notesGenStart,
        failure_reasons: failureReasons.length > 0 ? failureReasons : null,
        extracted_action_count: extractedActionCount,
        decision_count: decisionCount,
        next_meeting_item_count: nextMeetingItemCount,
        cross_section_check_performed: crossSectionCheckPerformed,
        extraction_reasoning_trace: extractionReasoningTrace,
        pro_status_code: proStatusCode,
        pro_elapsed_ms: proElapsedMs,
        pro_error_message: proErrorMessage,
        fallback_reason: fallbackReason,
        detail_tier: detailTier,
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to write generation log (non-blocking):', logErr);
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

    const notesGenEnd = Date.now();
    // ── 7-Category QC Audit (inline, non-blocking) ────────────────────
    const qcStart = Date.now();
    let qcResult: any = null;
    if (skipQc) {
      console.log('⏭️ QC audit skipped (disabled by user setting)');
      qcResult = { status: 'skipped', reason: 'disabled_by_user', ran_at: new Date().toISOString() };
    } else {
    try {
      console.log('🔍 Running 7-category QC audit via Claude Haiku 4.5...');
      const anthropicQcKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
      if (!anthropicQcKey) {
        throw new Error('ANTHROPIC_API_KEY not configured — skipping QC');
      }

      const QC_SYSTEM_PROMPT = `You are a meeting notes quality auditor for an NHS governance platform. You receive a source transcript and AI-generated meeting notes. Your job is to check for specific categories of error by comparing the notes against the transcript.

Check each category and return your findings as JSON.

CATEGORIES:

1. FABRICATED_DECISIONS
Check the decisions register. For every item marked RESOLVED, verify that the transcript contains explicit voting language (moved, seconded, carried, aye). For every item marked AGREED, verify that the transcript shows a positive signal — someone stating a conclusion AND others explicitly endorsing it or the chair confirming the position. For every item marked NOTED, verify the information was actually presented in the transcript. Flag any decision that cannot be traced to specific transcript content. Flag any item categorised as RESOLVED or AGREED that should be NOTED.

2. FABRICATED_ACTIONS
Check each action item. Verify that every action is traceable to something actually said in the transcript. Flag any action where the task, owner, or deadline does not appear in the source. Flag actions that convert conditional statements into unconditional commitments. Flag any action with a named owner where the transcript does not explicitly assign that person.

3. MISSING_SPEAKERS
Check whether speakers who are named in the transcript have been anonymised to "a member", "members", or "it was noted" in the notes. If a person is named in the transcript and their specific contribution appears in the notes, they should be named in the notes. List each instance where attribution was lost.

4. CURRENCY_DETECTION
If the transcript references New Zealand-specific entities (New Zealand, Waipa, Waikato, RMA, Te Waka, NZ alert levels, council/district council in NZ context), monetary values should use $ or NZD. If the transcript references NHS, PCN, ICB, or UK-specific entities, monetary values should use £ or GBP. Flag any currency mismatch between the detected context and the values used in the notes.

5. ATTENDEE_GAPS
Compare speaker names that appear in the transcript against the attendee list in the notes. Flag any person who speaks or is directly addressed by name in the transcript but is not listed as an attendee. Do not flag people who are merely referenced or mentioned in passing without being present.

6. PROMPT_LEAK
Check for any text in the notes that appears to be internal system instructions, template markers, or formatting directives. Examples include: "FORMAT NOTE", "NOTE TYPE", "Do NOT use", "Follow the NOTE TYPE format", "SKILL.md", or any text that reads as instructions to an AI rather than meeting content. Flag if found.

7. TONE_ESCALATION
Identify up to 3 instances where the notes use significantly more formal or corporate language than what was actually said in the transcript. For each instance, provide the approximate transcript wording and the notes wording side by side so the difference is clear.

Respond ONLY with a valid JSON object. No markdown backticks, no preamble, no explanation outside the JSON:

{
  "overall": "pass" or "fail",
  "score": <number 0-100>,
  "failed_count": <number of categories that failed>,
  "categories": {
    "fabricated_decisions": {"status": "pass" or "fail", "findings": "..."},
    "fabricated_actions": {"status": "pass" or "fail", "findings": "..."},
    "missing_speakers": {"status": "pass" or "fail", "findings": "..."},
    "currency_detection": {"status": "pass" or "fail", "findings": "..."},
    "attendee_gaps": {"status": "pass" or "fail", "findings": "..."},
    "prompt_leak": {"status": "pass" or "fail", "findings": "..."},
    "tone_escalation": {"status": "pass" or "fail", "findings": "..."}
  },
  "summary": "One sentence overall assessment"
}

Set overall to "fail" if ANY category fails. Score is your estimate of overall note quality from 0 to 100.`;

      const qcUserPrompt = `SOURCE TRANSCRIPT:\n${fullTranscript.substring(0, 80000)}\n\nGENERATED MEETING NOTES:\n${generatedNotes}`;

      const qcController = new AbortController();
      const qcTimeout = setTimeout(() => qcController.abort(), 30000);

      const qcResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicQcKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: QC_SYSTEM_PROMPT,
          temperature: 0.1,
          messages: [{ role: 'user', content: qcUserPrompt }],
        }),
        signal: qcController.signal,
      });

      clearTimeout(qcTimeout);

      if (!qcResponse.ok) {
        const errText = await qcResponse.text();
        throw new Error(`Anthropic QC API error: ${qcResponse.status} - ${errText}`);
      }

      const qcData = await qcResponse.json();

      if (qcData.stop_reason === 'max_tokens') {
        console.warn('⚠️ QC response was truncated (max_tokens reached)');
      }

      const qcText = qcData.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      let cleanedQcText = qcText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleanedQcText);
      } catch (_parseErr) {
        console.warn('⚠️ QC JSON parse failed, attempting repair…');
        let opens = 0, openBrackets = 0;
        let inString = false, escaped = false;
        for (const ch of cleanedQcText) {
          if (escaped) { escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') opens++;
          else if (ch === '}') opens--;
          else if (ch === '[') openBrackets++;
          else if (ch === ']') openBrackets--;
        }
        if (inString) cleanedQcText += '"';
        cleanedQcText += ']'.repeat(Math.max(0, openBrackets));
        cleanedQcText += '}'.repeat(Math.max(0, opens));
        parsed = JSON.parse(cleanedQcText);
        console.log('✅ QC JSON repaired successfully');
      }

      qcResult = {
        status: parsed.overall === 'pass' ? 'passed' : 'failed',
        score: parsed.score,
        failed_count: parsed.failed_count,
        categories: parsed.categories,
        summary: parsed.summary,
        model_used: 'claude-haiku-4-5',
        ran_at: new Date().toISOString(),
      };

      console.log(`✅ QC audit complete: ${qcResult.status} (score: ${qcResult.score}, failed: ${qcResult.failed_count})`);

    } catch (qcError: any) {
      console.warn('⚠️ QC audit failed (non-blocking):', qcError.message);
      qcResult = {
        status: 'error',
        error_message: qcError.message || 'Unknown QC error',
        model_used: 'claude-haiku-4-5',
        ran_at: new Date().toISOString(),
      };
    }
    } // end if (!skipQc)

    // Build generation metadata from available variables
    const generationMetadata = {
      model_used: modelUsed || modelOverride || 'unknown',
      generated_at: new Date().toISOString(),
      notes_length: generatedNotes?.length || 0,
      qc: qcResult || null,
      skip_qc: skipQc,
    };

    // Save or update notes in database using upsert to handle existing records
    const { error: summaryError } = await supabase
      .from('meeting_summaries')
      .upsert({
        meeting_id: meetingId,
        summary: generatedNotes,
        key_points: [],
        action_items: [],
        decisions: [],
        next_steps: [],
        ai_generated: true,
        updated_at: new Date().toISOString(),
        generation_metadata: generationMetadata,
      }, { onConflict: 'meeting_id' });

    if (summaryError) {
      console.error('❌ Error saving summary:', summaryError);
      throw summaryError;
    }

    const { error: notesMirrorError } = await supabase
      .from('meetings')
      .update({
        notes_style_3: generatedNotes,
        notes_generation_status: 'completed',
        primary_transcript_source: normaliseTranscriptSourceForMeeting(actualTranscriptSource),
        notes_model_used: stampModelForRefine(actualModelUsed),
      })
      .eq('id', meetingId);

    if (notesMirrorError) {
      console.error('❌ Failed to mirror generated notes to meetings.notes_style_3:', notesMirrorError);
      throw new Error(`Failed to save regenerated notes to meeting record: ${notesMirrorError.message}`);
    }

    // Extract and store action items immediately after notes are saved
    try {
      console.log('📋 Extracting action items from generated notes...');

      // On forceRegenerate, delete existing action items first so the user can
      // actually recover from corrupt data by clicking Regenerate Notes. Otherwise,
      // skip extraction if items already exist to avoid duplicates on idempotent runs.
      if (forceRegenerate) {
        console.log('🗑️ forceRegenerate=true — deleting existing action items before re-extraction');
        const { error: deleteError } = await supabase
          .from('meeting_action_items')
          .delete()
          .eq('meeting_id', meetingId);
        if (deleteError) {
          console.warn('⚠️ Failed to delete existing action items (continuing anyway):', deleteError.message);
        } else {
          console.log('✅ Existing action items cleared');
        }
      } else {
        const { data: existingItems } = await supabase
          .from('meeting_action_items')
          .select('id')
          .eq('meeting_id', meetingId)
          .limit(1);

        if (existingItems && existingItems.length > 0) {
          console.log('⚠️ Action items already exist for this meeting, skipping extraction');
        }
      }

      // Only proceed with extraction if forceRegenerate OR no existing items
      const shouldExtract = forceRegenerate || await (async () => {
        const { data: existingItems } = await supabase
          .from('meeting_action_items')
          .select('id')
          .eq('meeting_id', meetingId)
          .limit(1);
        return !existingItems || existingItems.length === 0;
      })();

      if (shouldExtract) {
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
          const parseCells = (row: string): string[] => row.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
          const isSeparatorRow = (row: string): boolean => /\|[-:\s|]+\|/.test(row);
          const tableLines = tableMatch[0].split('\n').filter((line: string) => line.trim().startsWith('|'));
          const headerRow = tableLines.find((line: string) => !isSeparatorRow(line));
          const headers = headerRow ? parseCells(headerRow) : [];
          const findColumnIndex = (headers: string[], ...patterns: RegExp[]): number =>
            headers.findIndex(h => patterns.some(p => p.test(h.toLowerCase().replace(/\*+/g, '').trim())));

          const actionIdx = findColumnIndex(headers, /\baction\b/, /task/, /next step/, /agreed action/);
          const ownerIdx = findColumnIndex(headers, /owner/, /assignee/, /lead/, /responsible/, /who/);
          const deadlineIdx = findColumnIndex(headers, /due/, /deadline/, /date/, /when/, /timescale/);
          const priorityIdx = findColumnIndex(headers, /priority/);

          // Fallback to the standard positional layout only if a column header was not recognised
          const safeActionIdx = actionIdx >= 0 ? actionIdx : 0;
          const safeOwnerIdx = ownerIdx >= 0 ? ownerIdx : 1;
          const safeDeadlineIdx = deadlineIdx >= 0 ? deadlineIdx : 2;
          const safePriorityIdx = priorityIdx >= 0 ? priorityIdx : 3;
          const tableRows = tableLines.filter((line: string) => line !== headerRow && !isSeparatorRow(line));
          
          for (const row of tableRows) {
            const cells = parseCells(row);
            if (cells.length < 2) continue;  // not enough cells to be an action row

            const actionText = cells[safeActionIdx] || '';
            const assignee = cells[safeOwnerIdx] || 'TBC';
            const deadline = cells[safeDeadlineIdx] || 'TBC';
            const priority = cells[safePriorityIdx] || 'Medium';
            if (!actionText || actionText.toLowerCase() === 'tbc') continue;  // skip empty action rows
              
            // Skip if action text is too short or is a header
            if (actionText.length < 25 || actionText.match(/^Action$/i)) continue;
              
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
                if (rawText.length < 25) continue;
                
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
                if (seenTexts.has(normalizedText) || normalizedText.length < 25) continue;
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
        
        // Quality filter: remove vague/ongoing items that aren't real deliverables
        const vaguePatterns = [
          /^(?:continue|keep|maintain|ensure|remain)\s+(?:to\s+)?(?:monitor|review|assess|track|oversee|watch|check)/i,
          /^monitor\s/i,
          /^review\s+(?:situation|position|progress|status)\s/i,
          /^(?:consider|explore|think about|look into)\s+(?:options|possibilities|alternatives|ways)/i,
          /^keep\s+(?:an eye|track|monitoring|reviewing|practices informed)/i,
          /^(?:await|wait for)\s/i,
          /^note\s+(?:that|the)\s/i,
          /^(?:be aware|stay aware|remain aware)\s/i,
          /^follow\s+up\s+(?:as needed|if required|when appropriate)/i,
          /^discuss\s+(?:at|in|during)\s+(?:next|future|upcoming)\s+meeting/i,
          /^(?:agenda item|standing item|return to this)/i,
        ];

        const filteredItems = actionItemsToInsert.filter(item => {
          const text = item.action_text.trim();
          
          if (text.length < 25) {
            console.log(`🔍 Filtered out (too short): "${text}"`);
            return false;
          }
          
          const isVague = vaguePatterns.some(pattern => pattern.test(text));
          if (isVague) {
            console.log(`🔍 Filtered out (vague/ongoing): "${text}"`);
            return false;
          }
          
          if (text.match(/^(?:action items?|open items?|next steps?|risks?|decisions?)/i)) {
            console.log(`🔍 Filtered out (header): "${text}"`);
            return false;
          }
          
          return true;
        });

        // Cap at maximum 8 action items — keep highest priority first
        const priorityOrder: Record<string, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
        const cappedItems = filteredItems
          .sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1))
          .slice(0, 8)
          .map((item, index) => ({ ...item, sort_order: index }));

        console.log(`📋 Action items: ${actionItemsToInsert.length} extracted → ${filteredItems.length} after quality filter → ${cappedItems.length} after cap`);

        // Insert filtered action items
        if (cappedItems.length > 0) {
          console.log(`📋 Inserting ${cappedItems.length} quality action items`);
          const { error: actionError } = await supabase
            .from('meeting_action_items')
            .insert(cappedItems);
          
          if (actionError) {
            console.warn('⚠️ Failed to insert action items:', actionError.message);
          } else {
            console.log('✅ Action items extracted and stored successfully');
          }
        } else {
          console.log('📋 No quality action items found after filtering');
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
    // Stage 8 — post-processing complete (action extraction + overview generation done).
    stamp('notes_post_processing_complete_at');

    // Update meeting with completion status, word count, AI overview, and generated title
    const { error: statusUpdateError } = await supabase
      .from('meetings')
      .update({ 
        notes_generation_status: 'completed',
        word_count: wordCount,
        overview: aiOverview || null,
        title: generatedTitle,
        notes_model_used: stampModelForRefine(actualModelUsed),
      })
      .eq('id', meetingId);

    if (statusUpdateError) {
      console.error('❌ CRITICAL: Failed to update meeting status to completed:', statusUpdateError.message);
      // Retry with minimal update to ensure status is set
      const { error: retryError } = await supabase
        .from('meetings')
        .update({ notes_generation_status: 'completed' })
        .eq('id', meetingId);
      if (retryError) {
        console.error('❌ CRITICAL: Retry also failed:', retryError.message);
      } else {
        console.log('✅ Retry succeeded - status set to completed (without overview/title)');
        // Try updating overview and title separately
        await supabase.from('meetings').update({ overview: aiOverview || null, title: generatedTitle }).eq('id', meetingId);
      }
    } else {
      console.log('✅ Meeting status updated to completed');
    }

    // Refine counter — bump on every successful single-shot Sonnet refine so we
    // can monitor how often the chunked default isn't good enough.
    if (forceSingleShot) {
      try {
        const { data: refRow } = await supabase
          .from('meetings')
          .select('refine_count')
          .eq('id', meetingId)
          .maybeSingle();
        const next = ((refRow as any)?.refine_count ?? 0) + 1;
        await supabase.from('meetings').update({ refine_count: next }).eq('id', meetingId);
        console.log(`✨ refine_count incremented to ${next} for meeting ${meetingId}`);
      } catch (refineErr: any) {
        console.warn('⚠️ Failed to increment refine_count (non-blocking):', refineErr?.message);
      }
    }

    // Also save overview to meeting_overviews table for consistency
    try {
      await supabase
        .from('meeting_overviews')
        .upsert({
          meeting_id: meetingId,
          overview: aiOverview || ''
        });
    } catch (overviewSaveErr) {
      console.warn('⚠️ Failed to save to meeting_overviews:', overviewSaveErr);
    }

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
        content: generatedNotes,
        modelUsed,
        actualModelUsed,
        fallbackCount,
        primaryModel: modelOverride,
        qc: qcResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in auto-generate-meeting-notes:', error.message);
    console.error('❌ Full error details:', error);
    
    // Try to update status to failed if we have meetingId
    try {
      if (meetingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Stamp the model that was attempted (even on failure) so the docx
        // footer surfaces what was tried instead of "unknown".
        const failedStamp = (() => {
          try { return stampModelWithTier(actualModelUsed || modelOverride || 'unknown'); }
          catch { return actualModelUsed || modelOverride || 'unknown'; }
        })();
        await supabase
          .from('meetings')
          .update({ 
            notes_generation_status: 'failed',
            notes_model_used: failedStamp,
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