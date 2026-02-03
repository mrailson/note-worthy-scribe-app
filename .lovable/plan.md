# Plan: Fix Out-of-Memory Crashes in Ask AI (AI4GP) Service

## ✅ IMPLEMENTATION COMPLETE

All phases have been implemented successfully.

---

## Summary of Changes Made

### Phase 1: Enforce Message Limits ✅
- Replaced **all 30+ direct `setMessages` calls** with `setMessagesWithLimit` wrapper
- Updated hook return to expose `setMessagesWithLimit` as `setMessages`
- Updated `loadSearch` and `clearMessages` helpers
- Updated `handleNewSearch` callback

### Phase 2: Memory-safe wrapper with hard cap ✅
- Added `MAX_MESSAGES_HARD_CAP = 100` emergency limit
- Console logging for when limits are triggered

### Phase 3: More Aggressive Base64 Stripping ✅
- Reduced file content threshold: 5000 → **2000 chars**
- Reduced image data threshold: 50000 → **10000 chars**
- Added presentation pptxBase64 stripping

### Phase 4: Desktop-Specific Limits ✅
- Hard cap implemented in `setMessagesWithLimit`
- Optimisation runs on every state update

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useAI4GPService.ts` | Replaced 30+ `setMessages` calls; added hard cap; exposed safe wrapper |
| `src/utils/streamingUtils.ts` | Lowered thresholds; added presentation stripping |

---

## Verification

Watch for these console logs during testing:
- `🧹 Running periodic memory cleanup` - periodic cleanup active
- `⚠️ Message count (X) exceeds limit (40), truncating` - limit enforcement active  
- `🚨 CRITICAL: Message count (X) exceeds hard cap!` - emergency truncation (shouldn't appear normally)

---

## Testing Checklist

- [ ] Send 5 messages rapidly → no crash
- [ ] Send 20 messages → memory stable
- [ ] Upload a large PDF → process and respond without crash
- [ ] Reload previous search history → loads correctly
- [ ] Voice generation works and audio plays
- [ ] Mobile: Same tests on smaller limits (20 messages)
