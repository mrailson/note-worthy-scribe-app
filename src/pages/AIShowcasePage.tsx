import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, FileText, BarChart3, ArrowRight, Download } from 'lucide-react';
import gpCallSnapshot from '@/assets/gp-call-performance-snapshot.png';
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
                  October 2025 Performance Snapshot: Best vs. Worst Performers
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  AI analysis identifying top and bottom performers from the October 2025 dataset, highlighting key success factors
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-white rounded-lg overflow-hidden">
                  <img 
                    src={gpCallSnapshot} 
                    alt="GP Call Performance Comparison showing Kingsthorpe Medical Centre (#1 rank) with 4.2% call abandonment versus The Pines Surgery (#52 rank) with 22.5% abandonment"
                    className="w-full h-auto"
                  />
                </div>
                <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                  <h4 className="font-semibold mb-2">Key Insights from Visualisation</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Best in class: 4.2% call abandonment with 69.5% answered in under 2 minutes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Needs improvement: 22.5% abandonment indicating significant patient frustration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Success factors: Effective staffing, smart triage systems, modern telephony features</span>
                    </li>
                  </ul>
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
                      <li className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                        <ArrowRight className="w-4 h-4 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                        <div>
                          <span className="text-red-700 dark:text-red-300 font-medium">7 practices identified with critical anomalies where patient ratings conflict with telephony performance:</span>
                          <ul className="mt-2 ml-4 space-y-1 text-sm">
                            <li>• The Pines</li>
                            <li>• Brook Medical Centre</li>
                            <li>• Dr Abbas & Partners</li>
                            <li>• The Cottons Medical Centre</li>
                            <li>• The Brook Health Centre</li>
                            <li>• Daventry Health Centre</li>
                            <li>• St Lukes Primary Care Centre</li>
                          </ul>
                        </div>
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
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Performance Rankings</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-4">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                          <span className="text-xl">🏆</span> Top 4 Performers
                        </h4>
                        <ol className="space-y-1 text-sm">
                          <li>1. Kingsthorpe Medical Centre</li>
                          <li>2. Woodview Medical Centre</li>
                          <li>3. The Buckby Practice</li>
                          <li>4. Long Practice</li>
                        </ol>
                      </div>
                      <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4">
                        <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                          <span className="text-xl">⚠️</span> Bottom 5 Performers
                        </h4>
                        <ol className="space-y-1 text-sm">
                          <li>48. The Brook Health Centre</li>
                          <li>49. The Cottons Medical Centre</li>
                          <li>50. Dr Abbas</li>
                          <li>51. Brook Medical Centre Pines</li>
                          <li>52. The Surgery</li>
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
