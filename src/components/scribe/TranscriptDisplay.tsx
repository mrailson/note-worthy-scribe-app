import React, { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface TranscriptDisplayProps {
  transcript: string;
  isLoading?: boolean;
}

/**
 * Beautifully formatted transcript display with elegant typography
 * and intelligent paragraph/speaker detection
 */
export function TranscriptDisplay({ transcript, isLoading }: TranscriptDisplayProps) {
  // Parse transcript into paragraphs and detect speakers
  const formattedContent = useMemo(() => {
    if (!transcript) return [];

    // Split by double newlines or detect natural paragraph breaks
    const paragraphs = transcript
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // If no paragraph breaks, try to split by sentences for readability
    if (paragraphs.length === 1 && transcript.length > 500) {
      // Split long text into chunks of ~3-4 sentences
      const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
      const chunks: string[] = [];
      let currentChunk = '';
      
      sentences.forEach((sentence, i) => {
        currentChunk += sentence;
        // Create a new paragraph every 3-4 sentences or at natural breaks
        if ((i + 1) % 4 === 0 || sentence.includes('Doctor:') || sentence.includes('Patient:')) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      });
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      return chunks.length > 1 ? chunks : paragraphs;
    }

    return paragraphs;
  }, [transcript]);

  // Format a paragraph with speaker styling
  const formatParagraph = (text: string) => {
    // Detect and style speaker labels
    const speakerPatterns = [
      { pattern: /(Doctor:|Clinician:|GP:|Dr\.?:)/gi, className: 'font-semibold text-primary' },
      { pattern: /(Patient:|Client:)/gi, className: 'font-medium italic text-foreground/80' },
      { pattern: /(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/gi, className: 'text-xs text-muted-foreground font-sans' },
    ];

    let formattedText = text;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Find all matches and their positions
    const matches: { index: number; length: number; text: string; className: string }[] = [];
    
    speakerPatterns.forEach(({ pattern, className }) => {
      let match;
      const regex = new RegExp(pattern);
      const globalRegex = new RegExp(pattern.source, 'gi');
      
      while ((match = globalRegex.exec(text)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0],
          className,
        });
      }
    });

    // Sort matches by position
    matches.sort((a, b) => a.index - b.index);

    // Build elements array
    matches.forEach((match, i) => {
      // Add text before this match
      if (match.index > lastIndex) {
        elements.push(text.slice(lastIndex, match.index));
      }
      // Add styled match
      elements.push(
        <span key={i} className={match.className}>
          {match.text}
        </span>
      );
      lastIndex = match.index + match.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements.length > 0 ? elements : text;
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[85%]" />
          </div>
        ))}
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="p-6 md:p-8 text-center text-muted-foreground italic">
        No transcript available
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <div 
          className="font-serif text-[1.05rem] md:text-lg leading-[1.85] tracking-wide text-foreground/90"
          style={{ fontFamily: "'EB Garamond', Georgia, 'Times New Roman', serif" }}
        >
          {formattedContent.map((paragraph, index) => (
            <p 
              key={index} 
              className="mb-6 last:mb-0"
            >
              {formatParagraph(paragraph)}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
