import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Brain, TrendingUp, FileText, BarChart3, ArrowRight, Download, Maximize2 } from 'lucide-react';
import gpCallSnapshot from '@/assets/gp-call-performance-snapshot.png';
import icbComparison from '@/assets/icb-comparison.png';
import performanceRankings from '@/assets/performance-rankings-table.png';
import notewellDemoAudio from '@/assets/notewell-demo-audio.mp3';
import { downloadFile } from '@/utils/downloadFile';

const AIShowcasePage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>AI for Healthcare Data Analysis | Notewell AI</title>
        <meta name="description" content="Discover how AI transforms complex NHS data into clear, actionable insights for ICB Leadership" />
        <link rel="canonical" href="/ai-showcase" />
      </Helmet>

      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Brain className="w-4 h-4" />
              <span className="text-sm font-semibold">AI-Powered Data Analysis</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Transforming Complex Healthcare Data into Clear Insights
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Examples to show how AI solutions could be used to turn detailed, dry data analysis into accessible understanding for better decision-making
            </p>
            <div className="mt-6 max-w-3xl mx-auto">
              <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  <strong className="text-foreground">Note:</strong> This data has not been verified and is provided as an example of how nationally published data could be presented into useful information for practices, PCNs, Neighbourhoods and ICBs.
                </p>
              </div>
            </div>
          </div>

        {/* Audio Overview Section */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-5 h-5 text-primary" />
                      <span className="text-sm font-semibold text-primary">AI-Generated Audio Briefing - Notewell AI</span>
                    </div>
                    <CardTitle className="text-xl">
                      Notewell AI: Overview of October 2025 Telephony Data for ICB Review
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      AI transforms 403,282 call records into an executive audio briefing with key insights and recommendations
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <audio 
                  controls 
                  className="w-full"
                  preload="metadata"
                >
                  <source src={notewellDemoAudio} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
                <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>What this demonstrates:</strong> AI's ability to process large datasets and create accessible audio summaries 
                    for busy healthcare leaders, turning complex spreadsheets into clear, actionable intelligence.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

        {/* Video Section */}
          <div className="max-w-4xl mx-auto mb-12">
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm font-semibold text-primary">Educational Video produced by AI - Notebook LM</span>
                  </div>
                  <CardTitle className="text-xl">
                    Understanding GP Access: Patient Perspective on Telephony Data
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Context video explaining the patient experience behind the October 2025 telephony statistics
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="aspect-video bg-muted">
                  <video 
                    controls 
                    className="w-full h-full"
                    poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Crect fill='%23f1f5f9' width='100%25' height='100%25'/%3E%3C/svg%3E"
                  >
                    <source src="https://dphcnbricafkbtizkoal.supabase.co/storage/v1/object/public/demo-videos/Calling_Your_GP.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Visual Infographic Section */}
        <section className="container mx-auto px-4 py-12 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <Card className="border-primary/20 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI-Generated Data Visualisation by Notebook LM</span>
                </div>
                <CardTitle className="text-2xl">
                  Saxon Spires Practice vs. ICB Average: A Telephony Performance Snapshot
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Comparative analysis of Saxon Spires Practice performance against NHS Northamptonshire ICB benchmarks
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-white rounded-lg overflow-hidden">
                  <img 
                    src={icbComparison} 
                    alt="Saxon Spires Practice vs ICB Average showing call answer rates, missed call rates, and wait times comparison"
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Overview Section */}
        <section className="container mx-auto px-4 py-12 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              AI Solutions Showcase: Real Healthcare Applications
            </h2>
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Data Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Complex NHS telephony data analysed across 52 practices and 403,282 calls
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">AI Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Automated pattern recognition and benchmarking using NotebookLM
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Actionable Reports</h3>
                  <p className="text-sm text-muted-foreground">
                    Clear recommendations and visualisations for leadership decision-making
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Report 1: Executive Deep-Dive */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <Card className="border-primary/20 mb-8">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Analysis by Claude</span>
                </div>
                <CardTitle className="text-2xl mb-2">
                  October 2025 NHS Telephony: Executive Analysis Report
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  AI-powered comprehensive analysis identifying performance patterns across 52 practices and 15 PCNs
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      Key Headlines
                    </h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                        <span>52 practices across 15 PCNs processed 403,282 inbound calls in October 2025</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                        <span>Average answer rate: 54.8% — nearly half of all calls are not answered by a person</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                        <span>Average missed call rate: 11.8% — approximately 47,500 patients had their calls missed</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Traffic Light Summary</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <span className="text-xl">🟢</span>
                        </div>
                        <div>
                          <div className="font-bold text-2xl">18</div>
                          <div className="text-xs text-muted-foreground">Green Status</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <span className="text-xl">🟡</span>
                        </div>
                        <div>
                          <div className="font-bold text-2xl">22</div>
                          <div className="text-xs text-muted-foreground">Amber Status</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <span className="text-xl">🔴</span>
                        </div>
                        <div>
                          <div className="font-bold text-2xl">12</div>
                          <div className="text-xs text-muted-foreground">Red Status</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <p className="text-sm text-muted-foreground italic">
                      "This report provides the first comprehensive analysis of NHS cloud-based telephony data for Northamptonshire GP practices, 
                      cross-referenced with patient satisfaction surveys and Google reviews. The October 2025 publication marks a significant 
                      transparency milestone, enabling evidence-based assessment of primary care telephone access."
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Data Source Section */}
        <section className="container mx-auto px-4 py-12 bg-primary/5">
          <div className="max-w-5xl mx-auto">
            <Card className="border-primary/30">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold">Source Data</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      All AI analysis and reports on this page are based on the official NHS Northamptonshire ICB 
                      Cloud-Based Telephony Publication for October 2025
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Published data covering 52 GP practices, 15 PCNs, and 403,282 patient calls
                    </p>
                  </div>
                  <Button 
                    className="shrink-0"
                    onClick={() => downloadFile('/data/Cloud_Based_Telephony_Publication_Summary_October_2025.xlsx', 'Cloud_Based_Telephony_Publication_Summary_October_2025.xlsx')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Source Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

      </main>
    </>
  );
};

export default AIShowcasePage;
