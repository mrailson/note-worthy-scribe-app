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
    const { action, token, group_token, signed_name, signed_role, signed_organisation, decline_comment } = await req.json();

    const clientIP = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ─── GROUP TOKEN FLOW ───────────────────────────────────────
    if (group_token) {
      // Fetch ALL signatory rows sharing this group_token
      const { data: groupSigs, error: gsErr } = await supabase
        .from('approval_signatories')
        .select('*, approval_documents(*)')
        .eq('group_token', group_token);

      if (gsErr || !groupSigs || groupSigs.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid or expired approval link' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── GROUP GET ───
      if (action === 'get') {
        // Mark all as viewed if not already
        for (const sig of groupSigs) {
          if (!sig.viewed_at) {
            await supabase
              .from('approval_signatories')
              .update({ viewed_at: new Date().toISOString() })
              .eq('id', sig.id);

            await supabase.from('approval_audit_log').insert({
              document_id: sig.document_id,
              signatory_id: sig.id,
              action: 'viewed',
              actor_name: sig.name,
              actor_email: sig.email,
              ip_address: clientIP,
              user_agent: userAgent,
            });
          }
        }

        const items = groupSigs.map(sig => ({
          signatory: {
            id: sig.id,
            name: sig.name,
            email: sig.email,
            role: sig.role,
            organisation: sig.organisation,
            status: sig.status,
            signed_at: sig.signed_at,
            signed_name: sig.signed_name,
            signed_role: sig.signed_role,
            signed_organisation: sig.signed_organisation,
            decline_comment: sig.decline_comment,
            viewed_at: sig.viewed_at,
          },
          document: {
            id: sig.approval_documents.id,
            title: sig.approval_documents.title,
            description: sig.approval_documents.description,
            category: sig.approval_documents.category,
            file_url: sig.approval_documents.file_url,
            original_filename: sig.approval_documents.original_filename,
            file_size_bytes: sig.approval_documents.file_size_bytes,
            deadline: sig.approval_documents.deadline,
            status: sig.approval_documents.status,
            message: sig.approval_documents.message,
            created_at: sig.approval_documents.created_at,
            sender_name: sig.approval_documents.sender_name,
            sender_email: sig.approval_documents.sender_email,
            signature_placement: sig.approval_documents.signature_placement,
          },
        }));

        return new Response(JSON.stringify({ items, is_group: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── GROUP APPROVE ───
      if (action === 'approve') {
        const alreadyAllApproved = groupSigs.every(s => s.status === 'approved');
        if (alreadyAllApproved) {
          return new Response(JSON.stringify({ error: 'Already approved', items: groupSigs }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const now = new Date().toISOString();

        // Approve all signatory rows in this group
        for (const sig of groupSigs) {
          if (sig.status === 'approved') continue;

          const doc = sig.approval_documents;
          if (doc.status === 'revoked' || doc.status === 'expired') continue;

          await supabase
            .from('approval_signatories')
            .update({
              status: 'approved',
              signed_at: now,
              signed_name: signed_name || sig.name,
              signed_role: signed_role || sig.role,
              signed_organisation: signed_organisation || sig.organisation,
              signed_ip: clientIP,
              signed_user_agent: userAgent,
            })
            .eq('id', sig.id);

          await supabase.from('approval_audit_log').insert({
            document_id: doc.id,
            signatory_id: sig.id,
            action: 'approved',
            actor_name: signed_name || sig.name,
            actor_email: sig.email,
            ip_address: clientIP,
            user_agent: userAgent,
            metadata: { signed_role, signed_organisation, group_token },
          });
        }

        // Check each document for completion
        const docIds = [...new Set(groupSigs.map(s => s.document_id))];
        const completedDocIds: string[] = [];

        for (const docId of docIds) {
          const { data: allSigs } = await supabase
            .from('approval_signatories')
            .select('status')
            .eq('document_id', docId);

          const allApproved = allSigs?.every(s => s.status === 'approved');
          if (allApproved) {
            await supabase
              .from('approval_documents')
              .update({ status: 'completed', completed_at: now })
              .eq('id', docId);

            await supabase.from('approval_audit_log').insert({
              document_id: docId,
              action: 'completed',
              actor_name: 'System',
              metadata: { trigger: 'all_signatories_approved' },
            });

            completedDocIds.push(docId);
          }
        }

        // Send individual confirmation to this signatory (once for all docs)
        try {
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
                document_id: docIds[0],
                signatory_id: groupSigs[0].id,
              }),
            }
          );
        } catch (e) {
          console.error('Failed to send group confirmation email:', e);
        }

        // Check if ALL documents in the multi_doc_group are completed
        const multiDocGroupId = groupSigs[0].approval_documents.multi_doc_group_id;
        if (multiDocGroupId && completedDocIds.length > 0) {
          const { data: groupDocs } = await supabase
            .from('approval_documents')
            .select('id, status')
            .eq('multi_doc_group_id', multiDocGroupId);

          const allGroupCompleted = groupDocs?.every(d => d.status === 'completed');

          if (allGroupCompleted) {
            console.log('All documents in multi-doc group completed — generating signed PDFs');

            // Generate signed PDFs for each document
            for (const gd of (groupDocs || [])) {
              try {
                await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-signed-pdf-server`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({ document_id: gd.id }),
                  }
                );
              } catch (e) {
                console.error('Failed to generate signed PDF for', gd.id, e);
              }
            }

            // Send one consolidated completion email
            try {
              await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-approval-email`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    type: 'multi_send_completed',
                    group_id: multiDocGroupId,
                  }),
                }
              );
            } catch (e) {
              console.error('Failed to send multi-doc completion email:', e);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'All documents approved successfully',
          all_completed: completedDocIds.length === docIds.length,
          signed_at: now,
          document_count: docIds.length,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── GROUP DECLINE ───
      if (action === 'decline') {
        const now = new Date().toISOString();

        for (const sig of groupSigs) {
          if (sig.status === 'declined') continue;
          const doc = sig.approval_documents;
          if (doc.status === 'revoked' || doc.status === 'expired') continue;

          await supabase
            .from('approval_signatories')
            .update({
              status: 'declined',
              signed_at: now,
              signed_name: signed_name || sig.name,
              signed_role: signed_role || sig.role,
              signed_organisation: signed_organisation || sig.organisation,
              signed_ip: clientIP,
              signed_user_agent: userAgent,
              decline_comment: decline_comment || null,
            })
            .eq('id', sig.id);

          await supabase.from('approval_audit_log').insert({
            document_id: doc.id,
            signatory_id: sig.id,
            action: 'declined',
            actor_name: signed_name || sig.name,
            actor_email: sig.email,
            ip_address: clientIP,
            user_agent: userAgent,
            metadata: { decline_comment, signed_role, signed_organisation, group_token },
          });

          // Send decline notification per document to sender
          try {
            await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-approval-email`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  type: 'declined',
                  document_id: doc.id,
                  signatory_id: sig.id,
                }),
              }
            );
          } catch (e) {
            console.error('Failed to send decline email:', e);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'All documents declined',
          signed_at: now,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─── SINGLE TOKEN FLOW (unchanged) ──────────────────────────
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
          signature_placement: document.signature_placement,
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

        if (allApproved) {
          console.log('All signatories approved — triggering server-side signed PDF generation');
          await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-signed-pdf-server`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({ document_id: document.id }),
            }
          );
        }
      } catch (emailErr) {
        console.error('Failed to send confirmation/generate signed PDF (non-blocking):', emailErr);
      }

      return new Response(JSON.stringify({
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

      try {
        await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-approval-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              type: 'declined',
              document_id: document.id,
              signatory_id: signatory.id,
            }),
          }
        );
      } catch (emailErr) {
        console.error('Failed to send decline email (non-blocking):', emailErr);
      }

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
