/**
 * Text transformation utilities for meeting notes editing
 */

/**
 * Remove all types of quotation marks from text
 */
export const removeQuotes = (text: string): string => {
  return text
    .replace(/[""]/g, '') // Smart double quotes
    .replace(/['']/g, '') // Smart single quotes
    .replace(/["']/g, '') // Regular quotes
    .trim();
};

/**
 * Strip markdown formatting from text
 */
export const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/~~(.*?)~~/g, '$1') // Strikethrough
    .replace(/`(.*?)`/g, '$1') // Inline code
    .replace(/^#{1,6}\s+/gm, '') // Headers
    .replace(/^[-*+]\s+/gm, '') // Bullet points
    .replace(/^\d+\.\s+/gm, '') // Numbered lists
    .trim();
};

/**
 * Capitalise first letter of each sentence
 */
export const capitaliseSentences = (text: string): string => {
  return text.replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
};

/**
 * Convert text to title case
 */
export const toTitleCase = (text: string): string => {
  const minorWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet'];
  
  return text
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index === 0 || !minorWords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
};

/**
 * Clean up excessive whitespace
 */
export const normaliseWhitespace = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
