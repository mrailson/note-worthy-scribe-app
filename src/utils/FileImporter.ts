import mammoth from "mammoth";

export interface ImportedTranscript {
  content: string;
  meetingTitle?: string;
  duration?: string;
  wordCount: number;
  extractedSettings?: {
    title: string;
    description: string;
    attendees: string;
    agenda: string;
    date: string;
  };
}

export class FileImporter {
  static async importTranscriptFile(file: File): Promise<ImportedTranscript> {
    console.log('📄 Starting transcript import for file:', file.name, `(${(file.size / 1024).toFixed(1)}KB)`);
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      switch (fileExtension) {
        case 'txt':
          return this.importTextFile(file);
        case 'doc':
        case 'docx':
          return this.importWordFile(file);
        case 'pdf':
          return this.importPdfFile(file);
        default:
          throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: .txt, .doc, .docx, .pdf`);
      }
    } catch (error) {
      console.error('❌ Error importing transcript file:', error);
      throw error;
    }
  }

  private static async importTextFile(file: File): Promise<ImportedTranscript> {
    console.log('📝 Processing text file...');
    const text = await file.text();
    
    if (!text.trim()) {
      throw new Error('The selected text file appears to be empty');
    }
    
    return this.processTranscriptContent(text, file.name);
  }

  private static async importWordFile(file: File): Promise<ImportedTranscript> {
    console.log('📄 Processing Word document...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (!result.value.trim()) {
        throw new Error('The Word document appears to be empty or contains no readable text');
      }
      
      return this.processTranscriptContent(result.value, file.name);
    } catch (error) {
      console.error('❌ Failed to parse Word document:', error);
      throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async importPdfFile(file: File): Promise<ImportedTranscript> {
    try {
      // Basic text extraction for PDFs - prompts user to copy/paste text
      const fileSize = (file.size / 1024 / 1024).toFixed(2);
      throw new Error(`PDF import requires manual extraction. Please:
1. Open your PDF file (${file.name}, ${fileSize}MB)
2. Select all text (Ctrl+A or Cmd+A)
3. Copy the text (Ctrl+C or Cmd+C)
4. Use "Paste from Clipboard" instead

For automatic PDF processing, please convert to .txt, .doc, or .docx format.`);
    } catch (error) {
      throw error;
    }
  }

  private static processTranscriptContent(content: string, fileName: string): ImportedTranscript {
    console.log('🔍 Processing transcript content...');
    
    if (!content.trim()) {
      throw new Error('The imported file contains no readable text content');
    }
    
    const lines = content.split('\n').filter(line => line.trim());
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

    console.log(`📊 Extracted ${wordCount} words from ${lines.length} lines`);

    // Extract metadata from the beginning of the file
    let meetingTitle = '';
    let duration = '';
    let extractedSettings = {
      title: '',
      description: '',
      attendees: '',
      agenda: '',
      date: new Date().toISOString().split('T')[0]
    };

    // Look for common patterns in the first few lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      const originalLine = lines[i];
      
      if (line.includes('meeting:') || line.includes('title:')) {
        meetingTitle = originalLine.split(':')[1]?.trim() || '';
        extractedSettings.title = meetingTitle;
        console.log('📋 Found meeting title:', meetingTitle);
      }
      
      if (line.includes('duration:') || line.includes('time:')) {
        const durationMatch = originalLine.match(/(\d{1,2}):(\d{2})/);
        if (durationMatch) {
          duration = `${durationMatch[1].padStart(2, '0')}:${durationMatch[2]}`;
          console.log('⏱️ Found duration:', duration);
        }
      }
      
      if (line.includes('attendees:') || line.includes('participants:')) {
        extractedSettings.attendees = originalLine.split(':')[1]?.trim() || '';
        console.log('👥 Found attendees:', extractedSettings.attendees);
      }
      
      if (line.includes('agenda:')) {
        extractedSettings.agenda = originalLine.split(':')[1]?.trim() || '';
        console.log('📝 Found agenda:', extractedSettings.agenda);
      }
      
      if (line.includes('date:')) {
        const dateStr = originalLine.split(':')[1]?.trim();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            extractedSettings.date = parsedDate.toISOString().split('T')[0];
            console.log('📅 Found date:', extractedSettings.date);
          }
        }
      }
    }

    // If no title found, use filename without extension
    if (!meetingTitle) {
      meetingTitle = fileName.replace(/\.[^/.]+$/, '');
      extractedSettings.title = meetingTitle;
      console.log('📋 Using filename as title:', meetingTitle);
    }

    // Clean the content to remove metadata lines and get pure transcript
    let cleanContent = content;
    const metadataPatterns = [
      /^meeting:\s*.+$/gmi,
      /^title:\s*.+$/gmi,
      /^duration:\s*.+$/gmi,
      /^attendees:\s*.+$/gmi,
      /^participants:\s*.+$/gmi,
      /^agenda:\s*.+$/gmi,
      /^date:\s*.+$/gmi,
      /^---+$/gm
    ];

    metadataPatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, '');
    });

    cleanContent = cleanContent.trim();
    
    if (!cleanContent) {
      throw new Error('After processing, no transcript content was found. The file may only contain metadata.');
    }

    console.log('✅ Transcript processing complete');

    return {
      content: cleanContent,
      meetingTitle,
      duration,
      wordCount,
      extractedSettings
    };
  }
}