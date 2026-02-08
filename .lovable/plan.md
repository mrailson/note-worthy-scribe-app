

# Fix: iPhone Recording Cutting Out After ~3 Minutes

## Root Cause

The `SimpleIOSTranscriber` creates a `MediaStream` via `getUserMedia` at startup and reuses it for the entire session. On iOS Safari, the underlying audio track can silently terminate (due to screen auto-lock, background suspension, or iOS audio session policies) without raising an error. When this happens:

1. The stream object reference remains valid, passing the `if (!this.stream)` checks
2. But the audio track's `readyState` has changed from `live` to `ended`
3. New `MediaRecorder` instances created during rotation capture empty or minimal data
4. The recording effectively dies without the user or system being aware

Evidence from the most recent iPhone recording:
- Chunk 1: 2MB (healthy 90s segment)
- Chunk 2: 345KB (degraded -- track likely dead)
- Chunk 3: 101KB (recording dying, stopped 28s later)

## Changes

### 1. Add Track Health Monitoring to SimpleIOSTranscriber (`src/utils/SimpleIOSTranscriber.ts`)

**a) Listen for `track.onended` events** after acquiring the microphone stream in `start()`:
- Attach an `ended` event listener to each audio track
- When fired, log the event and attempt automatic stream recovery

**b) Add a `recoverStream()` method** that:
- Calls `getUserMedia` again to get a fresh microphone stream
- Replaces the dead stream reference
- Restarts the MediaRecorder with the new stream
- Logs the recovery attempt for debugging

**c) Add track readyState validation** in `createAndStartRecorder()`:
- Before creating a new `MediaRecorder`, check that `this.stream.getAudioTracks()[0]?.readyState === 'live'`
- If the track is not live, trigger `recoverStream()` instead of blindly creating a new recorder

### 2. Add iOS Audio Keepalive (`src/utils/SimpleIOSTranscriber.ts`)

Add a silent audio keepalive mechanism to prevent iOS from killing the audio session:
- Create an `AudioContext` with a silent oscillator (gain = 0)
- Start it when recording begins, stop it when recording ends
- This keeps the iOS audio session active even when the page is partially backgrounded

### 3. Improve Wake Lock Handling for iOS (`src/utils/SimpleIOSTranscriber.ts`)

Add wake lock request/release directly within the transcriber:
- Request a wake lock in `start()` to prevent screen auto-lock
- Re-acquire it on visibility change
- Release it in `stop()`
- This ensures the screen stays on during recording, which is the primary defence against iOS killing the audio

### 4. Add Heartbeat Stream Health Check (`src/utils/SimpleIOSTranscriber.ts`)

In the existing `handleHeartbeatTick()` method, add a stream health check:
- Verify `this.stream.getAudioTracks()[0]?.readyState === 'live'` on every heartbeat (every 5 seconds)
- If the track is dead, immediately trigger recovery
- Log the recovery attempt with timing data for future debugging

## Technical Details

### File: `src/utils/SimpleIOSTranscriber.ts`

New method -- `recoverStream()`:
```typescript
private async recoverStream(): Promise<boolean> {
  console.warn('📱 iOS-Rotate: Attempting stream recovery...');
  this.callbacks.onStatusChange('Recovering microphone...');
  
  try {
    // Stop old stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    
    // Re-acquire microphone
    const constraints: MediaStreamConstraints = {
      audio: this.selectedDeviceId 
        ? { deviceId: { exact: this.selectedDeviceId } }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    };
    
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.setupTrackMonitoring();
    
    // Restart recorder with new stream
    if (this.isRecording && !this.stopRequested) {
      this.createAndStartRecorder();
    }
    
    this.callbacks.onStatusChange('Recording...');
    console.log('📱 iOS-Rotate: Stream recovery successful');
    return true;
  } catch (error) {
    console.error('📱 iOS-Rotate: Stream recovery failed:', error);
    this.callbacks.onError('Microphone lost. Please restart recording.');
    return false;
  }
}
```

Updated `createAndStartRecorder()` -- add track validation:
```typescript
private createAndStartRecorder(): void {
  if (!this.stream) {
    console.error('📱 iOS-Rotate: No stream available');
    return;
  }
  
  // NEW: Check track health before creating recorder
  const track = this.stream.getAudioTracks()[0];
  if (!track || track.readyState !== 'live') {
    console.warn('📱 iOS-Rotate: Audio track not live, triggering recovery');
    this.recoverStream();
    return;
  }
  
  // ... existing recorder creation code
}
```

Updated `handleHeartbeatTick()` -- add stream health check:
```typescript
private handleHeartbeatTick(): void {
  if (!this.isRecording || !this.mediaRecorder) return;
  
  // NEW: Check stream health
  const track = this.stream?.getAudioTracks()[0];
  if (track && track.readyState !== 'live') {
    console.warn('📱 iOS-Rotate: Track died (heartbeat detected)');
    this.recoverStream();
    return;
  }
  
  // ... existing rotation and emit logic
}
```

New method -- `setupTrackMonitoring()`:
```typescript
private setupTrackMonitoring(): void {
  if (!this.stream) return;
  
  this.stream.getAudioTracks().forEach(track => {
    track.addEventListener('ended', () => {
      console.warn('📱 iOS-Rotate: Audio track ended event fired');
      if (this.isRecording && !this.stopRequested) {
        this.recoverStream();
      }
    });
  });
}
```

New methods -- silent audio keepalive:
```typescript
private keepaliveContext: AudioContext | null = null;

private startKeepAlive(): void {
  try {
    this.keepaliveContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = this.keepaliveContext.createOscillator();
    const gain = this.keepaliveContext.createGain();
    gain.gain.value = 0; // Silent
    oscillator.connect(gain);
    gain.connect(this.keepaliveContext.destination);
    oscillator.start();
    console.log('📱 iOS-Rotate: Audio keepalive started');
  } catch (e) {
    console.warn('📱 iOS-Rotate: Keepalive failed:', e);
  }
}

private stopKeepAlive(): void {
  if (this.keepaliveContext) {
    this.keepaliveContext.close().catch(() => {});
    this.keepaliveContext = null;
  }
}
```

These changes are all contained within `SimpleIOSTranscriber.ts` and do not affect desktop recording paths.

