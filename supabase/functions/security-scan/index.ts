import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Running security linter scan...');

    // Call the Supabase linter tool
    const { data: linterData, error: linterError } = await supabaseAdmin.rpc('lint_security');

    if (linterError) {
      console.error('Linter error:', linterError);
      throw linterError;
    }

    const findings = linterData || [];
    console.log(`Found ${findings.length} security findings`);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabaseAdmin
      .from('security_scans')
      .insert({
        total_findings: findings.length,
        error_count: findings.filter((f: any) => f.level === 'ERROR').length,
        warn_count: findings.filter((f: any) => f.level === 'WARN').length,
        info_count: findings.filter((f: any) => f.level === 'INFO').length,
        scan_type: 'manual',
        triggered_by: userId,
      })
      .select()
      .single();

    if (scanError) {
      console.error('Error creating scan record:', scanError);
      throw scanError;
    }

    console.log('Created scan record:', scan.id);

    // Store individual findings
    if (findings.length > 0) {
      const findingsToInsert = findings.map((f: any) => ({
        scan_id: scan.id,
        finding_id: f.cache_key || f.name,
        name: f.name || 'Unknown',
        description: f.description || '',
        details: f.detail || null,
        level: f.level?.toLowerCase() || 'info',
        category: f.categories?.[0] || 'SECURITY',
      }));

      const { error: findingsError } = await supabaseAdmin
        .from('security_scan_findings')
        .insert(findingsToInsert);

      if (findingsError) {
        console.error('Error inserting findings:', findingsError);
        throw findingsError;
      }

      console.log(`Inserted ${findingsToInsert.length} findings`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scan_id: scan.id,
        total_findings: findings.length,
        findings: findings,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Security scan error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
