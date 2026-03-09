import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, token, signed_name, signed_role, signed_organisation, decline_comment } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch signatory by token
    const { data: signatory, error: sigErr } = await supabase
      .from('approval_signatories')
      .select('*, approval_documents(*)')
      .eq('approval_token', token)
      .single();

    if (sigErr || !signatory) {
      return new Response(JSON.stringify({ error: 'Invalid or expired approval link' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const document = signatory.approval_documents;
    const clientIP = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ─── GET: Fetch signatory + document info ───
    if (action === 'get') {
      // Log view if not already viewed
      if (!signatory.viewed_at) {
        await supabase
          .from('approval_signatories')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', signatory.id);

        await supabase.from('approval_audit_log').insert({
          document_id: document.id,
          signatory_id: signatory.id,
          action: 'viewed',
          actor_name: signatory.name,
          actor_email: signatory.email,
          ip_address: clientIP,
          user_agent: userAgent,
        });
      }

      return new Response(JSON.stringify({
        signatory: {
          id: signatory.id,
          name: signatory.name,
          email: signatory.email,
          role: signatory.role,
          organisation: signatory.organisation,
          status: signatory.status,
          signed_at: signatory.signed_at,
          signed_name: signatory.signed_name,
          signed_role: signatory.signed_role,
          signed_organisation: signatory.signed_organisation,
          decline_comment: signatory.decline_comment,
          viewed_at: signatory.viewed_at,
        },
        document: {
          id: document.id,
          title: document.title,
          description: document.description,
          category: document.category,
          file_url: document.file_url,
          original_filename: document.original_filename,
          file_size_bytes: document.file_size_bytes,
          deadline: document.deadline,
          status: document.status,
          message: document.message,
          created_at: document.created_at,
          sender_name: document.sender_name,
          sender_email: document.sender_email,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── APPROVE ───
    if (action === 'approve') {
      if (signatory.status === 'approved') {
        return new Response(JSON.stringify({ error: 'Already approved', signatory }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (document.status === 'revoked' || document.status === 'expired') {
        return new Response(JSON.stringify({ error: 'This approval request is no longer active' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();

      await supabase
        .from('approval_signatories')
        .update({
          status: 'approved',
          signed_at: now,
          signed_name: signed_name || signatory.name,
          signed_role: signed_role || signatory.role,
          signed_organisation: signed_organisation || signatory.organisation,
          signed_ip: clientIP,
          signed_user_agent: userAgent,
        })
        .eq('id', signatory.id);

      await supabase.from('approval_audit_log').insert({
        document_id: document.id,
        signatory_id: signatory.id,
        action: 'approved',
        actor_name: signed_name || signatory.name,
        actor_email: signatory.email,
        ip_address: clientIP,
        user_agent: userAgent,
        metadata: { signed_role, signed_organisation },
      });

      // Check if all signatories are now approved
      const { data: allSigs } = await supabase
        .from('approval_signatories')
        .select('status')
        .eq('document_id', document.id);

      const allApproved = allSigs?.every(s => s.status === 'approved');

      if (allApproved) {
        await supabase
          .from('approval_documents')
          .update({ status: 'completed', completed_at: now })
          .eq('id', document.id);

        await supabase.from('approval_audit_log').insert({
          document_id: document.id,
          action: 'completed',
          actor_name: 'System',
          metadata: { trigger: 'all_signatories_approved' },
        });
      }

      // Send confirmation email to the signatory
      try {
        const emailPayload: any = {
          type: 'confirmation',
          document_id: document.id,
          signatory_id: signatory.id,
        };
        // Also notify sender if all completed
        if (allApproved) {
          emailPayload.type = 'completed';
        }
        await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-approval-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify(emailPayload),
          }
        );
        // Also send individual confirmation if completed (completed email goes to sender)
        if (allApproved) {
          await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-approval-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                type: 'confirmation',
                document_id: document.id,
                signatory_id: signatory.id,
              }),
            }
          );
        }
        console.log('Confirmation email triggered for signatory:', signatory.email);
      } catch (emailErr) {
        console.error('Failed to send confirmation email (non-blocking):', emailErr);
      }

        success: true,
        message: 'Document approved successfully',
        all_completed: allApproved,
        signed_at: now,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── DECLINE ───
    if (action === 'decline') {
      if (signatory.status === 'declined') {
        return new Response(JSON.stringify({ error: 'Already declined' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (document.status === 'revoked' || document.status === 'expired') {
        return new Response(JSON.stringify({ error: 'This approval request is no longer active' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();

      await supabase
        .from('approval_signatories')
        .update({
          status: 'declined',
          signed_at: now,
          signed_name: signed_name || signatory.name,
          signed_role: signed_role || signatory.role,
          signed_organisation: signed_organisation || signatory.organisation,
          signed_ip: clientIP,
          signed_user_agent: userAgent,
          decline_comment: decline_comment || null,
        })
        .eq('id', signatory.id);

      await supabase.from('approval_audit_log').insert({
        document_id: document.id,
        signatory_id: signatory.id,
        action: 'declined',
        actor_name: signed_name || signatory.name,
        actor_email: signatory.email,
        ip_address: clientIP,
        user_agent: userAgent,
        metadata: { decline_comment, signed_role, signed_organisation },
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Document declined',
        signed_at: now,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-approval:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
