
# Plan: Fix Out-of-Memory Crashes in Ask AI (AI4GP) Service

## Summary of Investigation Findings

The Ask AI service is crashing due to uncontrolled memory growth, primarily caused by:

1. **Critical: `setMessagesWithLimit` is defined but NEVER USED** - All message state updates bypass the memory-safe wrapper and call `setMessages` directly, allowing unbounded message growth
2. **Messages array grows indefinitely** - No active enforcement of the 20/40 message limit
3. **Base64 content retained** - Heavy content (images, audio, presentations) stays in memory for all messages, not just recent ones
4. **Periodic cleanup insufficient** - The 15-30 second interval can't keep up with rapid interactions
5. **Streaming callbacks create stale closures** - Multiple `setMessages` calls during streaming compound memory pressure

## Technical Diagnosis

```text
┌─────────────────────────────────────────────────────────────┐
│                  Current Memory Flow                        │
├─────────────────────────────────────────────────────────────┤
│  User sends message                                          │
│       ↓                                                      │
│  setMessages([...messages, userMessage])  ← DIRECT CALL     │
│       ↓                                                      │
│  Streaming response adds to state every chunk                │
│       ↓                                                      │
│  More messages accumulate with base64 data                   │
│       ↓                                                      │
│  Cleanup interval (15-30s) may not fire in time              │
│       ↓                                                      │
│  BROWSER CRASH                                               │
└─────────────────────────────────────────────────────────────┘
```

## Proposed Solution

### Phase 1: Enforce Message Limits (High Priority)

**File: `src/hooks/useAI4GPService.ts`**

Replace all direct `setMessages` calls with the existing `setMessagesWithLimit` wrapper. Key locations:

- Line 535: `setMessages(newMessages)` → `setMessagesWithLimit(newMessages)`
- Line 553: `setMessages(messagesWithStreaming)` → `setMessagesWithLimit(messagesWithStreaming)`
- Lines 583, 646, 666: Voice generation message updates
- Lines 718, 749: GPT-5 streaming updates
- Lines 809, 824: Fallback error messages
- Lines 917, 926: SSE streaming content accumulation
- Lines 964, 1005, 1043: Simulated streaming updates
- Lines 1098, 1127, 1136: Non-streamable model responses
- Lines 1166, 1474, 1509, 1550, 1572: Quick response handling
- Lines 1639, 1653, 1689: Search loading and clearing

Additionally, update the hook's return value to expose `setMessagesWithLimit` instead of raw `setMessages`:

```typescript
return {
  messages,
  setMessages: setMessagesWithLimit, // Use safe wrapper everywhere
  // ... rest
};
```

### Phase 2: Immediate Cleanup After Streaming Completes

**File: `src/hooks/useAI4GPService.ts`**

Add a post-stream cleanup call after each response finishes (not just periodic interval):

```typescript
// After streaming completes (multiple locations around lines 750, 930, 1045, 1140)
setMessagesWithLimit(prev => prev.map(msg =>
  msg.id === assistantMessageId 
    ? finalAssistantMessage
    : msg
));

// Immediate cleanup to reclaim memory
setTimeout(() => {
  setMessages(prev => optimiseMessagesForMemory(prev, KEEP_RECENT_MESSAGES_INTACT));
}, 100);
```

### Phase 3: More Aggressive Base64 Stripping

**File: `src/utils/streamingUtils.ts`**

Lower thresholds and add additional content types to strip:

```typescript
// Current threshold: 5000 chars for files, 50000 for images
// Proposed: 2000 chars for files, 10000 for images

export function stripHeavyContentFromMessage(message: any): any {
  const stripped = { ...message };
  
  // Strip audio content (currently only checked if exists)
  if (stripped.generatedAudio?.audioContent) {
    stripped.generatedAudio = {
      ...stripped.generatedAudio,
      audioContent: '[STRIPPED_FOR_MEMORY]',
      wasStripped: true
    };
  }
  
  // Strip file content more aggressively (reduce from 5000 to 2000)
  if (stripped.files?.length > 0) {
    stripped.files = stripped.files.map((file: any) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      isLoading: false,
      metadata: file.metadata,
      content: file.content?.length > 2000 ? '[STRIPPED_FOR_MEMORY]' : file.content,
      wasStripped: file.content?.length > 2000
    }));
  }
  
  // Strip images more aggressively (reduce from 50000 to 10000)
  if (stripped.generatedImages?.length > 0) {
    stripped.generatedImages = stripped.generatedImages.map((img: any) => ({
      ...img,
      imageData: img.imageData?.length > 10000 
        ? '[STRIPPED_FOR_MEMORY]' 
        : img.imageData,
      wasStripped: img.imageData?.length > 10000
    }));
  }
  
  // NEW: Strip presentation base64 data
  if (stripped.generatedPresentation?.pptxBase64) {
    stripped.generatedPresentation = {
      ...stripped.generatedPresentation,
      pptxBase64: '[STRIPPED_FOR_MEMORY]',
      wasStripped: true
    };
  }
  
  return stripped;
}
```

### Phase 4: Desktop-Specific Limits

Since the crash is happening on desktop with text-only chat very quickly, the issue is likely in the streaming callback closure accumulation. Add additional safeguards:

**File: `src/hooks/useAI4GPService.ts`**

```typescript
// Add a hard cap check before every setMessages call
const MAX_MESSAGES_HARD_CAP = 100;

const setMessagesWithLimit = useCallback((newMessages: Message[] | ((prev: Message[]) => Message[])) => {
  setMessages(prev => {
    const updatedMessages = typeof newMessages === 'function' ? newMessages(prev) : newMessages;
    
    // HARD CAP: Emergency truncation if somehow we exceed
    if (updatedMessages.length > MAX_MESSAGES_HARD_CAP) {
      console.error(`🚨 CRITICAL: Message count (${updatedMessages.length}) exceeds hard cap!`);
      return optimiseMessagesForMemory(
        updatedMessages.slice(-MAX_MESSAGES_IN_MEMORY),
        KEEP_RECENT_MESSAGES_INTACT
      );
    }
    
    // Normal optimisation path
    const optimised = optimiseMessagesForMemory(updatedMessages, KEEP_RECENT_MESSAGES_INTACT);
    
    if (optimised.length > MAX_MESSAGES_IN_MEMORY) {
      console.log(`⚠️ Truncating from ${optimised.length} to ${MAX_MESSAGES_IN_MEMORY}`);
      return optimised.slice(-MAX_MESSAGES_IN_MEMORY);
    }
    
    return optimised;
  });
}, []);
```

## Measurement Strategy

### Before Fixes (Current State)

1. **Browser DevTools Memory Tab**
   - Open Chrome DevTools → Memory → Take heap snapshot
   - Send 3-5 messages in Ask AI
   - Take another snapshot
   - Compare: Look for message count and retained base64 strings

2. **Console Logging** (already in place)
   - Watch for `🧹 Running periodic memory cleanup` logs
   - Note if cleanup runs before crash

3. **Crash Frequency**
   - Document: How many messages before "Aw, Snap!"

### After Fixes (Verification)

1. **Heap Snapshot Comparison**
   - Same workflow, compare memory growth
   - Target: <50MB growth per 10 messages

2. **Console Verification**
   - Watch for `⚠️ Message count exceeds limit, truncating`
   - Confirm limit enforcement is active

3. **Stress Test**
   - Send 50+ rapid messages
   - Should NOT crash
   - Memory should plateau (not grow indefinitely)

4. **Add Debug UI (Optional)**
   - Temporarily add a dev-only message counter badge in settings
   - Shows current `messages.length` and estimated token count

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAI4GPService.ts` | Replace ~20 `setMessages` calls with `setMessagesWithLimit`; expose wrapper; add hard cap |
| `src/utils/streamingUtils.ts` | Lower stripping thresholds; add presentation stripping |
| `src/components/AI4GPService.tsx` | No changes needed (uses hook correctly) |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Stripping content too aggressively | Only strip from messages older than 3-5 exchanges; recent messages keep full content |
| Breaking existing chat functionality | All changes are internal to memory management; UI behaviour unchanged |
| Regression in file uploads | File content is preserved for recent messages; only stripped from history |

## Testing Checklist

- [ ] Send 5 messages rapidly → no crash
- [ ] Send 20 messages → memory stable
- [ ] Upload a large PDF → process and respond without crash
- [ ] Reload previous search history → loads correctly
- [ ] Voice generation works and audio plays
- [ ] PowerPoint downloads still work
- [ ] Mobile: Same tests on smaller limits (20 messages)
