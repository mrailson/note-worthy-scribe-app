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
  'Health Promotion & Campaigns': [
    'A GP surgery noticeboard displaying seasonal flu vaccination campaign posters, NHS branding, Northamptonshire ICB materials, colourful health promotion',
    'A practice nurse administering a flu jab to an elderly patient in a Northamptonshire GP surgery, NHS immunisation clinic, professional clinical setting',
    'A bowel cancer screening awareness display in a GP waiting area, NHS screening programme posters, FIT kit information leaflets',
    'A smoking cessation clinic poster on a GP surgery wall, NHS Stop Smoking service, Northamptonshire quit support details',
    'A cervical screening awareness campaign display in a GP practice, NHS smear test information, colourful health promotion materials',
    'A diabetes prevention programme poster in a GP surgery, NHS Healthier You, lifestyle change information, Northamptonshire community',
    'A blood pressure check awareness stand in a GP reception area, Know Your Numbers campaign, NHS cardiovascular prevention',
    'A childhood immunisation schedule poster in a GP baby clinic, NHS vaccination programme, colourful parent-friendly design',
    'A mental health awareness week display in a GP surgery, NHS Mind resources, Northamptonshire wellbeing signposting',
    'A weight management programme poster in a GP waiting area, NHS Better Health campaign, Northamptonshire healthy lifestyle services',
  ],
  'Signage & Wayfinding': [
    'A clear door sign for a GP consultation room reading Room 3, NHS blue, accessible font, Braille strip below, modern practice corridor',
    'Directional arrows on a GP surgery corridor wall pointing to treatment rooms, reception and exit, NHS wayfinding, clean design',
    'A fire exit sign and emergency evacuation plan displayed in a GP surgery corridor, compliant safety signage, NHS building',
    'An accessible toilet sign with wheelchair, baby change and hearing loop symbols at a Northamptonshire GP practice',
    'A GP surgery entrance sign with practice name, opening hours and NHS logo, Northamptonshire village setting, professional design',
    'Room labels on GP practice doors — Nurse Room, Phlebotomy, Minor Surgery — NHS blue text, clear accessible font',
    'A patient noticeboard with colour-coded zones map of a GP surgery, wayfinding for elderly patients, large print',
    'A digital display screen in GP reception showing queue information and room directions, modern NHS wayfinding technology',
    'A car park sign at a GP surgery showing disabled bays, patient parking and staff parking areas, Northamptonshire practice',
    'Pharmacy collection point signage within a GP dispensary, clear directional sign, NHS branding, Northamptonshire practice',
  ],
  'Patient Safety & Infection Control': [
    'A hand hygiene station at a GP surgery entrance with sanitiser dispenser, NHS hand washing poster, infection prevention',
    'A clinical waste bin and sharps disposal container in a GP treatment room, yellow waste bags, NHS infection control compliant',
    'A practice nurse wearing PPE — gloves, apron, face mask — preparing for a clinical procedure in a GP surgery',
    'An instrument decontamination area in a GP minor surgery suite, autoclave, sterile packaging, NHS infection control standards',
    'A GP surgery consultation room cleaned and ready between patients, surface wipes, hand gel, NHS cleanliness standards',
    'A needle stick injury protocol poster displayed in a GP treatment room, sharps safety, NHS occupational health guidance',
    'A vaccine cold chain monitoring display showing fridge temperature logs in a GP practice, patient safety, NHS standards',
    'A hand washing technique poster above a clinical sink in a GP surgery, NHS 5 moments of hand hygiene, illustrated steps',
    'Personal protective equipment storage in a GP practice storeroom — boxes of gloves, aprons, masks — organised shelves, NHS',
    'A spillage kit mounted on a GP surgery wall next to clinical waste bins, biohazard symbol, infection control equipment',
  ],
  'Pharmacy & Prescriptions': [
    'A clinical pharmacist reviewing repeat prescriptions on EMIS Web in a GP practice dispensary, medication shelves, NHS',
    'A GP practice dispensary counter with prescription bags ready for collection, medication labels, Northamptonshire village surgery',
    'Electronic prescribing on EMIS Web showing drug interaction alerts, GP computer screen, patient safety, clinical decision support',
    'A medication review appointment between clinical pharmacist and elderly patient in a GP surgery, polypharmacy, NHS',
    'A prescription collection point in a GP surgery reception area with numbered shelves, organised medication bags, NHS',
    'A pharmacist checking controlled drugs register in a GP practice, CD cabinet, NHS regulations, professional accountability',
    'Repeat prescription ordering via NHS App shown on a patient smartphone, digital prescribing, GP practice services',
    'A GP practice medication fridge with temperature monitoring, vaccines and insulin storage, NHS cold chain compliance',
    'A pharmacist-led inhaler technique clinic in a GP surgery, asthma devices, spacers, patient education, NHS',
    'A GP practice prescription printer producing FP10 forms, electronic prescribing workflow, NHS primary care',
  ],
  'Mental Health & Wellbeing': [
    'A calm and welcoming counselling room in a GP surgery, two comfortable chairs, soft lighting, tissue box, mindfulness poster, NHS',
    'A social prescribing link worker meeting a patient in a quiet GP side room, community resources leaflets, wellbeing conversation',
    'A mindfulness and relaxation group in a Northamptonshire community centre, referred by GP social prescribing, diverse attendees',
    'A mental health crisis contact card display in a GP surgery, Samaritans, NHS 111, Northamptonshire crisis team numbers',
    'A GP having a sensitive mental health conversation with a young patient, supportive atmosphere, PHQ-9 form on desk, NHS',
    'An art therapy session in a community hall linked to a Northamptonshire GP practice, creative wellbeing, social prescribing',
    'A wellbeing noticeboard in a GP surgery with information on local peer support groups, talking therapies, Northamptonshire IAPT',
    'A nature-based wellbeing walk in Northamptonshire countryside, social prescribing group, GP-referred patients, outdoor therapy',
    'A staff wellbeing room in a GP practice with comfortable seating, tea facilities, mindfulness resources, NHS staff support',
    'A five ways to wellbeing poster in a GP waiting area — Connect, Be Active, Take Notice, Keep Learning, Give — NHS branding',
  ],
  'Access & Inclusivity': [
    'A wheelchair-accessible entrance ramp at a Northamptonshire GP surgery, automatic doors, level access, inclusive NHS design',
    'A hearing loop sign and portable hearing loop device at a GP reception desk, accessible communication, NHS',
    'Easy Read patient information leaflets displayed in a GP surgery, simple language with pictures, inclusive healthcare, NHS',
    'A British Sign Language interpreter on a video screen during a GP consultation, deaf patient access, NHS reasonable adjustments',
    'A height-adjustable examination couch in a GP clinical room, bariatric-friendly, accessible healthcare equipment, NHS',
    'Large print appointment letters and patient leaflets in a GP surgery, visual impairment accessibility, NHS',
    'A translation service phone being used during a GP consultation, language access, diverse patient population, NHS',
    'An accessible car parking bay with wide space next to a Northamptonshire GP surgery entrance, disabled access, NHS',
    'A GP surgery waiting area with wheelchair spaces, low-level reception counter, and visual call display, inclusive design, NHS',
    'A patient completing an online GP consultation form with screen reader accessibility, digital inclusivity, NHS App',
  ],
  'Seasonal & Calendar Events': [
    'A GP surgery reception decorated for Christmas with a reminder notice about holiday opening hours, festive but professional, NHS',
    'A winter pressures campaign poster in a GP surgery — Keep Warm Keep Well, flu and COVID boosters, Northamptonshire NHS',
    'A GP practice entrance with autumn leaves, flu vaccination campaign banner displayed, seasonal health promotion, Northamptonshire',
    'A bank holiday closure notice on a GP surgery door with out-of-hours contact details, NHS 111 signposting, professional design',
    'A spring allergy and hayfever information display in a GP waiting area, seasonal health advice, NHS self-care guidance',
    'A GP practice summer opening hours notice with heatwave health advice poster, staying hydrated, NHS sun safety',
    'A Remembrance Day poppy display in a GP surgery reception alongside NHS mental health veteran support information',
    'A GP surgery noticeboard promoting New Year health checks — blood pressure, diabetes screening, NHS health MOT, January campaign',
    'A back-to-school immunisation reminder poster in a GP surgery, autumn term vaccinations, NHS childhood immunisation programme',
    'A GP practice Easter closure notice with pharmacy rota and NHS 111 information, Northamptonshire area, professional design',
  ],
  'Self-Care & Prevention': [
    'A patient education leaflet display in a GP surgery covering diabetes self-management, asthma action plans, healthy eating, NHS',
    'A health check station in a GP practice with BMI chart, blood pressure monitor, and lifestyle advice leaflets, NHS prevention',
    'A patient using a home blood pressure monitor as shown by their GP, self-monitoring, long-term condition management, NHS',
    'A healthy lifestyle poster in a GP waiting area — eat well, move more, drink less, stop smoking — NHS Better Health campaign',
    'A GP practice display promoting NHS Health Checks for 40-74 year olds, cardiovascular risk assessment, Northamptonshire',
    'A patient completing an online symptom checker before contacting their GP, NHS 111 online, digital self-care, smartphone',
    'A diabetes structured education session in a Northamptonshire community venue, DESMOND programme, patient self-care skills',
    'A GP surgery display about managing minor illnesses at home — colds, sore throats, sprains — NHS self-care pharmacy advice',
    'A long-term condition review appointment between a practice nurse and patient, care plan discussion, self-management goals, NHS',
    'A community exercise referral class in a Northamptonshire leisure centre, GP-referred patients, active lifestyle, NHS prevention',
  ],
  'Urgent & Emergency Care': [
    'A GP surgery minor injuries assessment room with wound care supplies, examination light, first aid equipment, NHS primary care',
    'A triage nurse on the phone at a GP surgery assessing patient urgency, appointment prioritisation, same-day access, NHS',
    'An NHS 111 signposting poster in a GP surgery reception, when to call 111 vs 999, urgent care pathways, patient guidance',
    'A defibrillator mounted on a GP surgery wall with clear signage and instructions, emergency equipment, NHS',
    'A GP duty doctor reviewing urgent same-day appointment requests on EMIS, clinical triage, workload management, NHS',
    'A minor illness clinic room in a GP surgery with ENT examination equipment, pulse oximeter, thermometer, NHS primary care',
    'An emergency drug kit in a GP practice including adrenaline, salbutamol, and glucose, anaphylaxis protocols, NHS',
    'A GP surgery poster explaining when to use A&E, GP, pharmacy or 111, right care right place, NHS urgent care navigation',
    'A practice paramedic conducting a home visit for an urgent patient assessment, GP-referred, Northamptonshire community, NHS',
    'An oxygen cylinder and suction equipment in a GP emergency treatment area, resuscitation equipment check list, NHS standards',
  ],
  'HR & Recruitment': [
    'A GP practice job advert poster for a salaried GP position, NHS terms and conditions, Northamptonshire location, professional design',
    'A new staff member induction pack on a desk with practice handbook, IT login details, and welcome letter, GP practice onboarding',
    'A staff appraisal meeting between a practice manager and team member, professional development review, NHS primary care',
    'A GP practice staff room with duty rota on the wall, team noticeboard, wellbeing resources, break area, NHS',
    'A practice manager reviewing staff training compliance records on screen, mandatory training tracker, NHS workforce management',
    'A GP trainee welcome day at a Northamptonshire training practice, medical education, supervision meeting, NHS',
    'A diverse recruitment fair stand promoting GP practice careers, NHS employer branding, Northamptonshire healthcare jobs',
    'A staff wellbeing survey form on a computer screen in a GP practice, anonymous feedback, NHS People Plan, workforce support',
    'A GP practice team building event in a Northamptonshire venue, staff away day, team development, NHS primary care',
    'An exit interview form and staff turnover report on a practice manager desk, HR processes, NHS retention strategies',
  ],
  'Data & Digital Services': [
    'A patient using NHS App on their smartphone to book a GP appointment, digital-first primary care, modern healthcare access',
    'A GP practice data dashboard on a large monitor showing appointment utilisation, DNA rates, and QOF performance metrics',
    'A practice manager reviewing cyber security checklist on screen, NHS Data Security and Protection Toolkit, GP practice compliance',
    'An online consultation form on a GP practice website, patient submitting symptoms digitally, eConsult or AccuRx, NHS',
    'A GP practice server room with secure NHS network equipment, data protection, HSCN connection, IT infrastructure',
    'A patient accessing their medical records online via NHS App, test results, correspondence, digital health records, GP practice',
    'A SNOMED CT clinical coding screen on EMIS Web, structured data entry, GP quality outcomes, NHS data standards',
    'A GP practice Wi-Fi and digital check-in setup guide poster, patient self-service technology, modern NHS surgery',
    'A data protection officer reviewing GDPR compliance documentation in a GP practice, patient data security, NHS',
    'A GP practice population health management dashboard showing disease prevalence, health inequalities, Northamptonshire PCN data',
  ],
  'CQC & Compliance': [
    'A CQC Good rating certificate displayed in a GP surgery reception area, NHS inspection results, professional framed display',
    'A practice manager organising CQC evidence folders — safe, effective, caring, responsive, well-led — inspection preparation, NHS',
    'A CQC inspection preparation meeting with a GP practice team around a table, compliance review, NHS governance',
    'A significant event audit log open on a computer screen in a GP practice, clinical governance, NHS learning culture',
    'A fire safety compliance folder and extinguisher inspection log in a GP surgery, health and safety, NHS standards',
    'A controlled drugs audit being conducted in a GP practice, CD register, NHS regulations, clinical governance',
    'A GP practice policy folder shelf — infection control, safeguarding, complaints, whistleblowing — NHS compliance library',
    'A staff training compliance matrix displayed on a practice manager screen, mandatory training due dates, NHS workforce',
    'A patient feedback and complaints procedure poster in a GP surgery, NHS Friends and Family Test, CQC requirement',
    'A GP practice risk register spreadsheet on screen, identified risks and mitigations, clinical governance, NHS compliance',
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

    // Limit Pro model to 5 images max due to longer generation time (~30s each)
    const maxCount = (model === 'gemini-pro') ? Math.min(count || 5, 5) : Math.min(count || 10, 10);
    const imageCount = maxCount;
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
