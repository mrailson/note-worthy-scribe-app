import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StepResult {
  step: string;
  success: boolean;
  message: string;
  durationMs?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const steps: StepResult[] = [];

  try {
    // Authenticate the calling admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify calling user is admin
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const adminUserId = claimsData.claims.sub as string;

    // Use service role for all operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin status
    const { data: adminCheck } = await supabase.rpc('is_system_admin', { user_uuid: adminUserId });
    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: 'meetingId is required' }), { status: 400, headers: corsHeaders });
    }

    console.log(`🎯 Graceful end requested for meeting: ${meetingId} by admin: ${adminUserId}`);

    // ─── Step 1: Update meeting status to completed ───
    let stepStart = Date.now();
    try {
      const { data: meetingData, error: updateError } = await supabase
        .from('meetings')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .select('id, title, user_id, created_at, duration_minutes, word_count')
        .single();

      if (updateError) throw updateError;

      steps.push({ step: 'stop_meeting', success: true, message: `Meeting "${meetingData.title}" marked as completed`, durationMs: Date.now() - stepStart });

      // Store meeting info for later steps
      const meeting = meetingData;

      // ─── Step 2: Broadcast force_stop signal ───
      stepStart = Date.now();
      try {
        const channel = supabase.channel(`meeting-kill:${meetingId}`);
        await channel.send({
          type: 'broadcast',
          event: 'force_stop',
          payload: {
            reason: 'admin_graceful_end',
            meeting_id: meetingId,
            timestamp: new Date().toISOString(),
          },
        });
        await supabase.removeChannel(channel);
        steps.push({ step: 'broadcast_stop', success: true, message: 'Kill signal broadcast to client', durationMs: Date.now() - stepStart });
      } catch (broadcastErr: any) {
        console.error('⚠️ Broadcast failed:', broadcastErr);
        steps.push({ step: 'broadcast_stop', success: false, message: broadcastErr.message || 'Broadcast failed', durationMs: Date.now() - stepStart });
      }

      // ─── Step 3: Consolidate transcript chunks ───
      stepStart = Date.now();
      try {
        console.log('📦 Invoking consolidate-meeting-chunks...');
        const { data: consolidateResult, error: consolidateError } = await supabase.functions.invoke('consolidate-meeting-chunks', {
          body: { meetingId },
        });

        if (consolidateError) throw consolidateError;
        steps.push({ step: 'consolidate', success: true, message: consolidateResult?.message || 'Transcript chunks consolidated', durationMs: Date.now() - stepStart });
      } catch (consolidateErr: any) {
        console.error('⚠️ Consolidation failed:', consolidateErr);
        steps.push({ step: 'consolidate', success: false, message: consolidateErr.message || 'Consolidation failed', durationMs: Date.now() - stepStart });
      }

      // ─── Step 4: Queue notes generation ───
      stepStart = Date.now();
      try {
        const { error: queueError } = await supabase
          .from('meeting_notes_queue')
          .upsert({
            meeting_id: meetingId,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'meeting_id' });

        if (queueError) throw queueError;
        steps.push({ step: 'queue_notes', success: true, message: 'Notes generation queued', durationMs: Date.now() - stepStart });
      } catch (queueErr: any) {
        console.error('⚠️ Queue failed:', queueErr);
        steps.push({ step: 'queue_notes', success: false, message: queueErr.message || 'Queue failed', durationMs: Date.now() - stepStart });
      }

      // ─── Step 5: Trigger immediate notes generation ───
      stepStart = Date.now();
      try {
        console.log('📝 Invoking auto-generate-meeting-notes...');
        const { data: notesResult, error: notesError } = await supabase.functions.invoke('auto-generate-meeting-notes', {
          body: {
            meetingId,
            forceRegenerate: true,
            detailLevel: 'standard',
            noteType: 'standard',
          },
        });

        if (notesError) throw notesError;
        steps.push({ step: 'generate_notes', success: true, message: notesResult?.message || 'Notes generation triggered', durationMs: Date.now() - stepStart });
      } catch (notesErr: any) {
        console.error('⚠️ Notes generation failed:', notesErr);
        steps.push({ step: 'generate_notes', success: false, message: notesErr.message || 'Notes generation failed', durationMs: Date.now() - stepStart });
      }

      // ─── Step 6: Fetch user email and send notification ───
      stepStart = Date.now();
      let userEmail = '';
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', meeting.user_id)
          .single();

        userEmail = profileData?.email || '';
        const userName = profileData?.full_name || 'there';

        if (!userEmail) {
          steps.push({ step: 'send_email', success: false, message: 'No email found for user', durationMs: Date.now() - stepStart });
        } else {
          // Wait a moment for notes generation to complete
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Fetch the generated notes
          const { data: summaryData } = await supabase
            .from('meeting_summaries')
            .select('summary')
            .eq('meeting_id', meetingId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Also check meetings.notes_style_3
          const { data: meetingNotes } = await supabase
            .from('meetings')
            .select('notes_style_3')
            .eq('id', meetingId)
            .single();

          const notesContent = summaryData?.summary || meetingNotes?.notes_style_3 || '';

          const meetingDate = new Date(meeting.created_at).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

          const durationText = meeting.duration_minutes
            ? `${Math.floor(meeting.duration_minutes / 60)}h ${meeting.duration_minutes % 60}m`
            : 'Unknown duration';

          const htmlContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto;">
              <div style="background: #1a56db; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">Your Meeting Notes Are Ready</h1>
              </div>
              <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
                <p style="color: #374151; margin: 0 0 16px;">Hi ${userName},</p>
                <p style="color: #374151; margin: 0 0 16px;">
                  Your meeting <strong>"${meeting.title || 'Untitled Meeting'}"</strong> has been completed and your AI-generated minutes are ready.
                </p>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">📅 ${meetingDate}</p>
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">⏱️ Duration: ${durationText}</p>
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">📝 Words: ${(meeting.word_count || 0).toLocaleString()}</p>
                </div>
                ${notesContent ? `
                  <div style="margin: 24px 0;">
                    <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 12px;">Meeting Minutes</h2>
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #374151;">
${notesContent}
                    </div>
                  </div>
                ` : `
                  <p style="color: #6b7280; font-style: italic;">Notes are still being generated. Please check the app in a few minutes.</p>
                `}
                <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
                  This email was sent by Notewell AI. You can view and edit your meeting notes in the app.
                </p>
              </div>
            </div>
          `;

          const { error: emailError } = await supabase.functions.invoke('send-meeting-email-resend', {
            body: {
              to_email: userEmail,
              subject: `Meeting Notes: ${meeting.title || 'Untitled Meeting'} — ${meetingDate}`,
              html_content: htmlContent,
            },
          });

          if (emailError) throw emailError;
          steps.push({ step: 'send_email', success: true, message: `Email sent to ${userEmail}`, durationMs: Date.now() - stepStart });
        }
      } catch (emailErr: any) {
        console.error('⚠️ Email failed:', emailErr);
        steps.push({ step: 'send_email', success: false, message: emailErr.message || 'Email failed', durationMs: Date.now() - stepStart });
      }

      // ─── Step 7: Audit log ───
      stepStart = Date.now();
      try {
        await supabase
          .from('system_audit_log')
          .insert({
            action: 'graceful_end_meeting',
            actor_id: adminUserId,
            target_id: meetingId,
            details: {
              meeting_title: meeting.title,
              meeting_user_id: meeting.user_id,
              user_email: userEmail,
              steps: steps.map(s => ({ step: s.step, success: s.success })),
            },
          });
        steps.push({ step: 'audit_log', success: true, message: 'Audit entry recorded', durationMs: Date.now() - stepStart });
      } catch (auditErr: any) {
        console.error('⚠️ Audit log failed:', auditErr);
        steps.push({ step: 'audit_log', success: false, message: auditErr.message || 'Audit log failed', durationMs: Date.now() - stepStart });
      }

      const totalMs = Date.now() - startTime;
      const allSuccess = steps.every(s => s.success);
      const failedSteps = steps.filter(s => !s.success);

      console.log(`✅ Graceful end completed for ${meetingId} in ${totalMs}ms — ${allSuccess ? 'all steps succeeded' : `${failedSteps.length} step(s) failed`}`);

      return new Response(JSON.stringify({
        success: true,
        meetingId,
        meetingTitle: meeting.title,
        userEmail,
        allStepsSucceeded: allSuccess,
        steps,
        totalDurationMs: totalMs,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (stopErr: any) {
      console.error('❌ Failed to stop meeting:', stopErr);
      return new Response(JSON.stringify({
        success: false,
        error: stopErr.message || 'Failed to stop meeting',
        steps,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('❌ Graceful end meeting error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      steps,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
