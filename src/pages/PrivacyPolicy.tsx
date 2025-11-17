import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Lock, Database, UserCheck, FileText, AlertCircle, Mail, Phone } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-l-4 border-primary p-6 mb-8 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <Badge variant="outline" className="text-xs">NHS OFFICIAL-SENSITIVE</Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-xl text-muted-foreground mb-4">NoteWell AI Healthcare Management System</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-semibold">Version:</span> 2.0</div>
            <div><span className="font-semibold">Effective Date:</span> {new Date().toLocaleDateString('en-GB')}</div>
            <div><span className="font-semibold">Last Updated:</span> November 2025</div>
            <div><span className="font-semibold">Status:</span> <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">ACTIVE</Badge></div>
          </div>
        </div>

        {/* Introduction */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Introduction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base leading-relaxed">
              PCN Services Ltd (trading as <strong>NoteWell AI</strong>) is committed to protecting the privacy and security of personal data processed through our healthcare management platform. As a registered <strong>MHRA Class I Medical Device</strong>, we operate under the highest standards of data protection and clinical safety.
            </p>
            <p className="text-base leading-relaxed">
              This Privacy Policy explains how we collect, use, store, and protect personal information, including patient-identifiable data, in accordance with:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>UK General Data Protection Regulation (UK GDPR)</li>
              <li>Data Protection Act 2018</li>
              <li>NHS Data Security and Protection Toolkit requirements</li>
              <li>Common Law Duty of Confidentiality</li>
              <li>Health and Social Care Act 2012</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Controller Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <UserCheck className="w-6 h-6" />
              Data Controller & Data Protection Officer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Data Controller</h3>
              <p className="text-sm text-muted-foreground">
                <strong>PCN Services Ltd</strong><br />
                Trading as NoteWell AI<br />
                Registered in England and Wales<br />
                Company Registration Number: 13491108<br />
                8 Watson Close<br />
                Northampton<br />
                NN5 6ER
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Data Protection Officer (DPO)</h3>
              <p className="text-sm text-muted-foreground mb-2">
                You can contact our Data Protection Officer regarding any privacy or data protection concerns:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">dpo@gpnotewell.co.uk</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">07740 812180</span>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="text-sm">
                <strong>Important:</strong> Your GP practice or healthcare organisation is the Data Controller for patient data. NoteWell AI acts as a <strong>Data Processor</strong> on behalf of your organisation.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Legal Basis for Processing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Legal Basis for Processing Personal Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">We process personal data under the following legal bases:</p>
            
            <div className="space-y-3">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h4 className="font-semibold">1. Legitimate Interests (Article 6(1)(f) UK GDPR)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing is necessary for the legitimate interests of healthcare provision, administrative efficiency, and quality improvement, provided this does not override the rights and freedoms of data subjects.
                </p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h4 className="font-semibold">2. Consent (Article 6(1)(a) UK GDPR)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Where explicit consent is obtained from individuals for specific processing activities, particularly for non-clinical administrative functions.
                </p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <h4 className="font-semibold">3. Legal Obligation (Article 6(1)(c) UK GDPR)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing necessary to comply with legal requirements, including CQC regulations, NHS contractual obligations, and statutory reporting duties.
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Special Category Data (Article 9 UK GDPR)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                For processing health data (special category data), we rely on:
              </p>
              <ul className="list-disc ml-6 space-y-1 text-sm">
                <li><strong>Article 9(2)(h):</strong> Processing necessary for health or social care purposes</li>
                <li><strong>Article 9(2)(i):</strong> Processing necessary for public health purposes</li>
                <li>Common Law Duty of Confidentiality</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data Collection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Database className="w-6 h-6" />
              Data We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-300">Patient-Identifiable Data Notice</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">
                    NoteWell AI processes patient-identifiable information as part of clinical and administrative workflows. All such data is handled in strict accordance with NHS Information Governance standards.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. Patient Data (via GP Scribe & Meeting Notes)</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>Patient demographics (name, date of birth, NHS number, address, contact details)</li>
                  <li>Clinical information (symptoms, diagnoses, treatment plans, medical history)</li>
                  <li>Consultation transcripts and audio recordings (temporarily)</li>
                  <li>Clinical notes and summaries generated by the system</li>
                  <li>Prescription information and medication records</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">2. Healthcare Staff Data</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>User account information (name, email address, job title, professional registration)</li>
                  <li>Authentication credentials (encrypted passwords, MFA tokens)</li>
                  <li>Practice and organisational affiliation</li>
                  <li>Access logs and system usage data</li>
                  <li>Professional development and training records</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">3. Complaints Management Data</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>Complainant personal details (name, contact information)</li>
                  <li>Patient information referenced in complaints</li>
                  <li>Complaint correspondence and evidence</li>
                  <li>Investigation findings and outcomes</li>
                  <li>Staff responses and documented actions</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">4. Meeting & Governance Data</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>Attendee names and roles</li>
                  <li>Meeting transcripts and recordings (temporarily)</li>
                  <li>Action items and decisions</li>
                  <li>Minutes and summaries</li>
                  <li>Governance documentation</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">5. Technical & Usage Data</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>IP addresses and device identifiers</li>
                  <li>Browser type and operating system</li>
                  <li>System performance and error logs</li>
                  <li>Feature usage analytics</li>
                  <li>Security event logs</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Data */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6" />
              How We Use Your Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Primary Care Delivery</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Generating clinical consultation notes and summaries</li>
                  <li>Supporting clinical decision-making with AI-assisted documentation</li>
                  <li>Facilitating communication between healthcare professionals</li>
                  <li>Maintaining accurate patient records</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Administrative & Governance</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Managing complaints in compliance with NHS requirements</li>
                  <li>Recording and tracking governance meetings and decisions</li>
                  <li>Generating reports for CQC, ICB, and internal audits</li>
                  <li>Monitoring fridge temperatures and equipment compliance</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">System Security & Integrity</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>User authentication and access control</li>
                  <li>Detecting and preventing security threats</li>
                  <li>Maintaining comprehensive audit logs</li>
                  <li>Ensuring data backup and disaster recovery</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Service Improvement</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Analysing system performance and reliability</li>
                  <li>Improving AI model accuracy (using anonymised data only)</li>
                  <li>Developing new features based on user feedback</li>
                  <li>Ensuring clinical safety and effectiveness</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Legal & Regulatory Compliance</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Complying with CQC inspection requirements</li>
                  <li>Meeting NHS contractual obligations</li>
                  <li>Responding to subject access requests</li>
                  <li>Fulfilling statutory reporting duties</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Sharing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <UserCheck className="w-6 h-6" />
              Data Sharing & Third Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="font-semibold text-blue-900 dark:text-blue-300">
                We do not sell, rent, or trade personal data. Data is only shared when necessary for service delivery or legal compliance.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Service Providers & Processors</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  We work with carefully selected third-party processors who are bound by data processing agreements:
                </p>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li><strong>Supabase (UK/EU):</strong> Database hosting and authentication (UK-based infrastructure)</li>
                  <li><strong>OpenAI (via Azure UK):</strong> AI processing for transcription and summarisation (UK South region)</li>
                  <li><strong>ElevenLabs:</strong> Voice synthesis (audio overviews only, no patient data)</li>
                  <li><strong>AssemblyAI:</strong> Speech-to-text transcription services</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">NHS & Healthcare Partners</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Your GP practice or PCN (as Data Controller)</li>
                  <li>ICBs for governance and reporting purposes</li>
                  <li>CQC when legally required for inspections</li>
                  <li>NHS England for national service monitoring (anonymised data)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Legal & Regulatory Authorities</h4>
                <p className="text-sm text-muted-foreground">
                  We may share data when required by law, including:
                </p>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Court orders and legal proceedings</li>
                  <li>Information Commissioner's Office (ICO) investigations</li>
                  <li>MHRA medical device incident reporting</li>
                  <li>Police and safeguarding authorities (when legally justified)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Lock className="w-6 h-6" />
              Data Security Measures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              We implement industry-leading security measures to protect all data processed through NoteWell AI:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Encryption
                </h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>TLS 1.2+ for data in transit</li>
                  <li>AES-256 encryption at rest</li>
                  <li>Encrypted database backups</li>
                  <li>End-to-end encryption for audio</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Access Control
                </h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Role-based access control (RBAC)</li>
                  <li>Row-Level Security (RLS)</li>
                  <li>Multi-factor authentication (MFA)</li>
                  <li>Automatic session timeout</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Audit & Monitoring
                </h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Comprehensive audit logs</li>
                  <li>Real-time security monitoring</li>
                  <li>Failed login attempt tracking</li>
                  <li>Data access logging</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Infrastructure
                </h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>UK-only data hosting</li>
                  <li>Redundant backups (30-day retention)</li>
                  <li>Network segregation</li>
                  <li>DDoS protection</li>
                </ul>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <p className="text-sm">
                <strong>Annual Penetration Testing:</strong> NoteWell AI undergoes CREST-aligned security testing annually and after significant system changes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Database className="w-6 h-6" />
              Data Retention & Deletion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              We retain data for the minimum period necessary, in accordance with NHS Records Management Code of Practice:
            </p>

            <div className="space-y-3">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h4 className="font-semibold">Patient Clinical Records</h4>
                <p className="text-sm text-muted-foreground">
                  Retained in line with GP practice retention policies (typically 10 years after last contact, or longer if required)
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h4 className="font-semibold">Complaints Records</h4>
                <p className="text-sm text-muted-foreground">
                  Minimum 10 years from date of closure (NHS England guidance)
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <h4 className="font-semibold">Meeting & Governance Records</h4>
                <p className="text-sm text-muted-foreground">
                  Minimum 6 years (corporate governance requirements)
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <h4 className="font-semibold">Audio Recordings</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically deleted within 30 days unless flagged for retention
                </p>
              </div>

              <div className="border-l-4 border-red-500 pl-4 py-2">
                <h4 className="font-semibold">System Audit Logs</h4>
                <p className="text-sm text-muted-foreground">
                  Retained for 7 years (legal and regulatory requirements)
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
              <p className="text-sm">
                <strong>Secure Deletion:</strong> When data is deleted, it is permanently removed from all systems and backups using secure erasure methods compliant with NHS Digital guidelines.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <UserCheck className="w-6 h-6" />
              Your Data Protection Rights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              Under UK GDPR, you have the following rights regarding your personal data:
            </p>

            <div className="space-y-3">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Right to Access</h4>
                <p className="text-sm text-muted-foreground">
                  Request a copy of your personal data held by NoteWell AI (Subject Access Request)
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Right to Rectification</h4>
                <p className="text-sm text-muted-foreground">
                  Request correction of inaccurate or incomplete data
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Right to Erasure ("Right to be Forgotten")</h4>
                <p className="text-sm text-muted-foreground">
                  Request deletion of data (subject to legal retention requirements)
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Right to Restrict Processing</h4>
                <p className="text-sm text-muted-foreground">
                  Request limitation on how your data is processed
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Right to Data Portability</h4>
                <p className="text-sm text-muted-foreground">
                  Receive your data in a structured, machine-readable format
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold">Right to Object</h4>
                <p className="text-sm text-muted-foreground">
                  Object to processing based on legitimate interests or direct marketing
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="text-sm">
                <strong>Important:</strong> For patient data, please contact your GP practice directly. For other enquiries, contact our DPO at <strong>dpo@gpnotewell.co.uk</strong>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Exercising Your Rights</h4>
              <p className="text-sm text-muted-foreground mb-2">
                We aim to respond to all requests within 30 days. You can make a request by:
              </p>
              <ul className="list-disc ml-6 space-y-1 text-sm">
                <li>Emailing our DPO: dpo@gpnotewell.co.uk</li>
                <li>Writing to: Data Protection Officer, PCN Services Ltd, 8 Watson Close, Northampton, NN5 6ER</li>
                <li>Contacting your GP practice (for patient records)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* International Transfers */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">International Data Transfers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <p className="font-semibold text-green-900 dark:text-green-300">
                UK-Only Hosting Commitment
              </p>
              <p className="text-sm text-green-800 dark:text-green-400 mt-2">
                All patient data and sensitive information is stored exclusively within the United Kingdom. We do not transfer data outside the UK except for the following limited circumstances:
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">AI Processing (OpenAI via Azure UK South)</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Processing occurs within UK data centres (Azure UK South region)</li>
                  <li>No data is retained after processing</li>
                  <li>Patient identifiers are redacted before AI processing where possible</li>
                  <li>Data Processing Agreement in place with adequate safeguards</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Transcription Services (AssemblyAI - USA)</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Audio processed under Standard Contractual Clauses (SCCs)</li>
                  <li>Audio deleted immediately after transcription</li>
                  <li>No audio recordings stored long-term by the provider</li>
                  <li>UK GDPR Article 46 adequacy assessment completed</li>
                </ul>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              All international transfers are conducted in accordance with UK GDPR Chapter V requirements and include appropriate safeguards such as Standard Contractual Clauses and transfer impact assessments.
            </p>
          </CardContent>
        </Card>

        {/* Changes to Policy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">Changes to This Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or service offerings.
            </p>
            <p className="text-base">
              <strong>Notification of Changes:</strong> Significant changes will be notified to users via:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-sm">
              <li>In-app notifications</li>
              <li>Email to registered users</li>
              <li>Notice on our website</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Continued use of NoteWell AI after changes are notified constitutes acceptance of the updated policy.
            </p>
          </CardContent>
        </Card>

        {/* Complaints & ICO */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              Complaints & Regulatory Authority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              If you have concerns about how we handle your personal data, please contact our Data Protection Officer first:
            </p>
            <div className="border-l-4 border-primary pl-4 py-2">
              <p className="font-semibold">Data Protection Officer</p>
              <p className="text-sm text-muted-foreground">Email: dpo@gpnotewell.co.uk</p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Right to Lodge a Complaint</h4>
              <p className="text-sm text-muted-foreground mb-3">
                If you are not satisfied with our response, you have the right to complain to the Information Commissioner's Office (ICO):
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-semibold">Information Commissioner's Office</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Wycliffe House<br />
                  Water Lane<br />
                  Wilmslow<br />
                  Cheshire<br />
                  SK9 5AF
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Tel:</strong> 0303 123 1113<br />
                  <strong>Website:</strong> <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.ico.org.uk</a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              For any questions or concerns about this Privacy Policy or our data practices:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Data Protection Enquiries</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>dpo@gpnotewell.co.uk</span>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">General Support</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>support@gpnotewell.co.uk</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
          <p className="font-semibold">NHS OFFICIAL-SENSITIVE</p>
          <p className="mt-1">This Privacy Policy is effective from November 2025</p>
          <p className="mt-1">© {new Date().getFullYear()} PCN Services Ltd trading as NoteWell AI. All rights reserved.</p>
          <p className="mt-2 text-xs">MHRA Class I Medical Device | UK-Based Healthcare Data Processor</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
