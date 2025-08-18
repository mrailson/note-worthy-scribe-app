# Chromium Microphone Pipeline

## Overview

This document describes the new Chromium-optimized microphone recording pipeline for improved Chrome/Edge recording quality and stability on desktop devices.

## Feature Flag

The pipeline is controlled by the `VITE_USE_CHROMIUM_MIC_PIPELINE` environment variable:

```bash
# Enable Chromium pipeline (test users only)
VITE_USE_CHROMIUM_MIC_PIPELINE=true

# Disable (default behavior)
VITE_USE_CHROMIUM_MIC_PIPELINE=false
```

**Default: `false`** - This ensures backwards compatibility.

## Routing Logic

### Device Detection
```typescript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Edg/.test(navigator.userAgent);
const isChromium = /Chrome|Edg/.test(navigator.userAgent);

const useChromiumMicPipeline =
  isChromium && 
  !isMobile && 
  process.env.VITE_USE_CHROMIUM_MIC_PIPELINE === 'true';
```

### Transcriber Selection
- **iOS Safari** → `iPhoneWhisperTranscriber` (unchanged)
- **Desktop Safari** → `DesktopWhisperTranscriber` (unchanged)
- **Android** → `DesktopWhisperTranscriber` (unchanged)
- **Desktop Chrome/Edge with flag=false** → `DesktopWhisperTranscriber` (unchanged)
- **Desktop Chrome/Edge with flag=true** → `ChromiumMicTranscriber` (new)

## Chromium Pipeline Features

### Optimized Audio Constraints
```typescript
{
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100
  }
}
```

### MIME Type Selection
Prioritizes Chromium-optimized formats:
1. `audio/webm;codecs=opus` (preferred)
2. `audio/webm`
3. `audio/mp4` (fallback)

### Small, Reliable Chunks
- **Chunk size**: 1 second (1000ms)
- **Queue limit**: 10 chunks maximum
- **Upload concurrency**: 1 (prevents backpressure)

### Graceful Degradation
- Drops oldest chunks if queue is full
- 5-second upload timeout per chunk
- Auto-restart with 1-minute cooldown
- Maximum 3 retry attempts

## Telemetry Events

All events are prefixed with `chromium_mic.` to avoid confusion with Teams recording:

- `chromium_mic.start` - Recording started
- `chromium_mic.chunk_ok` - Chunk uploaded successfully
- `chromium_mic.chunk_drop` - Chunk dropped due to queue full
- `chromium_mic.upload_err` - Upload failed
- `chromium_mic.stop` - Recording stopped

### Log Export
```typescript
// Export recent logs for support
const logs = ChromiumMicTranscriber.exportLogs();

// Clear logs
ChromiumMicTranscriber.clearLogs();
```

## Teams Recording Compatibility

**IMPORTANT**: This pipeline does **NOT** affect Teams meeting recording.

- Teams/system audio capture continues to use the existing `UnifiedAudioCapture` pipeline
- Tab capture and screen sharing audio remain unchanged
- Only microphone-only recording on desktop Chromium is affected when the flag is enabled

## Supported MIME Types

### Chrome
- ✅ `audio/webm;codecs=opus` (optimal)
- ✅ `audio/webm`
- ✅ `audio/mp4`

### Edge
- ✅ `audio/webm;codecs=opus` (optimal)
- ✅ `audio/webm`
- ✅ `audio/mp4`

## Known Limitations

1. **Desktop only** - Mobile Chrome/Edge still use existing pipeline
2. **Microphone only** - Does not handle system/tab audio
3. **Feature flagged** - Must be explicitly enabled
4. **Chromium specific** - Optimizations may not apply to other browsers

## QA Checklist

### Baseline Tests (flag=false)
- [ ] iPhone Safari: Recording works identically to before
- [ ] Desktop Teams recording: System audio capture unchanged
- [ ] Android Chrome: No behavior changes

### Chromium Pipeline Tests (flag=true)
- [ ] Chrome latest on Windows 10/11: Clear audio, continuous transcription
- [ ] Edge latest on Windows 10/11: Clear audio, continuous transcription
- [ ] macOS Chrome: Proper microphone handling
- [ ] Background noise handling: No AGC pumping
- [ ] Network throttling: Graceful queue drops, no UI freeze
- [ ] webrtc-internals: Continuous audio levels

### Toggle Tests
- [ ] Flag OFF → ON: New pipeline activates
- [ ] Flag ON → OFF: Reverts to original behavior
- [ ] No restart required for flag changes

## Troubleshooting

### Common Issues

1. **No audio captured**
   - Check microphone permissions
   - Verify HTTPS connection
   - Check webrtc-internals for audio levels

2. **Choppy transcription**
   - Monitor network in DevTools
   - Check for console errors with `chromium_mic.` prefix
   - Export logs for analysis

3. **Frequent restarts**
   - Check microphone hardware
   - Look for `chromium_mic.error_handled` events
   - Verify stable network connection

### Debug Commands
```javascript
// In browser console

// Check current device detection
console.log(window.location.search.includes('debug') ? 
  'Debug mode active' : 'Add ?debug to URL for verbose logging');

// Export logs
console.log(JSON.parse(ChromiumMicTranscriber.exportLogs()));

// Check feature flag
console.log('Feature flag:', import.meta.env.VITE_USE_CHROMIUM_MIC_PIPELINE);
```

## Performance Metrics

### Target Metrics
- **Chunk upload frequency**: ~1 per second
- **Queue drops**: <5% under normal conditions
- **Upload latency**: <2 seconds average
- **Error rate**: <1% of chunks
- **Auto-restart rate**: <1 per 10-minute session

### Monitoring
Logs are stored in `sessionStorage` as `chromium_mic_logs` for debugging and can be exported for support analysis.