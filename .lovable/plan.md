
# Professional Chat Bubble Styling for Ask AI Modal

## Overview
Improve the AI response bubble in the Ask AI modal to display with professional formatting, proper spacing, and clean typography. The current implementation uses basic `prose` styling which results in cramped, hard-to-read content.

## Changes

### 1. Use the NHS Markdown Renderer
Replace the basic `ReactMarkdown` rendering with the existing `renderNHSMarkdown` utility that's already used in other parts of the application (Meeting Manager, MeetingQAPanel). This provides:
- Properly styled headings with blue colour and consistent sizing
- Well-spaced bullet points with visual markers
- Structured numbered lists
- Professional table formatting
- Proper paragraph spacing with `leading-relaxed`
- Section highlighting for important notes

### 2. Enhanced Bubble Container Styling
Update the assistant message bubble with improved padding, spacing and typography:
- Increase internal padding for better breathing room
- Add proper text sizing and line height
- Ensure consistent spacing between content elements

### 3. Styling Details

**Current problematic styling:**
```
prose prose-sm prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:my-3
```

**New professional styling approach:**
- Use `renderNHSMarkdown` with `enableNHSStyling: true`
- Set appropriate `baseFontSize` (13-14px) for readability
- Apply container styling for proper text colour and spacing

### Technical Implementation

**File: `src/components/mock-cqc/InspectionItemAskAI.tsx`**

1. **Add import** for the NHS markdown renderer:
   ```typescript
   import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
   ```

2. **Update the assistant message rendering** (around line 300-303):
   Replace `ReactMarkdown` with `dangerouslySetInnerHTML` using the NHS renderer:
   ```typescript
   {message.role === 'assistant' ? (
     <div 
       className="text-sm leading-relaxed text-gray-700"
       dangerouslySetInnerHTML={{ 
         __html: renderNHSMarkdown(message.content, { 
           enableNHSStyling: true,
           baseFontSize: 14 
         }) 
       }}
     />
   ) : (
     ...
   )}
   ```

3. **Enhance bubble container** (around line 292-298):
   Increase padding and add better spacing:
   ```typescript
   className={cn(
     "rounded-xl",
     message.role === 'user'
       ? "bg-primary text-primary-foreground px-4 py-3 max-w-[75%]"
       : "bg-white border border-gray-200 shadow-sm px-6 py-5 max-w-[95%]"
   )}
   ```

4. **Remove ReactMarkdown import** if no longer needed elsewhere in the file

## Expected Result
- Clean, professional layout matching the Meeting Manager chat experience
- Proper heading hierarchy with blue-coloured section titles
- Well-spaced bullet points that don't run together
- Readable paragraph text with appropriate line height
- White background with subtle border for clear visual distinction
- Consistent styling across all AI chat interfaces in the application
