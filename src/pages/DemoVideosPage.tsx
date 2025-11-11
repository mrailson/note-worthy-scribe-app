import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <li key={v.name} className="border border-border rounded-lg p-4 bg-background shadow-sm">
                  <h2 className="font-medium text-foreground truncate">{v.name}</h2>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                    aria-label={`Open demo video ${v.name}`}
                  >
                    Open video
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
