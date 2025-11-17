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
  ArrowRight,
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
    { id: "sequences", label: "Sequence Diagrams", icon: Workflow },
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">High-Level System Architecture</h3>
                    <lov-mermaid>
graph TB
    subgraph "Client Layer"
        A[Web Browser<br/>React + TypeScript]
        B[Mobile Browser<br/>Responsive PWA]
    end
    
    subgraph "CDN & Edge"
        C[Lovable CDN<br/>Static Assets]
        D[Edge Caching<br/>Global Distribution]
    end
    
    subgraph "Authentication Layer"
        E[Supabase Auth<br/>OTP + Password]
        F[Session Management<br/>JWT Tokens]
    end
    
    subgraph "Application Layer"
        G[React Application<br/>TanStack Query]
        H[Real-time Subscriptions<br/>WebSocket]
        I[File Upload/Download<br/>Multipart Handling]
    end
    
    subgraph "Backend Services"
        J[Supabase PostgreSQL<br/>Primary Database]
        K[Row Level Security<br/>RLS Policies]
        L[Database Functions<br/>Stored Procedures]
        M[Storage Buckets<br/>Encrypted Files]
    end
    
    subgraph "AI Integration Layer"
        N[OpenAI API<br/>GPT-4 & Embeddings]
        O[ElevenLabs API<br/>Voice Synthesis]
        P[AssemblyAI<br/>Transcription]
    end
    
    subgraph "Security & Monitoring"
        Q[Audit Logging<br/>Comprehensive Trails]
        R[Data Encryption<br/>AES-256 at Rest]
        S[TLS 1.3<br/>In Transit]
    end
    
    A & B --> C
    C --> D
    A & B --> E
    E --> F
    F --> G
    G --> H
    G --> I
    H --> J
    I --> M
    J --> K
    J --> L
    K --> J
    G --> N
    G --> O
    G --> P
    J --> Q
    J --> R
    A & B -.-> S
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style G fill:#3b82f6,stroke:#1e40af,color:#fff
    style J fill:#10b981,stroke:#059669,color:#fff
    style K fill:#10b981,stroke:#059669,color:#fff
    style L fill:#10b981,stroke:#059669,color:#fff
    style M fill:#10b981,stroke:#059669,color:#fff
    style N fill:#f59e0b,stroke:#d97706,color:#fff
    style O fill:#f59e0b,stroke:#d97706,color:#fff
    style P fill:#f59e0b,stroke:#d97706,color:#fff
    style Q fill:#ef4444,stroke:#dc2626,color:#fff
    style R fill:#ef4444,stroke:#dc2626,color:#fff
    style S fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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
                        <li>• Token optimization</li>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Authentication Flow Diagram</h3>
                    <lov-mermaid>
graph TB
    subgraph "User Actions"
        A[User Enters Credentials<br/>Email + Password/OTP]
    end
    
    subgraph "Frontend Validation"
        B{Form Validation<br/>Client-side}
        C[Display Error<br/>Invalid Format]
    end
    
    subgraph "Supabase Auth Service"
        D[Auth Request<br/>POST /auth/v1]
        E{Credential<br/>Validation}
        F[Generate JWT Token<br/>Access + Refresh]
        G[Return Error<br/>401 Unauthorised]
    end
    
    subgraph "Session Management"
        H[Store JWT in<br/>Secure Storage]
        I[Set Session Cookie<br/>HttpOnly]
        J[Session Activity Monitor<br/>Inactivity Tracking]
    end
    
    subgraph "Authorisation Check"
        K[Extract User ID<br/>from JWT]
        L[Query user_profiles<br/>& user_practices]
        M{Check Module<br/>Permissions}
        N[Grant Access<br/>to Resources]
        O[Deny Access<br/>403 Forbidden]
    end
    
    subgraph "Row Level Security"
        P[Apply RLS Policies<br/>auth.uid = user_id]
        Q[Filter Database Queries<br/>Practice-specific]
    end
    
    A --> B
    B -->|Valid| D
    B -->|Invalid| C
    D --> E
    E -->|Success| F
    E -->|Failure| G
    F --> H
    H --> I
    I --> J
    J --> K
    K --> L
    L --> M
    M -->|Authorised| N
    M -->|Unauthorised| O
    N --> P
    P --> Q
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style D fill:#10b981,stroke:#059669,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style F fill:#10b981,stroke:#059669,color:#fff
    style P fill:#ef4444,stroke:#dc2626,color:#fff
    style Q fill:#ef4444,stroke:#dc2626,color:#fff
    style G fill:#f59e0b,stroke:#d97706,color:#fff
    style O fill:#f59e0b,stroke:#d97706,color:#fff
                    </lov-mermaid>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Meeting Transcription Flow</h3>
                    <lov-mermaid>
graph TB
    subgraph "Audio Capture"
        A[Browser Microphone<br/>MediaRecorder API]
        B[Audio Chunks<br/>250ms intervals]
        C[Local Buffer<br/>In-memory Queue]
    end
    
    subgraph "Session Management"
        D[Create Meeting Record<br/>meetings table]
        E[Create Audio Session<br/>audio_sessions table]
        F[Active Meeting Monitor<br/>Heartbeat tracking]
    end
    
    subgraph "Transcription Services"
        G[AssemblyAI WebSocket<br/>Real-time streaming]
        H[Transcription Chunks<br/>assembly_transcripts]
        I[Confidence Scoring<br/>Quality metrics]
    end
    
    subgraph "Storage Layer"
        J[Audio Storage<br/>Supabase Storage]
        K[Audio Chunks Table<br/>Metadata tracking]
        L[Chunk Cleaning<br/>Background process]
    end
    
    subgraph "AI Processing"
        M[OpenAI GPT-4<br/>Summary generation]
        N[Extract Action Items<br/>Structured data]
        O[Generate Meeting Notes<br/>Formatted document]
    end
    
    subgraph "Document Creation"
        P[Create Meeting Summary<br/>meeting_summaries table]
        Q[Generate PDF/DOCX<br/>Export formats]
        R[Share with Attendees<br/>Email distribution]
    end
    
    subgraph "Audit & Security"
        S[Audit Log Entry<br/>User actions tracked]
        T[RLS Enforcement<br/>Practice isolation]
        U[Data Retention<br/>Automatic cleanup]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    C --> G
    G --> H
    H --> I
    C --> J
    J --> K
    K --> L
    I --> M
    M --> N
    N --> O
    O --> P
    P --> Q
    Q --> R
    D --> S
    H --> T
    P --> U
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style C fill:#3b82f6,stroke:#1e40af,color:#fff
    style G fill:#f59e0b,stroke:#d97706,color:#fff
    style J fill:#10b981,stroke:#059669,color:#fff
    style K fill:#10b981,stroke:#059669,color:#fff
    style M fill:#f59e0b,stroke:#d97706,color:#fff
    style N fill:#f59e0b,stroke:#d97706,color:#fff
    style S fill:#ef4444,stroke:#dc2626,color:#fff
    style T fill:#ef4444,stroke:#dc2626,color:#fff
    style U fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Complaints Workflow</h3>
                    <lov-mermaid>
graph TB
    subgraph "Complaint Submission"
        A[User Creates Complaint<br/>Web form entry]
        B[Validate Required Fields<br/>Patient info, description]
        C[Generate Reference Number<br/>Auto-incremented]
    end
    
    subgraph "Initial Processing"
        D[Store in Database<br/>complaints table]
        E[AI Categorisation<br/>OpenAI classification]
        F[Priority Assignment<br/>Urgent/High/Medium/Low]
        G[Send Acknowledgement<br/>Email to complainant]
    end
    
    subgraph "Document Management"
        H[Upload Supporting Docs<br/>complaint_documents]
        I[Store in Supabase Storage<br/>Encrypted bucket]
        J[OCR Processing<br/>Extract text if needed]
    end
    
    subgraph "Investigation"
        K[Assign to Staff Member<br/>Workflow routing]
        L[Request Staff Responses<br/>Secure token links]
        M[Collect Evidence<br/>complaint_investigation_evidence]
        N[AI-Assisted Analysis<br/>Pattern detection]
    end
    
    subgraph "Response Generation"
        O[Draft Outcome Letter<br/>AI-assisted drafting]
        P[Human Review & Edit<br/>Clinician approval]
        Q[Final Approval<br/>Practice manager sign-off]
        R[Send to Complainant<br/>Email + PDF]
    end
    
    subgraph "Audit & Compliance"
        S[Comprehensive Audit Log<br/>complaint_audit_detailed]
        T[Compliance Checks<br/>complaint_compliance_checks]
        U[CQC Reporting<br/>Annual data extraction]
    end
    
    subgraph "Data Retention"
        V[Calculate Retention Date<br/>6 years from closure]
        W[Automatic Archival<br/>Cold storage]
        X[Secure Deletion<br/>GDPR compliance]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    D --> H
    H --> I
    I --> J
    G --> K
    K --> L
    L --> M
    M --> N
    N --> O
    O --> P
    P --> Q
    Q --> R
    D --> S
    F --> T
    R --> U
    R --> V
    V --> W
    W --> X
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style D fill:#10b981,stroke:#059669,color:#fff
    style E fill:#f59e0b,stroke:#d97706,color:#fff
    style N fill:#f59e0b,stroke:#d97706,color:#fff
    style O fill:#f59e0b,stroke:#d97706,color:#fff
    style S fill:#ef4444,stroke:#dc2626,color:#fff
    style T fill:#ef4444,stroke:#dc2626,color:#fff
    style U fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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
                          <h4 className="font-semibold mb-2">Response Generation</h4>
                          <ul className="text-sm space-y-1 ml-4">
                            <li>• AI drafts initial response based on investigation findings</li>
                            <li>• Multiple tone options: formal, empathetic, clinical</li>
                            <li>• Template library for common scenarios</li>
                            <li>• Mandatory human review and approval workflow</li>
                            <li>• Digital signature integration for authorised signatories</li>
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

            {/* AI Integration Flow */}
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">AI Integration Flow</h3>
                    <lov-mermaid>
graph TB
    subgraph "User Request"
        A[User Action<br/>AI feature trigger]
        B[Context Preparation<br/>Data masking]
        C[Request Validation<br/>Input sanitisation]
    end
    
    subgraph "Request Processing"
        D{Check API Key<br/>Configuration}
        E[Load from Secrets<br/>Supabase secrets]
        F[Rate Limit Check<br/>Token bucket]
        G[Queue Request<br/>If rate limited]
    end
    
    subgraph "OpenAI Integration"
        H[GPT-4 API Call<br/>HTTPS POST]
        I[Context Window<br/>Management]
        J[Token Optimisation<br/>Truncation logic]
        K[Response Streaming<br/>Server-Sent Events]
    end
    
    subgraph "ElevenLabs Integration"
        L[Voice Synthesis<br/>Text-to-Speech API]
        M[Audio Format<br/>MP3 generation]
        N[Storage Upload<br/>Supabase bucket]
    end
    
    subgraph "AssemblyAI Integration"
        O[Transcription WebSocket<br/>Real-time stream]
        P[Audio Processing<br/>Chunk upload]
        Q[Confidence Scoring<br/>Quality metrics]
    end
    
    subgraph "Error Handling"
        R{Request<br/>Success?}
        S[Return Response<br/>to User]
        T[Log Error<br/>Audit trail]
        U[Retry Logic<br/>Exponential backoff]
        V[Fallback Response<br/>User notification]
    end
    
    subgraph "Security Controls"
        W[PII Masking<br/>Before API call]
        X[Response Sanitisation<br/>After API call]
        Y[Audit Logging<br/>All AI interactions]
    end
    
    A --> B
    B --> C
    C --> D
    D -->|Valid| F
    D -->|Missing| E
    E --> F
    F -->|Allowed| H
    F -->|Limited| G
    G --> F
    H --> I
    I --> J
    J --> K
    A --> L
    L --> M
    M --> N
    A --> O
    O --> P
    P --> Q
    K --> R
    N --> R
    Q --> R
    R -->|Success| S
    R -->|Failure| T
    T --> U
    U -->|Retry| H
    U -->|Max retries| V
    B --> W
    K --> X
    S --> Y
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style H fill:#f59e0b,stroke:#d97706,color:#fff
    style L fill:#f59e0b,stroke:#d97706,color:#fff
    style O fill:#f59e0b,stroke:#d97706,color:#fff
    style W fill:#ef4444,stroke:#dc2626,color:#fff
    style X fill:#ef4444,stroke:#dc2626,color:#fff
    style Y fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Defence-in-Depth Security Model</h3>
                    <lov-mermaid>
graph TB
    subgraph "Layer 1: Network Security"
        A[TLS 1.3 Encryption<br/>All traffic encrypted]
        B[CDN Protection<br/>DDoS mitigation]
        C[Firewall Rules<br/>IP whitelisting]
    end
    
    subgraph "Layer 2: Application Security"
        D[Input Validation<br/>XSS & SQL injection prevention]
        E[CSRF Protection<br/>Token verification]
        F[Content Security Policy<br/>CSP headers]
        G[Rate Limiting<br/>Abuse prevention]
    end
    
    subgraph "Layer 3: Authentication"
        H[Supabase Auth<br/>JWT tokens]
        I[MFA Support<br/>OTP codes]
        J[Session Management<br/>Timeout + activity monitoring]
        K[Password Policy<br/>Complexity requirements]
    end
    
    subgraph "Layer 4: Authorisation"
        L[Row Level Security<br/>Database-enforced]
        M[Role-Based Access<br/>User/Admin/System roles]
        N[Practice Isolation<br/>Multi-tenancy]
        O[Module Permissions<br/>Feature flags]
    end
    
    subgraph "Layer 5: Data Encryption"
        P[Encryption at Rest<br/>AES-256]
        Q[Encryption in Transit<br/>TLS 1.3]
        R[Field-Level Encryption<br/>Sensitive data]
        S[Key Management<br/>Supabase managed]
    end
    
    subgraph "Layer 6: Audit & Monitoring"
        T[Comprehensive Audit Logs<br/>All user actions]
        U[Security Event Detection<br/>Anomaly detection]
        V[Automated Alerts<br/>Suspicious activity]
        W[Compliance Reporting<br/>GDPR, CQC]
    end
    
    subgraph "Layer 7: Incident Response"
        X[Incident Detection<br/>Real-time monitoring]
        Y[Automated Response<br/>Account lockout]
        Z[Manual Investigation<br/>Security team review]
        AA[Post-Incident Review<br/>Lessons learned]
    end
    
    A --> D
    B --> D
    C --> D
    D --> H
    E --> H
    F --> H
    G --> H
    H --> L
    I --> L
    J --> L
    K --> L
    L --> P
    M --> P
    N --> P
    O --> P
    P --> T
    Q --> T
    R --> T
    S --> T
    T --> X
    U --> X
    V --> X
    W --> X
    X --> Y
    Y --> Z
    Z --> AA
    
    style A fill:#ef4444,stroke:#dc2626,color:#fff
    style D fill:#ef4444,stroke:#dc2626,color:#fff
    style H fill:#ef4444,stroke:#dc2626,color:#fff
    style L fill:#ef4444,stroke:#dc2626,color:#fff
    style P fill:#ef4444,stroke:#dc2626,color:#fff
    style T fill:#ef4444,stroke:#dc2626,color:#fff
    style X fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Frontend Component Architecture</h3>
                    <lov-mermaid>
graph TB
    subgraph "Application Shell"
        A[App.tsx<br/>Root component]
        B[Router<br/>react-router-dom]
        C[Security Wrapper<br/>Session monitoring]
    end
    
    subgraph "Layout Components"
        D[Header<br/>Navigation & user menu]
        E[Sidebar<br/>Module navigation]
        F[Footer<br/>Branding & links]
    end
    
    subgraph "Page Components"
        G[AI4GP Page<br/>AI search interface]
        H[GPScribe Page<br/>Meeting recording]
        I[Complaints Page<br/>Complaint management]
        J[Settings Page<br/>User preferences]
        K[Admin Pages<br/>System configuration]
    end
    
    subgraph "Feature Components"
        L[MeetingRecorder<br/>Audio capture]
        M[TranscriptViewer<br/>Real-time display]
        N[ComplaintForm<br/>Data entry]
        O[AIChat<br/>Conversational UI]
        P[FileUpload<br/>Document handling]
    end
    
    subgraph "UI Components"
        Q[Shadcn UI<br/>Base components]
        R[Custom Components<br/>Branded elements]
        S[Forms<br/>react-hook-form]
        T[Modals & Dialogs<br/>Radix UI]
    end
    
    subgraph "State Management"
        U[TanStack Query<br/>Server state]
        V[React Context<br/>Global state]
        W[Local State<br/>useState]
        X[Supabase Subscriptions<br/>Real-time updates]
    end
    
    subgraph "Data Layer"
        Y[API Hooks<br/>Custom hooks]
        Z[Supabase Client<br/>Database access]
        AA[File Upload<br/>Storage API]
        AB[Real-time Listeners<br/>WebSocket]
    end
    
    A --> B
    A --> C
    B --> D
    B --> E
    B --> F
    B --> G
    B --> H
    B --> I
    B --> J
    B --> K
    G --> O
    H --> L
    H --> M
    I --> N
    I --> P
    L --> Q
    N --> S
    O --> T
    U --> Y
    V --> Y
    W --> Y
    X --> Y
    Y --> Z
    Y --> AA
    Y --> AB
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style G fill:#3b82f6,stroke:#1e40af,color:#fff
    style H fill:#3b82f6,stroke:#1e40af,color:#fff
    style I fill:#3b82f6,stroke:#1e40af,color:#fff
    style U fill:#10b981,stroke:#059669,color:#fff
    style Z fill:#10b981,stroke:#059669,color:#fff
                    </lov-mermaid>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Backend Service Architecture</h3>
                    <lov-mermaid>
graph TB
    subgraph "Supabase Platform"
        A[PostgreSQL 15<br/>Primary database]
        B[Connection Pooler<br/>PgBouncer]
        C[Realtime Server<br/>WebSocket]
    end
    
    subgraph "Database Schema"
        D[User Management<br/>user_profiles, user_practices]
        E[Clinical Data<br/>meetings, complaints]
        F[Audit Tables<br/>Comprehensive logging]
        G[Configuration<br/>Settings & templates]
    end
    
    subgraph "Row Level Security"
        H[RLS Policies<br/>Enforced at DB level]
        I[User Isolation<br/>auth.uid checks]
        J[Practice Isolation<br/>Multi-tenancy]
        K[Admin Override<br/>Conditional access]
    end
    
    subgraph "Database Functions"
        L[Custom Functions<br/>PL/pgSQL]
        M[Computed Columns<br/>Virtual fields]
        N[Validation Logic<br/>Check constraints]
        O[Business Rules<br/>Triggers]
    end
    
    subgraph "Triggers & Automation"
        P[Audit Logging<br/>After insert/update/delete]
        Q[Timestamp Management<br/>updated_at automation]
        R[Data Validation<br/>Before insert/update]
        S[Cascade Operations<br/>Referential integrity]
    end
    
    subgraph "Storage & Files"
        T[Supabase Storage<br/>S3-compatible]
        U[Encrypted Buckets<br/>Server-side encryption]
        V[Access Control<br/>Storage policies]
        W[File Metadata<br/>Size, type, checksums]
    end
    
    subgraph "Backup & Recovery"
        X[Automated Backups<br/>Daily snapshots]
        Y[Point-in-Time Recovery<br/>7-day retention]
        Z[Disaster Recovery<br/>Multi-region]
        AA[Backup Encryption<br/>AES-256]
    end
    
    A --> B
    B --> C
    A --> D
    A --> E
    A --> F
    A --> G
    D --> H
    E --> H
    F --> H
    H --> I
    H --> J
    H --> K
    A --> L
    L --> M
    L --> N
    L --> O
    O --> P
    O --> Q
    O --> R
    O --> S
    A --> T
    T --> U
    U --> V
    T --> W
    A --> X
    X --> Y
    X --> Z
    X --> AA
    
    style A fill:#10b981,stroke:#059669,color:#fff
    style B fill:#10b981,stroke:#059669,color:#fff
    style D fill:#10b981,stroke:#059669,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style H fill:#ef4444,stroke:#dc2626,color:#fff
    style P fill:#ef4444,stroke:#dc2626,color:#fff
    style T fill:#10b981,stroke:#059669,color:#fff
    style X fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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
                  <CardDescription>Entity-relationship diagram and table structure</CardDescription>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Core Database Schema</h3>
                    <lov-mermaid>
erDiagram
    USER_PROFILES ||--o{ USER_PRACTICES : "belongs to"
    USER_PROFILES ||--o{ MEETINGS : "creates"
    USER_PROFILES ||--o{ COMPLAINTS : "creates"
    USER_PROFILES ||--o{ AI_4_PM_SEARCHES : "creates"
    
    GP_PRACTICES ||--o{ USER_PRACTICES : "has members"
    GP_PRACTICES ||--o{ PRACTICE_DETAILS : "has details"
    GP_PRACTICES ||--o{ COMPLAINTS : "receives"
    GP_PRACTICES ||--o{ ATTENDEES : "employs"
    
    MEETINGS ||--o{ AUDIO_SESSIONS : "has"
    AUDIO_SESSIONS ||--o{ AUDIO_CHUNKS : "contains"
    MEETINGS ||--o{ ASSEMBLY_TRANSCRIPTS : "generates"
    MEETINGS ||--o{ MEETING_SUMMARIES : "produces"
    MEETINGS ||--o{ MEETING_ATTENDEES : "includes"
    ATTENDEES ||--o{ MEETING_ATTENDEES : "attends"
    
    COMPLAINTS ||--o{ COMPLAINT_DOCUMENTS : "has"
    COMPLAINTS ||--o{ COMPLAINT_NOTES : "has"
    COMPLAINTS ||--o{ COMPLAINT_AUDIT_LOG : "logs"
    COMPLAINTS ||--o{ COMPLAINT_COMPLIANCE_CHECKS : "tracks"
    COMPLAINTS ||--o{ COMPLAINT_OUTCOMES : "resolves"
    COMPLAINTS ||--o{ COMPLAINT_INVESTIGATION_FINDINGS : "investigates"
    
    CQC_POLICIES ||--o{ CQC_EVIDENCE : "supports"
    CQC_ASSESSMENTS ||--o{ CQC_EVIDENCE : "references"
    CQC_ALERTS ||--o{ CQC_POLICIES : "relates to"
    
    CONTRACTORS ||--o{ CONTRACTOR_RESUMES : "uploads"
    CONTRACTORS ||--o{ CONTRACTOR_COMPETENCIES : "possesses"
    CONTRACTORS ||--o{ CONTRACTOR_EXPERIENCE : "has"
    CONTRACTORS ||--o{ CONTRACTOR_NOTES : "annotated"
    
    USER_PROFILES {
        uuid id PK
        uuid user_id FK
        string full_name
        string email
        string role
        uuid practice_id FK
        jsonb modules
        timestamp created_at
        timestamp updated_at
    }
    
    MEETINGS {
        uuid id PK
        uuid user_id FK
        string title
        string status
        timestamp meeting_date
        jsonb meeting_notes
        jsonb attendees
        timestamp created_at
    }
    
    COMPLAINTS {
        uuid id PK
        uuid created_by FK
        string reference_number
        string patient_name
        string category
        string priority
        string status
        text complaint_description
        timestamp created_at
    }
    
    CQC_POLICIES {
        uuid id PK
        string title
        string policy_type
        string cqc_domain
        string file_path
        number ai_compliance_score
        timestamp review_date
    }
                    </lov-mermaid>
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
                </CardContent>
              </Card>
            </section>

            {/* Sequence Diagrams */}
            <section id="sequences">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Workflow className="w-6 h-6" />
                    Sequence Diagrams for Critical Operations
                  </CardTitle>
                  <CardDescription>Step-by-step interaction flows for key features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="seq-auth">
                      <AccordionTrigger>User Authentication Sequence</AccordionTrigger>
                      <AccordionContent>
                        <lov-mermaid>
sequenceDiagram
    actor User
    participant Browser
    participant React App
    participant Supabase Auth
    participant PostgreSQL
    participant RLS Engine
    
    User->>Browser: Enter credentials
    Browser->>React App: Submit login form
    React App->>React App: Validate input
    React App->>Supabase Auth: POST /auth/v1/token
    Supabase Auth->>Supabase Auth: Verify credentials
    alt Credentials valid
        Supabase Auth->>Supabase Auth: Generate JWT
        Supabase Auth-->>React App: Return access & refresh tokens
        React App->>Browser: Store tokens securely
        React App->>PostgreSQL: Query user_profiles
        PostgreSQL->>RLS Engine: Apply RLS policy
        RLS Engine-->>PostgreSQL: Filter by auth.uid()
        PostgreSQL-->>React App: Return user profile
        React App->>React App: Set user context
        React App-->>Browser: Redirect to dashboard
        Browser-->>User: Show authenticated UI
    else Credentials invalid
        Supabase Auth-->>React App: Return 401 error
        React App-->>Browser: Show error message
        Browser-->>User: Display "Invalid credentials"
    end
                        </lov-mermaid>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="seq-meeting">
                      <AccordionTrigger>Meeting Recording & Transcription Sequence</AccordionTrigger>
                      <AccordionContent>
                        <lov-mermaid>
sequenceDiagram
    actor User
    participant Browser
    participant React App
    participant MediaRecorder
    participant AssemblyAI
    participant Supabase DB
    participant Supabase Storage
    participant OpenAI
    
    User->>Browser: Click "Start Recording"
    Browser->>React App: Request microphone permission
    React App->>MediaRecorder: Start audio capture
    React App->>Supabase DB: Create meeting record
    Supabase DB-->>React App: Return meeting ID
    React App->>Supabase DB: Create audio session
    
    loop Every 250ms
        MediaRecorder->>React App: Audio chunk available
        React App->>Supabase Storage: Upload audio chunk
        React App->>AssemblyAI: Stream audio (WebSocket)
        AssemblyAI->>AssemblyAI: Process audio
        AssemblyAI-->>React App: Return transcription
        React App->>Supabase DB: Store transcript chunk
        React App->>Browser: Update UI with transcript
    end
    
    User->>Browser: Click "Stop Recording"
    Browser->>React App: Stop recording request
    React App->>MediaRecorder: Stop capture
    React App->>AssemblyAI: Close WebSocket
    React App->>Supabase DB: Mark session complete
    React App->>Supabase DB: Fetch full transcript
    Supabase DB-->>React App: Return transcript
    React App->>OpenAI: Generate meeting summary
    OpenAI-->>React App: Return summary & actions
    React App->>Supabase DB: Store meeting summary
    React App->>Browser: Show summary for review
    Browser-->>User: Display meeting notes
                        </lov-mermaid>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="seq-complaint">
                      <AccordionTrigger>Complaint Submission & Processing Sequence</AccordionTrigger>
                      <AccordionContent>
                        <lov-mermaid>
sequenceDiagram
    actor User
    participant React App
    participant Supabase DB
    participant Supabase Storage
    participant OpenAI
    participant Email Service
    
    User->>React App: Fill complaint form
    User->>React App: Upload supporting docs
    React App->>Supabase Storage: Store documents
    Supabase Storage-->>React App: Return file paths
    
    User->>React App: Submit complaint
    React App->>React App: Validate form data
    React App->>Supabase DB: Insert complaint record
    Supabase DB->>Supabase DB: Generate reference number
    Supabase DB->>Supabase DB: Trigger audit log
    Supabase DB-->>React App: Return complaint ID
    
    React App->>OpenAI: Categorise complaint
    OpenAI-->>React App: Return category & priority
    React App->>Supabase DB: Update complaint
    
    React App->>OpenAI: Generate acknowledgement
    OpenAI-->>React App: Return draft letter
    React App->>Supabase DB: Store acknowledgement
    React App->>Email Service: Send to complainant
    Email Service-->>User: Receive acknowledgement
    
    React App->>Supabase DB: Create compliance checklist
    React App->>Supabase DB: Assign to staff member
    React App-->>User: Show success message
                        </lov-mermaid>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Deployment Architecture</h3>
                    <lov-mermaid>
graph TB
    subgraph "Development"
        A[Developer Workstation<br/>Local development]
        B[Git Repository<br/>Version control]
        C[Feature Branches<br/>Code review]
    end
    
    subgraph "CI/CD Pipeline"
        D[Build Process<br/>Vite bundler]
        E[Type Checking<br/>TypeScript compiler]
        F[Linting & Testing<br/>ESLint + Tests]
        G[Build Artifacts<br/>Optimised bundle]
    end
    
    subgraph "Lovable Platform"
        H[Lovable CDN<br/>Global edge network]
        I[Static Assets<br/>HTML, CSS, JS]
        J[Cache Strategy<br/>Intelligent caching]
    end
    
    subgraph "Supabase Cloud"
        K[PostgreSQL Database<br/>Managed service]
        L[Storage Buckets<br/>File storage]
        M[Auth Service<br/>User management]
        N[Realtime Server<br/>WebSocket]
    end
    
    subgraph "Monitoring & Logging"
        O[Application Logs<br/>Error tracking]
        P[Performance Metrics<br/>Response times]
        Q[Security Events<br/>Audit logs]
        R[Uptime Monitoring<br/>Health checks]
    end
    
    subgraph "Backup & DR"
        S[Automated Backups<br/>Daily snapshots]
        T[Point-in-Time Recovery<br/>7-day retention]
        U[Geo-Replication<br/>Multi-region]
        V[Disaster Recovery Plan<br/>RTO: 4h, RPO: 1h]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    J --> L
    J --> M
    J --> N
    H --> O
    K --> P
    M --> Q
    N --> R
    K --> S
    S --> T
    S --> U
    S --> V
    
    style H fill:#3b82f6,stroke:#1e40af,color:#fff
    style K fill:#10b981,stroke:#059669,color:#fff
    style L fill:#10b981,stroke:#059669,color:#fff
    style M fill:#10b981,stroke:#059669,color:#fff
    style O fill:#f59e0b,stroke:#d97706,color:#fff
    style S fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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
                        <li>• <strong>CDN:</strong> <200ms latency globally</li>
                        <li>• <strong>Database:</strong> <50ms query response</li>
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

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Data Lifecycle Flow</h3>
                    <lov-mermaid>
graph TB
    subgraph "Data Creation"
        A[User Creates Data<br/>Form submission]
        B[Data Validation<br/>Input checks]
        C[Store in Database<br/>Initial record]
        D[Calculate Retention Date<br/>Based on policy]
    end
    
    subgraph "Active Use Phase"
        E[Data Accessible<br/>Normal operations]
        F[Regular Access<br/>Read/write operations]
        G[Audit Logging<br/>Track all access]
        H[Updates & Modifications<br/>Version tracking]
    end
    
    subgraph "Retention Monitoring"
        I[Daily Retention Scan<br/>Automated check]
        J{Retention Date<br/>Passed?}
        K[Continue Active Use<br/>No action needed]
    end
    
    subgraph "Archival Phase"
        L[Mark for Archival<br/>Status update]
        M[Notify Stakeholders<br/>Email alerts]
        N[Move to Cold Storage<br/>Compressed backup]
        O[Update Access Controls<br/>Read-only]
    end
    
    subgraph "Deletion Phase"
        P[Final Retention Check<br/>Legal requirements]
        Q[User Confirmation<br/>If required]
        R[Secure Deletion<br/>Multi-pass wipe]
        S[Deletion Audit Log<br/>Immutable record]
        T[Update Related Records<br/>Cascade cleanup]
    end
    
    subgraph "Audit & Compliance"
        U[Retention Policy Table<br/>data_retention_policies]
        V[Compliance Reports<br/>GDPR documentation]
        W[Right to Erasure<br/>User requests]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    H --> I
    I --> J
    J -->|No| K
    K --> F
    J -->|Yes| L
    L --> M
    M --> N
    N --> O
    O --> P
    P --> Q
    Q --> R
    R --> S
    S --> T
    U --> D
    V --> I
    W --> P
    
    style C fill:#10b981,stroke:#059669,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style G fill:#ef4444,stroke:#dc2626,color:#fff
    style L fill:#f59e0b,stroke:#d97706,color:#fff
    style R fill:#ef4444,stroke:#dc2626,color:#fff
    style S fill:#ef4444,stroke:#dc2626,color:#fff
                    </lov-mermaid>
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
