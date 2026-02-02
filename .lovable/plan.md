
# Plan: Enable Generate Button When Attachment Is Uploaded

## Summary

The "Generate" button in the Image Studio footer is greyed out when an attachment is uploaded because its disabled condition doesn't check for uploaded files or extracted supporting content - only the main description text and reference images.

---

## Root Cause

There are **two** Generate buttons with **inconsistent** validation:

| Location | Current Disabled Condition | Result |
|----------|---------------------------|--------|
| **GenerateTab** (line 224) | `!description && !supportingContent && !hasUploadedFiles` | ✅ Correct |
| **Footer** (line 253) | `!description && referenceImages === 0` | ❌ Missing file check |

The footer button ignores uploaded files and extracted document content.

---

## Solution

Update the footer button's disabled condition to match the GenerateTab logic, checking for:
1. Text description (`settings.description.trim()`)
2. Supporting content from extracted documents (`settings.supportingContent?.trim()`)
3. Uploaded files flag (`hasUploadedFiles`)

---

## Technical Changes

### File: `src/components/ai4gp/ImageStudioModal.tsx`

**Change: Update footer button disabled condition (line 253)**

```typescript
// FROM (line 253):
disabled={!settings.description.trim() && settings.referenceImages.length === 0}

// TO:
disabled={!settings.description.trim() && !settings.supportingContent?.trim() && !hasUploadedFiles && settings.referenceImages.length === 0}
```

This ensures the Generate button in the footer is enabled when ANY of these is true:
- User has typed a description
- User has uploaded a document and content was extracted
- User has uploaded any files (images or documents)
- User has added reference images

---

## Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/components/ai4gp/ImageStudioModal.tsx` | 253 | Add `!settings.supportingContent?.trim() && !hasUploadedFiles` to disabled condition |

---

## Expected Behaviour After Fix

| Scenario | Generate Button |
|----------|-----------------|
| Empty form | Disabled ❌ |
| Text description only | Enabled ✅ |
| Uploaded Word/PDF (content extracted) | Enabled ✅ |
| Uploaded image file | Enabled ✅ |
| Reference image added | Enabled ✅ |
| Combination of above | Enabled ✅ |
