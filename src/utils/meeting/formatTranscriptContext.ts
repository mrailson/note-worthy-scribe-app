import { UploadedFile } from '@/types/ai4gp';

/**
 * Format uploaded context content with appropriate headings for transcript integration
 */
export const formatTranscriptContext = (
  contextType: 'agenda' | 'attendees' | 'presentation' | 'other',
  files: UploadedFile[],
  customLabel?: string
): string => {
  if (files.length === 0) return '';

  // Determine the heading based on context type
  let heading = '';
  switch (contextType) {
    case 'agenda':
      heading = 'MEETING AGENDA';
      break;
    case 'attendees':
      heading = 'ATTENDEE LIST';
      break;
    case 'presentation':
      heading = files.length === 1 ? `PRESENTATION: ${files[0].name}` : 'PRESENTATIONS';
      break;
    case 'other':
      heading = customLabel?.toUpperCase() || 'ADDITIONAL CONTEXT';
      break;
  }

  // Create decorative separator
  const separator = '═'.repeat(heading.length + 20);

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

    // Extract and format the content
    let content = file.content || '';
    
    // Remove data URL prefixes if present (for images)
    if (content.startsWith('IMAGE_DATA_URL:')) {
      content = '[Image content - visual context added to transcript]';
    } else if (content.startsWith('PDF_DATA_URL:')) {
      content = '[PDF content - document added to transcript]';
    } else if (content.startsWith('POWERPOINT_DATA_URL:')) {
      content = '[PowerPoint content - presentation added to transcript]';
    }

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
 */
export const extractCleanContent = (content: string): string => {
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
