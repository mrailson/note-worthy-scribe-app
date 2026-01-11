import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Presentation, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GeneratedPresentation } from '@/types/ai4gp';

interface PowerPointDownloadCardProps {
  presentation: GeneratedPresentation;
}

export const PowerPointDownloadCard: React.FC<PowerPointDownloadCardProps> = ({ presentation }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const fileName = `${presentation.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.pptx`;
      
      // Prefer direct download URL from Gamma (avoids memory issues with large files)
      if (presentation.downloadUrl) {
        console.log('[PowerPointDownloadCard] Using direct download URL');
        const a = document.createElement('a');
        a.href = presentation.downloadUrl;
        a.download = fileName;
        a.target = '_blank'; // Open in new tab as fallback
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('PowerPoint downloaded successfully!');
        return;
      }
      
      // Legacy fallback: Convert base64 to blob
      if (presentation.pptxBase64) {
        console.log('[PowerPointDownloadCard] Using legacy base64 data');
        const byteCharacters = atob(presentation.pptxBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { 
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
        });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('PowerPoint downloaded successfully!');
        return;
      }
      
      throw new Error('No download data available');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PowerPoint');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="mt-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Presentation className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">{presentation.title}</CardTitle>
            <CardDescription className="text-sm">
              PowerPoint Presentation
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">
            {presentation.slideCount} slides
          </Badge>
          <Badge variant="outline" className="text-xs">
            {presentation.presentationType}
          </Badge>
          {presentation.sourceFiles && presentation.sourceFiles.length > 0 && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {presentation.sourceFiles.length} source{presentation.sourceFiles.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {presentation.sourceFiles && presentation.sourceFiles.length > 0 && (
          <div className="text-xs text-muted-foreground mb-3">
            <span className="font-medium">Sources:</span>{' '}
            {presentation.sourceFiles.slice(0, 3).join(', ')}
            {presentation.sourceFiles.length > 3 && ` +${presentation.sourceFiles.length - 3} more`}
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleDownload} 
            disabled={isDownloading}
            className="w-full gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing download...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PowerPoint
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
