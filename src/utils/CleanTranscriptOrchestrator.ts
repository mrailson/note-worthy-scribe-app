import { supabase } from '@/integrations/supabase/client';
import { transcriptCleaner } from '@/utils/TranscriptCleaner';

export type ProgressCallback = (done: number, total: number) => void;

function splitTextIntoChunks(text: string, target = 3500, overlap = 200): string[] {
  if (text.length <= target) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);

    // try to end on a sentence boundary
    const boundary = text.lastIndexOf('.', end);
    if (boundary > start + target * 0.6) {
      end = boundary + 1;
    } else {
      const q = text.lastIndexOf('?', end);
      const e = text.lastIndexOf('!', end);
      const best = Math.max(q, e);
      if (best > start + target * 0.6) end = best + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function dedupeBoundary(prev: string, next: string): string {
  // Remove duplicated overlap from start of next if present
  const tail = prev.slice(-220);
  if (!tail) return next;
  const normalizedTail = tail.replace(/\s+/g, ' ').trim();
  let candidate = next;
  for (let k = 220; k >= 80; k -= 20) {
    const t = normalizedTail.slice(-k);
    const re = new RegExp('^' + escapeRegExp(t).replace(/\s+/g, '\\s+'));
    if (re.test(candidate.replace(/\s+/g, ' ').trim())) {
      // strip the matching prefix (approximate)
      const idx = candidate.toLowerCase().indexOf(t.toLowerCase());
      if (idx === 0) {
        return candidate.slice(t.length).trimStart();
      }
    }
  }
  return next;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeCleanedChunks(chunks: string[]): string {
  if (chunks.length === 0) return '';
  let out = chunks[0].trim();
  for (let i = 1; i < chunks.length; i++) {
    const cleanedNext = dedupeBoundary(out, chunks[i]);
    out = `${out}\n\n${cleanedNext.trim()}`;
  }
  return out.trim();
}

export async function cleanLargeTranscript(
  rawTranscript: string,
  meetingTitle: string,
  onProgress?: ProgressCallback,
  options: { concurrency?: number; chunkSize?: number; overlap?: number } = {}
): Promise<string> {
  const { concurrency = 3, chunkSize = 3500, overlap = 200 } = options;

  // Small transcripts: use existing single-call function
  if (rawTranscript.length <= 7000) {
    const { data, error } = await supabase.functions.invoke('clean-transcript', {
      body: { rawTranscript, meetingTitle },
    });
    if (error) throw error;
    return data?.cleanedTranscript || data?.transcript || '';
  }

  const chunks = splitTextIntoChunks(rawTranscript, chunkSize, overlap);
  const total = chunks.length;
  let done = 0;
  const results: string[] = new Array(total);

  // Simple concurrency pool
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= total) break;
      try {
        const { data, error } = await supabase.functions.invoke('clean-transcript-chunk', {
          body: { text: chunks[i], meetingTitle, chunkIndex: i, totalChunks: total },
        });
        if (error) throw error;
        results[i] = (data?.cleanedChunk as string) || '';
      } catch (e) {
        // Fallback to local rule-based cleaner if AI fails
        try {
          results[i] = transcriptCleaner.cleanFinal(chunks[i]);
        } catch {
          results[i] = chunks[i];
        }
      } finally {
        done++;
        onProgress?.(done, total);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  return mergeCleanedChunks(results);
}
