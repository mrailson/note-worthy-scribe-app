// Utility functions for confidence-based transcript gating

export interface TranscriberThresholds {
  whisper: number;
  deepgram: number;
}

export interface MeetingSettingsWithThresholds {
  transcriberService: "whisper" | "deepgram";
  transcriberThresholds: TranscriberThresholds;
}

/**
 * Get the active minimum confidence threshold based on the selected transcriber service
 */
export function getActiveMinConfidence(settings: MeetingSettingsWithThresholds): number {
  return settings.transcriberService === "deepgram"
    ? settings.transcriberThresholds.deepgram
    : settings.transcriberThresholds.whisper;
}

/**
 * Check if a transcript chunk meets the confidence threshold for the active service
 */
export function meetsConfidenceThreshold(
  confidence: number | undefined, 
  settings: MeetingSettingsWithThresholds
): boolean {
  if (typeof confidence !== "number") {
    // If no confidence provided, allow through (backward compatibility)
    return true;
  }
  
  const minConfidence = getActiveMinConfidence(settings);
  return confidence >= minConfidence;
}

/**
 * Merge default thresholds with provided settings to ensure all required fields exist
 */
export function withDefaultThresholds(settings: any): MeetingSettingsWithThresholds {
  return {
    transcriberService: settings?.transcriberService || "whisper",
    transcriberThresholds: {
      whisper: settings?.transcriberThresholds?.whisper ?? 0.35,
      deepgram: settings?.transcriberThresholds?.deepgram ?? 0.35,
    },
  };
}