import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnomedItem {
  id: string;
  type: 'Diagnosis' | 'Surgery' | 'Immunisation' | 'Allergy' | 'Other';
  term: string;
  snomed_code: string;
  date: string | null;
  confidence: number;
  page_number: number;
}

interface PageData {
  page_number: number;
  ocr_text: string;
  image_base64?: string;
}

interface AuditedItem {
  id: string;
  status: 'confirmed' | 'corrected' | 'removed' | 'needs_manual_review';
  original: {
    type: string;
    term: string;
    code: string;
    date: string | null;
    confidence: number;
    page_number: number;
  };
  corrected: {
    type: string | null;
    term: string | null;
    code: string | null;
    date: string | null;
  };
  reason: string;
}

interface AuditSummary {
  total_items: number;
  confirmed_count: number;
  corrected_count: number;
  removed_count: number;
  needs_manual_review_count: number;
  messages_for_user: string[];
}

const QUALITY_GATE_SYSTEM_PROMPT = `You are the FINAL QUALITY GATE for Notewell AI before a Lloyd George summary is published and emailed to a UK GP practice.

Context:
- Upstream components have already scanned the Lloyd George paper record, extracted OCR text, and proposed SNOMED CT codes
- Your job is to verify each SNOMED item against the source page image and OCR text

For each SNOMED item you review, determine:

1. **Verify the clinical concept**: Look at the page image and OCR text. Is there actually evidence of this diagnosis/surgery/immunisation/allergy?

2. **Check the SNOMED code accuracy**: Is this the correct SNOMED CT code for what's documented? Use UK primary care SNOMED concepts.

3. **Verify the date**: Is the date correct based on the source document?

4. **Decide the status**:
   - "confirmed": The existing term, SNOMED code, type and date are correct for what's shown on the page
   - "corrected": There IS a genuine codable concept, but something is wrong (wrong code, term, date, or type) - provide corrections
   - "removed": There is NO appropriate codable concept on this page, or the item refers to something not supported by any evidence
   - "needs_manual_review": Evidence is too ambiguous or conflicting for safe automatic decision (e.g., illegible handwriting)

Return your decision as a JSON object with this exact structure:
{
  "status": "confirmed" | "corrected" | "removed" | "needs_manual_review",
  "corrected_type": "Diagnosis" | "Surgery" | "Immunisation" | "Allergy" | null,
  "corrected_term": string | null,
  "corrected_code": string | null,
  "corrected_date": string | null,
  "reason": string
}

For "confirmed" status, set all corrected fields to the original values.
For "corrected" status, provide the correct values.
For "removed" status, set all corrected fields to null and explain why in reason.
For "needs_manual_review", fill what you're confident about, set uncertain fields to null.

Be conservative - if in doubt, use "needs_manual_review" rather than making assumptions.`;

async function reviewSingleItem(
  item: SnomedItem,
  page: PageData,
  openaiKey: string
): Promise<AuditedItem> {
  const userContent: any[] = [];

  // Add image if available
  if (page.image_base64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${page.image_base64}` }
    });
  }

  // Add OCR text and item details
  userContent.push({
    type: 'text',
    text: `OCR Text from Page ${page.page_number + 1}:
---
${page.ocr_text}
---

SNOMED Item to verify:
- Type: ${item.type}
- Term: ${item.term}
- SNOMED Code: ${item.snomed_code}
- Date: ${item.date || 'Not specified'}
- Current Confidence: ${item.confidence}%
- Source Page: ${item.page_number + 1}

Please review this item against the source document and return your decision as JSON.`
  });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: QUALITY_GATE_SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const decision = JSON.parse(content);
    console.log(`Item ${item.id} decision:`, decision.status);

    return {
      id: item.id,
      status: decision.status,
      original: {
        type: item.type,
        term: item.term,
        code: item.snomed_code,
        date: item.date,
        confidence: item.confidence,
        page_number: item.page_number,
      },
      corrected: {
        type: decision.status === 'removed' ? null : (decision.corrected_type || item.type),
        term: decision.status === 'removed' ? null : (decision.corrected_term || item.term),
        code: decision.status === 'removed' ? null : (decision.corrected_code || item.snomed_code),
        date: decision.status === 'removed' ? null : (decision.corrected_date !== undefined ? decision.corrected_date : item.date),
      },
      reason: decision.reason || 'No reason provided',
    };
  } catch (err) {
    console.error(`Error reviewing item ${item.id}:`, err);
    // Return as needs_manual_review on error
    return {
      id: item.id,
      status: 'needs_manual_review',
      original: {
        type: item.type,
        term: item.term,
        code: item.snomed_code,
        date: item.date,
        confidence: item.confidence,
        page_number: item.page_number,
      },
      corrected: {
        type: item.type,
        term: item.term,
        code: item.snomed_code,
        date: item.date,
      },
      reason: `AI review failed: ${err instanceof Error ? err.message : 'Unknown error'}. Manual review required.`,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { patient_id, practice_ods, snomed_items, include_images = true } = await req.json();

    if (!patient_id || !snomed_items || !Array.isArray(snomed_items)) {
      throw new Error('Missing required fields: patient_id, snomed_items');
    }

    console.log(`Starting quality gate for patient ${patient_id} with ${snomed_items.length} items`);

    // Get unique page numbers from items
    const pageNumbers = [...new Set(snomed_items.map((item: SnomedItem) => item.page_number))];
    
    // Load OCR text for relevant pages
    const pagesData: Map<number, PageData> = new Map();
    
    // Try to load OCR merged file first
    const ocrPath = `${practice_ods}/${patient_id}/final/ocr_merged.json`;
    const { data: ocrFile } = await supabase.storage.from('lg').download(ocrPath);
    
    let fullOcrText = '';
    if (ocrFile) {
      try {
        const ocrData = JSON.parse(await ocrFile.text());
        fullOcrText = ocrData.merged_text || ocrData.text || '';
      } catch (e) {
        console.log('Could not parse OCR file:', e);
      }
    }

    // Parse OCR into pages
    const pageRegex = /---\s*Page\s+page_(\d+)\.(jpg|jpeg|png)\s*---/gi;
    const pageMatches = [...fullOcrText.matchAll(pageRegex)];
    
    for (let i = 0; i < pageMatches.length; i++) {
      const match = pageMatches[i];
      const pageNum = parseInt(match[1], 10) - 1; // Convert to 0-indexed
      const startIdx = match.index! + match[0].length;
      const endIdx = pageMatches[i + 1]?.index || fullOcrText.length;
      const pageText = fullOcrText.slice(startIdx, endIdx).trim();
      
      if (pageNumbers.includes(pageNum)) {
        pagesData.set(pageNum, {
          page_number: pageNum,
          ocr_text: pageText,
        });
      }
    }

    // Optionally load images for pages
    if (include_images) {
      for (const pageNum of pageNumbers) {
        const pageNumStr = String(pageNum + 1).padStart(3, '0');
        const imagePath = `${practice_ods}/${patient_id}/raw/page_${pageNumStr}.jpg`;
        
        try {
          const { data: imageData } = await supabase.storage.from('lg').download(imagePath);
          if (imageData) {
            const arrayBuffer = await imageData.arrayBuffer();
            // Use chunked conversion to avoid stack overflow on large images
            const uint8Array = new Uint8Array(arrayBuffer);
            const chunkSize = 32768;
            let base64 = '';
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
              base64 += String.fromCharCode.apply(null, Array.from(chunk));
            }
            base64 = btoa(base64);
            
            const existing = pagesData.get(pageNum) || { page_number: pageNum, ocr_text: '' };
            existing.image_base64 = base64;
            pagesData.set(pageNum, existing);
            console.log(`Loaded image for page ${pageNum}, size: ${base64.length} chars`);
          }
        } catch (e) {
          console.log(`Could not load image for page ${pageNum}:`, e);
        }
      }
    }

    // Review each item
    const auditedItems: AuditedItem[] = [];
    
    for (const item of snomed_items as SnomedItem[]) {
      const page = pagesData.get(item.page_number) || {
        page_number: item.page_number,
        ocr_text: 'OCR text not available for this page',
      };
      
      const result = await reviewSingleItem(item, page, openaiKey);
      auditedItems.push(result);
      
      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Build summary
    const confirmedCount = auditedItems.filter(i => i.status === 'confirmed').length;
    const correctedCount = auditedItems.filter(i => i.status === 'corrected').length;
    const removedCount = auditedItems.filter(i => i.status === 'removed').length;
    const needsReviewCount = auditedItems.filter(i => i.status === 'needs_manual_review').length;

    const messages: string[] = [];
    
    if (confirmedCount > 0) {
      messages.push(`${confirmedCount} item(s) confirmed as correct.`);
    }
    
    if (correctedCount > 0) {
      const corrected = auditedItems.filter(i => i.status === 'corrected');
      for (const item of corrected.slice(0, 3)) {
        messages.push(`Corrected: "${item.original.term}" → "${item.corrected.term}" (${item.reason.substring(0, 100)})`);
      }
      if (corrected.length > 3) {
        messages.push(`...and ${corrected.length - 3} more correction(s).`);
      }
    }
    
    if (removedCount > 0) {
      messages.push(`${removedCount} item(s) removed due to insufficient evidence.`);
    }
    
    if (needsReviewCount > 0) {
      messages.push(`⚠️ ${needsReviewCount} item(s) need manual review due to ambiguous evidence.`);
    }

    const auditSummary: AuditSummary = {
      total_items: snomed_items.length,
      confirmed_count: confirmedCount,
      corrected_count: correctedCount,
      removed_count: removedCount,
      needs_manual_review_count: needsReviewCount,
      messages_for_user: messages,
    };

    console.log('Quality gate complete:', auditSummary);

    return new Response(JSON.stringify({
      audited_items: auditedItems,
      audit_summary: auditSummary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Quality gate error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
