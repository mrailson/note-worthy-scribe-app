import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Play, Clock, Shield, TrendingUp, CheckCircle2, Zap, Award } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

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

        {/* Why Notewell AI Section */}
        <section className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">Why Choose Notewell AI?</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Clock className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">Save Time</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Reduce complaint processing time from hours to minutes with automated workflows and AI-powered analysis.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">NHS Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Built specifically for NHS regulations and CQC standards, ensuring full compliance and inspection readiness.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">Improve Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Identify trends and recurring issues to drive continuous improvement across your practice.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">How It Works</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">1</div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Automated Capture</h3>
                    <p className="text-sm text-muted-foreground">
                      Complaints are logged quickly via multiple channels - email, phone, or direct entry. AI extracts key information automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">2</div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Intelligent Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      AI analyses complaints against NHS guidelines, identifies themes, and suggests appropriate responses and actions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">3</div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Streamlined Resolution</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate professional responses, track deadlines, and maintain full audit trails - all in one integrated system.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Value to GP Practices Section */}
        <section className="mt-16 mb-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">Value for Your GP Practice</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CheckCircle2 className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">Reduce Administrative Burden</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Free up practice managers and staff to focus on patient care rather than paperwork. Automated acknowledgements and tracking save hours each week.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">Never Miss a Deadline</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automatic deadline tracking ensures NHS timelines are met. Clear dashboards show what needs attention and when.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Award className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">CQC Inspection Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate comprehensive reports instantly. All documentation organised and accessible, demonstrating your commitment to quality care.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">Data-Driven Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Identify patterns and recurring themes to address systemic issues. Turn complaints into opportunities for practice improvement.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
};

export default DemoVideosPage;
