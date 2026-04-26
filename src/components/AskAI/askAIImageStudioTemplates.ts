export const ASK_AI_IMAGE_STUDIO_ENABLED =
  import.meta.env.VITE_ASK_AI_IMAGE_STUDIO === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_ASK_AI_IMAGE_STUDIO !== 'false');

export const ASK_AI_IMAGE_STUDIO_NEGATIVE_POSTER =
  'photograph of poster, mockup, wall, room, hands holding, perspective, blurry text, gibberish text, lorem ipsum, watermark';

export type AskAIImageStudioModel =
  | 'recraft/v4-svg'
  | 'recraft/v4'
  | 'ideogram/v3'
  | 'google/imagen-4-pro'
  | 'google/imagen-4-ultra';

export type AskAIImageStudioAspect = '3:4' | '1:1' | '16:9';

export interface AskAIImageStudioTemplateVariable {
  key: string;
  label: string;
  placeholder: string;
}

export interface AskAIImageStudioTemplate {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  variables: AskAIImageStudioTemplateVariable[];
  model: AskAIImageStudioModel;
  aspectRatio: AskAIImageStudioAspect;
  prefix: string;
  suffix: string;
  negativePrompt: string;
}

export const ASK_AI_IMAGE_STUDIO_TEMPLATES: AskAIImageStudioTemplate[] = [
  {
    id: 'patient-information-poster',
    title: 'Patient Information Poster',
    description: 'A4-style patient poster with clear typography and NHS-appropriate visuals.',
    thumbnail: '/image-studio-thumbs/patient-information-poster.svg',
    variables: [
      { key: 'TOPIC', label: 'Topic', placeholder: 'e.g. Handwashing reminder' },
      { key: 'KEY_MESSAGE', label: 'Key message', placeholder: 'e.g. Clean hands protect everyone' },
      { key: 'AUDIENCE', label: 'Audience', placeholder: 'e.g. Patients in the waiting room' },
    ],
    model: 'recraft/v4-svg',
    aspectRatio: '3:4',
    prefix: 'Flat graphic design poster artwork for an NHS GP practice.',
    suffix: 'Clean modern NHS-appropriate style, bold legible typography, accessible high colour contrast, simple flat iconography, vector illustration, no perspective, no mockup, full bleed, A4 portrait.',
    negativePrompt: ASK_AI_IMAGE_STUDIO_NEGATIVE_POSTER,
  },
  {
    id: 'health-campaign-poster',
    title: 'Health Campaign Poster',
    description: 'Campaign poster with exact headline, details and call to action.',
    thumbnail: '/image-studio-thumbs/health-campaign-poster.svg',
    variables: [
      { key: 'CAMPAIGN_NAME', label: 'Campaign name', placeholder: 'e.g. Flu Vaccination Clinic' },
      { key: 'DATE_OR_DETAILS', label: 'Date or details', placeholder: 'e.g. Saturday 12 October, 09:00–13:00' },
      { key: 'CALL_TO_ACTION', label: 'Call to action', placeholder: 'e.g. Book with reception today' },
    ],
    model: 'ideogram/v3',
    aspectRatio: '3:4',
    prefix: 'Modern NHS health campaign poster.',
    suffix: 'Friendly, inclusive, professional. NHS blue and white palette with one accent colour, simple flat illustration, high contrast accessible typography, no perspective, no mockup, full bleed.',
    negativePrompt: ASK_AI_IMAGE_STUDIO_NEGATIVE_POSTER,
  },
  {
    id: 'internal-staff-notice',
    title: 'Internal Staff Notice',
    description: 'Simple staff notice for internal updates and reminders.',
    thumbnail: '/image-studio-thumbs/internal-staff-notice.svg',
    variables: [
      { key: 'NOTICE_HEADLINE', label: 'Notice headline', placeholder: 'e.g. Team Briefing Today' },
      { key: 'DETAIL', label: 'Detail', placeholder: 'e.g. Meeting room 2 at 12:30' },
    ],
    model: 'ideogram/v3',
    aspectRatio: '3:4',
    prefix: 'Simple internal staff notice.',
    suffix: 'Minimal flat design, plain background, single accent colour, professional, no decoration, no perspective, full bleed.',
    negativePrompt: ASK_AI_IMAGE_STUDIO_NEGATIVE_POSTER,
  },
  {
    id: 'social-media-post',
    title: 'Social Media Post',
    description: 'Square post for practice updates and patient-facing messages.',
    thumbnail: '/image-studio-thumbs/social-media-post.svg',
    variables: [
      { key: 'MESSAGE', label: 'Message', placeholder: 'e.g. We are closed on Bank Holiday Monday' },
      { key: 'VISUAL_STYLE', label: 'Visual style', placeholder: 'e.g. Friendly and calm with simple icons' },
    ],
    model: 'recraft/v4',
    aspectRatio: '1:1',
    prefix: 'Square social media graphic for an NHS GP practice.',
    suffix: 'Modern, friendly, on-brand for NHS primary care, bold legible typography, balanced composition, accessible colour contrast, flat design, no perspective.',
    negativePrompt: ASK_AI_IMAGE_STUDIO_NEGATIVE_POSTER,
  },
  {
    id: 'newsletter-hero-image',
    title: 'Newsletter Hero Image',
    description: 'Editorial photo-style header for newsletters without on-image text.',
    thumbnail: '/image-studio-thumbs/newsletter-hero-image.svg',
    variables: [
      { key: 'SCENE_DESCRIPTION', label: 'Scene description', placeholder: 'e.g. Reception team welcoming patients on a bright morning' },
    ],
    model: 'google/imagen-4-pro',
    aspectRatio: '16:9',
    prefix: 'Editorial photograph for an NHS GP practice newsletter.',
    suffix: 'Warm natural lighting, candid, diverse and inclusive, modern UK primary care setting, soft depth of field, professional editorial photography. No text on image.',
    negativePrompt: 'text, watermark, logo, distorted faces, deformed hands, extra fingers, low quality, cartoon, illustration',
  },
  {
    id: 'educational-diagram-infographic',
    title: 'Educational Diagram / Infographic',
    description: 'Vector infographic for patient education or clinical explanation.',
    thumbnail: '/image-studio-thumbs/educational-diagram-infographic.svg',
    variables: [
      { key: 'SUBJECT', label: 'Subject', placeholder: 'e.g. How to use an inhaler' },
      { key: 'KEY_POINTS', label: 'Key points', placeholder: 'e.g. Shake, breathe out, press, inhale, hold breath' },
    ],
    model: 'recraft/v4-svg',
    aspectRatio: '3:4',
    prefix: 'Clean medical infographic explaining',
    suffix: 'Flat vector illustration with labelled sections, clear concise typography, NHS-appropriate clinical accuracy, accessible colour contrast, simple iconography, white background, no perspective, no photograph.',
    negativePrompt: 'photograph, photoreal, perspective, 3D render, gibberish text, anatomical inaccuracy',
  },
  {
    id: 'practice-team-illustration',
    title: 'Practice Team Illustration',
    description: 'Friendly flat illustration of a UK GP practice team.',
    thumbnail: '/image-studio-thumbs/practice-team-illustration.svg',
    variables: [
      { key: 'SCENE', label: 'Scene', placeholder: 'e.g. Multidisciplinary team gathered around a care plan' },
    ],
    model: 'recraft/v4',
    aspectRatio: '16:9',
    prefix: 'Friendly modern flat vector illustration of a UK GP practice team.',
    suffix: 'Diverse, inclusive, warm, approachable, NHS-appropriate, clean line work, soft modern palette. No text on image.',
    negativePrompt: 'photograph, photoreal, text, watermark, distorted features, extra limbs',
  },
  {
    id: 'waiting-room-website-hero',
    title: 'Waiting Room / Website Hero',
    description: 'Warm photo-style hero image for screens or the practice website.',
    thumbnail: '/image-studio-thumbs/waiting-room-website-hero.svg',
    variables: [
      { key: 'SCENE_OR_MOOD', label: 'Scene or mood', placeholder: 'e.g. Calm waiting room with inclusive patients and staff' },
    ],
    model: 'google/imagen-4-ultra',
    aspectRatio: '16:9',
    prefix: 'Welcoming photograph for an NHS GP practice.',
    suffix: 'Warm, calm, professional, modern UK primary care environment, diverse inclusive patients and staff, natural lighting, candid, soft depth of field, editorial photography. No on-image text.',
    negativePrompt: 'text, watermark, logo, distorted faces, deformed hands, extra fingers, low quality, cartoon, illustration',
  },
];

export function assembleAskAIImageStudioPrompt(template: AskAIImageStudioTemplate, values: Record<string, string>, additionalRequirements: string) {
  const variableText = template.variables.map(variable => `${variable.label}: ${values[variable.key] || ''}.`).join(' ');
  return `${template.prefix} ${variableText} ${template.suffix}${additionalRequirements.trim() ? ` Additional requirements: ${additionalRequirements.trim()}` : ''}`.replace(/\s+/g, ' ').trim();
}
