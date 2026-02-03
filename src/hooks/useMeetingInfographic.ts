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
}

// GP Practice-focused infographic style presets
const INFOGRAPHIC_STYLES: Record<string, { name: string; prompt: string }> = {
  'practice-professional': {
    name: 'Practice Professional',
    prompt: 'Clean GP practice meeting style with calming blue and green tones, stethoscope and primary care icons, professional medical typography (Calibri/Arial), structured sections for clinical governance, patient safety items, and practice management. Trust-inspiring and NHS-aligned.'
  },
  'clinical-governance': {
    name: 'Clinical Governance',
    prompt: 'Formal clinical governance style using NHS blue (#005EB8) with red/amber/green RAG rating indicators, checklist icons, compliance and audit focused layout, structured risk assessment sections, clear action tracking visual elements, and regulatory compliance theming.'
  },
  'patient-safety': {
    name: 'Patient Safety Focus',
    prompt: 'Patient safety themed design with protective healthcare imagery, amber and green accents on white, shield and safety icons, prominent incident tracking sections, clear escalation pathways visualised, and compassionate professional aesthetic.'
  },
  'team-engagement': {
    name: 'Team Engagement',
    prompt: 'Warm and engaging team-focused style with friendly people icons, collaborative imagery, soft purple and teal colours, celebration of achievements, staff wellbeing focus, and approachable modern design that feels supportive and team-oriented.'
  },
  'qof-targets': {
    name: 'QOF & Targets',
    prompt: 'Data-driven QOF and targets style with progress bars, pie charts, percentage indicators, green for achieved targets, performance dashboard aesthetic, KPI visualisation, and clear metric tracking focused on practice performance outcomes.'
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
      'star wars': 'cinematic space-opera sci-fi theme: deep starfield backgrounds, dramatic lighting, holographic UI motifs, glowing blue/amber accents, futuristic typography, sleek spacecraft silhouettes',
      'star trek': 'retro-futuristic space exploration theme: sleek starship bridge aesthetics, LCARS-inspired panel layouts, bold primary colours on dark backgrounds, clean geometric shapes, optimistic sci-fi feel',
      'lord of the rings': 'epic high-fantasy medieval theme: aged parchment textures, ornate Celtic knotwork borders, earthy tones (forest green, gold, brown), elegant calligraphic typography, mystical glow effects',
      'lotr': 'epic high-fantasy medieval theme: aged parchment textures, ornate Celtic knotwork borders, earthy tones (forest green, gold, brown), elegant calligraphic typography, mystical glow effects',
      'hobbit': 'cosy fantasy adventure theme: warm rustic colours, rolling green hills, handwritten-style typography, whimsical illustrations, comfortable cottage aesthetics',
      'harry potter': 'magical wizarding school theme: gothic stone textures, candlelit warmth, burgundy/gold/navy palette, vintage parchment, ornate serif fonts, mystical floating elements',
      'marvel': 'dynamic superhero comic-book theme: bold primary colours, halftone dot patterns, dramatic action poses, comic panel layouts, punchy typography with outlines',
      'avengers': 'dynamic superhero team theme: bold metallic accents, dramatic lighting, sleek modern tech aesthetic, powerful colour contrasts (red, blue, gold)',
      'dc': 'dark heroic comic theme: dramatic shadows, bold silhouettes, strong contrasts, gothic undertones, powerful iconography',
      'batman': 'dark noir detective theme: shadowy blacks and greys, art-deco inspired geometry, gothic architecture silhouettes, dramatic spotlighting, mysterious atmosphere',
      'superman': 'bright heroic theme: bold primary colours (red, blue, yellow), clean strong typography, hopeful and powerful imagery, art-deco influences',
      'james bond': 'sleek spy-thriller theme: sophisticated black and gold palette, gun-barrel motifs, elegant typography, casino glamour, international intrigue',
      '007': 'sleek spy-thriller theme: sophisticated black and gold palette, gun-barrel motifs, elegant typography, casino glamour, international intrigue',
      'jurassic park': 'prehistoric adventure theme: jungle greens, amber tones, fossil textures, bold expedition typography, adventurous and slightly dangerous atmosphere',
      'jurassic': 'prehistoric adventure theme: jungle greens, amber tones, fossil textures, bold expedition typography, adventurous and slightly dangerous atmosphere',
      'matrix': 'digital cyberpunk theme: cascading green code rain on black, neon green accents, monospace typography, glitch effects, virtual reality aesthetics',
      'terminator': 'apocalyptic tech-noir theme: metallic chrome, red targeting displays, industrial textures, military stencil fonts, dystopian atmosphere',
      'alien': 'sci-fi horror theme: dark industrial corridors, green scanner displays, biomechanical textures, claustrophobic atmosphere, retrofuturistic tech',
      'aliens': 'military sci-fi theme: colonial marines aesthetic, motion tracker displays, industrial yellows and greys, combat-ready typography',
      'blade runner': 'neon-noir cyberpunk theme: rain-soaked streets, neon pink and blue, retrofuturistic cityscapes, Japanese typography influences, melancholic atmosphere',
      'tron': 'digital grid theme: glowing neon blue lines on black, geometric circuit patterns, sleek futuristic typography, light-cycle aesthetics',
      'back to the future': 'retro 80s sci-fi adventure theme: chrome and neon, digital clock displays, bold italicised typography, time-travel energy effects, optimistic futurism',
      'indiana jones': 'vintage adventure archaeology theme: aged maps and parchment, sepia tones, expedition typography, exotic locations, 1930s pulp adventure aesthetic',
      'pirates of the caribbean': 'swashbuckling pirate theme: weathered treasure maps, nautical elements, aged parchment, rope and anchor motifs, Caribbean sunset colours',
      'pirates': 'classic pirate adventure theme: treasure maps, skull motifs, weathered wood textures, nautical rope borders, ocean blues and sunset golds',
      'frozen': 'icy Nordic fairy-tale theme: crystalline ice patterns, cool blue and purple palette, snowflake motifs, elegant flowing typography, magical winter atmosphere',
      'disney': 'magical fairy-tale theme: enchanted castle silhouettes, sparkle effects, warm storybook colours, whimsical typography, happily-ever-after atmosphere',
      'pixar': 'vibrant animated adventure theme: bold cheerful colours, playful rounded typography, expressive character-driven layouts, heartwarming atmosphere',
      'minions': 'playful yellow cartoon theme: bright yellow and blue palette, banana motifs, silly rounded typography, fun chaotic energy',
      'transformers': 'mech-tech action theme: metallic surfaces, angular geometric shapes, industrial typography, chrome and steel, explosive energy effects',
      'fast and furious': 'street racing action theme: chrome and neon, speedometer elements, bold aggressive typography, urban nightscape, adrenaline energy',
      'mission impossible': 'high-tech espionage theme: sleek modern interfaces, timer countdown displays, bold urgent typography, international locations, suspenseful atmosphere',
      'john wick': 'neo-noir assassin theme: dark atmospheric lighting, gold accents on black, elegant typography, nightclub neon, sophisticated violence aesthetic',
      'hunger games': 'dystopian rebellion theme: mockingjay-inspired fire motifs, gold on dark backgrounds, propaganda poster aesthetic, revolutionary typography',
      'twilight': 'romantic gothic theme: misty forest atmospheres, cool blue-grey palette, elegant serif typography, subtle sparkle effects, moody atmosphere',
      'game of thrones': 'epic medieval fantasy theme: iron and stone textures, house sigil-inspired iconography, aged parchment, dark dramatic lighting, royal heraldry',
      'got': 'epic medieval fantasy theme: iron and stone textures, house sigil-inspired iconography, aged parchment, dark dramatic lighting, royal heraldry',
      'stranger things': 'retro 80s supernatural theme: neon red glow, flickering Christmas lights, VHS aesthetic, bold outlined typography, synth-wave colours',
      'ghostbusters': 'retro paranormal comedy theme: ecto-green glow, red prohibition-style iconography, 80s tech displays, bold fun typography',
      'top gun': 'military aviation theme: fighter jet silhouettes, sunset orange skies, aviator aesthetic, bold stencil typography, patriotic energy',
      'rocky': 'underdog boxing theme: gritty Philadelphia streets, Italian flag colours, bold champion typography, training montage energy',
      'godfather': 'classic mafia crime theme: sepia and shadow, elegant script typography, Italian-American iconography, rose motifs, solemn atmosphere',
      'scarface': 'Miami crime drama theme: art-deco influences, palm trees and neon, bold aggressive typography, 80s excess aesthetic',
      'pulp fiction': 'retro crime noir theme: bold pop-art colours, vintage movie poster layouts, pulp magazine aesthetic, eclectic typography',
      'kill bill': 'martial arts revenge theme: bold yellow and black, Japanese katana motifs, blood-red accents, anime-influenced graphics',
      'mad max': 'post-apocalyptic wasteland theme: rust and chrome, desert orange and black, industrial decay, aggressive tribal typography',
      'avatar': 'bioluminescent alien nature theme: glowing cyan and magenta, organic flowing shapes, alien flora patterns, ethereal atmosphere',
      'dune': 'epic desert sci-fi theme: golden sand tones, ornate Arabic-inspired patterns, ancient futurism, spice-orange accents, mystical typography',
      'interstellar': 'cosmic space exploration theme: vast starfields, wormhole visualisations, scientific diagrams, hopeful yet melancholic atmosphere',
      'gravity': 'realistic space thriller theme: Earth from orbit, stark white on black, minimal typography, isolation and vastness',
      'inception': 'mind-bending architectural theme: impossible geometry, folding cityscapes, layered dimensions, elegant modern typography',
      'shrek': 'fairy-tale parody theme: swamp greens, storybook illustrations, playful medieval fonts, irreverent humour, ogre-friendly colours',
      'finding nemo': 'underwater ocean adventure theme: tropical coral colours, bubble effects, friendly aquatic motifs, warm family atmosphere',
      'lion king': 'African savanna theme: sunset oranges and purples, tribal patterns, majestic wildlife silhouettes, circle of life motifs',
      'toy story': 'playful childrens toy theme: primary colours, toy-box aesthetics, friendly rounded typography, nostalgic childhood warmth',
      'cars': 'retro Americana racing theme: Route 66 aesthetics, chrome and fins, desert landscapes, neon motel signs, vintage car culture',
      'moana': 'Polynesian ocean adventure theme: tropical turquoise waters, traditional tapa patterns, volcanic islands, wayfinding stars',
      'coco': 'Mexican Dia de los Muertos theme: marigold orange, papel picado patterns, calavera motifs, vibrant celebration colours',
      'encanto': 'magical Colombian family theme: tropical flowers, vibrant Latin colours, magical golden glow, family home warmth',
      'doctor who': 'time-travelling British sci-fi theme: TARDIS blue, swirling vortex patterns, retrofuturistic controls, Gallifreyan circular writing',
      'breaking bad': 'desert crime drama theme: Albuquerque desert tones, periodic table elements, RV and laboratory motifs, meth-blue accents',
      'walking dead': 'zombie apocalypse survival theme: blood-red accents, distressed textures, abandoned infrastructure, survival gear motifs',
      'squid game': 'Korean survival game theme: pink guards and teal tracksuits, geometric shapes (circle, triangle, square), childhood game motifs, stark contrasts',
      'wednesday': 'gothic academia theme: black and purple, gothic architecture, ornate Victorian patterns, macabre elegance',
      'bridgerton': 'Regency romance theme: soft pastels, ornate floral patterns, elegant script typography, romantic ballroom aesthetics',
      'peaky blinders': 'gritty 1920s Birmingham theme: industrial smoke and shadows, flat cap silhouettes, vintage typography, gang aesthetic',
      'the office': 'mundane corporate comedy theme: beige office supplies, fluorescent lighting, deadpan typography, cubicle life',
      'friends': 'cosy 90s sitcom theme: Central Perk coffee colours, friendly handwritten fonts, New York apartment warmth, nostalgic comfort',
      'office space': 'corporate satire theme: grey cubicle aesthetic, red stapler accents, mundane office supplies, TPS report formatting',
    };

    // Check for franchise matches
    for (const [franchise, vibe] of Object.entries(franchiseMappings)) {
      if (lower.includes(franchise)) {
        return `${vibe} (no characters, logos, or franchise names).`;
      }
    }

    return trimmed;
  };

  const formatMeetingForInfographic = (data: MeetingInfographicData): string => {
    const sections: string[] = [];

    // NEW: "What You Missed" header
    sections.push(`WHAT YOU MISSED`);
    sections.push(`─────────────────────────────────`);
    
    // PROMINENT DATE (hero element)
    if (data.meetingDate) {
      sections.push(`\n📅 ${data.meetingDate}`);
    }
    if (data.meetingTime) {
      sections.push(`⏰ ${data.meetingTime}`);
    }
    
    // Meeting Title
    sections.push(`\nMEETING: "${data.meetingTitle}"`);
    
    if (data.location) {
      sections.push(`📍 ${data.location}`);
    }

    // Executive summary as "THE MEETING IN BRIEF"
    const execMatch = data.notesContent.match(/(?:#|##)\s*EXECUTIVE SUMMARY[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (execMatch) {
      sections.push('\n📝 THE MEETING IN BRIEF:');
      const summary = execMatch[1].trim();
      sections.push(summary.length > 400 ? summary.substring(0, 400) + '...' : summary);
    }

    // Extract Key Points from Discussion Summary
    const keyPointsMatch = data.notesContent.match(/(?:#|##)\s*(?:Key Points|KEY POINTS|DISCUSSION SUMMARY)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (keyPointsMatch) {
      sections.push('\n💡 KEY DISCUSSION POINTS:');
      const keyPoints = keyPointsMatch[1].trim()
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 5);
      sections.push(keyPoints.join('\n'));
    }

    // Key decisions
    const decisionsMatch = data.notesContent.match(/(?:#|##)\s*(?:KEY DECISIONS|DECISIONS)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (decisionsMatch) {
      sections.push('\n✅ DECISIONS MADE:');
      const decisions = decisionsMatch[1].trim()
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 4);
      sections.push(decisions.join('\n'));
    }

    // Action items - now SECONDARY (just a count)
    if (data.actionItems.length > 0) {
      sections.push(`\n📋 ${data.actionItems.length} action item${data.actionItems.length > 1 ? 's' : ''} assigned`);
    }

    return sections.join('\n');
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
      const documentContent = formatMeetingForInfographic(data);
      
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
        const styleData = INFOGRAPHIC_STYLES[options?.style || 'clean-professional'];
        styleInstruction = styleData?.prompt || INFOGRAPHIC_STYLES['clean-professional'].prompt;
        console.log('[useMeetingInfographic] Using preset style:', options?.style || 'clean-professional');
      }
      
      setCurrentPhase('generating');

      // Call the AI image generation edge function with Gemini Pro 3
      // Use Promise.race for timeout since Supabase client doesn't support AbortController
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      // Build design requirements - conditionally include NHS styling only for preset styles
      const designRequirements = isCustomStyle 
        ? `- "WHAT YOU MISSED" banner/badge styling at the top
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Apply the custom style throughout ALL visual elements
- British English spelling throughout
- A4 portrait format, suitable for printing or sharing digitally
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make the custom style the dominant visual theme`
        : `- "WHAT YOU MISSED" banner/badge styling at the top
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Professional GP practice/NHS styling
- British English spelling throughout
- A4 portrait format, suitable for printing or sharing digitally
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make it feel like catching up with a colleague, not a task list`;

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
7. ACTION ITEMS - Small/optional section with just a count or brief mention

DESIGN REQUIREMENTS:
${designRequirements}`;

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
      const safeTitle = data.meetingTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      link.download = `${safeTitle}_Summary_Infographic.png`;
      
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
