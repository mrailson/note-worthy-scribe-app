import type { ImageStudioSettings } from '@/types/imageStudio';

export const IMAGE_STUDIO_V2_ROUTING = import.meta.env.VITE_IMAGE_STUDIO_V2_ROUTING !== 'false';

export const IDEOGRAM_V3_MODEL = 'ideogram/v3' as const;
export const RECRAFT_V4_SVG_MODEL = 'recraft/v4-svg' as const;

export const PATIENT_AREA_POSTER_PREFIX =
  'Flat graphic design poster artwork, NHS-appropriate clean style, clear bold typography, accessible high colour contrast, vector illustration, no perspective, no mockup, no photograph, full bleed composition. Subject:';

export const PATIENT_AREA_POSTER_NEGATIVE_PROMPT =
  'photograph of poster, mockup, wall, room interior, perspective view, 3D, frame, hands holding poster, blurry text, gibberish text, lorem ipsum';

const TEXT_HEAVY_WORDS = ['poster', 'sign', 'banner', 'leaflet', 'flyer', 'label', 'infographic', 'certificate'];

export function hasLongQuotedText(prompt: string) {
  return /"([^"]+)"/.test(prompt) && prompt.match(/"([^"]+)"/g)?.some(match => match.replace(/"/g, '').trim().split(/\s+/).length > 6);
}

export function getImageStudioRouting(settings: ImageStudioSettings) {
  if (!IMAGE_STUDIO_V2_ROUTING || settings.isModelManuallyOverridden) return null;

  const prompt = settings.description.toLowerCase();
  const hasQuotedText = /"[^"]+"/.test(settings.description);
  const matchedWords = TEXT_HEAVY_WORDS.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(prompt));

  if (!hasQuotedText && matchedWords.length === 0) return null;

  const shouldUseSvg = matchedWords.includes('poster') || matchedWords.includes('sign');
  return {
    model: shouldUseSvg ? RECRAFT_V4_SVG_MODEL : IDEOGRAM_V3_MODEL,
    label: shouldUseSvg ? 'Recraft v4 SVG' : 'Ideogram v3',
    reason: hasQuotedText ? 'quoted text' : matchedWords.join(', '),
  };
}