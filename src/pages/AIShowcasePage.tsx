import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Brain, TrendingUp, FileText, BarChart3, ArrowRight, Download, Maximize2 } from 'lucide-react';
import gpCallSnapshot from '@/assets/gp-call-performance-snapshot.png';
import icbComparison from '@/assets/icb-comparison.png';
import performanceRankings from '@/assets/performance-rankings-table.png';
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
                  <source src="/audio/notewell-demo.mp3" type="audio/mpeg" />
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
                <div className="mt-4 flex justify-center">
                  <a
                    href="/documents/Saxon_Spires_ICB_Benchmarking_Report.docx"
                    download="Saxon_Spires_ICB_Benchmarking_Report.docx"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Full Report (Word)
                  </a>
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

        {/* Report 2: Benchmarking Analysis */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <Card className="border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Analysis #2 • NotebookLM Benchmarking</span>
                </div>
                <CardTitle className="text-2xl mb-2">
                  October 2025 Patient Access: AI-Powered Benchmarking Report
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  NotebookLM comparative analysis identifying improvement opportunities from October 2025 telephony data
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      Key Findings
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="bg-primary/5 rounded-lg p-4">
                        <div className="text-sm font-semibold text-primary mb-1">Wide Variation</div>
                        <p className="text-xs text-muted-foreground">
                          Abandonment rates range from 3.1% to 23.8% across practices
                        </p>
                      </div>
                      <div className="bg-primary/5 rounded-lg p-4">
                        <div className="text-sm font-semibold text-primary mb-1">Best Practices Exist</div>
                        <p className="text-xs text-muted-foreground">
                          Top performers provide a proven blueprint for success
                        </p>
                      </div>
                      <div className="bg-primary/5 rounded-lg p-4">
                        <div className="text-sm font-semibold text-primary mb-1">Targeted Support</div>
                        <p className="text-xs text-muted-foreground">
                          Clear identification of practices needing intervention
                        </p>
                      </div>
                    </div>

                    {/* Performance Rankings Table - Expandable */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold mb-3">Full Performance Rankings</h4>
                      <Dialog>
                        <DialogTrigger asChild>
                          <div className="relative cursor-pointer group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            <img 
                              src={performanceRankings}
                              alt="Complete performance rankings table showing all 51 practices sorted by answered rate"
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full p-3">
                                <Maximize2 className="w-6 h-6" />
                              </div>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-background/90 text-xs px-2 py-1 rounded">
                              Click to expand
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
                          <img 
                            src={performanceRankings}
                            alt="Complete performance rankings table showing all 51 practices sorted by answered rate"
                            className="w-full h-auto"
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Performance Rankings</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-4">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                          <span className="text-xl">🏆</span> Top 5 Performers
                        </h4>
                        <ol className="space-y-1 text-sm">
                          <li>1. Kingsthorpe Medical Ctr.</li>
                          <li>2. Nene Valley Surgery</li>
                          <li>3. Brackley Medical Centre</li>
                          <li>4. Dryland Medical Centre</li>
                          <li>5. Woodview Medical Centre</li>
                        </ol>
                      </div>
                      <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4">
                        <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                          <span className="text-xl">⚠️</span> Bottom 5 Performers
                        </h4>
                        <ol className="space-y-1 text-sm">
                          <li>47. Leicester Tce Healthcare Ctr</li>
                          <li>48. The Mounts Medical Centre</li>
                          <li>49. Parklands Medical Centre</li>
                          <li>50. Greens Norton & Weedon</li>
                          <li>51. St Lukes Primary Care Centre</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <p className="text-sm text-muted-foreground italic">
                      "A significant performance gap offers a clear opportunity for system-wide improvement. 
                      The data clearly identifies a group of practices that would benefit from targeted support 
                      and shared learning to elevate the standard of patient access for all residents."
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
