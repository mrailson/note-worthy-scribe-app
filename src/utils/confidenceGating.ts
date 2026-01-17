// Utility functions for confidence-based transcript gating

export interface TranscriberThresholds {
  whisper: number;
  deepgram: number;
}

export interface MeetingSettingsWithThresholds {
  transcriberService: "whisper" | "deepgram";
  transcriberThresholds: TranscriberThresholds;
}

export type TranscriptQualityStatus = 'reliable' | 'degraded' | 'unreliable';

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
 * Hard gate at 30% confidence to prevent hallucinations
 */
export function withDefaultThresholds(settings: any): MeetingSettingsWithThresholds {
  return {
    transcriberService: settings?.transcriberService || "whisper",
    transcriberThresholds: {
      whisper: settings?.transcriberThresholds?.whisper ?? 0.30,
      deepgram: settings?.transcriberThresholds?.deepgram ?? 0.30,
    },
  };
}

/**
 * Get transcript quality status based on average confidence
 * Used to display warnings to users when transcript quality is poor
 */
export function getTranscriptQualityStatus(avgConfidence: number): TranscriptQualityStatus {
  if (avgConfidence >= 0.60) {
    return 'reliable';
  } else if (avgConfidence >= 0.30) {
    return 'degraded';
  } else {
    return 'unreliable';
  }
}

/**
 * Get human-readable quality description
 */
export function getQualityDescription(status: TranscriptQualityStatus): string {
  switch (status) {
    case 'reliable':
      return 'Transcript quality is good';
    case 'degraded':
      return 'Transcript quality is reduced - some content may be inaccurate';
    case 'unreliable':
      return 'Transcript quality is poor - audio may not be suitable for transcription';
  }
}