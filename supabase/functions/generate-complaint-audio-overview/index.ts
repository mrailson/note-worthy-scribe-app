import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { complaintId, voiceProvider = 'elevenlabs', voiceId = 'G17SuINrv2H9FC6nvetn', overrideText } = await req.json();
    
    if (!complaintId) {
      throw new Error('complaintId is required');
    }

    console.log('Generating audio overview for complaint:', complaintId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get comprehensive complaint data (fetch practice separately to avoid FK issues)
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        complaint_outcomes (*),
        complaint_involved_parties (staff_name, staff_role, response_text),
        complaint_notes (note, is_internal)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      console.error('Error loading complaint:', complaintError);
      throw new Error('Unable to load complaint details');
    }

    // Check if complaint has outcome
    if (!complaint.complaint_outcomes || complaint.complaint_outcomes.length === 0) {
      throw new Error('Complaint must have an outcome to generate audio overview');
    }

    const outcome = complaint.complaint_outcomes[0];
    
    // Auto-close complaint if it has an outcome but isn't closed
    if (complaint.status !== 'closed') {
      console.log('Auto-closing complaint with outcome...');
      const { error: closeError } = await supabase
        .from('complaints')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', complaintId);
      
      if (closeError) {
        console.warn('Failed to auto-close complaint:', closeError);
        // Continue anyway - outcome exists
      } else {
        console.log('Complaint auto-closed successfully');
      }
    }
    
    let narrative: string;

    // Collect all names to redact from generated text (for privacy safety net)
    const namesToRedact: string[] = [];
    if (complaint.patient_name) namesToRedact.push(complaint.patient_name);
    if (complaint.complainant_name) namesToRedact.push(complaint.complainant_name);
    (complaint.complaint_involved_parties || []).forEach((p: any) => {
      if (p.staff_name) namesToRedact.push(p.staff_name);
    });
    
    // Use overrideText if provided, otherwise generate with AI
    if (overrideText && overrideText.trim()) {
      console.log('Using provided override text for audio generation');
      narrative = overrideText.trim();
    } else {
      console.log('Generating executive summary narrative with Lovable AI...');

      // Generate narrative using Lovable AI
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableApiKey) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      // Gather staff responses — anonymise names for privacy
      const staffResponses = (complaint.complaint_involved_parties || [])
        .filter((p: any) => p.response_text)
        .map((p: any, i: number) => `Staff Member ${i + 1} (${p.staff_role || 'Team Member'}): ${p.response_text.slice(0, 500)}`)
        .join('\n\n');

      // Gather internal notes
      const internalNotes = (complaint.complaint_notes || [])
        .filter((n: any) => n.is_internal)
        .map((n: any) => n.note.slice(0, 300))
        .join(' ');

      // Resolve practice name
      let practiceName = 'our practice';
      if (complaint.practice_id) {
        const { data: practice, error: practiceError } = await supabase
          .from('gp_practices')
          .select('practice_name')
          .eq('id', complaint.practice_id)
          .maybeSingle();
        if (practiceError) {
          console.warn('Practice lookup error:', practiceError);
        } else if (practice?.practice_name) {
          practiceName = practice.practice_name;
        }
      }
      
       const systemPrompt = `You are an NHS complaints executive briefing specialist. Your task is to produce a calm, balanced spoken overview suitable for senior practice management.

PRIVACY — ABSOLUTE RULE:
- NEVER mention any patient name, complainant name, staff member name, or any other personal name
- Refer to individuals ONLY as "the patient", "the complainant", "a staff member", "a clinician", "a member of the team", etc.
- If a name appears anywhere in the source material, you MUST replace it with a role-based reference
- This applies to ALL names without exception

Create a concise spoken summary under one minute (target 120–150 words).

Opening line (mandatory):
Start with: "Complaint number [number] received on the [date] concerns [brief issue]."
- Extract only the final sequential number by removing ALL prefix letters/digits and leading zeros (e.g. "COMP260007" → "7", "COMP250046" → "46", "COMP260001" → "1"). Never read the full reference code or year digits.
- Use the complaint submitted date, formatted as "the 7th of November", "the 12th of January" (ordinal day + "of" + full month name, always preceded by "the")
- Do not include greetings, preambles, or "Good morning"
- Limit the opening issue description to 5–7 words

Tone and approach:
- Use neutral, supportive, non-judgemental language
- Frame points as learning opportunities and service insights
- Avoid directive or instructive wording (e.g. "must", "should ensure")
- Prefer suggestive phrasing (e.g. "highlights the importance of…", "offers an opportunity to…")

Content focus (in plain prose, no headings or formatting):
- Brief particulars of the complaint
- Key learnings identified from the review
- Actions already taken or acknowledged
- Areas for ongoing consideration or improvement

Governance framing:
- Reference NHS best practice and CQC alignment in a reflective way
- Emphasise reassurance, responsiveness, and continuous improvement
- Do not imply regulatory failure unless explicitly stated in the source

Anti-hallucination rules (strict):
- Use ONLY information explicitly provided in the user prompt
- Do not invent audits, policy changes, training, system changes, or outcomes
- If something is unclear or absent, reflect this cautiously rather than inferring
- Do not embellish or add specific technical details not mentioned
- If actions are described generally, keep them general — do not add fictional specifics

Language:
- British English throughout
- Plain, spoken narrative style
- No bullet points, labels, formatting symbols, stage directions, or script notations`;

      // Helper to scrub names from text before sending to AI
      const scrubNames = (text: string): string => {
        let scrubbed = text;
        for (const name of namesToRedact) {
          if (!name || name.trim().length < 2) continue;
          const fullPattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          scrubbed = scrubbed.replace(fullPattern, '[REDACTED]');
          const parts = name.trim().split(/\s+/);
          for (const part of parts) {
            if (part.length < 3) continue;
            const partPattern = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            scrubbed = scrubbed.replace(partPattern, '[REDACTED]');
          }
        }
        return scrubbed;
      };

      const scrubbedDescription = scrubNames(complaint.complaint_description.slice(0, 800));
      const scrubbedStaffResponses = staffResponses ? scrubNames(staffResponses.slice(0, 1000)) : '';
      const scrubbedNotes = internalNotes ? scrubNames(internalNotes.slice(0, 600)) : '';
      const scrubbedOutcomeSummary = outcome.outcome_summary ? scrubNames(outcome.outcome_summary.slice(0, 800)) : '';

      const userPrompt = `Complaint Reference: ${complaint.reference_number}
Complaint Received Date: ${complaint.submitted_at ? new Date(complaint.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : new Date(complaint.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
Category: ${complaint.category}
Incident Date: ${complaint.incident_date}

Complaint Description:
${scrubbedDescription}

${scrubbedStaffResponses ? `Staff Responses:\n${scrubbedStaffResponses}\n\n` : ''}

${scrubbedNotes ? `Investigation Notes:\n${scrubbedNotes}\n\n` : ''}

Outcome: ${outcome.outcome_type}
${scrubbedOutcomeSummary ? `\nOutcome Summary:\n${scrubbedOutcomeSummary}` : ''}

IMPORTANT: Do NOT mention any patient, complainant, or staff member by name. Use role-based references only (e.g. "the patient", "the complainant", "a staff member").

Create an under-1-minute executive audio briefing using only the information provided above. Start with "Complaint number [sequential number in words] received on the [Complaint Received Date in format: the 7th of November] concerns [brief 5-7 word summary]." Then cover key learnings, actions taken (only as documented), and areas for ongoing consideration, framed reflectively in line with NHS best practice and CQC expectations.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', errorText);
        
        // Handle rate limits and credits
        if (aiResponse.status === 429) {
          throw new Error('Rate limits exceeded, please try again later.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Payment required, please add funds to your Lovable AI workspace.');
        }
        
        throw new Error('Failed to generate narrative');
      }

      const aiData = await aiResponse.json();
      narrative = aiData.choices[0].message.content;
    }

    // SAFETY NET: Scrub any personal names that may have leaked through
    // This catches cases where the AI ignores the anonymisation instruction
    if (namesToRedact && namesToRedact.length > 0) {
      for (const name of namesToRedact) {
        if (!name || name.trim().length < 2) continue;
        // Replace full name
        const fullNamePattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        narrative = narrative.replace(fullNamePattern, 'the individual');
        // Also replace individual name parts (first name, surname)
        const parts = name.trim().split(/\s+/);
        for (const part of parts) {
          if (part.length < 3) continue; // Skip initials/short words
          const partPattern = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          narrative = narrative.replace(partPattern, 'the individual');
        }
      }
      // Clean up awkward repetitions from replacement
      narrative = narrative.replace(/the individual the individual/gi, 'the individual');
    }
    
    console.log('Generated narrative length:', narrative.length);

    // Convert narrative to audio using ElevenLabs TTS
    console.log(`Converting to audio with ${voiceProvider} TTS, voice: ${voiceId}`);
    
    const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
      body: { 
        text: narrative,
        voiceId: voiceId 
      },
    });

    if (ttsError) {
      console.error('TTS error:', ttsError);
      throw new Error(`Failed to convert to audio: ${ttsError.message}`);
    }

    const { audioContent } = ttsData;

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const fileName = `${complaint.reference_number}-${Date.now()}.mp3`;
    
    console.log('Uploading audio to storage...');
    
    const { error: uploadError } = await supabase.storage
      .from('complaint-audio-overviews')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '0',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('complaint-audio-overviews')
      .getPublicUrl(fileName);

    const rawUrl = urlData.publicUrl;
    const audioUrl = `${rawUrl}?v=${Date.now()}`;

    // Estimate duration (rough: ~150 words per minute, 5 chars per word average)
    const estimatedWords = narrative.length / 5;
    const estimatedDuration = Math.ceil((estimatedWords / 150) * 60); // in seconds

    // Save to database
    console.log('Saving audio overview metadata to database...');

    // Get current user
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Upsert audio overview record
    const { error: dbError } = await supabase
      .from('complaint_audio_overviews')
      .upsert({
        complaint_id: complaintId,
        audio_overview_url: audioUrl,
        audio_overview_text: narrative,
        audio_overview_duration: estimatedDuration,
        created_by: userId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'complaint_id'
      });

    if (dbError) {
      console.error('Database update error:', dbError);
      throw new Error('Failed to save audio overview metadata');
    }

    console.log('Complaint audio overview generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        audioUrl,
        duration: estimatedDuration,
        narrative: narrative.slice(0, 200) + '...' // Preview only
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Generate complaint audio overview error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes('Rate limits') ? 429 : error.message.includes('Payment required') ? 402 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
