import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token to verify they're an admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if current user is a system admin
    const { data: adminCheck, error: adminError } = await userClient.rpc('has_role', {
      _user_id: currentUser.id,
      _role: 'system_admin'
    });

    if (adminError || !adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Only system admins can use this feature' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
    const { targetUserId, redirectTo } = await req.json();
    
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Target user ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the target user's email
    const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email,
      options: {
        redirectTo: redirectTo || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/`
      }
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate login link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the impersonation for audit purposes
    await adminClient.from('admin_impersonation_log').insert({
      admin_user_id: currentUser.id,
      admin_email: currentUser.email,
      target_user_id: targetUserId,
      target_email: targetUser.user.email,
      created_at: new Date().toISOString()
    }).catch(() => {
      // Log table might not exist, that's okay
      console.log('Impersonation log table not available');
    });

    return new Response(
      JSON.stringify({ 
        loginUrl: linkData.properties?.action_link,
        message: `Login link generated for ${targetUser.user.email}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-login-as-user:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
