import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Shield,
  Database,
  Cloud,
  Lock,
  GitBranch,
  Workflow,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  TrendingUp,
  Zap,
  Server,
  Globe,
  HardDrive
} from "lucide-react";
import { useState } from "react";

const DataFlowArchitecture = () => {
  const [activeSection, setActiveSection] = useState<string>("overview");

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const navigation = [
    { id: "overview", label: "Executive Overview", icon: TrendingUp },
    { id: "auth-flow", label: "Authentication Flow", icon: Lock },
    { id: "meeting-flow", label: "Meeting Transcription", icon: FileText },
    { id: "complaints-flow", label: "Complaints Management", icon: AlertTriangle },
    { id: "ai-integration", label: "AI Integration", icon: Zap },
    { id: "security-flow", label: "Security Architecture", icon: Shield },
    { id: "frontend-arch", label: "Frontend Architecture", icon: Globe },
    { id: "backend-arch", label: "Backend Architecture", icon: Server },
    { id: "database-schema", label: "Database Schema", icon: Database },
    { id: "deployment", label: "Deployment", icon: Cloud },
    { id: "data-lifecycle", label: "Data Lifecycle", icon: HardDrive },
    { id: "integration-matrix", label: "Integration Security", icon: GitBranch }
  ];

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <GitBranch className="w-10 h-10 text-primary" />
            Data Flow Diagram & Architecture Summary
          </h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive technical architecture and data flow documentation for NoteWell AI
          </p>
          <div className="mt-4 flex items-center gap-4">
            <Badge className="bg-primary text-primary-foreground">PCN Services Ltd</Badge>
            <Badge variant="outline">Version 1.0</Badge>
            <Badge variant="outline">Last Updated: {new Date().toLocaleDateString('en-GB')}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation Sidebar */}
          <Card className="lg:col-span-1 h-fit sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {navigation.map((nav) => (
                  <Button
                    key={nav.id}
                    variant={activeSection === nav.id ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => scrollToSection(nav.id)}
                  >
                    <nav.icon className="w-4 h-4 mr-2" />
                    {nav.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Executive Overview */}
            <section id="overview">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <TrendingUp className="w-6 h-6" />
                    Executive Architecture Overview
                  </CardTitle>
                  <CardDescription>High-level system architecture and technology stack</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI is a cloud-based healthcare management system built on modern, secure infrastructure.
                      The system leverages Supabase for backend services, React for the frontend, and integrates with
                      leading AI providers to deliver intelligent clinical documentation and practice management tools.
                    </p>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Frontend Technology
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• React 18.3 with TypeScript</li>
                        <li>• TanStack Query for data fetching</li>
                        <li>• Tailwind CSS for styling</li>
                        <li>• Radix UI components</li>
                        <li>• Vite build system</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Server className="w-4 h-4 text-primary" />
                        Backend Technology
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• Supabase (PostgreSQL 15)</li>
                        <li>• Row Level Security (RLS)</li>
                        <li>• Real-time subscriptions</li>
                        <li>• Storage buckets (encrypted)</li>
                        <li>• Database functions & triggers</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        AI Integrations
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• OpenAI GPT-4 & Embeddings</li>
                        <li>• ElevenLabs voice synthesis</li>
                        <li>• AssemblyAI transcription</li>
                        <li>• Context-aware processing</li>
                        <li>• Token optimisation</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Security Features
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• AES-256 encryption at rest</li>
                        <li>• TLS 1.3 in transit</li>
                        <li>• Row Level Security (RLS)</li>
                        <li>• Comprehensive audit logs</li>
                        <li>• Role-based access control</li>
                      </ul>
                    </div>
                  </div>

                  <Separator />

                  <div className="p-6 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <h3 className="font-semibold text-lg mb-3 text-blue-900 dark:text-blue-100">
                      High-Level Architecture Summary
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <strong className="text-blue-900 dark:text-blue-200">Client Layer:</strong>
                        <p className="ml-4">Web browsers and mobile devices access the React application via HTTPS, with all static assets served through a global CDN.</p>
                      </div>
                      <div>
                        <strong className="text-blue-900 dark:text-blue-200">Authentication Layer:</strong>
                        <p className="ml-4">Supabase Auth handles user authentication with JWT tokens, supporting OTP and password-based login with session management.</p>
                      </div>
                      <div>
                        <strong className="text-blue-900 dark:text-blue-200">Application Layer:</strong>
                        <p className="ml-4">React application with TanStack Query manages state, real-time WebSocket subscriptions provide live updates, and file operations handle document uploads/downloads.</p>
                      </div>
                      <div>
                        <strong className="text-blue-900 dark:text-blue-200">Backend Services:</strong>
                        <p className="ml-4">Supabase PostgreSQL database enforces Row Level Security policies, with encrypted storage buckets for files and database functions for business logic.</p>
                      </div>
                      <div>
                        <strong className="text-blue-900 dark:text-blue-200">AI Integration:</strong>
                        <p className="ml-4">Secure connections to OpenAI (GPT-4), ElevenLabs (voice), and AssemblyAI (transcription) with PII masking and rate limiting.</p>
                      </div>
                      <div>
                        <strong className="text-blue-900 dark:text-blue-200">Security & Monitoring:</strong>
                        <p className="ml-4">Comprehensive audit logging, AES-256 encryption at rest, TLS 1.3 in transit, and continuous monitoring for security events.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Authentication Flow */}
            <section id="auth-flow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Lock className="w-6 h-6" />
                    Authentication & Authorisation Flow
                  </CardTitle>
                  <CardDescription>Secure user authentication and session management</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI implements a robust authentication system using Supabase Auth with support for
                      both OTP (one-time password) and traditional password-based login. All sessions are managed
                      with JWT tokens and protected by Row Level Security policies.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Authentication Flow Process</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">1. User Input</h4>
                        <p className="text-sm">User enters email and password/OTP → Client-side validation → Form submission to Supabase Auth</p>
                      </div>
                      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <h4 className="font-semibold mb-2 text-green-900 dark:text-green-100">2. Credential Verification</h4>
                        <p className="text-sm">Supabase Auth validates credentials → Generates JWT access & refresh tokens → Returns tokens to client</p>
                      </div>
                      <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/30">
                        <h4 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">3. Session Management</h4>
                        <p className="text-sm">Tokens stored securely → HttpOnly session cookies set → Inactivity monitoring enabled (30min timeout)</p>
                      </div>
                      <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/30">
                        <h4 className="font-semibold mb-2 text-orange-900 dark:text-orange-100">4. Authorisation Check</h4>
                        <p className="text-sm">Extract user ID from JWT → Query user profile & practice membership → Check module permissions → Apply RLS policies</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="auth-details">
                      <AccordionTrigger>Authentication Security Details</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Password Requirements</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• Minimum 8 characters</li>
                            <li>• Stored using bcrypt hashing (Supabase default)</li>
                            <li>• Rate limiting on failed attempts</li>
                            <li>• Password reset via secure email link</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Session Security</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• JWT tokens with 1-hour expiry</li>
                            <li>• Refresh tokens for seamless re-authentication</li>
                            <li>• Automatic logout after 30 minutes of inactivity</li>
                            <li>• Secure, HttpOnly cookies</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Authorisation Layers</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• User-level permissions (system_admin, practice_admin, user)</li>
                            <li>• Practice-level isolation (users only see their practice data)</li>
                            <li>• Module-level access control (AI4GP, GPScribe, Complaints, etc.)</li>
                            <li>• Row Level Security enforced at database level</li>
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </section>

            {/* Meeting Transcription Flow */}
            <section id="meeting-flow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    Meeting Transcription Data Flow
                  </CardTitle>
                  <CardDescription>Real-time audio capture, transcription, and AI summarisation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      The meeting transcription system captures audio in real-time, processes it through multiple
                      transcription services, generates AI-powered summaries, and stores all data securely with
                      comprehensive audit trails.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Meeting Transcription Process</h3>
                    <div className="space-y-3">
                      <div className="p-4 border-l-4 border-blue-500 bg-muted/50">
                        <h4 className="font-semibold mb-1 text-blue-700 dark:text-blue-300">Step 1: Audio Capture</h4>
                        <p className="text-sm">Browser MediaRecorder API captures microphone audio in 250ms chunks → Audio buffered in-memory queue → Meeting record created in database</p>
                      </div>
                      <div className="p-4 border-l-4 border-green-500 bg-muted/50">
                        <h4 className="font-semibold mb-1 text-green-700 dark:text-green-300">Step 2: Real-time Transcription</h4>
                        <p className="text-sm">Audio chunks streamed to AssemblyAI via WebSocket → Transcription processed with confidence scoring → Chunks stored in assembly_transcripts table</p>
                      </div>
                      <div className="p-4 border-l-4 border-purple-500 bg-muted/50">
                        <h4 className="font-semibold mb-1 text-purple-700 dark:text-purple-300">Step 3: Storage & Archival</h4>
                        <p className="text-sm">Audio chunks uploaded to encrypted Supabase storage → Metadata tracked in audio_chunks table → Background cleanup process after 90 days</p>
                      </div>
                      <div className="p-4 border-l-4 border-orange-500 bg-muted/50">
                        <h4 className="font-semibold mb-1 text-orange-700 dark:text-orange-300">Step 4: AI Processing</h4>
                        <p className="text-sm">Complete transcript sent to OpenAI GPT-4 → Summary generated with action items → Structured meeting notes created and stored</p>
                      </div>
                      <div className="p-4 border-l-4 border-red-500 bg-muted/50">
                        <h4 className="font-semibold mb-1 text-red-700 dark:text-red-300">Step 5: Distribution</h4>
                        <p className="text-sm">Meeting summary exported to PDF/DOCX → Shared with attendees via email → Audit log entry created for all access</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="transcription-details">
                      <AccordionTrigger>Technical Implementation Details</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Audio Processing</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• Audio captured at 16kHz, 16-bit, mono</li>
                            <li>• Chunks buffered every 250ms for real-time streaming</li>
                            <li>• Automatic audio quality optimisation</li>
                            <li>• Stored in encrypted Supabase storage buckets</li>
                            <li>• Background cleanup after 90 days (configurable)</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Transcription Accuracy</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• AssemblyAI provides confidence scores per utterance</li>
                            <li>• Medical vocabulary optimisation enabled</li>
                            <li>• Speaker diarisation for multi-party meetings</li>
                            <li>• Automatic punctuation and capitalisation</li>
                            <li>• Low confidence segments flagged for review</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">AI Summary Generation</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• GPT-4 processes complete transcript with context</li>
                            <li>• Structured output: summary, action items, decisions, risks</li>
                            <li>• Template-based formatting for consistency</li>
                            <li>• Cross-validation with alternative AI models (optional)</li>
                            <li>• Human review required before finalisation</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Data Security</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• All audio files encrypted at rest (AES-256)</li>
                            <li>• Transcripts protected by RLS policies</li>
                            <li>• No patient-identifiable information sent to AI without masking</li>
                            <li>• Comprehensive audit trail of all access</li>
                            <li>• GDPR-compliant data retention and deletion</li>
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </section>

            {/* Complaints Management Flow */}
            <section id="complaints-flow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6" />
                    Complaints Management Data Flow
                  </CardTitle>
                  <CardDescription>End-to-end complaint handling with AI assistance and CQC compliance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      The complaints management system provides a comprehensive workflow from initial submission
                      through investigation, response generation, and resolution, with full audit trails for CQC compliance.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Complaints Workflow Stages</h3>
                    <div className="grid gap-3">
                      {[
                        { stage: "1. Submission", color: "blue", desc: "Web form entry → Field validation → Auto-generated reference number → Database storage" },
                        { stage: "2. Initial Processing", color: "green", desc: "AI categorisation → Priority assignment → Acknowledgement email sent within 3 days" },
                        { stage: "3. Investigation", color: "purple", desc: "Staff assignment → Evidence collection → Secure token links for responses → AI pattern analysis" },
                        { stage: "4. Response", color: "orange", desc: "AI-assisted draft → Human review → Manager approval → Send to complainant" },
                        { stage: "5. Compliance", color: "red", desc: "Audit logging → Compliance checks → CQC reporting → 6-year retention" }
                      ].map((item, idx) => (
                        <div key={idx} className={`p-4 border-l-4 border-${item.color}-500 bg-muted/50`}>
                          <h4 className={`font-semibold mb-1 text-${item.color}-700 dark:text-${item.color}-300`}>{item.stage}</h4>
                          <p className="text-sm">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="complaints-details">
                      <AccordionTrigger>Complaints System Details</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Complaint Categorisation</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• AI-powered categorisation using OpenAI GPT-4</li>
                            <li>• Categories: Clinical Care, Access, Staff Attitude, Communication, etc.</li>
                            <li>• Automatic sub-categorisation for detailed tracking</li>
                            <li>• Priority assignment based on content analysis</li>
                            <li>• Manual override available for staff</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Investigation Workflow</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• Secure access tokens for staff to submit responses</li>
                            <li>• Structured forms for consistent data collection</li>
                            <li>• Evidence upload with automatic metadata extraction</li>
                            <li>• AI-assisted pattern detection across complaints</li>
                            <li>• Timeline reconstruction from multiple sources</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">CQC Compliance</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• Automatic compliance checklist generation</li>
                            <li>• Acknowledgement within 3 working days tracking</li>
                            <li>• Response deadline monitoring (10-20 working days)</li>
                            <li>• Outcomes questionnaire for complainant feedback</li>
                            <li>• Annual reporting data extraction</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Audit Trail</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• Every action logged with timestamp and user ID</li>
                            <li>• Device fingerprint and IP address captured</li>
                            <li>• Browser and OS information for security</li>
                            <li>• Old and new values tracked for all changes</li>
                            <li>• Immutable audit log (append-only)</li>
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </section>

            {/* AI Integration */}
            <section id="ai-integration">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Zap className="w-6 h-6" />
                    AI Integration Architecture
                  </CardTitle>
                  <CardDescription>External AI service integration with security and error handling</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI integrates with multiple AI providers to deliver intelligent features while maintaining
                      data security, implementing rate limiting, and providing fallback mechanisms for resilience.
                    </p>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <h4 className="font-semibold mb-2 text-orange-900 dark:text-orange-100">OpenAI Integration</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Model: GPT-4 & GPT-3.5 Turbo</li>
                        <li>• Max tokens: 8,192 per request</li>
                        <li>• Temperature: 0.7 for creativity</li>
                        <li>• Rate limit: 60 requests/minute</li>
                        <li>• Retry: 3 attempts with backoff</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <h4 className="font-semibold mb-2 text-orange-900 dark:text-orange-100">ElevenLabs Integration</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Voice: Professional British English</li>
                        <li>• Format: MP3, 128kbps</li>
                        <li>• Max chars: 5,000 per request</li>
                        <li>• Rate limit: 50 requests/minute</li>
                        <li>• Storage: Encrypted Supabase bucket</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <h4 className="font-semibold mb-2 text-orange-900 dark:text-orange-100">AssemblyAI Integration</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Real-time WebSocket streaming</li>
                        <li>• Sample rate: 16kHz, 16-bit</li>
                        <li>• Confidence threshold: 0.85</li>
                        <li>• Speaker diarisation: enabled</li>
                        <li>• Medical vocabulary: optimised</li>
                      </ul>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">AI Request Flow</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[120px]">1. Request Init:</span>
                        <span>User action triggers AI feature → Context preparation with data masking → Input validation</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[120px]">2. Security:</span>
                        <span>API key loaded from Supabase secrets → PII masking applied → Rate limit check</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[120px]">3. API Call:</span>
                        <span>HTTPS POST to AI service → Token optimisation → Response streaming (if supported)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[120px]">4. Error Handling:</span>
                        <span>Success: Return sanitised response → Failure: Log error, retry with exponential backoff, fallback if max retries exceeded</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[120px]">5. Audit:</span>
                        <span>All AI interactions logged → Response sanitisation → User notification</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Security Architecture */}
            <section id="security-flow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Shield className="w-6 h-6" />
                    Security Architecture & Data Protection
                  </CardTitle>
                  <CardDescription>Defence-in-depth security model with encryption and access controls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI implements a comprehensive, multi-layered security architecture following the principle
                      of defence-in-depth. Every layer of the system includes security controls to protect sensitive
                      healthcare data.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Defence-in-Depth Layers</h3>
                    <div className="space-y-2">
                      {[
                        { layer: "Layer 1: Network Security", items: ["TLS 1.3 encryption for all traffic", "CDN with DDoS protection", "Firewall rules and IP whitelisting"] },
                        { layer: "Layer 2: Application Security", items: ["Input validation (XSS & SQL injection prevention)", "CSRF protection with token verification", "Content Security Policy headers", "Rate limiting for abuse prevention"] },
                        { layer: "Layer 3: Authentication", items: ["Supabase Auth with JWT tokens", "MFA support with OTP codes", "Session timeout after 30min inactivity", "Password complexity requirements"] },
                        { layer: "Layer 4: Authorisation", items: ["Row Level Security (database-enforced)", "Role-based access control", "Practice-level isolation (multi-tenancy)", "Module permissions with feature flags"] },
                        { layer: "Layer 5: Data Encryption", items: ["AES-256 encryption at rest", "TLS 1.3 in transit", "Field-level encryption for sensitive data", "Supabase-managed key management"] },
                        { layer: "Layer 6: Audit & Monitoring", items: ["Comprehensive audit logs of all actions", "Security event detection", "Automated alerts for suspicious activity", "Compliance reporting (GDPR, CQC)"] },
                        { layer: "Layer 7: Incident Response", items: ["Real-time incident detection", "Automated response (account lockout)", "Manual investigation workflows", "Post-incident review process"] }
                      ].map((layer, idx) => (
                        <div key={idx} className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                          <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100">{layer.layer}</h4>
                          <ul className="text-sm space-y-1">
                            {layer.items.map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                      <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Encryption Standards
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>At Rest:</strong> AES-256-GCM</li>
                        <li>• <strong>In Transit:</strong> TLS 1.3 (minimum 1.2)</li>
                        <li>• <strong>Database:</strong> Transparent encryption</li>
                        <li>• <strong>Storage:</strong> Server-side encryption</li>
                        <li>• <strong>Backups:</strong> Encrypted snapshots</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                      <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100 flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Row Level Security
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Enforcement:</strong> Database-level policies</li>
                        <li>• <strong>User Isolation:</strong> auth.uid() = user_id</li>
                        <li>• <strong>Practice Isolation:</strong> Practice membership check</li>
                        <li>• <strong>Multi-tenancy:</strong> Complete data separation</li>
                        <li>• <strong>Admin Override:</strong> Controlled escalation</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                      <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Access Control
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Authentication:</strong> Mandatory for all features</li>
                        <li>• <strong>Authorisation:</strong> RBAC with module permissions</li>
                        <li>• <strong>Session Timeout:</strong> 30 minutes inactivity</li>
                        <li>• <strong>Failed Login:</strong> Account lockout after 5 attempts</li>
                        <li>• <strong>Password Reset:</strong> Secure email verification</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                      <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Audit Logging
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Scope:</strong> All user actions logged</li>
                        <li>• <strong>Data:</strong> User, timestamp, action, changes</li>
                        <li>• <strong>Immutability:</strong> Append-only logs</li>
                        <li>• <strong>Retention:</strong> 7 years minimum</li>
                        <li>• <strong>Review:</strong> Monthly security audits</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Frontend Architecture */}
            <section id="frontend-arch">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Globe className="w-6 h-6" />
                    Frontend Architecture
                  </CardTitle>
                  <CardDescription>React component hierarchy and state management</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      The frontend is built with React 18.3 and TypeScript, using modern patterns for state management,
                      data fetching, and component composition. The architecture prioritises performance, maintainability,
                      and user experience.
                    </p>
                  </div>

                  <Separator />

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="frontend-details">
                      <AccordionTrigger>Frontend Technical Details</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Component Structure</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• <strong>Atomic Design:</strong> Atoms → Molecules → Organisms → Templates → Pages</li>
                            <li>• <strong>Co-location:</strong> Related components grouped by feature</li>
                            <li>• <strong>Separation:</strong> Presentation vs container components</li>
                            <li>• <strong>Reusability:</strong> Shared components in /components/ui</li>
                            <li>• <strong>Type Safety:</strong> Full TypeScript coverage</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">State Management Strategy</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• <strong>Server State:</strong> TanStack Query for API data with caching</li>
                            <li>• <strong>Global State:</strong> React Context for authentication and user preferences</li>
                            <li>• <strong>Local State:</strong> useState/useReducer for component-specific data</li>
                            <li>• <strong>Form State:</strong> react-hook-form with Zod validation</li>
                            <li>• <strong>Real-time:</strong> Supabase subscriptions for live updates</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Performance Optimisations</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• <strong>Code Splitting:</strong> React.lazy() for route-based splitting</li>
                            <li>• <strong>Memoisation:</strong> useMemo and useCallback for expensive operations</li>
                            <li>• <strong>Virtualisation:</strong> Virtual scrolling for large lists</li>
                            <li>• <strong>Image Optimisation:</strong> Lazy loading and responsive images</li>
                            <li>• <strong>Bundle Size:</strong> Tree shaking and dead code elimination</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Accessibility (A11Y)</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• <strong>Semantic HTML:</strong> Proper heading hierarchy and landmarks</li>
                            <li>• <strong>Keyboard Navigation:</strong> Full keyboard support without mouse</li>
                            <li>• <strong>Screen Readers:</strong> ARIA labels and live regions</li>
                            <li>• <strong>Focus Management:</strong> Visible focus indicators and logical tab order</li>
                            <li>• <strong>Colour Contrast:</strong> WCAG AA compliant (4.5:1 minimum)</li>
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </section>

            {/* Backend Architecture */}
            <section id="backend-arch">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Server className="w-6 h-6" />
                    Backend Architecture
                  </CardTitle>
                  <CardDescription>Supabase PostgreSQL database with RLS, functions, and triggers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      The backend infrastructure is built on Supabase, leveraging PostgreSQL for data storage,
                      Row Level Security for access control, database functions for business logic, and triggers
                      for automated workflows.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Backend Components</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <h4 className="font-semibold mb-2 text-green-900 dark:text-green-100">Database Layer</h4>
                        <ul className="text-sm space-y-1">
                          <li>• PostgreSQL 15 managed by Supabase</li>
                          <li>• PgBouncer connection pooling</li>
                          <li>• Real-time WebSocket server</li>
                          <li>• Automated backups & replication</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <h4 className="font-semibold mb-2 text-green-900 dark:text-green-100">Row Level Security</h4>
                        <ul className="text-sm space-y-1">
                          <li>• Database-enforced policies</li>
                          <li>• User isolation (auth.uid checks)</li>
                          <li>• Practice isolation (multi-tenancy)</li>
                          <li>• Admin conditional access</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <h4 className="font-semibold mb-2 text-green-900 dark:text-green-100">Database Functions</h4>
                        <ul className="text-sm space-y-1">
                          <li>• PL/pgSQL custom functions</li>
                          <li>• Computed columns (virtual fields)</li>
                          <li>• Validation logic & check constraints</li>
                          <li>• Business rules via triggers</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
                        <h4 className="font-semibold mb-2 text-green-900 dark:text-green-100">Storage & Files</h4>
                        <ul className="text-sm space-y-1">
                          <li>• S3-compatible storage buckets</li>
                          <li>• Server-side encryption (AES-256)</li>
                          <li>• Storage-level access policies</li>
                          <li>• Metadata tracking (size, type, checksums)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Database Schema */}
            <section id="database-schema">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Database className="w-6 h-6" />
                    Database Schema Overview
                  </CardTitle>
                  <CardDescription>Entity-relationship and table structure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      The database schema is designed for healthcare data management with comprehensive audit trails,
                      multi-tenancy support, and GDPR compliance. Key entity groups include user management, clinical
                      data, complaints, CQC compliance, and audit logging.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Key Database Features</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Row Level Security (RLS)</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          All tables have RLS policies enforcing user and practice isolation:
                        </p>
                        <ul className="text-sm space-y-1">
                          <li>• Users only see their own data</li>
                          <li>• Practice members share practice data</li>
                          <li>• Admins have controlled elevated access</li>
                          <li>• System admin can access all data with audit</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Audit Tables</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Comprehensive audit logging for compliance:
                        </p>
                        <ul className="text-sm space-y-1">
                          <li>• complaint_audit_detailed (full device info)</li>
                          <li>• complaint_audit_log (action summaries)</li>
                          <li>• All tables have created_at/updated_at</li>
                          <li>• Immutable logs (no updates or deletes)</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Data Retention</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          GDPR-compliant automatic data lifecycle:
                        </p>
                        <ul className="text-sm space-y-1">
                          <li>• data_retention_policies table defines rules</li>
                          <li>• Each record has data_retention_date</li>
                          <li>• Automated archival after retention period</li>
                          <li>• Secure deletion with audit trail</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Referential Integrity</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Foreign key constraints maintain data consistency:
                        </p>
                        <ul className="text-sm space-y-1">
                          <li>• Cascade deletes for dependent records</li>
                          <li>• Restrict deletes for referenced records</li>
                          <li>• Triggers for complex dependencies</li>
                          <li>• Check constraints for data validation</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Major Table Groups</h3>
                    <div className="space-y-2">
                      <div className="p-3 border-l-4 border-blue-500 bg-muted/50">
                        <strong className="text-blue-700 dark:text-blue-300">User Management:</strong> user_profiles, user_practices, gp_practices, practice_details
                      </div>
                      <div className="p-3 border-l-4 border-green-500 bg-muted/50">
                        <strong className="text-green-700 dark:text-green-300">Meetings:</strong> meetings, audio_sessions, audio_chunks, assembly_transcripts, meeting_summaries, attendees
                      </div>
                      <div className="p-3 border-l-4 border-orange-500 bg-muted/50">
                        <strong className="text-orange-700 dark:text-orange-300">Complaints:</strong> complaints, complaint_documents, complaint_notes, complaint_audit_log, complaint_outcomes, complaint_involved_parties
                      </div>
                      <div className="p-3 border-l-4 border-purple-500 bg-muted/50">
                        <strong className="text-purple-700 dark:text-purple-300">CQC Compliance:</strong> cqc_policies, cqc_evidence, cqc_assessments, cqc_alerts, cqc_domains
                      </div>
                      <div className="p-3 border-l-4 border-red-500 bg-muted/50">
                        <strong className="text-red-700 dark:text-red-300">Audit & Security:</strong> complaint_audit_detailed, data_retention_policies, chunk_cleaning_stats
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Deployment */}
            <section id="deployment">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Cloud className="w-6 h-6" />
                    Deployment & Infrastructure
                  </CardTitle>
                  <CardDescription>Cloud architecture and hosting configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI is deployed on cloud infrastructure with automated CI/CD, global CDN distribution,
                      automated backups, and multi-region availability for resilience.
                    </p>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Hosting Infrastructure</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Frontend:</strong> Lovable CDN (global distribution)</li>
                        <li>• <strong>Backend:</strong> Supabase Cloud (AWS-based)</li>
                        <li>• <strong>Database:</strong> PostgreSQL 15 (managed)</li>
                        <li>• <strong>Storage:</strong> S3-compatible encrypted buckets</li>
                        <li>• <strong>Region:</strong> Primary EU, replicated globally</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Availability & Performance</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Uptime SLA:</strong> 99.9% availability</li>
                        <li>• <strong>CDN:</strong> &lt;200ms latency globally</li>
                        <li>• <strong>Database:</strong> &lt;50ms query response</li>
                        <li>• <strong>Concurrent Users:</strong> 1,000+ supported</li>
                        <li>• <strong>Scalability:</strong> Auto-scaling enabled</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Disaster Recovery</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>RTO (Recovery Time):</strong> 4 hours</li>
                        <li>• <strong>RPO (Recovery Point):</strong> 1 hour</li>
                        <li>• <strong>Backups:</strong> Daily automated snapshots</li>
                        <li>• <strong>Retention:</strong> 7-day point-in-time recovery</li>
                        <li>• <strong>Replication:</strong> Multi-region geo-redundancy</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Monitoring & Alerts</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>Uptime:</strong> 24/7 health check monitoring</li>
                        <li>• <strong>Performance:</strong> Response time tracking</li>
                        <li>• <strong>Errors:</strong> Real-time error alerting</li>
                        <li>• <strong>Security:</strong> Automated security scanning</li>
                        <li>• <strong>Capacity:</strong> Resource utilisation alerts</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Data Lifecycle */}
            <section id="data-lifecycle">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <HardDrive className="w-6 h-6" />
                    Data Retention & Lifecycle
                  </CardTitle>
                  <CardDescription>GDPR-compliant data management from creation to deletion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI implements a comprehensive data lifecycle management system ensuring GDPR compliance,
                      with automated archival and deletion based on legal retention requirements and user preferences.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Retention Policies by Data Type</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left border">Data Type</th>
                            <th className="p-2 text-left border">Retention Period</th>
                            <th className="p-2 text-left border">Legal Basis</th>
                            <th className="p-2 text-left border">Deletion Method</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-2 border">Meeting recordings & transcripts</td>
                            <td className="p-2 border">6 years from creation</td>
                            <td className="p-2 border">NHS Records Management Code of Practice</td>
                            <td className="p-2 border">Secure deletion with audit</td>
                          </tr>
                          <tr className="bg-muted/30">
                            <td className="p-2 border">Complaints records</td>
                            <td className="p-2 border">6 years from closure</td>
                            <td className="p-2 border">CQC requirements</td>
                            <td className="p-2 border">Archival then secure deletion</td>
                          </tr>
                          <tr>
                            <td className="p-2 border">Audit logs</td>
                            <td className="p-2 border">7 years minimum</td>
                            <td className="p-2 border">GDPR Article 5(2) accountability</td>
                            <td className="p-2 border">Archival to cold storage</td>
                          </tr>
                          <tr className="bg-muted/30">
                            <td className="p-2 border">User account data</td>
                            <td className="p-2 border">30 days after account closure</td>
                            <td className="p-2 border">GDPR right to erasure</td>
                            <td className="p-2 border">Immediate secure deletion</td>
                          </tr>
                          <tr>
                            <td className="p-2 border">AI query logs</td>
                            <td className="p-2 border">90 days from creation</td>
                            <td className="p-2 border">Service improvement & debugging</td>
                            <td className="p-2 border">Automatic deletion</td>
                          </tr>
                          <tr className="bg-muted/30">
                            <td className="p-2 border">CQC compliance documents</td>
                            <td className="p-2 border">Indefinite (until superseded)</td>
                            <td className="p-2 border">Regulatory requirement</td>
                            <td className="p-2 border">Manual review before deletion</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Integration Security Matrix */}
            <section id="integration-matrix">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <GitBranch className="w-6 h-6" />
                    Integration Security Matrix
                  </CardTitle>
                  <CardDescription>Third-party service security assessment and controls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <p>
                      NoteWell AI integrates with carefully vetted third-party services. Each integration is assessed
                      for security, data protection, and compliance requirements, with appropriate controls implemented.
                    </p>
                  </div>

                  <Separator />

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left border">Service</th>
                          <th className="p-2 text-left border">Purpose</th>
                          <th className="p-2 text-left border">Data Shared</th>
                          <th className="p-2 text-left border">Security Controls</th>
                          <th className="p-2 text-left border">Compliance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2 border font-semibold">Supabase</td>
                          <td className="p-2 border">Backend infrastructure</td>
                          <td className="p-2 border">All application data</td>
                          <td className="p-2 border">
                            • AES-256 encryption at rest<br/>
                            • TLS 1.3 in transit<br/>
                            • Row Level Security<br/>
                            • SOC 2 Type II certified
                          </td>
                          <td className="p-2 border">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-950">GDPR Compliant</Badge>
                          </td>
                        </tr>
                        <tr className="bg-muted/30">
                          <td className="p-2 border font-semibold">OpenAI</td>
                          <td className="p-2 border">AI processing & summarisation</td>
                          <td className="p-2 border">De-identified text data only</td>
                          <td className="p-2 border">
                            • PII masking before API call<br/>
                            • No data retention by OpenAI<br/>
                            • API keys in Supabase secrets<br/>
                            • Rate limiting & monitoring
                          </td>
                          <td className="p-2 border">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-950">SOC 2 Type II</Badge>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 border font-semibold">AssemblyAI</td>
                          <td className="p-2 border">Audio transcription</td>
                          <td className="p-2 border">Audio files (no PHI)</td>
                          <td className="p-2 border">
                            • Audio encrypted in transit<br/>
                            • No audio retention by vendor<br/>
                            • Transcript-only output<br/>
                            • Medical vocabulary optimised
                          </td>
                          <td className="p-2 border">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-950">SOC 2 Type II</Badge>
                          </td>
                        </tr>
                        <tr className="bg-muted/30">
                          <td className="p-2 border font-semibold">ElevenLabs</td>
                          <td className="p-2 border">Voice synthesis</td>
                          <td className="p-2 border">Non-sensitive text for audio</td>
                          <td className="p-2 border">
                            • Text sanitised before sending<br/>
                            • No PHI in voice synthesis<br/>
                            • Audio stored in Supabase<br/>
                            • API keys secured
                          </td>
                          <td className="p-2 border">
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950">Limited use</Badge>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 border font-semibold">Lovable CDN</td>
                          <td className="p-2 border">Frontend hosting & distribution</td>
                          <td className="p-2 border">Static assets only (no data)</td>
                          <td className="p-2 border">
                            • HTTPS only<br/>
                            • Global edge caching<br/>
                            • DDoS protection<br/>
                            • No user data stored
                          </td>
                          <td className="p-2 border">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-950">N/A (no data)</Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Data Protection by Integration</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          Full GDPR Compliance
                        </h4>
                        <ul className="text-sm space-y-1">
                          <li>• Supabase (backend)</li>
                          <li>• OpenAI (with PII masking)</li>
                          <li>• AssemblyAI (audio only)</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2 text-yellow-700 dark:text-yellow-400">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          Limited Data Sharing
                        </h4>
                        <ul className="text-sm space-y-1">
                          <li>• ElevenLabs (non-PHI text)</li>
                          <li>• EmailJS (anonymised notifications)</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          No Data Sharing
                        </h4>
                        <ul className="text-sm space-y-1">
                          <li>• Lovable CDN (static assets)</li>
                          <li>• Client-side libraries</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

          </div>
        </div>
      </div>
    </>
  );
};

export default DataFlowArchitecture;
