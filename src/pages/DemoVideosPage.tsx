import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Play } from 'lucide-react';

const DemoVideosPage: React.FC = () => {
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
          <p className="text-muted-foreground mt-1">Short Overview of the Notewell AI Complaint Management Service</p>
        </header>

        {/* Featured Loom Demo */}
        <section className="mb-8 max-w-4xl mx-auto">
          <a
            href="https://www.loom.com/share/58d3d16963224dddac2ea8211bd2b90d"
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video shadow-lg hover:shadow-xl transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 group-hover:from-primary/30 group-hover:to-primary/10 transition-all flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-primary/90 group-hover:bg-primary group-hover:scale-110 transition-all flex items-center justify-center shadow-lg mx-auto">
                    <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">Watch Full Demo</h2>
                    <p className="text-sm text-muted-foreground">Click to view on Loom</p>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </section>
      </main>
    </>
  );
};

export default DemoVideosPage;
