

# Plan: Fix Dual Recording Issues (Triple Meetings & Dual Transcription Sources)

## Summary

The investigation identified **two distinct issues** affecting Rachel Parry's recordings:

1. **Triple Meeting Creation**: Three separate meeting records were created within 1 second due to missing debounce/lock protection on the Start Recording button
2. **Dual Transcription Sources**: One meeting received chunks from both `ios-simple` (320 chunks) and `legacy` (106 chunks), causing inflated word counts (~21K words)

---

## Root Cause Analysis

### Issue 1: Triple Meeting Creation
- The Start Recording button has no `disabled` state during initialisation
- The `startRecording` function lacks an `isStarting` lock/ref
- Users who multi-click (or experience UI lag) trigger multiple database insertions before `isRecording` becomes true

### Issue 2: Dual Transcription Running Simultaneously
- On iOS devices, `checkBrowserSupport()` should detect iOS and route to `startIPhoneWhisperTranscription` (which uses `ios-simple`)
- However, the user appears to have both engines running:
  - `SimpleIOSTranscriber` → saves as `ios-simple`
  - `DesktopWhisperTranscriber` → saves as `legacy` (via database default)
- This suggests either:
  - iOS detection failed (iPad Pro masquerading as Mac), OR
  - Both transcription paths were triggered somehow

---

## Proposed Fix (Safe, Non-Breaking)

### Fix 1: Add Start Recording Lock (Prevents Triple Meetings)

Add an `isStartingRecording` ref to prevent concurrent execution:

```typescript
// Add near other refs
const isStartingRecordingRef = useRef(false);

// At start of startRecording function
const startRecording = async () => {
  // Prevent double-starts from rapid clicks
  if (isStartingRecordingRef.current || isRecording) {
    console.log('⚠️ Recording already starting or active, ignoring');
    return;
  }
  
  isStartingRecordingRef.current = true;
  
  try {
    // ... existing logic
  } finally {
    isStartingRecordingRef.current = false;
  }
};
```

Also disable the button while starting:

```tsx
<Button
  onClick={startRecording}
  disabled={isRecording || isStartingRecordingRef.current}
  // ... other props
>
```

**Risk Level**: Very Low - additive change only

---

### Fix 2: Ensure Single Transcription Path (Prevents Dual Sources)

Update `DesktopWhisperTranscriber` to explicitly set `transcriber_type: 'whisper'` instead of relying on the database default:

```typescript
// In DesktopWhisperTranscriber.ts, line ~860
const { error: dbError } = await supabase
  .from('meeting_transcription_chunks')
  .insert({
    meeting_id: this.meetingId,
    session_id: this.sessionId,
    chunk_number: currentChunkNumber,
    transcription_text: JSON.stringify(newSegments),
    confidence: data.confidence || 0.9,
    is_final: true,
    user_id: (await supabase.auth.getUser()).data.user?.id,
    transcriber_type: 'whisper',  // ADD THIS - explicit type
    merge_rejection_reason: null
  });
```

**Risk Level**: Very Low - makes type explicit, no logic change

---

### Fix 3: Improve iOS Detection for iPad Pro

Update `checkBrowserSupport` to handle iPad Pro (which reports as "MacIntel"):

```typescript
const checkBrowserSupport = () => {
  // Enhanced iOS detection for iPad Pro
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // ... rest of function
};
```

**Risk Level**: Low - aligns with existing pattern in other utilities

---

### Fix 4: Add Transcriber Exclusivity Guard (Belt & Braces)

Add a guard in `startWhisperTranscription` to ensure only ONE transcriber runs:

```typescript
const startWhisperTranscription = async (meetingId: string) => {
  const browserSupport = checkBrowserSupport();
  
  if (browserSupport.isIOS) {
    console.log('📱 iOS detected - using SimpleIOSTranscriber exclusively');
    // Ensure desktop transcriber is not running
    if (desktopTranscriberRef.current) {
      console.warn('⚠️ Stopping orphaned desktop transcriber');
      desktopTranscriberRef.current.stopTranscription();
      desktopTranscriberRef.current = null;
    }
    await startIPhoneWhisperTranscription(meetingId);
  } else {
    console.log('🖥️ Desktop detected - using DesktopWhisperTranscriber');
    // Ensure iOS transcriber is not running
    if (simpleIOSTranscriberRef.current) {
      console.warn('⚠️ Stopping orphaned iOS transcriber');
      simpleIOSTranscriberRef.current.stop();
      simpleIOSTranscriberRef.current = null;
    }
    await startDesktopWhisperTranscription(meetingId);
  }
};
```

**Risk Level**: Low - defensive cleanup only

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/MeetingRecorder.tsx` | Add `isStartingRecordingRef`, disable button, improve iOS detection, add transcriber exclusivity guard |
| `src/utils/DesktopWhisperTranscriber.ts` | Add explicit `transcriber_type: 'whisper'` |

---

## Technical Details

### Why This Won't Break Existing Recordings

1. **Lock ref** - Only prevents new duplicate recordings; doesn't affect in-progress ones
2. **Explicit transcriber_type** - The consolidation and merge logic already handles multiple source types gracefully
3. **iOS detection enhancement** - Same pattern already used in `BrowserSpeechTranscriber.ts` and `PatientVoiceRecorderLive.tsx`
4. **Exclusivity guard** - Only cleans up if a transcriber ref exists (which shouldn't happen normally)

### Database Impact

- Existing `legacy` chunks remain unaffected
- New desktop recordings will show as `whisper` type
- Word count calculations remain unchanged (uses `MAX()` across sources)

---

## Testing Recommendations

After implementation:
1. Test recording start on desktop Chrome/Edge - should create exactly ONE meeting
2. Test recording start on iOS Safari - should only use `ios-simple` transcriber
3. Test rapid double-click on Start button - should be ignored
4. Verify existing meetings with `legacy` chunks still display correctly

