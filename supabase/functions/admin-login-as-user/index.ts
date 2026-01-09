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
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('No authorization header found');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token to verify they're an admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client to verify the JWT token
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Extract the token from the header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token and get user
    const { data: { user: currentUser }, error: userError } = await adminClient.auth.getUser(token);
    
    console.log('User lookup result:', { 
      hasUser: !!currentUser, 
      userId: currentUser?.id,
      error: userError?.message 
    });
    
    if (userError || !currentUser) {
      console.log('User verification failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if current user is a system admin using the admin client
    const { data: adminCheck, error: adminError } = await adminClient.rpc('has_role', {
      _user_id: currentUser.id,
      _role: 'system_admin'
    });

    console.log('Admin check result:', { adminCheck, error: adminError?.message });

    if (adminError || !adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Only system admins can use this feature' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
    const { targetUserId, redirectTo } = await req.json();
    
    console.log('Request body:', { targetUserId, redirectTo });
    
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Target user ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Log the impersonation for audit purposes (optional - table may not exist)
    try {
      await adminClient.from('admin_impersonation_log').insert({
        admin_user_id: currentUser.id,
        admin_email: currentUser.email,
        target_user_id: targetUserId,
        target_email: targetUser.user.email,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      // Log table might not exist, that's okay
      console.log('Impersonation log table not available:', logError);
    }

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
