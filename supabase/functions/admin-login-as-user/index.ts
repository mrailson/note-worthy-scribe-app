import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.log('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Missing bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1]?.trim();

    if (!token) {
      console.log('Bearer token missing after parsing header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Bearer token missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate the JWT using signing keys and extract claims
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);

    console.log('Claims result:', {
      hasClaims: !!claimsData?.claims,
      sub: (claimsData as any)?.claims?.sub,
      email: (claimsData as any)?.claims?.email,
      error: claimsError?.message,
    });

    const userId = (claimsData as any)?.claims?.sub as string | undefined;
    const userEmail = (claimsData as any)?.claims?.email as string | undefined;

    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: claimsError?.message ?? 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentUser = { id: userId, email: userEmail };

    // Service role client for admin actions
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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
