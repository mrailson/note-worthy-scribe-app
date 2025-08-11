import { supabase } from '@/integrations/supabase/client';

export type MinutesProgressCallback = (done: number, total: number) => void;

function splitTextIntoChunks(text: string, target = 3500, overlap = 200): string[] {
  if (text.length <= target) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);
    const boundary = text.lastIndexOf('.', end);
    if (boundary > start + target * 0.6) end = boundary + 1;
    const q = text.lastIndexOf('?', end);
    const e = text.lastIndexOf('!', end);
    const best = Math.max(q, e);
    if (best > start + target * 0.6) end = best + 1;
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function dedupeBoundary(prev: string, next: string): string {
  const tail = prev.slice(-220);
  if (!tail) return next;
  const normalizedTail = tail.replace(/\s+/g, ' ').trim();
  let candidate = next;
  for (let k = 220; k >= 80; k -= 20) {
    const t = normalizedTail.slice(-k);
    const re = new RegExp('^' + t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+'));
    if (re.test(candidate.replace(/\s+/g, ' ').trim())) {
      const idx = candidate.toLowerCase().indexOf(t.toLowerCase());
      if (idx === 0) return candidate.slice(t.length).trimStart();
    }
  }
  return next;
}

function mergeSummaries(parts: string[]): string {
  if (parts.length === 0) return '';
  let out = parts[0].trim();
  for (let i = 1; i < parts.length; i++) {
    const merged = dedupeBoundary(out, parts[i]);
    out = `${out}\n\n${merged.trim()}`;
  }
  return out.trim();
}

export async function generateMinutesFast(
  transcript: string,
  opts: {
    meetingTitle: string;
    meetingDate?: string;
    meetingTime?: string;
    detailLevel?: 'headlines' | 'standard' | 'more' | 'super';
    concurrency?: number;
    chunkSize?: number;
    overlap?: number;
    onProgress?: MinutesProgressCallback;
  }
): Promise<string> {
  const {
    meetingTitle,
    meetingDate,
    meetingTime,
    detailLevel = 'standard',
    concurrency = 4,
    chunkSize = 3500,
    overlap = 200,
    onProgress,
  } = opts;

  // Small transcripts: use single existing function for compatibility
  if (transcript.length <= 7000) {
    const { data, error } = await supabase.functions.invoke('generate-meeting-minutes', {
      body: { transcript, meetingTitle, meetingDate, meetingTime, detailLevel },
    });
    if (error) throw error;
    return data?.meetingMinutes || data?.minutes || data || '';
  }

  const chunks = splitTextIntoChunks(transcript, chunkSize, overlap);
  const total = chunks.length;
  let done = 0;
  const summaries: string[] = new Array(total);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= total) break;
      try {
        const { data, error } = await supabase.functions.invoke('summarize-transcript-chunk', {
          body: {
            text: chunks[i],
            meetingTitle,
            chunkIndex: i,
            totalChunks: total,
            detailLevel,
          },
        });
        if (error) throw error;
        summaries[i] = data?.summary || '';
      } catch (e) {
        summaries[i] = chunks[i].slice(0, 2000); // fallback minimal
      } finally {
        done++;
        onProgress?.(done, total);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));

  // Merge on server for higher quality synthesis
  const { data: merged, error: mergeErr } = await supabase.functions.invoke('merge-meeting-minutes', {
    body: {
      summaries,
      meetingTitle,
      meetingDate,
      meetingTime,
      detailLevel,
    },
  });
  if (mergeErr) return mergeSummaries(summaries); // fallback client merge
  return merged?.meetingMinutes || mergeSummaries(summaries);
}
