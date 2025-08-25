import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { policy_template_id, policy_name } = await req.json();
    
    console.log('Assigning policy to all practices:', { policy_template_id, policy_name });

    // Get the current user from the JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify user has system admin role
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is system admin
    const { data: isAdmin, error: adminError } = await supabase
      .rpc('is_system_admin', { _user_id: user.id })
    
    if (adminError || !isAdmin) {
      console.error('Admin check error:', adminError)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. System admin required.' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all GP practices
    const { data: practices, error: practicesError } = await supabase
      .from('gp_practices')
      .select('id, name')

    if (practicesError) {
      console.error('Error fetching practices:', practicesError)
      throw new Error('Failed to fetch practices')
    }

    console.log(`Found ${practices?.length || 0} practices`)

    // Get existing assignments to avoid duplicates
    const { data: existingAssignments, error: assignmentsError } = await supabase
      .from('practice_policy_assignments')
      .select('practice_id')
      .eq('policy_template_id', policy_template_id)

    if (assignmentsError) {
      console.error('Error fetching existing assignments:', assignmentsError)
      throw new Error('Failed to fetch existing assignments')
    }

    const existingPracticeIds = new Set(existingAssignments?.map(a => a.practice_id) || [])
    console.log(`Found ${existingPracticeIds.size} existing assignments`)

    // Filter out practices that already have this policy assigned
    const practicesNeedingAssignment = practices?.filter(p => !existingPracticeIds.has(p.id)) || []
    console.log(`${practicesNeedingAssignment.length} practices need assignment`)

    if (practicesNeedingAssignment.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All practices already have this policy assigned',
          practicesAssigned: 0,
          totalPractices: practices?.length || 0
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create assignments for practices that don't have this policy
    const assignments = practicesNeedingAssignment.map(practice => ({
      practice_id: practice.id,
      policy_template_id: policy_template_id,
      assigned_by: user.id,
      is_active: true,
      notes: `Auto-assigned to all Northamptonshire practices - ${policy_name || 'Policy'}`
    }))

    const { data: insertedAssignments, error: insertError } = await supabase
      .from('practice_policy_assignments')
      .insert(assignments)
      .select()

    if (insertError) {
      console.error('Error inserting assignments:', insertError)
      throw new Error('Failed to create policy assignments')
    }

    console.log(`Successfully assigned policy to ${insertedAssignments?.length || 0} practices`)

    // Log the bulk assignment
    const { error: logError } = await supabase
      .rpc('log_system_activity', {
        p_table_name: 'practice_policy_assignments',
        p_operation: 'BULK_POLICY_ASSIGNMENT',
        p_record_id: policy_template_id,
        p_old_values: null,
        p_new_values: {
          policy_template_id: policy_template_id,
          practices_assigned: insertedAssignments?.length || 0,
          assigned_by: user.id,
          assignment_type: 'bulk_all_practices',
          policy_name: policy_name
        }
      })

    if (logError) {
      console.error('Error logging activity:', logError)
      // Don't fail the request for logging errors
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully assigned policy to ${insertedAssignments?.length || 0} practices`,
        practicesAssigned: insertedAssignments?.length || 0,
        totalPractices: practices?.length || 0,
        assignments: insertedAssignments
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in assign-policy-to-practices function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to assign policy to practices',
        details: error.message
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})