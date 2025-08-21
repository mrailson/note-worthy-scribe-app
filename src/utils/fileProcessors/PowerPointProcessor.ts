export class PowerPointProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      // For now, we'll convert to data URL and let the edge function handle PPT processing
      // Future enhancement could use a client-side library like officegen or pptx-parser
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:application/vnd.ms-powerpoint;base64,${base64}`;
      
      return `POWERPOINT_DATA_URL:${dataUrl}`;
      
    } catch (error) {
      console.error('PowerPoint processing error:', error);
      throw new Error(`Failed to process PowerPoint file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}