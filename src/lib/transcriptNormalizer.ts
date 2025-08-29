type OldShape = { text?: string };
type WhisperVerbose = { 
  ok?: boolean; 
  data?: { 
    text?: string; 
    segments?: Array<{start:number;end:number;text:string}> 
  } 
};
type Unified = { 
  text: string; 
  segments?: Array<{start:number;end:number;text:string}> 
};

export function normalizeTranscript(payload: unknown): Unified {
  // Handle new verbose_json format from chunked transcriber
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const whisperPayload = payload as WhisperVerbose;
    const data = whisperPayload.data;
    
    if (data?.segments?.length) {
      return {
        text: data.segments.map(s => s.text).join(' ').trim(),
        segments: data.segments
      };
    }
    
    if (data?.text) {
      return { text: data.text.trim() };
    }
  }
  
  // Handle old base64 JSON format
  if (payload && typeof payload === 'object' && 'text' in payload) {
    const oldPayload = payload as OldShape;
    return { text: (oldPayload.text || '').trim() };
  }
  
  // Fallback for string responses
  if (typeof payload === 'string') {
    return { text: payload.trim() };
  }
  
  return { text: '' };
}