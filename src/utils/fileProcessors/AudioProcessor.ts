import { supabase } from '@/integrations/supabase/client';

export class AudioProcessor {
  /**
   * Transcribe an audio file using the speech-to-text edge function
   */
  static async transcribeAudio(file: File): Promise<string> {
    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);

      // Determine the audio format from file extension
      const extension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      
      console.log(`🎵 Transcribing audio file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

      // Call the speech-to-text edge function
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          format: extension,
          fileName: file.name
        }
      });

      if (error) {
        console.error('❌ Audio transcription error:', error);
        throw new Error(`Failed to transcribe audio: ${error.message}`);
      }

      if (!data?.text) {
        throw new Error('No transcription returned from audio processing');
      }

      const transcribedText = data.text.trim();
      console.log(`✅ Transcription complete: ${transcribedText.split(/\s+/).length} words`);

      // Format the output with metadata
      const durationInfo = data.duration ? ` (Duration: ${Math.round(data.duration)}s)` : '';
      
      return `AUDIO TRANSCRIPTION FROM: ${file.name}${durationInfo}

${transcribedText}

[End of audio transcription]`;

    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }
}
