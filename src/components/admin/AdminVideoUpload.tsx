import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const AdminVideoUpload: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);

  const checkExistingVideo = async () => {
    const { data, error } = await supabase.storage
      .from('demo-videos')
      .list();
    
    if (data && data.length > 0) {
      const videoFile = data[0];
      const { data: urlData } = supabase.storage
        .from('demo-videos')
        .getPublicUrl(videoFile.name);
      setCurrentVideo(urlData.publicUrl);
    }
  };

  React.useEffect(() => {
    checkExistingVideo();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Please upload a video file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Delete existing video first
      const { data: existingFiles } = await supabase.storage
        .from('demo-videos')
        .list();
      
      if (existingFiles && existingFiles.length > 0) {
        await Promise.all(
          existingFiles.map(f => 
            supabase.storage.from('demo-videos').remove([f.name])
          )
        );
      }

      // Upload new video with original filename
      const { data, error } = await supabase.storage
        .from('demo-videos')
        .upload(file.name, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('demo-videos')
        .getPublicUrl(file.name);

      setCurrentVideo(urlData.publicUrl);
      setUploadProgress(100);
      toast.success('Demo video uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo Video Upload</CardTitle>
        <CardDescription>
          Upload the demo video for the homepage (max 50MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentVideo && (
          <div className="space-y-2">
            <div className="flex items-center text-sm text-green-600">
              <Check className="h-4 w-4 mr-2" />
              Video currently uploaded
            </div>
            <video 
              src={currentVideo} 
              controls 
              className="w-full max-w-md rounded-lg border"
            />
          </div>
        )}

        <div>
          <input
            type="file"
            id="video-upload"
            accept="video/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <label htmlFor="video-upload">
            <Button
              type="button"
              disabled={uploading}
              className="cursor-pointer"
              onClick={() => document.getElementById('video-upload')?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {currentVideo ? 'Replace Video' : 'Upload Video'}
                </>
              )}
            </Button>
          </label>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Supported formats: MP4, WebM, QuickTime, AVI</p>
          <p>• Maximum file size: 50MB</p>
          <p>• Recommended resolution: 1920x1080 or 1280x720</p>
        </div>
      </CardContent>
    </Card>
  );
};
