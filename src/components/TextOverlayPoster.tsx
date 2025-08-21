import React from 'react';
import { cn } from '@/lib/utils';

interface TextOverlayPosterProps {
  backgroundImage: string;
  headline: string;
  body: string;
  size: string;
  className?: string;
}

export const TextOverlayPoster: React.FC<TextOverlayPosterProps> = ({
  backgroundImage,
  headline,
  body,
  size,
  className
}) => {
  // Parse dimensions and layout based on size
  const isA4Portrait = size === "A4 Portrait";
  const isA4Landscape = size === "A4 Landscape";
  const isSquare = size === "Square 1024";
  
  // Set container dimensions (scaled down for preview)
  const containerClass = isA4Portrait 
    ? "w-[600px] h-[848px]" 
    : isA4Landscape 
    ? "w-[848px] h-[600px]"
    : "w-[600px] h-[600px]";

  // Parse headline and body from the text
  const cleanHeadline = headline.replace('Headline: ', '');
  const cleanBody = body.replace('Body:\n', '').replace('Body:', '');

  return (
    <div className={cn("relative bg-white shadow-lg overflow-hidden", containerClass, className)}>
      {/* AI-generated background image */}
      <img 
        src={backgroundImage} 
        alt="AI generated layout background"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Text overlay container with backdrop for readability */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[0.5px]">
        
        {/* Headline positioning */}
        <div className={cn(
          "absolute text-black font-bold leading-tight",
          isA4Portrait && "top-16 left-12 right-12 text-3xl",
          isA4Landscape && "top-12 left-16 right-16 text-2xl",
          isSquare && "top-12 left-8 right-8 text-2xl"
        )}>
          <div className="bg-white/95 px-4 py-2 rounded shadow-sm">
            {cleanHeadline}
          </div>
        </div>

        {/* Body text positioning */}
        <div className={cn(
          "absolute text-black leading-relaxed whitespace-pre-line",
          isA4Portrait && "top-32 left-12 right-12 text-lg",
          isA4Landscape && "top-24 left-16 right-16 text-base",
          isSquare && "top-24 left-8 right-8 text-base"
        )}>
          <div className="bg-white/95 px-4 py-3 rounded shadow-sm">
            {cleanBody}
          </div>
        </div>

        {/* NHS branding footer */}
        <div className={cn(
          "absolute bottom-4 right-4 text-xs text-black/70",
        )}>
          <div className="bg-white/90 px-2 py-1 rounded text-right">
            NHS Practice Communications
          </div>
        </div>
      </div>
    </div>
  );
};