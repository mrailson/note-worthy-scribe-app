import { UploadedFile } from '@/types/ai4gp';

/**
 * Add meeting metadata header to transcript
 */
export const addMeetingMetadataToTranscript = (
  transcript: string,
  meetingData: {
    startTime?: string;
    endTime?: string;
    duration?: string;
  }
): string => {
  if (!meetingData.startTime) {
    return transcript;
  }

  const startDate = new Date(meetingData.startTime);
  const meetingDate = startDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const startTimeFormatted = startDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate end time and duration
  let endTimeFormatted = '';
  let durationFormatted = '';
  
  if (meetingData.endTime) {
    const endDate = new Date(meetingData.endTime);
    endTimeFormatted = endDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Calculate duration in hours and minutes
    const durationMs = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      durationFormatted = `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      durationFormatted = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  } else if (meetingData.duration) {
    // Use existing duration string if available
    durationFormatted = meetingData.duration;
  }

  const separator = '═'.repeat(60);
  let metadata = '\n' + separator + '\n';
  metadata += 'MEETING METADATA\n';
  metadata += separator + '\n';
  metadata += `Transcript Date: ${meetingDate}\n`;
  metadata += `Transcript Start Time: ${startTimeFormatted}\n`;
  
  if (endTimeFormatted) {
    metadata += `Meeting End Time: ${endTimeFormatted}\n`;
  }
  
  if (durationFormatted) {
    metadata += `Total Meeting Length: ${durationFormatted}\n`;
  }
  
  metadata += separator + '\n\n';

  return metadata + transcript;
};

/**
 * Format uploaded context content with appropriate headings for transcript integration
 */
export const formatTranscriptContext = (
  contextTypes: Array<'agenda' | 'attendees' | 'presentation' | 'other'>,
  files: UploadedFile[],
  customLabel?: string
): string => {
  if (files.length === 0) return '';

  // Determine the heading(s) based on context types
  let headings: string[] = [];
  contextTypes.forEach(contextType => {
    switch (contextType) {
      case 'agenda':
        headings.push('MEETING AGENDA');
        break;
      case 'attendees':
        headings.push('ATTENDEE LIST');
        break;
      case 'presentation':
        headings.push(files.length === 1 ? `PRESENTATION: ${files[0].name}` : 'PRESENTATIONS');
        break;
      case 'other':
        headings.push(customLabel?.toUpperCase() || 'ADDITIONAL CONTEXT');
        break;
    }
  });

  const heading = headings.join(' & ');
  
  // Create decorative separator
  const separator = '═'.repeat(Math.max(heading.length + 20, 60));

  // Build the formatted content
  let formattedContent = '\n\n';
  formattedContent += separator + '\n';
  formattedContent += heading + '\n';
  formattedContent += separator + '\n\n';

  // Add each file's content
  files.forEach((file, index) => {
    if (files.length > 1) {
      // If multiple files, add file name headers
      formattedContent += `--- ${file.name} ---\n\n`;
    }

    // The content should already be extracted text from the file processors
    let content = file.content || '';
    
    formattedContent += content.trim();
    
    if (index < files.length - 1) {
      formattedContent += '\n\n';
    }
  });

  formattedContent += '\n' + separator + '\n';

  return formattedContent;
};

/**
 * Extract clean text from file processors that might include metadata
 * Also detects and warns about failed image extractions
 */
export const extractCleanContent = (content: string): string => {
  // Check for failed image extraction patterns
  const failedImagePatterns = [
    /^\[Image:.*- OCR failed.*\]$/,
    /^\[Image:.*- No text found\]$/,
    /^\[Image:.*- Processing failed\]$/
  ];
  
  for (const pattern of failedImagePatterns) {
    if (pattern.test(content.trim())) {
      console.warn('Image extraction failed or found no text:', content);
      // Return empty string for failed extractions so they can be detected
      return '';
    }
  }
  
  // Remove common file processor metadata headers
  const patterns = [
    /^TEXT FILE CONTENT FROM:.*?\n\n/s,
    /^WORD DOCUMENT CONTENT FROM:.*?\n\n/s,
    /^EXCEL SPREADSHEET CONTENT FROM:.*?\n\n/s,
    /\[Plain text file\]$/,
    /\[Extracted using.*?\]$/
  ];

  let cleanContent = content;
  patterns.forEach(pattern => {
    cleanContent = cleanContent.replace(pattern, '');
  });

  return cleanContent.trim();
};
