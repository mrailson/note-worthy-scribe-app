import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GenerateRequest {
  category: string;
  count: number;
  model: 'gemini-flash' | 'gemini-pro' | 'runware';
  customPrompt?: string;
  referenceImageUrl?: string;
  batchInstructions?: string;
}

const CATEGORY_PROMPTS: Record<string, string[]> = {
  'Patients': [
    'A diverse elderly patient smiling during a GP consultation in a modern NHS surgery, warm lighting, professional medical setting',
    'A young mother with baby in a GP waiting room, friendly NHS environment, natural lighting',
    'A middle-aged man discussing health concerns with a nurse practitioner, clinical but warm setting',
    'A diverse group of patients in a GP practice waiting area, NHS posters on walls, realistic',
    'An elderly couple at a GP reception desk checking in for an appointment, modern NHS surgery',
    'A teenager having a confidential consultation with a GP, supportive atmosphere, clinical room',
    'A patient using a self-check-in kiosk at a GP surgery, modern technology, NHS branding',
    'A patient receiving a blood pressure check from a practice nurse, clinical room, NHS',
    'A wheelchair user arriving at an accessible GP surgery entrance, inclusive healthcare',
    'A patient on a video call telehealth consultation with their GP, home setting with laptop',
  ],
  'Buildings': [
    'A modern NHS GP surgery building exterior with glass entrance and brick facade, Northamptonshire style architecture',
    'An aerial view of a primary care centre campus with car park, green surroundings, NHS signage',
    'A converted Victorian building now serving as a GP practice, heritage meets modern healthcare',
    'A purpose-built health centre with pharmacy attached, NHS blue signage, suburban setting',
    'A GP surgery entrance with disabled access ramp and automatic doors, welcoming',
    'A rural GP branch surgery in a village setting, Northamptonshire countryside',
    'A multi-storey health centre building with PCN offices, modern architecture',
    'A GP surgery at dusk with warm interior lighting visible through windows, inviting',
    'A new-build GP super-practice with large car park, solar panels on roof, modern NHS',
    'A community health hub building incorporating GP services, pharmacy and social care',
  ],
  'Reception & Waiting Areas': [
    'A modern GP reception desk with friendly receptionist, NHS branding, self-check-in screens',
    'A spacious GP waiting area with comfortable seating, health information displays, natural light',
    'A children\'s play corner in a GP surgery waiting room, colourful, NHS posters',
    'Digital check-in screens at a GP surgery entrance, touchscreen technology, modern NHS',
    'A pharmacy collection point within a GP surgery, organised medications, professional',
    'A GP practice noticeboard with health campaigns, flu jab posters, community events',
    'An accessible reception counter at a GP surgery, hearing loop sign, wheelchair friendly',
    'A waiting area with electronic display showing queue numbers, modern GP practice',
    'A GP surgery corridor with consultation room doors numbered, professional, clean',
    'A patient information leaflet display stand in GP waiting area, NHS branded materials',
  ],
  'Clinical Rooms': [
    'A GP consultation room with EMIS Web on dual monitors, examination couch with blue curtain, dermatoscope and pulse oximeter on desk, natural window light, NHS clean',
    'A practice nurse treatment room set up for flu vaccination clinic, sharps bin, vaccine fridge with temperature log, NHS immunisation posters on wall',
    'A GP minor surgery suite with cautery equipment, sterile instrument tray, adjustable operating light, no-touch waste bins, NHS infection control compliant',
    'A respiratory clinic room in a GP surgery with spirometry machine, peak flow meters, spacer devices and inhaler technique posters, asthma and COPD review',
    'A baby clinic room in a GP practice with infant weighing scales, red book growth charts on wall, developmental check toys, colourful and clinical',
    'A phlebotomy room in a GP surgery with blood-taking chair, tourniquet, vacutainer system, sharps container, specimen bags, NHS clinical setting',
    'A first contact physiotherapist room in a GP practice with treatment couch, resistance bands, musculoskeletal model, exercise instruction posters',
    'A GP mental health consultation room with two comfortable chairs angled for conversation, anxiety self-help leaflets, tissue box, calming neutral decor, confidential',
    'A cardiac assessment room in a GP surgery with 12-lead ECG machine, blood pressure monitor, stethoscope, clinical observation chart on wall',
    'An ear irrigation and examination room in a GP practice with otoscope on wall mount, audiometry equipment, ear model, clinical white walls',
  ],
  'Staff & Teams': [
    'A diverse GP practice team group photo outside their surgery entrance, GPs in smart casual, nurses in NHS tunics, receptionists and practice manager, friendly professional',
    'A GP partner and salaried GP reviewing QOF performance data together at a desk, EMIS screens visible, teamwork in a consulting room',
    'A practice manager in their office with staff rotas on screen, CQC folder on desk, HR paperwork, administrative leadership in primary care',
    'A clinical pharmacist in a GP practice reviewing medication queries, prescription stack, BNF on desk, collaborative prescribing role',
    'A social prescribing link worker meeting a patient in a GP surgery side room, community resources leaflets, wellbeing conversation',
    'A healthcare assistant in NHS tunic taking patient observations in a GP treatment room, blood pressure cuff, pulse oximeter, weighing scales',
    'A PCN multidisciplinary team meeting with GPs, paramedics, pharmacists and mental health practitioners around a table, collaborative primary care',
    'A GP reception team behind a busy front desk, telephone headsets, appointment screens, patient queue, friendly and efficient NHS service',
    'A GP registrar being supervised by a training practice GP, teaching consultation, medical education in primary care',
    'An advanced nurse practitioner conducting an independent consultation in a GP surgery, prescribing medication, autonomous clinical role',
  ],
  'Technology': [
    'A GP using EMIS Web clinical system on dual monitors showing patient record and electronic prescribing, modern NHS consulting room',
    'A GP conducting a video consultation via AccuRx on a large monitor with webcam, digital-first primary care, home patient visible on screen',
    'NHS App open on a patient smartphone showing GP appointment booking, repeat prescription ordering, digital health records access',
    'A practice manager reviewing appointment utilisation dashboard and DNA rates on screen, GP analytics, operational performance metrics',
    'EMIS electronic prescribing screen close-up showing drug interaction alerts and allergy warnings, patient safety, clinical decision support',
    'A GP using a handheld dermatoscope connected to smartphone for teledermatology referral, digital diagnostic tools in primary care',
    'A district nurse accessing SystmOne patient records on a secure NHS tablet during a home visit, mobile clinical access',
    'Digital self-check-in screens in a GP surgery reception area, patient arrival kiosk, touchscreen with NHS branding, reducing reception workload',
    'A GP practice using Ardens templates on EMIS for structured clinical coding, QOF data capture, clinical template on screen',
    'An AI triage tool on a GP practice website helping patients describe symptoms before booking, online consultation form, digital front door',
  ],
  'Community & Wellbeing': [
    'A community walking group in a Northamptonshire park, social prescribing, diverse group',
    'A community garden project linked to GP social prescribing, wellbeing, outdoor activity',
    'A chair-based exercise class for elderly patients, community hall, NHS wellbeing',
    'A mental health peer support group meeting, community setting, supportive atmosphere',
    'A cooking and nutrition class for patients with diabetes, community kitchen, NHS',
    'A befriending service volunteer visiting an isolated elderly patient, community care',
    'A parkrun event with NHS health checks promotion, community fitness, outdoor',
    'A community pharmacy health check station, blood pressure screening, public health',
    'A mindfulness and meditation group in a community centre, wellbeing programme',
    'A parent and toddler group at a children\'s centre, early years, community health',
  ],
  'Meetings & Training': [
    'NHS professionals in a boardroom meeting, presentation screen, strategic planning',
    'A GP training session with registrars, clinical teaching, medical education',
    'A primary care network collaborative meeting, multidisciplinary, modern conference room',
    'A practice meeting discussing QOF targets, performance review, team discussion',
    'A safeguarding training session for GP staff, professional development, NHS',
    'A significant event analysis meeting, clinical governance, learning from incidents',
    'CQC inspection preparation meeting with practice team, compliance review',
    'A virtual meeting on a large screen, remote collaboration, NHS Teams meeting',
    'A healthcare conference presentation, speaker at podium, NHS audience',
    'A peer review session between GP practices, quality improvement, collaborative',
  ],
  'Branding & Logos': [
    'NHS England logo on a clean white background, official branding, blue',
    'A PCN (Primary Care Network) branded banner, professional NHS design',
    'NHS blue gradient background with subtle medical icons, presentation backdrop',
    'NHS values and constitution displayed on a wall poster, professional design',
    'A clean NHS letterhead template design with blue header, professional correspondence',
    'ICB (Integrated Care Board) branding materials, NHS system design',
    'NHS Health Education England training badge and branding, professional development',
    'A practice website header design with NHS branding guidelines, digital',
    'NHS digital health brand identity materials, app icons and screens',
    'Primary care service poster template with NHS colour scheme, professional layout',
  ],
  'Infographic Elements': [
    'Medical infographic icons set on white background: stethoscope, heart, pills, syringe, clipboard, flat design',
    'Healthcare data visualisation chart elements, pie charts and bar graphs in NHS blue colour scheme',
    'Patient journey flowchart icons, step-by-step process arrows, clean infographic style',
    'Healthcare statistics number callout boxes, percentages, NHS data presentation elements',
    'Medical process timeline infographic elements, milestone markers, clean professional design',
    'Body system diagram elements for patient education, anatomical icons, simple flat style',
    'NHS colour palette gradient backgrounds for presentations, blue teal green, subtle patterns',
    'Healthcare workforce infographic people icons, diverse silhouettes, team structure diagrams',
    'Quality improvement PDSA cycle diagram elements, clinical governance infographic',
    'Population health data map elements, geographic health indicators, data visualisation',
  ],
};

async function generateWithGemini(prompt: string, model: 'flash' | 'pro'): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const modelName = model === 'pro' 
    ? 'google/gemini-3-pro-image-preview' 
    : 'google/gemini-2.5-flash-image';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: `Generate a high quality, photorealistic image: ${prompt}. Ultra high resolution, professional photography style.\n\nCRITICAL TEXT QUALITY RULES:\n- Any text in the image MUST be spelled correctly with zero typos\n- Use British English spelling (e.g. colour, organisation, centre, programme)\n- Keep text minimal — use short, simple words that are easy to render accurately\n- If you cannot render a word correctly, omit it entirely rather than misspell it\n- Double-check every word before rendering\n- Prefer icons and visual elements over text where possible` }],
        modalities: ['image', 'text'],
      }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${model} error [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) throw new Error('No image returned from Gemini');
  return imageUrl; // base64 data URL
}

async function generateWithRunware(prompt: string): Promise<string> {
  const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
  if (!RUNWARE_API_KEY) throw new Error('RUNWARE_API_KEY not configured');

  const taskUUID = crypto.randomUUID();
  const response = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { taskType: 'authentication', apiKey: RUNWARE_API_KEY },
      {
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: `${prompt}. Ultra high resolution, professional photography style. All text must be spelled correctly using British English. Prefer icons over text. Keep any text short and simple.`,
        width: 1024,
        height: 768,
        model: 'runware:100@1',
        numberResults: 1,
        outputFormat: 'WEBP',
        CFGScale: 1,
        scheduler: 'FlowMatchEulerDiscreteScheduler',
        strength: 0.8,
      },
    ]),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Runware error [${response.status}]: ${errText}`);
  }

  const result = await response.json();
  const imageData = result.data?.find((d: any) => d.taskType === 'imageInference');
  if (!imageData?.imageURL) throw new Error('No image returned from Runware');
  return imageData.imageURL; // Direct URL
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader, 'starts with Bearer:', authHeader?.startsWith('Bearer '));
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    console.log('getClaims result:', { hasClaims: !!claimsData?.claims, error: claimsError?.message });
    
    if (claimsError || !claimsData?.claims) {
      // Fallback to getUser if getClaims not available
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      console.log('getUser fallback:', { userId: user?.id, error: authError?.message });
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      var userId = user.id;
    } else {
      var userId = claimsData.claims.sub as string;
    }

    // Admin check
    const { data: isAdmin } = await supabaseClient.rpc('is_system_admin', { _user_id: userId });
    console.log('Admin check:', { userId, isAdmin });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { category, count, model, customPrompt, referenceImageUrl, batchInstructions } = await req.json() as GenerateRequest;

    if (!category || !model) throw new Error('Category and model are required');

    const imageCount = Math.min(count || 10, 10);
    const results: { title: string; imageUrl: string; error?: string }[] = [];

    // Get prompts
    let prompts: string[] = [];
    if (customPrompt) {
      // For custom prompts, repeat the same prompt for the requested count
      const customCount = Math.min(count || 1, 5);
      // Append reference image instruction if provided
      const enhancedPrompt = referenceImageUrl 
        ? `${customPrompt}. Use this reference image for style/content guidance: ${referenceImageUrl}`
        : customPrompt;
      prompts = Array(customCount).fill(enhancedPrompt);
    } else {
      const categoryPrompts = CATEGORY_PROMPTS[category] || [];
      // Pick random prompts that haven't been used (based on randomisation)
      const shuffled = [...categoryPrompts].sort(() => Math.random() - 0.5);
      prompts = shuffled.slice(0, imageCount);
      
      // Append batch instructions and reference image to each prompt if provided
      if (batchInstructions || referenceImageUrl) {
        prompts = prompts.map(p => {
          let enhanced = p;
          if (batchInstructions) enhanced += `. Additional instructions: ${batchInstructions}`;
          if (referenceImageUrl) enhanced += `. Use this reference image for style/content guidance: ${referenceImageUrl}`;
          return enhanced;
        });
      }
    }

    // Use service role client for storage/db operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const title = customPrompt 
        ? `Custom: ${customPrompt.substring(0, 50)}${prompts.length > 1 ? ` (${i + 1}/${prompts.length})` : ''}`
        : prompt.split(',')[0].replace(/^A |^An /, '').substring(0, 60);
      
      try {
        console.log(`Generating image ${i + 1}/${prompts.length} with ${model}: ${title}`);
        
        let imageDataOrUrl: string;
        if (model === 'gemini-flash') {
          imageDataOrUrl = await generateWithGemini(prompt, 'flash');
        } else if (model === 'gemini-pro') {
          imageDataOrUrl = await generateWithGemini(prompt, 'pro');
        } else {
          imageDataOrUrl = await generateWithRunware(prompt);
        }

        // Upload to storage
        const storagePath = `${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}/${Date.now()}-${i}.${model === 'runware' ? 'webp' : 'png'}`;
        
        let fileBlob: Blob;
        if (imageDataOrUrl.startsWith('data:')) {
          // Base64 data URL
          const base64 = imageDataOrUrl.split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
          const mimeType = imageDataOrUrl.match(/data:(.*?);/)?.[1] || 'image/png';
          fileBlob = new Blob([bytes], { type: mimeType });
        } else {
          // URL - fetch it
          const imgResp = await fetch(imageDataOrUrl);
          if (!imgResp.ok) throw new Error(`Failed to fetch image from URL`);
          fileBlob = await imgResp.blob();
        }

        const { error: uploadErr } = await serviceClient.storage
          .from('stock-images')
          .upload(storagePath, fileBlob, { contentType: fileBlob.type, upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = serviceClient.storage
          .from('stock-images')
          .getPublicUrl(storagePath);

        // Insert record
        const tags = prompt.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean).slice(0, 5);
        const { error: insertErr } = await serviceClient
          .from('stock_images')
          .insert({
            title,
            description: prompt,
            category,
            tags,
            image_url: publicUrl,
            storage_path: storagePath,
            file_size: fileBlob.size,
            is_active: true,
          });
        if (insertErr) throw insertErr;

        results.push({ title, imageUrl: publicUrl });
      } catch (err: any) {
        console.error(`Failed to generate image ${i + 1}:`, err.message);
        results.push({ title, imageUrl: '', error: err.message });
      }
    }

    const successCount = results.filter(r => !r.error).length;
    return new Response(
      JSON.stringify({ success: true, generated: successCount, total: prompts.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-stock-images:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: error.message?.includes('Admin') ? 403 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
