import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const DemoVideoPlayerPage: React.FC = () => {
  const { name } = useParams();
  const fileName = useMemo(() => decodeURIComponent(name || ''), [name]);
  const { data: urlData } = supabase.storage.from('demo-videos').getPublicUrl(fileName);
  const url = urlData.publicUrl;

  return (
    <>
      <Helmet>
        <title>{`Watch: ${fileName} | Notewell AI Demos`}</title>
        <meta name="description" content={`Watch demo video: ${fileName} from Notewell AI.`} />
        <link rel="canonical" href={`/demos/watch/${encodeURIComponent(fileName)}`} />
      </Helmet>
      <main className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">{fileName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Demo video playback</p>
        </header>

        <section className="rounded-lg overflow-hidden bg-black">
          <video
            controls
            className="w-full"
            playsInline
            preload="metadata"
            src={url}
          />
        </section>

        <div className="mt-4 flex items-center gap-4">
          <Link to="/demos" className="text-primary hover:underline">← Back to all demos</Link>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Open in new tab
          </a>
        </div>
      </main>
    </>
  );
};

export default DemoVideoPlayerPage;
