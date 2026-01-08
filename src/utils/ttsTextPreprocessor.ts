/**
 * Preprocesses text for TTS to ensure natural voice output.
 * Cleans up speech recognition artefacts that cause choppy delivery.
 */

// Common filler words to remove
const FILLER_PATTERNS = /\b(um|uh|er|erm|ah|like,?\s|you know,?\s|i mean,?\s|so,?\s(?=\w))\b/gi;

// Multiple spaces/punctuation
const MULTIPLE_SPACES = /\s{2,}/g;
const MULTIPLE_PERIODS = /\.{2,}/g;
const TRAILING_COMMA = /,\s*$/;

export function preprocessTextForTTS(text: string): string {
  if (!text?.trim()) return '';

  let processed = text.trim();

  // Remove filler words
  processed = processed.replace(FILLER_PATTERNS, '');

  // Fix multiple periods (hesitation) to single comma for natural pause
  processed = processed.replace(MULTIPLE_PERIODS, ',');

  // Clean up multiple spaces
  processed = processed.replace(MULTIPLE_SPACES, ' ');

  // Remove trailing comma before final punctuation
  processed = processed.replace(TRAILING_COMMA, '');

  // Ensure sentence ends with proper punctuation for natural cadence
  processed = processed.trim();
  if (processed && !/[.!?]$/.test(processed)) {
    processed += '.';
  }

  // Capitalise first letter
  if (processed.length > 0) {
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
  }

  return processed.trim();
}
