import { supabase } from '@/integrations/supabase/client';

const MAX_BASE64_RAW_SIZE = 4 * 1024 * 1024; // 4MB raw → ~5.3MB base64

export class AudioProcessor {
  /**
   * Transcribe an audio file using the speech-to-text edge function.
   * Small files (<4MB) are sent inline as base64.
   * Larger files are uploaded to temp storage first, then processed server-side.
   */
  static async transcribeAudio(file: File): Promise<string> {
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      console.log(`🎵 Transcribing audio file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

      let data: any;
      let error: any;

      if (file.size > MAX_BASE64_RAW_SIZE) {
        // Large file path: upload to storage, then invoke process-large-audio
        console.log(`📦 File exceeds ${(MAX_BASE64_RAW_SIZE / 1024 / 1024).toFixed(0)}MB — using storage upload path`);
        const tempPath = `temp-transcribe/${crypto.randomUUID().substring(0, 8)}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('audio-imports')
          .upload(tempPath, file, { contentType: file.type || 'audio/mpeg', upsert: false });

        if (uploadError) {
          throw new Error(`Failed to upload audio for transcription: ${uploadError.message}`);
        }

        const result = await supabase.functions.invoke('speech-to-text', {
          body: {
            action: 'process-large-audio',
            storagePath: tempPath,
            fileName: file.name,
          }
        });
        data = result.data;
        error = result.error;
      } else {
        // Small file path: send as base64
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        const result = await supabase.functions.invoke('speech-to-text', {
          body: {
            audio: base64Audio,
            mimeType: file.type || `audio/${extension}`,
            format: extension,
            fileName: file.name
          }
        });
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ Audio transcription error:', error);
        throw new Error(`Failed to transcribe audio: ${error.message}`);
      }

      if (!data?.text) {
        throw new Error('No transcription returned from audio processing');
      }

      const transcribedText = data.text.trim();
      console.log(`✅ Transcription complete: ${transcribedText.split(/\s+/).length} words`);

      const durationInfo = data.duration ? ` (Duration: ${Math.round(data.duration)}s)` : '';
      
      return `AUDIO TRANSCRIPTION FROM: ${file.name}${durationInfo}\n\n${transcribedText}\n\n[End of audio transcription]`;

    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }
}
