import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Copy, Download, Sparkles } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { StyleDefinition } from './types';
import { stripMarkdown } from '@/utils/stripMarkdown';
import { renderMinutesMarkdown } from '@/lib/minutesRenderer';

interface StyleCardProps {
  style: StyleDefinition;
  content: string | null;
  isLoading: boolean;
  isCurrentStyle?: boolean;
  onView: (content: string, styleName: string) => void;
  onCopy: (content: string) => void;
  onExport: (content: string, styleName: string) => void;
}

export const StyleCard = ({
  style,
  content,
  isLoading,
  isCurrentStyle,
  onView,
  onCopy,
  onExport
}: StyleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    if (content) {
      const plainText = stripMarkdown(content);
      navigator.clipboard.writeText(plainText);
      onCopy(content);
      showToast.success('Copied to clipboard', { section: 'meeting_manager' });
    }
  };

  if (isLoading || !content) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{style.icon}</span>
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <Skeleton className="h-full w-full" />
        </CardContent>
        <CardFooter className="pt-3">
          <Skeleton className="h-9 w-full" />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card
      className={`h-full flex flex-col transition-all ${
        isCurrentStyle ? 'ring-2 ring-primary' : ''
      } ${isHovered ? 'shadow-lg' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <span className="text-2xl flex-shrink-0">{style.icon}</span>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              {style.name}
              {isCurrentStyle && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {style.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden pb-3">
        <ScrollArea className="h-full max-h-[300px] w-full rounded-md border bg-background p-4">
          <div 
            className="text-xs sm:text-sm max-w-none"
            style={{ fontSize: '11px', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ 
              __html: renderMinutesMarkdown(content.substring(0, 800)) 
            }}
          />
          {content.length > 800 && (
            <p className="text-muted-foreground italic text-xs mt-3">... (preview truncated)</p>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="pt-3 flex flex-col sm:flex-row gap-2">
        <Button
          onClick={() => onView(content, style.name)}
          variant="outline"
          size="sm"
          className="w-full sm:flex-1"
        >
          <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          View Full
        </Button>
        <Button
          onClick={handleCopy}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
        <Button
          onClick={() => onExport(content, style.name)}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          <Download className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};
