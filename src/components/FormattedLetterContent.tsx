import React from 'react';
import { parseLetterContent, FormattedContent } from '@/utils/letterFormatter';

interface FormattedLetterContentProps {
  content: string;
}

export const FormattedLetterContent: React.FC<FormattedLetterContentProps> = ({ content }) => {
  const formattedContent = parseLetterContent(content);
  
  const renderFormattedContent = (content: FormattedContent[]): JSX.Element[] => {
    const elements: JSX.Element[] = [];
    let currentParagraph: JSX.Element[] = [];
    let paragraphKey = 0;

    content.forEach((item, index) => {
      if (item.type === 'text' && item.content === '\n') {
        // End current paragraph
        if (currentParagraph.length > 0) {
          elements.push(
            <p key={paragraphKey} className="mb-4 leading-relaxed">
              {currentParagraph}
            </p>
          );
          currentParagraph = [];
          paragraphKey++;
        } else {
          // Empty line for spacing
          elements.push(<br key={`br-${index}`} />);
        }
      } else if (item.type === 'bold') {
        currentParagraph.push(
          <strong key={`bold-${index}`} className="font-semibold">
            {item.content}
          </strong>
        );
      } else if (item.type === 'text') {
        const text = item.content.replace('\n', '');
        if (text) {
          currentParagraph.push(
            <span key={`text-${index}`}>{text}</span>
          );
        }
      }
    });

    // Add any remaining paragraph
    if (currentParagraph.length > 0) {
      elements.push(
        <p key={paragraphKey} className="mb-4 leading-relaxed">
          {currentParagraph}
        </p>
      );
    }

    return elements;
  };

  return (
    <div className="font-nhs text-sm leading-relaxed">
      {renderFormattedContent(formattedContent)}
    </div>
  );
};