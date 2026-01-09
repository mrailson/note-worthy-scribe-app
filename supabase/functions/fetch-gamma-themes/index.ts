import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GAMMA_API_KEY = Deno.env.get('GAMMA_API_KEY');
const GAMMA_API_BASE = 'https://public-api.gamma.app';

// Fallback NHS-themed templates for when Gamma is unavailable
const NHS_FALLBACK_THEMES = [
  {
    id: 'nhs-professional',
    name: 'NHS Professional',
    description: 'Official NHS branding with blue colour scheme',
    primaryColor: '#005EB8',
    secondaryColor: '#003087',
    accentColor: '#41B6E6',
    style: 'professional',
    preview: 'NHS blue, clean professional layout',
    source: 'local'
  },
  {
    id: 'nhs-modern',
    name: 'NHS Modern',
    description: 'Contemporary NHS design with gradient accents',
    primaryColor: '#003087',
    secondaryColor: '#005EB8',
    accentColor: '#00A499',
    style: 'modern',
    preview: 'Modern gradients, dynamic layouts',
    source: 'local'
  },
  {
    id: 'clinical-clean',
    name: 'Clinical Clean',
    description: 'Minimalist design for medical content',
    primaryColor: '#2D3748',
    secondaryColor: '#4A5568',
    accentColor: '#38A169',
    style: 'clean',
    preview: 'Minimalist white/grey, clean typography',
    source: 'local'
  },
  {
    id: 'educational-bright',
    name: 'Educational Bright',
    description: 'Colourful design for patient education',
    primaryColor: '#2B6CB0',
    secondaryColor: '#3182CE',
    accentColor: '#ED8936',
    style: 'bright',
    preview: 'Vibrant colours, engaging visuals',
    source: 'local'
  },
  {
    id: 'executive-dark',
    name: 'Executive Dark',
    description: 'Sophisticated dark theme for board presentations',
    primaryColor: '#1A202C',
    secondaryColor: '#2D3748',
    accentColor: '#805AD5',
    style: 'dark',
    preview: 'Dark backgrounds, premium feel',
    source: 'local'
  }
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // If no Gamma API key, return local themes only
    if (!GAMMA_API_KEY) {
      console.log('[Gamma Themes] No API key configured, returning local themes');
      return new Response(
        JSON.stringify({
          success: true,
          themes: NHS_FALLBACK_THEMES,
          source: 'local'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Gamma Themes] Fetching themes from Gamma API');

    // Fetch themes from Gamma API
    const response = await fetch(`${GAMMA_API_BASE}/v1.0/themes`, {
      method: 'GET',
      headers: {
        'X-API-KEY': GAMMA_API_KEY,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gamma Themes] API error: ${response.status} - ${errorText}`);
      
      // Return local themes as fallback
      return new Response(
        JSON.stringify({
          success: true,
          themes: NHS_FALLBACK_THEMES,
          source: 'local',
          note: 'Using local themes (Gamma API unavailable)'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const gammaThemes = await response.json();
    console.log(`[Gamma Themes] Retrieved ${gammaThemes.length || 0} themes from Gamma`);

    // Transform Gamma themes to our format
    const formattedThemes = (gammaThemes || []).map((theme: any) => ({
      id: theme.themeId || theme.id,
      name: theme.name || 'Untitled Theme',
      description: theme.description || '',
      primaryColor: theme.primaryColor || theme.colors?.primary || '#005EB8',
      secondaryColor: theme.secondaryColor || theme.colors?.secondary || '#003087',
      accentColor: theme.accentColor || theme.colors?.accent || '#41B6E6',
      style: theme.style || 'professional',
      preview: theme.previewUrl || theme.thumbnailUrl || null,
      source: 'gamma'
    }));

    // Combine Gamma themes with local NHS themes
    const allThemes = [...formattedThemes, ...NHS_FALLBACK_THEMES];

    return new Response(
      JSON.stringify({
        success: true,
        themes: allThemes,
        gammaThemesCount: formattedThemes.length,
        localThemesCount: NHS_FALLBACK_THEMES.length,
        source: 'combined'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Gamma Themes] Error:', error);
    
    // Return local themes as fallback on any error
    return new Response(
      JSON.stringify({
        success: true,
        themes: NHS_FALLBACK_THEMES,
        source: 'local',
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
