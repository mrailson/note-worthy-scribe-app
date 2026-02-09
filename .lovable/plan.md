

# Fix: Repeated Sections in Policy Documents

## Investigation Findings

I examined the actual saved policy content in the database and traced the full generation-to-export pipeline. I found **two distinct causes** of section repetition.

### Cause 1: References section appears twice

This is the primary issue. The AI-generated policy content includes its own detailed "References and Legislation" section (typically section 10 or 17, with 10-14 fully cited items). Then **both** the Word export and the on-screen preview **unconditionally append another** "References and Legislation" section built from `metadata.references` (a shorter list of 4-5 items).

The result is two back-to-back references sections at the end of every policy document.

Example from the Confidentiality policy:
- Section 17 (AI-generated): 14 detailed legislation items with full titles and dates
- Then immediately after: A second "References and Legislation" heading with 5 brief items from metadata

### Cause 2: AI enhancement artifacts appearing as content

The enhance-policy step sometimes appends meta-commentary that is not actual policy content:
- `## CRITICAL COMPLIANCE ENHANCEMENTS MADE:` followed by a numbered list of what the AI changed
- `**PRACTICE ACTIONS REQUIRED:**` followed by action items
- Trailing italic disclaimers like `*This policy has been enhanced to ensure full CQC regulatory compliance...*`

These sections appear after the policy's natural ending (e.g. after "Version History" or "END OF POLICY") and repeat/summarise information already covered in the body. Found in at least the Safeguarding Children and Confidentiality policies.

## Fixes

### Fix 1: Skip the hardcoded References section when content already includes one

Both `generatePolicyDocx.ts` and `PolicyDocumentPreview.tsx` currently append a "References and Legislation" section unconditionally from `metadata.references`. The fix adds a simple check: if the AI-generated content already contains a references heading (matching patterns like `references and legislation`, `references & legislation`, or `## references`), skip the hardcoded section.

The AI-generated version is kept because it is more comprehensive (10-14 fully cited items vs 4-5 brief metadata items).

**Files changed:**

| File | Change |
|---|---|
| `src/utils/generatePolicyDocx.ts` | Wrap the hardcoded References section (lines 358-380) in a conditional check |
| `src/components/policy/PolicyDocumentPreview.tsx` | Wrap the hardcoded References section (lines 586-605) in a conditional check |

### Fix 2: Strip enhancement artifacts from content before rendering

Add content-cleaning logic that removes known enhancement meta-commentary patterns from the end of the content. This runs before parsing in both the Word export and the preview.

Patterns to strip:
- Everything after a line reading `**END OF POLICY**` or `**Document End**`
- Sections starting with `## CRITICAL COMPLIANCE ENHANCEMENTS MADE` (and everything following)
- Sections starting with `**PRACTICE ACTIONS REQUIRED:**` (and everything following)
- Trailing italic lines matching `*This policy has been enhanced...` or `*This policy has been developed...`

**Files changed:**

| File | Change |
|---|---|
| `src/utils/generatePolicyDocx.ts` | Add `cleanEnhancementArtifacts()` function; apply it to `processedContent` before parsing |
| `src/components/policy/PolicyDocumentPreview.tsx` | Import and apply the same cleaning function before parsing |

## Technical Detail

### References duplication check

```text
Before appending the hardcoded References section:

  contentLower = content.toLowerCase()
  hasReferencesInContent = contentLower includes any of:
    - "references and legislation"
    - "references & legislation" 
    - "## references"
    - "# references"

  if hasReferencesInContent:
    skip the hardcoded References section
  else:
    render it as before (backwards-compatible)
```

### Enhancement artifact cleaning

```text
function cleanEnhancementArtifacts(content):
  
  1. Find the earliest occurrence of:
     - /^\*{0,2}END OF POLICY\*{0,2}$/m
     - /^## CRITICAL COMPLIANCE ENHANCEMENTS/m
     - /^\*{0,2}PRACTICE ACTIONS REQUIRED/m
  
  2. If found, truncate content at that point
  
  3. Remove trailing italic disclaimer lines matching:
     - /^\*This policy has been (enhanced|developed).*\*$/m
  
  4. Trim trailing whitespace and horizontal rules
  
  return cleaned content
```

### Files modified summary

| File | Changes |
|---|---|
| `src/utils/generatePolicyDocx.ts` | Add `cleanEnhancementArtifacts()` function; apply before `parseMarkdownToSections`; conditionally skip hardcoded References section |
| `src/components/policy/PolicyDocumentPreview.tsx` | Import and apply `cleanEnhancementArtifacts()`; conditionally skip hardcoded References section |

No edge functions or database changes required. Both the on-screen preview and the Word export will be fixed together.

