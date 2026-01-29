import JSZip from 'jszip';

export class PowerPointProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const slideTexts: string[] = [];
      
      // Get all slide files (pptx stores slides as slide1.xml, slide2.xml, etc.)
      const slideFiles = Object.keys(zip.files)
        .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
          const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
          return numA - numB;
        });
      
      for (const slidePath of slideFiles) {
        const slideContent = await zip.files[slidePath].async('string');
        const slideText = this.extractTextFromSlideXml(slideContent);
        if (slideText.trim()) {
          const slideNum = slidePath.match(/slide(\d+)\.xml$/)?.[1] || '?';
          slideTexts.push(`--- Slide ${slideNum} ---\n${slideText}`);
        }
      }
      
      // Also try to extract from notes if present
      const notesFiles = Object.keys(zip.files)
        .filter(name => name.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/notesSlide(\d+)\.xml$/)?.[1] || '0');
          const numB = parseInt(b.match(/notesSlide(\d+)\.xml$/)?.[1] || '0');
          return numA - numB;
        });
      
      const notesTexts: string[] = [];
      for (const notesPath of notesFiles) {
        const notesContent = await zip.files[notesPath].async('string');
        const notesText = this.extractTextFromSlideXml(notesContent);
        if (notesText.trim()) {
          const slideNum = notesPath.match(/notesSlide(\d+)\.xml$/)?.[1] || '?';
          notesTexts.push(`[Notes for Slide ${slideNum}]: ${notesText}`);
        }
      }
      
      let result = slideTexts.join('\n\n');
      
      if (notesTexts.length > 0) {
        result += '\n\n--- Speaker Notes ---\n' + notesTexts.join('\n');
      }
      
      if (!result.trim()) {
        throw new Error('No text content found in PowerPoint file');
      }
      
      console.log(`📊 Extracted ${slideTexts.length} slides from PowerPoint`);
      return result;
      
    } catch (error) {
      console.error('Error extracting text from PowerPoint:', error);
      throw new Error(`Failed to extract text from PowerPoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private static extractTextFromSlideXml(xml: string): string {
    // Remove XML declaration and namespaces for easier parsing
    const textParts: string[] = [];
    
    // Extract text from <a:t> tags (text runs in PowerPoint XML)
    const textMatches = xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    for (const match of textMatches) {
      if (match[1].trim()) {
        textParts.push(match[1]);
      }
    }
    
    // Also check for <p:txBody> patterns and extract text
    const bodyMatches = xml.matchAll(/<a:r[^>]*>.*?<a:t[^>]*>([^<]*)<\/a:t>.*?<\/a:r>/gs);
    for (const match of bodyMatches) {
      // Already captured above, skip duplicates
    }
    
    // Join with appropriate spacing
    let result = '';
    let lastWasText = false;
    
    for (const part of textParts) {
      if (part.trim()) {
        if (lastWasText) {
          // Check if this looks like a continuation or new line
          result += ' ' + part.trim();
        } else {
          result += (result ? '\n' : '') + part.trim();
        }
        lastWasText = true;
      } else {
        lastWasText = false;
      }
    }
    
    return result;
  }
}
