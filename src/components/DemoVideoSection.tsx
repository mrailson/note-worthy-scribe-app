import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play } from 'lucide-react';

export const DemoVideoSection: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('demo-videos')
          .list();
        
        if (data && data.length > 0) {
          const videoFile = data[0];
          const { data: urlData } = supabase.storage
            .from('demo-videos')
            .getPublicUrl(videoFile.name);
          setVideoUrl(urlData.publicUrl);
        }
      } catch (error) {
        console.error('Error fetching demo video:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, []);

  if (loading || !videoUrl) return null;

  return (
    <section className="mb-8 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-foreground mb-1">
          See Notewell AI in Action
        </h2>
        <p className="text-sm text-muted-foreground">
          Watch our quick demo
        </p>
      </div>
      
      <div className="flex justify-center">
        <div className="relative max-w-md w-full rounded-lg overflow-hidden shadow-lg border border-border">
          <video 
            controls
            preload="auto"
            className="w-full h-auto"
            controlsList="nodownload"
          >
            <source src={videoUrl} type="video/mp4" />
            <source src={videoUrl} type="video/webm" />
            <source src={videoUrl} type="video/quicktime" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
};
