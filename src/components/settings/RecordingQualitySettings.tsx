/**
 * RecordingQualitySettings
 * 
 * Add this into the existing settings cog/modal.
 * Reads/writes audio bitrate preference to localStorage.
 */

import { BITRATE_OPTIONS, AudioBitrate } from '@/lib/audio/ChunkedRecorder';

const STORAGE_KEY = 'notewell_audio_bitrate';

/** Read saved bitrate from localStorage, default 32kbps */
export function getSavedBitrate(): AudioBitrate {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed === 64000 || parsed === 32000 || parsed === 24000) return parsed;
    }
  } catch {}
  return 32000;
}

/** Save bitrate preference */
export function saveBitrate(bitrate: AudioBitrate): void {
  try { localStorage.setItem(STORAGE_KEY, String(bitrate)); } catch {}
}

interface RecordingQualitySettingsProps {
  value: AudioBitrate;
  onChange: (bitrate: AudioBitrate) => void;
}

export function RecordingQualitySettings({ value, onChange }: RecordingQualitySettingsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-foreground">Recording quality</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Lower quality uses less storage and syncs faster. Higher quality improves transcription accuracy in noisy environments.
        </p>
      </div>
      <div className="space-y-2">
        {BITRATE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              value === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            }`}
          >
            <input
              type="radio"
              name="audio-bitrate"
              value={option.value}
              checked={value === option.value}
              onChange={() => { saveBitrate(option.value); onChange(option.value); }}
              className="mt-0.5 accent-primary"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                {option.value === 32000 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                3hr meeting ≈ {Math.round((option.value / 8) * 180 * 60 / (1024 * 1024))} MB
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
