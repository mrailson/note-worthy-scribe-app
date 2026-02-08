

# AI Question Generator for Survey Builder

## Overview
Add an "Ask AI" button to the Survey Builder's Questions tab that allows users to describe what kind of survey questions they need -- either by typing or using voice input -- and have AI generate appropriate questions. The generated questions are appended to the existing question list, where users can then manually edit, reorder, or remove them.

## User Experience

1. In the Questions tab header (alongside "Import from File" and "Add Question"), a new sparkle/wand icon button labelled "Ask AI" appears
2. Clicking it opens a modal dialog with:
   - A text input area with a placeholder like "Describe the questions you need, e.g. 'Create 5 patient satisfaction questions about waiting times and staff friendliness'"
   - A microphone button (using the existing `CompactMicButton` component) for voice input
   - A "Generate Questions" submit button
3. The AI processes the request via the existing `parse-survey-questions` edge function (reused with a new prompt path) or a dedicated lightweight edge function
4. Generated questions appear in a review list within the modal (similar to the import modal pattern)
5. User clicks "Add Questions" to append them to the survey

## Technical Approach

### 1. New Edge Function: `generate-survey-questions`
A new Supabase edge function that takes a natural language description and returns structured survey questions. Uses the Lovable AI Gateway with Gemini 3 Flash and tool calling (same pattern as `parse-survey-questions`).

- **Input**: `{ prompt: string, surveyType?: string, existingQuestionCount?: number }`
- **Output**: `{ questions: ParsedQuestion[] }` (same format as parse-survey-questions)
- **Auth**: `verify_jwt = true`
- Handles 429/402 rate limit and credit errors
- System prompt tailored for NHS GP survey question generation with appropriate question type detection

### 2. New Component: `SurveyAIGenerateModal`
Located at `src/components/surveys/SurveyAIGenerateModal.tsx`

- Modal dialog with text input + `CompactMicButton` for voice-to-text
- Loading state with spinner whilst AI generates questions
- Preview list of generated questions (reuses the same card pattern from the import modal)
- Users can remove individual questions before adding
- "Add to Survey" button appends questions to the parent state

### 3. Updates to `SurveyBuilder.tsx`
- Import and render the new `SurveyAIGenerateModal`
- Add an "Ask AI" button with a `Sparkles` icon in the Questions tab header
- New `handleAIGeneratedQuestions` handler (mirrors `handleImportQuestions`)
- Add state for modal visibility: `showAIGenerateModal`

### 4. Config Update
- Add `[functions.generate-survey-questions]` with `verify_jwt = true` to `supabase/config.toml`

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate-survey-questions/index.ts` | Create -- new edge function |
| `supabase/config.toml` | Edit -- add function entry |
| `src/components/surveys/SurveyAIGenerateModal.tsx` | Create -- modal component |
| `src/pages/SurveyBuilder.tsx` | Edit -- add button + modal integration |

## Edge Function Detail

```text
POST /generate-survey-questions
Body: { prompt, surveyType?, existingQuestionCount? }

System prompt instructs the model to:
  - Generate survey questions appropriate for NHS GP practices
  - Use the same question type taxonomy (rating, text, multiple_choice, yes_no, scale)
  - Return structured output via tool calling
  - Consider the survey type context if provided
  - Avoid duplicating existing questions (count provided for ordering)

Response: { questions: [{ question_text, question_type, options, is_required, confidence }] }
```

## UI Button Placement

The "Ask AI" button sits in the Questions card header alongside "Import from File" and "Add Question":

```text
+-------------------------------------------------------+
| Questions                          [Sparkles Ask AI]   |
| Add and configure your survey      [Upload Import]     |
| questions                          [+ Add Question]    |
+-------------------------------------------------------+
```

The icon will use `Sparkles` from lucide-react for a distinctive, recognisable AI action indicator.

