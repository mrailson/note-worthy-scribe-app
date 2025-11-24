import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Play, Shield, Clock, FileText, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const DemoVideosPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Demo Videos | Notewell AI</title>
        <meta name="description" content="Watch Notewell AI demo videos showcasing features and workflows." />
        <link rel="canonical" href="/demos" />
      </Helmet>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Notewell AI Complaints Manager</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Transform how you handle NHS complaints with intelligent AI-powered management
          </p>
        </header>

        {/* Overview Section */}
        <section className="mb-12">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Why Notewell AI Complaints Manager?</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Managing NHS complaints can be time-consuming and complex. Notewell AI streamlines the entire process, 
                from initial logging through investigation to final resolution, ensuring compliance with NHS regulations 
                whilst saving you valuable time.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Save Hours of Admin Time</h3>
                    <p className="text-sm text-muted-foreground">Automate acknowledgements, track deadlines, and generate compliant responses instantly</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Ensure Full Compliance</h3>
                    <p className="text-sm text-muted-foreground">Built-in NHS complaint handling frameworks and automatic compliance checks</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Professional Documentation</h3>
                    <p className="text-sm text-muted-foreground">AI-generated investigation notes, outcome letters, and audit trails</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Complete Visibility</h3>
                    <p className="text-sm text-muted-foreground">Track every complaint from start to finish with detailed analytics and reporting</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Explainer Video */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 text-center">Using AI for Complaints - Explainer Video (5 Mins)</h2>
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-lg overflow-hidden shadow-xl bg-muted aspect-video">
              <video 
                controls 
                className="w-full h-full"
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Crect fill='%23f1f5f9' width='100%25' height='100%25'/%3E%3C/svg%3E"
              >
                <source src="https://dphcnbricafkbtizkoal.supabase.co/storage/v1/object/public/demo-videos/AI_for_Admin.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </section>

        {/* Featured Loom Demo */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 text-center">Watch the Notewell AI Complaint System in Action - a Demo of a full complaint life cycle:</h2>
        <div className="max-w-4xl mx-auto">
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
          </div>
        </section>
      </main>
    </>
  );
};

export default DemoVideosPage;
