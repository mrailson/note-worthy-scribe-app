import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActionItem {
  id?: string;
  description: string;
  owner?: string;
  deadline?: string;
  status?: string;
  priority?: string;
}

interface MeetingInfographicData {
  meetingTitle: string;
  meetingDate?: string;
  meetingTime?: string;
  location?: string;
  attendees: string[];
  notesContent: string;
  actionItems: ActionItem[];
  transcript?: string;
}

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface InfographicOptions {
  style: string;
  customStyle?: string;
  orientation?: 'portrait' | 'landscape';
  logoUrl?: string;
  practiceName?: string;
}

const INFOGRAPHIC_STYLES: Record<string, { name: string; prompt: string }> = {
  'practice-professional': {
    name: 'Practice Professional',
    prompt: `Clean, premium GP practice meeting summary design. Use a calming palette of NHS blue, soft teal, and warm grey backgrounds with white card sections. 
Layout: Bold "WHAT YOU MISSED" header in NHS blue banner at top. Date displayed as a prominent badge/card element. Meeting title in large, confident Calibri/Arial typography. 
Content organised into clearly separated card sections with subtle drop shadows: "In Brief" summary box with a left blue border accent, numbered key discussion points with lightbulb icons, decisions in a highlighted green-tinted box with checkmark icons, and a small action count badge at the bottom.
Visual style: Flat design healthcare icons (stethoscope, clipboard, calendar, people silhouettes), generous white space, professional but approachable. Feels like a premium NHS document, not a busy poster.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'clinical-governance': {
    name: 'Clinical Governance',
    prompt: `Formal clinical governance and audit-focused infographic. NHS blue as the dominant colour with a structured, grid-based layout that feels authoritative and compliant.
Layout: "WHAT YOU MISSED" in a dark navy banner. Date in a formal badge. Meeting title in bold uppercase. 
Content structured as a governance dashboard: RAG-rated sections (red/amber/green traffic light indicators next to each discussion point), compliance checklist icons (ticked boxes, shield symbols), risk register styling for open items, and a prominent "Decisions Made" panel with a gavel or stamp icon.
Visual style: Clean grid lines separating sections, numbered items with circle badges, minimal decoration — this should look like something you'd present to a CQC inspector or clinical lead. Data-driven feel with progress bars or status indicators where appropriate.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'patient-safety': {
    name: 'Patient Safety Focus',
    prompt: `Patient safety and quality improvement themed infographic. Protective, compassionate colour palette: deep teal and amber accents on a clean white background with soft green section backgrounds.
Layout: "WHAT YOU MISSED" with a shield icon in the header. Date prominently displayed. Meeting title clear and readable.
Content structured around safety themes: discussion points with safety shield or heart-in-hand icons, incident/concern items highlighted in amber warning boxes, improvement actions in green "safe" boxes, decisions displayed with prominent checkmark-in-shield icons.
Visual style: Caring and protective feel — rounded corners on all boxes, gentle gradients, healthcare safety iconography (shields, crosses, protective hands, alert triangles for risks). Should feel reassuring and thorough, like a patient safety bulletin board.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'team-engagement': {
    name: 'Team Engagement',
    prompt: `Warm, engaging team-focused meeting summary designed to make staff feel valued and informed. Friendly palette: soft purple, warm teal, and sunshine yellow accents on light backgrounds.
Layout: "WHAT YOU MISSED" in a friendly, slightly playful banner. Date in a calendar-page style element. Meeting title welcoming and clear.
Content designed for staff engagement: "The Big Picture" summary in a warm-toned card, discussion points with people/team icons and speech bubble motifs, celebrations or achievements highlighted with star/trophy icons, decisions in a collaborative "agreed together" styled box, and a "Your Actions" section with friendly task icons.
Visual style: Modern and approachable — think team newsletter rather than formal minutes. Rounded shapes, friendly sans-serif typography, subtle confetti or sparkle accents for positive items, supportive messaging. Should make someone who missed the meeting feel included, not lectured.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'qof-targets': {
    name: 'QOF & Targets',
    prompt: `Data-driven performance and targets dashboard infographic. Bold, results-focused palette: dark blue headers, green for achieved/on-track, amber for approaching, red for at-risk, on a clean white/light grey background.
Layout: "WHAT YOU MISSED" in a dark dashboard-style header bar. Date prominent. Meeting title as a dashboard title.
Content structured as a performance report: KPI-style metric cards with large numbers and trend arrows, discussion points formatted as "performance areas" with progress bar indicators, target percentages displayed prominently (e.g., "78.5% achieved" in large bold text), decisions as "agreed targets" with milestone markers, and a compact action tracker at the bottom.
Visual style: Dashboard aesthetic — clean data cards with shadows, donut charts or progress rings for percentages, trend arrows (up/down), colour-coded status badges. Should look like a practice performance dashboard printed as a one-page summary.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'board-pack': {
    name: 'Board Pack Summary',
    prompt: `Executive board pack summary — formal, authoritative, and designed for governance review. Palette: deep navy header, NHS blue accents, gold for key decisions, on pristine white with subtle grey section backgrounds.
Layout: "WHAT YOU MISSED" styled as a formal document header with a thin gold underline. Date in a formal "Board Meeting — DD MMM YYYY" format. Meeting title large and professional.
Content structured for executive consumption: a 2-3 line "Executive Summary" box at the top with a blue left border, numbered discussion items as formal agenda-point summaries (concise, no fluff), a bold "DECISIONS REGISTER" section in gold/navy styling listing each decision as a bullet, and "Matters Arising / Risks" in a separate formal panel.
Visual style: Think annual report meets board minutes — serif headings (optional), clean horizontal dividers between sections, minimal iconography (just small bullet indicators), formal classification badge ("OFFICIAL" in top corner). Must look like something a CD or Practice Manager would be comfortable sharing with the ICB.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'icb-submission': {
    name: 'ICB Submission',
    prompt: `ICB / commissioner-facing meeting summary designed to evidence delivery and outcomes. Palette: NHS blue and NHS dark blue as primary colours, NHS green for positive outcomes, NHS warm yellow for items requiring attention, on white.
Layout: "WHAT YOU MISSED" styled as an evidence summary header. "Meeting held: DD MMM YYYY" as a formal date line. Meeting title as a programme/project title.
Content structured as a commissioner evidence pack: "Programme Update" summary paragraph, key discussion points framed as "delivery milestones" or "programme workstreams" with status indicators, outcomes and decisions presented as "evidenced achievements" with green tick badges, risks and open items in a formal "Risks & Mitigations" panel with amber/red indicators.
Visual style: NHS England document aesthetic — clean, evidence-based, no frivolous decoration. Horizontal progress bars for workstream status, formal NHS typography, structured grid layout. Should look like something extracted from an ICB programme board report.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  },
  'neighbourhood': {
    name: 'Neighbourhood Team',
    prompt: `Neighbourhood / place-based team meeting summary — collaborative, multi-agency, and community-focused. Palette: NHS teal as primary, warm coral accents for community items, soft blue backgrounds, with friendly earth tones.
Layout: "WHAT YOU MISSED" in a warm teal banner with a community/neighbourhood icon (houses, people). Date prominent. Meeting title reflecting the neighbourhood/place-based focus.
Content structured for multi-disciplinary consumption: "Meeting Overview" summary that sets the neighbourhood context, discussion points with icons representing different agencies/services (health, social care, community, housing), decisions framed as "agreed actions for our neighbourhood" with collaborative language, and a compact "Who's Doing What" section linking actions to organisations.
Visual style: Community health poster meets professional summary — friendly but credible, with simple illustrations of community (houses, trees, people together), warm accessible typography, inclusive design. Should feel like something you'd pin up in a neighbourhood hub or share across a multi-agency WhatsApp group.
British English spelling throughout (organisation, colour, summarise, centre, programme, recognise, prioritise).`
  }
};

export const useMeetingInfographic = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);

  const sanitiseCustomStyleRequest = (rawStyle: string): string => {
    const trimmed = rawStyle.trim();
    const lower = trimmed.toLowerCase();

    // Avoid prompting with trademarked franchise names/characters/logos – these can cause the image model to refuse.
    // Map common requests to "vibe" descriptions that still achieve the look.
    const franchiseMappings: Record<string, string> = {
      // Sci-Fi
      'star wars': 'cinematic space-opera sci-fi theme: deep starfield backgrounds, dramatic lighting, holographic UI motifs, glowing blue/amber accents, futuristic typography, sleek spacecraft silhouettes',
      'star trek': 'retro-futuristic space exploration theme: sleek starship bridge aesthetics, LCARS-inspired panel layouts, bold primary colours on dark backgrounds, clean geometric shapes, optimistic sci-fi feel',
      'matrix': 'digital cyberpunk theme: cascading green code rain on black, neon green accents, monospace typography, glitch effects, virtual reality aesthetics',
      'blade runner': 'neon-noir cyberpunk theme: rain-soaked streets, neon pink and blue, retrofuturistic cityscapes, melancholic atmosphere',
      'dune': 'epic desert sci-fi theme: golden sand tones, ornate Arabic-inspired patterns, ancient futurism, spice-orange accents, mystical typography',
      'interstellar': 'cosmic space exploration theme: vast starfields, wormhole visualisations, scientific diagrams, hopeful yet melancholic atmosphere',
      'back to the future': 'retro 80s sci-fi adventure theme: chrome and neon, digital clock displays, bold italicised typography, time-travel energy effects, optimistic futurism',
      'tron': 'digital grid theme: glowing neon blue lines on black, geometric circuit patterns, sleek futuristic typography, light-cycle aesthetics',
      'the martian': 'survival on Mars theme: rusty red landscapes, NASA aesthetics, scientific problem-solving, optimistic determination',
      
      // Fantasy
      'lord of the rings': 'epic high-fantasy medieval theme: aged parchment textures, ornate Celtic knotwork borders, earthy tones (forest green, gold, brown), elegant calligraphic typography, mystical glow effects',
      'lotr': 'epic high-fantasy medieval theme: aged parchment textures, ornate Celtic knotwork borders, earthy tones (forest green, gold, brown), elegant calligraphic typography, mystical glow effects',
      'harry potter': 'magical wizarding school theme: gothic stone textures, candlelit warmth, burgundy/gold/navy palette, vintage parchment, ornate serif fonts, mystical floating elements',
      'game of thrones': 'epic medieval fantasy theme: iron and stone textures, house sigil-inspired iconography, aged parchment, dark dramatic lighting, royal heraldry',
      'got': 'epic medieval fantasy theme: iron and stone textures, house sigil-inspired iconography, aged parchment, dark dramatic lighting, royal heraldry',
      'narnia': 'classic British fantasy theme: snowy lamppost scenes, noble lion imagery, wardrobe portal magic, storybook feel',
      'frozen': 'icy Nordic fairy-tale theme: crystalline ice patterns, cool blue and purple palette, snowflake motifs, elegant flowing typography, magical winter atmosphere',
      
      // Superheroes
      'marvel': 'dynamic superhero comic-book theme: bold primary colours, halftone dot patterns, dramatic action poses, comic panel layouts, punchy typography with outlines',
      'dc': 'dark heroic comic theme: dramatic shadows, bold silhouettes, strong contrasts, gothic undertones, powerful iconography',
      'batman': 'dark noir detective theme: shadowy blacks and greys, art-deco inspired geometry, gothic architecture silhouettes, dramatic spotlighting',
      'spider-man': 'dynamic web-slinger theme: red and blue action, web patterns, cityscape, youthful energy',
      
      // Action & Thriller
      'james bond': 'sleek spy-thriller theme: sophisticated black and gold palette, gun-barrel motifs, elegant typography, casino glamour, international intrigue',
      '007': 'sleek spy-thriller theme: sophisticated black and gold palette, gun-barrel motifs, elegant typography, casino glamour, international intrigue',
      'indiana jones': 'vintage adventure archaeology theme: aged maps and parchment, sepia tones, expedition typography, exotic locations, 1930s pulp adventure',
      'mission impossible': 'high-tech espionage theme: sleek modern interfaces, timer countdown displays, bold urgent typography, suspenseful atmosphere',
      'john wick': 'neo-noir assassin theme: dark atmospheric lighting, gold accents on black, elegant typography, nightclub neon',
      'kingsman': 'gentleman spy comedy theme: British tailoring, umbrella weapons, outrageous action, posh meets punk',
      
      // Comedy & Pop Culture
      'wes anderson': 'symmetrical indie quirky theme: perfectly centred compositions, pastel colour palettes, vintage typography, miniature diorama aesthetic',
      'grand budapest hotel': 'whimsical European hotel theme: pink and purple pastels, ornate Art Nouveau details, symmetrical compositions, concierge elegance',
      'the office': 'mundane office mockumentary theme: Dunder Mifflin fluorescent lighting, beige cubicle walls, talking-head interview framing, paper company aesthetic',
      'friends': 'cosy 90s sitcom theme: Central Perk coffee colours, friendly handwritten fonts, New York apartment warmth, nostalgic comfort',
      'monty python': 'absurdist British comedy theme: Terry Gilliam collage animation style, medieval silliness, irreverent hand-drawn elements',
      
      // Animated
      'disney': 'magical fairy-tale theme: enchanted castle silhouettes, sparkle effects, warm storybook colours, whimsical typography, happily-ever-after atmosphere',
      'pixar': 'vibrant animated adventure theme: bold cheerful colours, playful rounded typography, expressive character-driven layouts, heartwarming atmosphere',
      'studio ghibli': 'Japanese animation theme: watercolour landscapes, magical nature spirits, gentle pastel colours, contemplative atmosphere, Miyazaki wonder',
      'spirited away': 'Studio Ghibli theme: Japanese bathhouse, magical spirits, food transformation, wonder',
      'simpsons': 'animated sitcom theme: bright yellow, suburban small-town satire, chunky cartoon outlines, warm yellow as dominant colour',
      'the simpsons': 'animated sitcom theme: bright yellow, suburban small-town satire, chunky cartoon outlines, warm yellow as dominant colour',
      'minions': 'playful yellow cartoon theme: bright yellow and blue palette, banana motifs, silly rounded typography, fun chaotic energy',
      
      // TV Shows
      'stranger things': 'retro 80s supernatural theme: neon red glow, flickering Christmas lights, VHS aesthetic, bold outlined typography, synth-wave colours',
      'doctor who': 'time-travelling British sci-fi theme: TARDIS blue, swirling vortex patterns, retrofuturistic controls, Gallifreyan circular writing',
      'breaking bad': 'desert crime drama theme: desert tones, periodic table elements, laboratory motifs, meth-blue accents',
      'peaky blinders': 'prohibition-era gangster theme: flat cap silhouettes, industrial smoke, whisky amber tones, razor-sharp typography',
      'ted lasso': 'optimistic sports comedy theme: believe poster, British football, American positivity, warm feel-good energy',
      'downton abbey': 'Edwardian estate theme: upstairs downstairs, British aristocracy, period costume, elegant drama',
      'the crown': 'British royalty theme: palace interiors, royal protocol, historical drama, regal elegance',
      
      // Style/Aesthetic themes
      'retro': 'vintage retro theme: warm sepia tones, halftone printing effects, mid-century modern typography, old-school graphic design',
      '80s': '1980s retro theme: neon colours, grid patterns, synthwave aesthetics, VHS glitch effects, Miami Vice vibes',
      '90s': '1990s nostalgia theme: bright neon on black, geometric shapes, grunge textures, rave culture colours',
      'vaporwave': 'vaporwave aesthetic: pink and cyan gradients, Greek statues, palm trees, Japanese text, retro computing',
      'steampunk': 'Victorian steampunk theme: brass gears and cogs, leather textures, clockwork mechanisms, sepia and copper tones',
      'art deco': 'Art Deco luxury theme: geometric gold patterns on dark backgrounds, gatsby-era elegance, bold symmetrical layouts',
      'cyberpunk': 'cyberpunk neon city theme: rain-soaked neon streets, holographic displays, augmented reality overlays, purple and cyan',
      'minimalist': 'ultra-minimalist Scandinavian theme: vast white space, single accent colour, thin-line typography, zen simplicity',
      'dark mode': 'dark mode interface theme: dark charcoal background, neon accent colours, sleek modern typography, futuristic UI feel',
      'vintage poster': 'vintage travel poster theme: bold flat colours, simplified illustrations, art-deco typography, retro tourism aesthetic',
      'comic book': 'comic book pop-art theme: Ben-Day dots, bold outlines, speech bubbles, BAM/POW energy, primary colours',
      'watercolour': 'soft watercolour painting theme: flowing colour washes, paint drip effects, handwritten typography, artistic and organic feel',
      'neon': 'electric neon sign theme: glowing neon tubes on dark backgrounds, bar sign aesthetic, vibrant pinks blues and greens',
      'japanese': 'Japanese aesthetic theme: cherry blossoms, clean minimalism, kanji-inspired layouts, zen garden tranquillity, ukiyo-e colour palette',
      'christmas': 'festive Christmas theme: red and green with gold accents, snowflakes, fairy lights, warm holiday atmosphere',
      'halloween': 'spooky Halloween theme: orange and black, cobwebs, carved pumpkins, gothic typography, creepy fun',
    };

    // Check if the input matches a known franchise
    for (const [key, replacement] of Object.entries(franchiseMappings)) {
      if (lower.includes(key)) {
        return replacement;
      }
    }

    // No match — return the original (trimmed) input
    return trimmed;
  };

  // Format meeting data into a concise text summary for the infographic prompt
  const formatMeetingForInfographic = (data: MeetingInfographicData): string => {
    const parts: string[] = [];
    parts.push(`Meeting: ${data.meetingTitle}`);
    if (data.meetingDate) parts.push(`Date: ${data.meetingDate}`);
    if (data.meetingTime) parts.push(`Time: ${data.meetingTime}`);
    if (data.location) parts.push(`Location: ${data.location}`);
    if (data.attendees?.length) parts.push(`Attendees: ${data.attendees.join(', ')}`);
    if (data.notesContent) parts.push(`\nNotes:\n${data.notesContent}`);
    if (data.actionItems?.length) {
      parts.push(`\nAction Items (${data.actionItems.length}):`);
      data.actionItems.forEach(item => {
        parts.push(`- ${item.description}${item.owner ? ` (${item.owner})` : ''}${item.deadline ? ` by ${item.deadline}` : ''}`);
      });
    }
    return parts.join('\n');
  };

  const generateInfographic = async (
    data: MeetingInfographicData,
    options?: InfographicOptions
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      // Format meeting content for infographic
      // Truncate to 3000 chars max to prevent Gemini 3 Pro timeouts on large meetings
      const rawContent = formatMeetingForInfographic(data);
      const documentContent = rawContent.length > 3000 
        ? rawContent.substring(0, 3000) + '\n\n[Content truncated for infographic generation]'
        : rawContent;

      // Count action items for the prompt
      const actionItemCount = data.actionItems?.length || 0;
      const actionItemText = actionItemCount === 0 
        ? 'No specific action items were recorded.'
        : actionItemCount === 1 
          ? '1 action item was assigned.'
          : `${actionItemCount} action items were assigned.`;
      
      // Log options received - CRITICAL for debugging custom styles
      console.log('[useMeetingInfographic] Options received:', JSON.stringify(options));
      console.log('[useMeetingInfographic] customStyle value:', options?.customStyle);
      console.log('[useMeetingInfographic] style value:', options?.style);
      
      // Build style instruction based on preset or custom style
      // Determine if using custom style
      const isCustomStyle = !!options?.customStyle?.trim();
      console.log('[useMeetingInfographic] isCustomStyle:', isCustomStyle);
      let styleInstruction: string;
      
      if (isCustomStyle) {
        // For custom styles, give full creative freedom to the user's request
        const safeStyle = sanitiseCustomStyleRequest(options.customStyle);
        styleInstruction = `CUSTOM STYLE REQUEST: "${safeStyle}"
        
IMPORTANT: Apply this custom visual style as the PRIMARY design direction. 
Be creative and interpret the style request fully. The style should be clearly visible throughout the design.
Examples:
- For a "space‑opera sci‑fi" theme: starfield background, glowing accents, futuristic typography, cinematic contrast.
- For a "retro 80s" theme: neon colours, grid patterns, synthwave aesthetics.
Maintain readability but prioritise the requested visual style.`;
        console.log('[useMeetingInfographic] Using custom style:', options.customStyle);
      } else {
        const styleData = INFOGRAPHIC_STYLES[options?.style || 'practice-professional'];
        styleInstruction = styleData?.prompt || INFOGRAPHIC_STYLES['practice-professional'].prompt;
        console.log('[useMeetingInfographic] Using preset style:', options?.style || 'practice-professional');
      }
      
      setCurrentPhase('generating');

      // Call the AI image generation edge function with Gemini Pro 3
      // Use Promise.race for timeout since Supabase client doesn't support AbortController
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 180 seconds. Please try again.')), 180000);
      });

      // Determine orientation - default to landscape
      const orientation = options?.orientation || 'landscape';
      const orientationInstruction = orientation === 'landscape' 
        ? 'Landscape orientation (16:9 aspect ratio), suitable for presentations and widescreen displays'
        : 'Portrait orientation (9:16 or A4 aspect ratio), suitable for printing and mobile viewing';

      // Build design requirements - conditionally include NHS styling only for preset styles
      const designRequirements = isCustomStyle 
        ? `- "WHAT YOU MISSED" banner/badge styling at the top
- ${orientationInstruction}
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Apply the custom style throughout ALL visual elements
- British English spelling throughout
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make the custom style the dominant visual theme
- CRITICAL TEXT LENGTH RULE: Every text block on the infographic must be SHORT. Maximum 20 words per sentence. Maximum 2 sentences per section. If a discussion point needs more detail, split it into a bold heading (5-8 words) and one short explanatory line (15 words max). Long sentences WILL render with garbled characters — brevity prevents this.
- Use bullet points with 8-12 words each rather than full paragraphs
- Headings should be 3-6 words maximum
- Never render a sentence longer than 20 words — break it into two lines or shorten it
- NEVER duplicate a section. Each heading (Key Discussion Points, Decisions Made, Action Items, The Meeting in Brief) must appear EXACTLY ONCE in the infographic. If you find yourself writing the same heading twice, you have made an error — remove the duplicate.`
        : `- "WHAT YOU MISSED" banner/badge styling at the top
- ${orientationInstruction}
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Professional GP practice/NHS styling
- British English spelling throughout
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make it feel like catching up with a colleague, not a task list
- CRITICAL TEXT LENGTH RULE: Every text block on the infographic must be SHORT. Maximum 20 words per sentence. Maximum 2 sentences per section. If a discussion point needs more detail, split it into a bold heading (5-8 words) and one short explanatory line (15 words max). Long sentences WILL render with garbled characters — brevity prevents this.
- Use bullet points with 8-12 words each rather than full paragraphs
- Headings should be 3-6 words maximum
- Never render a sentence longer than 20 words — break it into two lines or shorten it
- NEVER duplicate a section. Each heading (Key Discussion Points, Decisions Made, Action Items, The Meeting in Brief) must appear EXACTLY ONCE in the infographic. If you find yourself writing the same heading twice, you have made an error — remove the duplicate.`;

      const customPrompt = `Create a HIGH QUALITY "WHAT YOU MISSED" meeting overview infographic.

MEETING: "${data.meetingTitle}"

CONCEPT: This is a visual catch-up for people who missed the meeting. 
Focus on WHAT HAPPENED, not just tasks.

VISUAL STYLE INSTRUCTIONS:
${styleInstruction}

CRITICAL CONTENT HIERARCHY (in order of visual prominence):

1. "WHAT YOU MISSED" - Bold header at top
2. DATE AND TIME - Display VERY PROMINENTLY as a HERO ELEMENT (large, styled)
   ${data.meetingDate ? `Date: ${data.meetingDate}` : ''}
   ${data.meetingTime ? `Time: ${data.meetingTime}` : ''}
3. MEETING TITLE - Clear and readable
4. THE MEETING IN BRIEF - Key summary paragraph (what this meeting was about)
5. KEY DISCUSSION POINTS - The main topics and conversations that took place
6. DECISIONS MADE - Important outcomes that were agreed
7. ACTION ITEMS - Small section stating: "${actionItemText}" — do NOT list individual actions, just show this count.

DESIGN REQUIREMENTS:
${designRequirements}

CRITICAL ACCURACY RULES:
- ONLY include information that appears in the document content provided. NEVER invent, fabricate, or extrapolate figures, budgets, percentages, monetary amounts, or decisions that are not explicitly stated in the source material.
- If you are unsure whether a specific figure or detail was discussed, OMIT it entirely. A missing detail is far better than an invented one.
- Do NOT split monetary amounts into sub-amounts unless the source material explicitly provides that breakdown.
- Do NOT invent "proposals" or "recommendations" — only state what the document content says was actually agreed or decided.
- If the document mentions "£50,000 shortfall", do NOT turn this into "£35,000 immediate + £15,000 later" unless those exact figures appear in the source.

CRITICAL SPELLING AND LANGUAGE RULES:
This infographic is for a British NHS audience. You MUST use British English spelling throughout ALL text content. Specifically:
- "organisation" NOT "organization"
- "colour" NOT "color"  
- "summarise" NOT "summarize"
- "centre" NOT "center"
- "programme" NOT "program" (when referring to a plan/scheme)
- "recognise" NOT "recognize"
- "prioritise" NOT "prioritize"
- "behaviour" NOT "behavior"
- "analyse" NOT "analyze"
- "defence" NOT "defense"
- "licence" NOT "license" (noun)
- "practise" NOT "practice" (verb)
- "focussed" or "focused" (both acceptable)
- Use "whilst" or "while" (both acceptable)
- Date format: "11 March 2026" or "11th March 2026" (never "March 11, 2026")
- Time format: "13:00" or "1:00 PM" (never "1:00 pm" lowercase)
Any American English spelling in the output is a CRITICAL ERROR. Check every word before finalising.
- NEVER render prompt instructions, template variables, or formatting directives as visible text. Specifically:
  - Never show "[Number]", "[Text]", or any square-bracket placeholders
  - Never show "Minimal, count:" or any instruction-style labels
  - Never show colour hex codes like "#EF4444" or "#005EB8"
  - Never show "e.g.," examples from the prompt — use the actual meeting data instead
  - If you don't have data for a section, write "See full minutes" not a placeholder`;

      const invokePromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: customPrompt,
          conversationContext: '',
          documentContent: documentContent,
          requestType: 'infographic',
          imageModel: 'google/gemini-3-pro-image-preview',
          practiceContext: {
            brandingLevel: 'none'
          }
        },
      });

      const { data: response, error: fnError } = await Promise.race([invokePromise, timeoutPromise]);

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate infographic');
      }

      // The edge function returns { success, image: { url }, textResponse }
      const imageUrl = response?.image?.url;
      if (!imageUrl) {
        throw new Error(response?.error || response?.textResponse || 'No image generated');
      }

      setCurrentPhase('downloading');

      // Download the image
      
      // Handle both base64 and URL responses
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        // Base64 image
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/png' });
      } else {
        // URL - fetch and convert to blob
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error('Failed to download infographic image');
        }
        blob = await imageResponse.blob();
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean filename
      // Use clean British date filename format
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const datePrefix = `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
      const cleanTitle = data.meetingTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .substring(0, 60);
      link.download = `${datePrefix} - ${cleanTitle} - Infographic.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setCurrentPhase('complete');
      
      return {
        success: true,
        imageUrl: imageUrl,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[MeetingInfographic] Generation error:', err);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateInfographic,
    isGenerating,
    currentPhase,
    error,
  };
};
