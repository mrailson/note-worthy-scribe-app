
# Plan: Test Ask AI Service and Add Test/Demo Mode

## Overview
This plan covers three items:
1. Testing the `gpt5-fast-clinical` edge function for clinical responses
2. Testing the image processing flow with a storage URL
3. Adding a test/demo mode to Ask AI that bypasses authentication

---

## 1. Test `gpt5-fast-clinical` Edge Function

### Purpose
Verify that the clinical response model works correctly for NHS GP queries, returns British English formatting, and adheres to clinical guidelines.

### Test Cases
I will execute the following tests against the `gpt5-fast-clinical` edge function:

| Test | Query | Expected Outcome |
|------|-------|------------------|
| Basic Clinical Query | "What is the first-line treatment for hypertension in adults?" | NICE guideline response with appropriate drug classes |
| BNF Compliance | "What is the adult dose of amoxicillin for a chest infection?" | BNF-compliant dosing (500mg TDS, etc.) |
| Real-time Search | "What are the latest NICE guidelines for diabetes?" | Should trigger Tavily web search |
| Context Memory | Multi-turn conversation about UTI then follow-up | Should maintain context |

### Execution Method
Use the `supabase--curl_edge_functions` tool to call the deployed function directly with test payloads.

---

## 2. Test Image Processing Flow

### Purpose
Verify that the AI can correctly process and summarise images from Supabase Storage URLs (the flow used by iPhone photo capture).

### Test Approach
Send a request to `ai-4-pm-chat` with a real Supabase storage URL to verify:
- The edge function detects the URL as an image
- `fetchImageAsBase64` correctly fetches and converts the image
- The multimodal message is correctly formatted for the AI gateway
- The AI returns a meaningful image description/summary

### Test Payload
```json
{
  "messages": [{ 
    "role": "user", 
    "content": "Please describe this image",
    "files": [{
      "name": "test-image.jpg",
      "type": "image/jpeg",
      "content": "https://dphcnbricafkbtizkoal.supabase.co/storage/v1/object/public/ai-chat-captures/[existing-image]"
    }]
  }],
  "model": "google/gemini-3-flash-preview",
  "stream": false
}
```

### Execution Method
Use the `supabase--curl_edge_functions` tool to send the request and verify the response.

---

## 3. Add Test/Demo Mode to Ask AI

### Purpose
Allow testing of the Ask AI service without requiring NHS Staff authentication, enabling automated testing and demonstrations.

### Implementation Approach

#### Option A: URL Query Parameter (Recommended)
Add a `?demo=true` query parameter that:
- Bypasses the login requirement
- Creates a mock user context for the session
- Is only available in non-production environments (preview URLs)

#### Changes Required

**File: `src/pages/AI4GP.tsx`**
```typescript
// Add demo mode detection
const [isDemoMode] = useState(() => {
  const params = new URLSearchParams(window.location.search);
  const isDemo = params.get('demo') === 'true';
  const isPreview = window.location.hostname.includes('lovableproject.com') || 
                    window.location.hostname.includes('localhost');
  return isDemo && isPreview;
});

// Modify the auth check
if (!user && !isDemoMode) {
  return <SimpleLoginForm />;
}

// Pass demo mode to AI4GPService
<AI4GPService isDemoMode={isDemoMode} />
```

**File: `src/components/AI4GPService.tsx`**
- Accept `isDemoMode` prop
- When in demo mode, use a mock practice context

**File: `src/contexts/AuthContext.tsx`**
- Add demo user support for context consumers

### Security Considerations
- Demo mode ONLY works on preview URLs (not production `meetingmagic.lovable.app`)
- Demo mode is clearly indicated in the UI
- No real patient data accessible in demo mode
- Demo mode uses a mock user context

---

## Technical Details

### Edge Function Testing
The tests will be executed using the `supabase--curl_edge_functions` tool, which:
- Automatically handles authentication
- Returns the full response body
- Works with both streaming and non-streaming endpoints

### Demo Mode Security
```typescript
const isAllowedDemoHost = 
  window.location.hostname.includes('lovableproject.com') ||
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('preview');

const isDemoAllowed = isDemo && isAllowedDemoHost;
```

---

## Execution Order

1. **Immediate**: Run `gpt5-fast-clinical` tests
2. **Immediate**: Run image processing test
3. **After Approval**: Implement demo mode changes

---

## Expected Outcomes

### gpt5-fast-clinical Tests
- All clinical queries return appropriate British English responses
- BNF/NICE guidelines are referenced
- Real-time search triggers when keywords detected
- Responses include appropriate clinical disclaimers

### Image Processing Test
- Storage URL correctly converted to base64
- AI returns meaningful image description
- No "Base64 decoding failed" errors

### Demo Mode
- `/ai4gp?demo=true` loads the full Ask AI interface
- Demo mode banner visible
- All chat features functional without login
- Works only on preview URLs
