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
    <section className="mb-12 animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          See Notewell AI in Action
        </h2>
        <p className="text-muted-foreground">
          Watch how Notewell AI streamlines practice management and enhances patient care
        </p>
      </div>
      
      <div className="relative max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-border">
        <video 
          controls
          preload="metadata"
          className="w-full"
          poster="/placeholder.svg"
        >
          <source src={videoUrl} type="video/mp4" />
          <source src={videoUrl} type="video/webm" />
          <source src={videoUrl} type="video/quicktime" />
          Your browser does not support the video tag.
        </video>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
          <div className="bg-primary/80 rounded-full p-6">
            <Play className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>
      </div>
    </section>
  );
};
