import { Download, Play } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VideoPreviewPlayerProps {
  videoUrl: string;
  title: string;
}

export const VideoPreviewPlayer = ({ videoUrl, title }: VideoPreviewPlayerProps) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Video downloaded!');
  };

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Your Generated Video</CardTitle>
        <CardDescription>Preview and download your narrated presentation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Player */}
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <video
            src={videoUrl}
            controls
            className="w-full h-full"
            preload="metadata"
          >
            Your browser does not support the video element.
          </video>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleDownload}
            size="lg"
            className="flex-1"
          >
            <Download className="h-5 w-5 mr-2" />
            Download Video
          </Button>
        </div>

        {/* Info */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-1">Video Details:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Format: WebM (H.264)</li>
            <li>• Quality: 1080p</li>
            <li>• Title: {title}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
