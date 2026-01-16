/**
 * Centralised Whisper hallucination detection patterns
 * Used by both Desktop and iPhone transcribers for consistent filtering
 */

// Common Whisper hallucination phrases - these appear when Whisper "invents" content
export const HALLUCINATION_PHRASES = [
  // "Thank you" variations (most common hallucination)
  'thank you for watching',
  'thanks for watching',
  'thank you for listening',
  'thanks for listening',
  'thank you for your time',
  'thank you for joining',
  'thank you for your attention',
  'thank you very much for watching',
  'thank you very much for listening',
  'thank you so much for watching',
  'i hope you enjoyed this video',
  'i hope you enjoyed this',
  
  // Presentation/video endings
  'this is the end of the presentation',
  'end of presentation',
  'this concludes the presentation',
  'that concludes the presentation',
  'this concludes our',
  'that concludes our',
  'this has been',
  'that was',
  
  // Call to action hallucinations
  'please subscribe',
  'like and subscribe',
  'please like and subscribe',
  'don\'t forget to subscribe',
  'hit the subscribe button',
  'hit the like button',
  'smash the like button',
  'leave a comment',
  'please leave a comment',
  'leave your comments below',
  'comment below',
  'let me know in the comments',
  
  // "See you" variations
  'see you in the next video',
  'see you in the next one',
  'see you next time',
  'i\'ll see you next time',
  'catch you in the next one',
  'until next time',
  'take care',
  'have a great day',
  'have a nice day',
  
  // Generic closings
  'bye', 'bye-bye', 'bye bye', 'goodbye', 'good bye',
  'good night', 'good morning', 'good afternoon',
  
  // Music/sound descriptions (shouldn't appear in speech transcription)
  '[music]', '[applause]', '[laughter]', '[silence]',
  'music playing', 'background music', 'upbeat music',
  'gentle music', 'soft music',
  
  // Fabricated attributions
  'my name is david',
  'my name is john',
  'my name is michael',
  'my name is jonathan',
  'my name is sarah',
  'my name is jane',
  'this is david',
  'this is john',
  
  // Subtitle/transcript meta
  'subtitles by',
  'translated by',
  'transcribed by',
  'captions by',
  
  // Podcast/channel references
  'welcome to my channel',
  'welcome back to my channel',
  'welcome to the podcast',
  'welcome back to the show',
  'on today\'s episode',
  'in today\'s video',
  'in this video',
  
  // Patreon/sponsor hallucinations
  'this video is sponsored',
  'thank you to our sponsors',
  'brought to you by',
  'check out the link',
  'link in the description',
  
  // Foreign language artifacts (Whisper sometimes inserts these)
  '你好', '谢谢', 'ありがとう', 'こんにちは', '감사합니다',
];

// Patterns for detecting fabricated URLs (not related to NHS/medical context)
const LEGITIMATE_URL_PATTERNS = [
  /nhs\.uk/i,
  /nice\.org\.uk/i,
  /gov\.uk/i,
  /bnf\.org/i,
  /rcgp\.org/i,
  /gmc-uk\.org/i,
  /cqc\.org\.uk/i,
  /rcn\.org\.uk/i,
  /mhra\.gov\.uk/i,
  /medicines\.org\.uk/i,
  /patient\.info/i,
  /emis/i,
  /systmone/i,
  /accurx/i,
];

export interface HallucinationCheckResult {
  isHallucination: boolean;
  reason?: string;
  confidence?: number;
}

/**
 * Check if text contains known hallucination phrases
 */
export function containsHallucinationPhrase(text: string): HallucinationCheckResult {
  const normalised = text.toLowerCase().trim();
  
  for (const phrase of HALLUCINATION_PHRASES) {
    if (normalised.includes(phrase.toLowerCase())) {
      return {
        isHallucination: true,
        reason: `Contains hallucination phrase: "${phrase}"`,
        confidence: 0.9
      };
    }
  }
  
  return { isHallucination: false };
}

/**
 * Check if text is repetitive (low unique word ratio)
 */
export function isRepetitiveContent(text: string, minWords = 8, maxUniqueRatio = 0.30): HallucinationCheckResult {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  
  if (words.length < minWords) {
    return { isHallucination: false };
  }
  
  const uniqueWords = new Set(words).size;
  const uniqueRatio = uniqueWords / words.length;
  
  if (uniqueRatio < maxUniqueRatio) {
    return {
      isHallucination: true,
      reason: `Repetitive content: only ${(uniqueRatio * 100).toFixed(1)}% unique words`,
      confidence: 1 - uniqueRatio // Lower unique ratio = higher confidence of hallucination
    };
  }
  
  return { isHallucination: false };
}

/**
 * Check for fabricated URLs that aren't legitimate medical/NHS sites
 */
export function hasFabricatedUrls(text: string): HallucinationCheckResult {
  // Check if text contains URL-like patterns
  const urlPatterns = [
    /www\.\S+/gi,
    /https?:\/\/\S+/gi,
    /\S+\.com\b/gi,
    /\S+\.org\b/gi,
    /\S+\.net\b/gi,
    /\S+\.io\b/gi,
  ];
  
  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Check if it's a legitimate medical URL
        const isLegitimate = LEGITIMATE_URL_PATTERNS.some(legit => legit.test(match));
        if (!isLegitimate) {
          return {
            isHallucination: true,
            reason: `Fabricated URL detected: "${match}"`,
            confidence: 0.85
          };
        }
      }
    }
  }
  
  return { isHallucination: false };
}

/**
 * Check for "laughter" patterns (ha ha ha, hehe, etc.)
 */
export function isLaughterNoise(text: string): HallucinationCheckResult {
  const normalised = text.toLowerCase().trim();
  
  // Pattern for repetitive laughter sounds
  const laughterPattern = /(?:\b(?:ha|haha|ha-ha|hee|hehe|ho|hoho|lol|heh|woo|beep|hmm|uh|um)[\s,!.?-]*){5,}/i;
  
  if (laughterPattern.test(normalised)) {
    return {
      isHallucination: true,
      reason: 'Repetitive laughter/noise pattern detected',
      confidence: 0.95
    };
  }
  
  return { isHallucination: false };
}

/**
 * Combined hallucination check with confidence scoring
 */
export function isLikelyHallucination(
  text: string, 
  confidence?: number,
  options: {
    checkPhrases?: boolean;
    checkRepetition?: boolean;
    checkUrls?: boolean;
    checkLaughter?: boolean;
    confidenceThreshold?: number;
  } = {}
): HallucinationCheckResult {
  const {
    checkPhrases = true,
    checkRepetition = true,
    checkUrls = true,
    checkLaughter = true,
    confidenceThreshold = 0.15
  } = options;
  
  // Very short text is less likely to be a hallucination (unless it's a known phrase)
  const trimmedText = text.trim();
  if (trimmedText.length < 10) {
    // Still check for exact phrase matches even in short text
    if (checkPhrases) {
      const phraseCheck = containsHallucinationPhrase(trimmedText);
      if (phraseCheck.isHallucination) return phraseCheck;
    }
    return { isHallucination: false };
  }
  
  // If confidence is very low, be more suspicious
  const isLowConfidence = typeof confidence === 'number' && confidence < confidenceThreshold;
  
  // Check for laughter patterns first (most obvious)
  if (checkLaughter) {
    const laughterCheck = isLaughterNoise(trimmedText);
    if (laughterCheck.isHallucination) return laughterCheck;
  }
  
  // Check for known hallucination phrases
  if (checkPhrases) {
    const phraseCheck = containsHallucinationPhrase(trimmedText);
    if (phraseCheck.isHallucination) {
      // If it's a known phrase AND low confidence, definitely a hallucination
      if (isLowConfidence) {
        return {
          ...phraseCheck,
          reason: `${phraseCheck.reason} (with low confidence: ${(confidence! * 100).toFixed(1)}%)`,
          confidence: 0.98
        };
      }
      // Even with high confidence, some phrases are dead giveaways
      const deadGiveaways = ['thank you for watching', 'please subscribe', 'like and subscribe'];
      if (deadGiveaways.some(dg => trimmedText.toLowerCase().includes(dg))) {
        return phraseCheck;
      }
      // For other phrases, only flag if combined with low confidence
      if (isLowConfidence) {
        return phraseCheck;
      }
    }
  }
  
  // Check for repetitive content
  if (checkRepetition) {
    const repetitionCheck = isRepetitiveContent(trimmedText);
    if (repetitionCheck.isHallucination) return repetitionCheck;
  }
  
  // Check for fabricated URLs
  if (checkUrls) {
    const urlCheck = hasFabricatedUrls(trimmedText);
    if (urlCheck.isHallucination) return urlCheck;
  }
  
  // Final check: very low confidence with no other issues
  if (isLowConfidence && confidence! < 0.10) {
    return {
      isHallucination: true,
      reason: `Extremely low confidence: ${(confidence! * 100).toFixed(1)}%`,
      confidence: 0.7
    };
  }
  
  return { isHallucination: false };
}

/**
 * Wrapper for simple boolean check (backwards compatible)
 */
export function isHallucinationText(text: string, confidence?: number): boolean {
  return isLikelyHallucination(text, confidence).isHallucination;
}
