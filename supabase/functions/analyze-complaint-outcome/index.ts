import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { complaintId } = await req.json();
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    // Initialize Supabase client (prefer service key, but honour caller auth for RLS if provided)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    );

    // Fetch complaint base details first (avoid failing embeds)
    const baseSelect = `id, reference_number, category, priority, complaint_title, complaint_description, incident_date, location_service, staff_mentioned, complaint_on_behalf, consent_given`;

    let { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(baseSelect)
      .eq('id', complaintId)
      .single();

    // Fallback: if UUID not found, try by reference number (for demos)
    if ((complaintError || !complaint) && typeof complaintId === 'string' && complaintId.startsWith('COMP')) {
      const res2 = await supabase
        .from('complaints')
        .select(baseSelect)
        .eq('reference_number', complaintId)
        .single();
      complaint = res2.data as any;
      complaintError = res2.error as any;
    }

    if (complaintError || !complaint) {
      console.error('Complaint fetch failed:', complaintError, 'for id:', complaintId);
      throw new Error('Complaint not found');
    }

    // Related data fetched separately to avoid join permission issues
    const [{ data: notes }, { data: parties }] = await Promise.all([
      supabase.from('complaint_notes')
        .select('note, is_internal, created_at')
        .eq('complaint_id', complaint.id)
        .order('created_at', { ascending: true }),
      supabase.from('complaint_involved_parties')
        .select('staff_name, staff_role, response_text, response_submitted_at')
        .eq('complaint_id', complaint.id)
        .order('response_submitted_at', { ascending: true })
    ]);

    const systemPrompt = `You are an expert NHS complaints analyst with deep knowledge of:
- NHS Constitution standards
- Parliamentary and Health Service Ombudsman guidelines
- CQC compliance requirements
- NHS England complaints procedure
- Good Medical Practice standards
- Patient rights and expectations

Analyze the complaint and provide:
1. RECOMMENDED OUTCOME: rejected, upheld, or partially_upheld
2. DETAILED REASONING: Clear, evidence-based justification
3. KEY FACTORS: List specific elements that influenced the decision
4. REGULATORY COMPLIANCE: How this aligns with NHS/CQC standards
5. LEARNING OPPORTUNITIES: Suggestions for service improvement
6. RISK ASSESSMENT: Potential clinical or reputational risks

⚠️ CRITICAL: Base your analysis ONLY on the information provided. DO NOT invent or assume medical conditions, emergencies, clinical details, or events not explicitly mentioned in the complaint details, staff responses, or investigation notes.

Be objective, thorough, and focus on patient safety and quality of care.`;

    const staffResponses = (parties || [])
      .filter(p => p.response_text)
      .map(p => `${p.staff_name} (${p.staff_role}): ${p.response_text}`)
      .join('\n\n') || 'No staff responses received yet';

    const internalNotes = (notes || [])
      .filter(n => n.is_internal)
      .map(n => n.note)
      .join('\n\n') || 'No internal notes';

    const userPrompt = `Analyze this NHS complaint and recommend an outcome:

COMPLAINT DETAILS:
Reference: ${complaint.reference_number}
Category: ${complaint.category}
Priority: ${complaint.priority}
Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Incident Date: ${complaint.incident_date}
Location/Service: ${complaint.location_service || 'Not specified'}
Staff Mentioned: ${complaint.staff_mentioned?.join(', ') || 'None specifically mentioned'}

STAFF RESPONSES:
${staffResponses}

INTERNAL INVESTIGATION NOTES:
${internalNotes}

PATIENT INFORMATION:
- Complaint made on behalf of patient: ${complaint.complaint_on_behalf ? 'Yes' : 'No'}
- Consent given: ${complaint.consent_given ? 'Yes' : 'No'}

Please provide a comprehensive analysis with recommended outcome and clear reasoning that would satisfy CQC inspection and NHS England standards.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const analysisResult = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      analysis: analysisResult,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-complaint-outcome function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to analyze complaint outcome' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});