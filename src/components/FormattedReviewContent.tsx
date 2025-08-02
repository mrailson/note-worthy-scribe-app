import React from 'react';
import { SafeMessageRenderer } from './SafeMessageRenderer';

interface FormattedReviewContentProps {
  content: string;
}

export const FormattedReviewContent: React.FC<FormattedReviewContentProps> = ({ content }) => {
  // Clean and format the review content
  const formatReviewContent = (text: string) => {
    // Remove the consultation score section as it's handled separately
    const reviewOnly = text.split('CONSULTATION SCORE:')[0] || text;
    
    // Split into sections and format each one
    const formatted = reviewOnly
      // Remove the detailed scoring breakdown block
      .replace(/\*\*HISTORY TAKING[\s\S]*?\*\*FINAL SCORE:\s*\*\*\[\d+\/100\]\*\*\s*\*\*/i, '')
      .replace(/\*\*HISTORY TAKING[\s\S]*?FINAL SCORE:\s*\[\d+\/100\]/i, '')
      
      // Add proper spacing around major sections
      .replace(/(\*\*[A-Z\s&]+\*\*)/g, '\n\n$1\n')
      .replace(/(=== [A-Z\s]+ ===)/g, '\n\n$1\n')
      
      // Format subsections with better spacing
      .replace(/(-\s)([A-Z][^:]+:)/g, '\n\n**$2**\n')
      .replace(/(-\s)([^:]+:)(\s*\[[^\]]+\])/g, '\n\n**$2**$3\n')
      
      // Improve bullet point formatting
      .replace(/^-\s/gm, '• ')
      .replace(/^\*\s/gm, '• ')
      
      // Add spacing around scoring brackets
      .replace(/(\[[^\]]+\])/g, ' **$1**')
      
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return formatted;
  };

  // Parse content into structured sections
  const parseReviewSections = (text: string) => {
    const sections = [];
    const cleanText = formatReviewContent(text);
    
    // Try to identify major sections
    const sectionPatterns = [
      { title: 'Overall Assessment', pattern: /^(.*?)(?=\n\n\*\*|\n\n===|$)/s },
      { title: 'Clinical Reasoning', pattern: /\*\*Clinical Reasoning\*\*(.*?)(?=\n\n\*\*|\n\n===|$)/s },
      { title: 'Documentation Quality', pattern: /\*\*Documentation\*\*(.*?)(?=\n\n\*\*|\n\n===|$)/s },
      { title: 'Safety Considerations', pattern: /\*\*Safety\*\*(.*?)(?=\n\n\*\*|\n\n===|$)/s },
      { title: 'Recommendations', pattern: /\*\*Recommendations?\*\*(.*?)(?=\n\n\*\*|\n\n===|$)/s }
    ];

    // If we can't identify clear sections, split by paragraph for better readability
    const paragraphs = cleanText.split('\n\n').filter(p => p.trim());
    
    if (paragraphs.length > 1) {
      return paragraphs.map((paragraph, index) => ({
        content: paragraph.trim(),
        isSection: paragraph.includes('**') || paragraph.includes('===')
      }));
    }
    
    return [{ content: cleanText, isSection: false }];
  };

  const sections = parseReviewSections(content);

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div 
          key={index} 
          className={`
            ${section.isSection 
              ? 'bg-background/50 p-4 rounded-lg border border-border/50' 
              : 'bg-card/30 p-3 rounded-md'
            }
          `}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <SafeMessageRenderer content={section.content} />
          </div>
        </div>
      ))}
    </div>
  );
};