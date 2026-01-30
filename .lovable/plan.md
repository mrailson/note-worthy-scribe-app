
# Fix: PM Genie Infographic Response Parsing

## Problem Identified

The infographic generation is actually **succeeding** (confirmed by edge function logs showing "✅ Image generated successfully"), but the client code is incorrectly parsing the response.

### Root Cause

**Mismatched response structure:**

The `ai4gp-image-generation` edge function returns:
```javascript
{
  success: true,
  image: {
    url: "data:image/png;base64,..."  // URL is nested here
  },
  textResponse: "..."
}
```

But `EmbeddedPMGenie.tsx` line 141 checks for:
```tsx
if (data?.imageUrl) {  // Looking for "imageUrl" at top level - WRONG
```

### Why Email Worked

The email was sent successfully because the PM Genie agent correctly invoked the `send_email` client tool after believing it had an infographic URL. However, the user saw the "Failed to generate infographic" toast because the client-side success check failed.

---

## Solution

### File: `src/components/ai4gp/EmbeddedPMGenie.tsx`

Update the `generateInfographic` function to correctly access the nested image URL:

**Lines 141-150 — Change:**
```tsx
// BEFORE
if (data?.imageUrl) {
  setInfographicsGenerated(prev => prev + 1);
  toast.success('Infographic generated!');
  return `Infographic generated successfully. The image URL is: ${data.imageUrl}. You can now offer to email this to the user.`;
} else {
  toast.error('Failed to generate infographic');
  return 'Failed to generate infographic: No image returned';
}
```

**To:**
```tsx
// AFTER
const imageUrl = data?.image?.url || data?.imageUrl;

if (imageUrl) {
  setInfographicsGenerated(prev => prev + 1);
  toast.success('Infographic generated!');
  return `Infographic generated successfully. The image URL is: ${imageUrl}. You can now offer to email this to the user.`;
} else {
  toast.error('Failed to generate infographic');
  return 'Failed to generate infographic: No image returned';
}
```

This fix:
1. Correctly accesses `data.image.url` (the actual response structure)
2. Falls back to `data.imageUrl` for compatibility if the response format ever changes
3. Passes the correct URL to the agent for emailing

---

## Expected Outcome

After this fix:
- ✅ Infographic generation will show success toast
- ✅ The counter will increment correctly
- ✅ The correct image URL will be returned to the agent
- ✅ Emails with infographics will work as intended

---

## Technical Details

| Aspect | Details |
|--------|---------|
| Files Modified | 1 (`EmbeddedPMGenie.tsx`) |
| Lines Changed | ~5 lines in the `generateInfographic` function |
| Risk Level | Low — simple property access fix |
| Testing Required | Generate an infographic via PM Genie voice and verify success toast appears |
