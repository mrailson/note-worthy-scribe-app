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
    'A well-equipped GP consultation room with desk, examination bed, computer screen, natural light',
    'A practice nurse treatment room with vaccination supplies, clinical equipment, NHS clean',
    'A minor surgery room in a GP practice, operating light, sterile environment',
    'A spirometry testing room in a GP surgery, lung function equipment, clinical',
    'A baby weighing and developmental check room, colourful, clinical yet friendly',
    'A phlebotomy room with blood-taking chair, sharps bins, NHS clinical setting',
    'A physiotherapy assessment room within a GP practice, exercise equipment, treatment bed',
    'A mental health consultation room, comfortable chairs, calming decor, confidential setting',
    'An ECG testing room with cardiac monitoring equipment, clinical, professional',
    'A GP examination room with ophthalmoscope and otoscope on wall mount, medical equipment',
  ],
  'Staff & Teams': [
    'A diverse GP practice team photo with doctors, nurses, receptionists and managers, professional NHS uniforms',
    'A GP and practice nurse discussing patient care at a computer, teamwork, clinical setting',
    'A practice manager working at their desk with spreadsheets and rotas, administrative',
    'A community pharmacist consulting with a GP, collaborative working, NHS',
    'A social prescriber meeting with a patient, community health setting, supportive',
    'A healthcare assistant taking observations, blood pressure cuff, professional',
    'A team of paramedics and GPs at a primary care network meeting, collaborative',
    'A receptionist team at a busy GP surgery front desk, multitasking, friendly',
    'A district nurse preparing home visit kit, community nursing bag, NHS uniform',
    'A mental health practitioner in a GP practice, IAPT service, professional',
  ],
  'Technology': [
    'A GP using EMIS clinical system on dual monitors, electronic prescribing, modern NHS',
    'A telehealth video consultation setup with webcam and screen, digital healthcare',
    'NHS App displayed on a smartphone with appointment booking, digital health access',
    'A practice manager reviewing data analytics dashboard on screen, performance metrics',
    'Electronic prescribing system close-up, medication safety alerts, clinical software',
    'A GP using a portable diagnostic device with Bluetooth connection, digital health tools',
    'Patient records on a secure tablet device, mobile clinical access, NHS IT',
    'A practice Wi-Fi enabled waiting room with patient information screens, digital',
    'AccuRx messaging system on screen, patient communication, GP technology',
    'An AI-assisted clinical decision support tool on screen, modern GP technology',
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
      messages: [{ role: 'user', content: `Generate a high quality, photorealistic image: ${prompt}. Ultra high resolution, professional photography style.` }],
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
        positivePrompt: `${prompt}. Ultra high resolution, professional photography style.`,
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
    if (!authHeader) throw new Error('Not authenticated');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Not authenticated');

    // Admin check
    const { data: isAdmin } = await supabaseClient.rpc('is_system_admin', { _user_id: user.id });
    if (!isAdmin) throw new Error('Admin access required');

    const { category, count, model, customPrompt } = await req.json() as GenerateRequest;

    if (!category || !model) throw new Error('Category and model are required');

    const imageCount = Math.min(count || 10, 10);
    const results: { title: string; imageUrl: string; error?: string }[] = [];

    // Get prompts
    let prompts: string[] = [];
    if (customPrompt) {
      prompts = [customPrompt];
    } else {
      const categoryPrompts = CATEGORY_PROMPTS[category] || [];
      // Pick random prompts that haven't been used (based on randomisation)
      const shuffled = [...categoryPrompts].sort(() => Math.random() - 0.5);
      prompts = shuffled.slice(0, imageCount);
    }

    // Use service role client for storage/db operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const title = customPrompt 
        ? `Custom: ${customPrompt.substring(0, 50)}`
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
