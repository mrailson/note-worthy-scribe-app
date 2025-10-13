import { UploadedFile } from '@/types/ai4gp';

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
