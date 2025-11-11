import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { supabase } from '@/integrations/supabase/client';
import { Play } from 'lucide-react';

interface DemoVideo {
  name: string;
  url: string;
}

const DemoVideosPage: React.FC = () => {
  const [videos, setVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('demo-videos')
          .list();
        if (error) throw error;
        const items = (data || []).map((file) => {
          const { data: urlData } = supabase.storage
            .from('demo-videos')
            .getPublicUrl(file.name);
          return { name: file.name, url: urlData.publicUrl };
        });
        setVideos(items);
      } catch (e) {
        console.error('Error loading demo videos', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <Helmet>
        <title>Demo Videos | Notewell AI</title>
        <meta name="description" content="Watch Notewell AI demo videos showcasing features and workflows." />
        <link rel="canonical" href="/demos" />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Demo Videos</h1>
          <p className="text-muted-foreground mt-1">Explore short demos of Notewell AI features.</p>
        </header>

        <section aria-label="Demo video list">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading videos…</div>
          ) : videos.length === 0 ? (
            <div className="text-center text-muted-foreground">No demos available yet.</div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <li key={v.name} className="group">
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="block" aria-label={`Open demo video ${v.name} in a new tab`}>
                    <div className="relative rounded-lg overflow-hidden bg-muted aspect-video shadow-lg hover:shadow-xl transition-shadow">
                      <video
                        src={v.url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/90 group-hover:bg-primary group-hover:scale-110 transition-all flex items-center justify-center shadow-lg">
                          <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                    <h2 className="mt-3 font-medium text-foreground line-clamp-2">{v.name}</h2>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
};

export default DemoVideosPage;
