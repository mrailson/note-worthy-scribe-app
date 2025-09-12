/**
 * Utility function to strip markdown formatting from text
 * Removes common markdown patterns while preserving readable text
 */
export function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove HTML tags first
    .replace(/<[^>]*>/g, '')
    
    // Remove markdown headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    
    // Remove bold and italic markers (** __ * _)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    
    // Remove strikethrough (~~text~~)
    .replace(/~~([^~]+)~~/g, '$1')
    
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    
    // Remove links but keep text [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    
    // Remove images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    
    // Remove list markers (- * +)
    .replace(/^\s*[-*+]\s+/gm, '')
    
    // Remove numbered lists
    .replace(/^\s*\d+\.\s+/gm, '')
    
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Copy plain text to clipboard (strips markdown formatting)
 */
export async function copyPlainTextToClipboard(text: string, successMessage = 'Copied to clipboard'): Promise<boolean> {
  try {
    const plainText = stripMarkdown(text);
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
