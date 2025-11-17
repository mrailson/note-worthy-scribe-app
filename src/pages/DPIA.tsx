import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileDown, Shield, AlertTriangle, CheckCircle2, XCircle, Download } from "lucide-react";
import { Link } from "react-router-dom";

const DPIA = () => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/reports/Data_Protection_Impact_Assessment.md';
    link.download = 'Data_Protection_Impact_Assessment.md';
    link.click();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold">Data Protection Impact Assessment (DPIA)</h1>
              <p className="text-muted-foreground mt-1">PCN Services Ltd - Integrated Clinical & Administrative Platform</p>
            </div>
          </div>
          <Button onClick={handleDownload} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Download Full DPIA
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Document Version</div>
            <div className="text-2xl font-bold">1.0</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Reference</div>
            <div className="text-2xl font-bold">DPIA-PCN-001</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Date Prepared</div>
            <div className="text-2xl font-bold">17 Nov 2025</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Review Date</div>
            <div className="text-2xl font-bold">17 Nov 2026</div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="risks">Risk Assessment</TabsTrigger>
          <TabsTrigger value="processors">Third Parties</TabsTrigger>
          <TabsTrigger value="rights">Data Subject Rights</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Executive Summary */}
        <TabsContent value="summary" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Overview</h2>
            <p className="text-muted-foreground mb-4">
              This Data Protection Impact Assessment (DPIA) has been conducted for the PCN Services Ltd Integrated Clinical & Administrative Platform in accordance with Article 35 of the UK General Data Protection Regulation (UK GDPR) and guidance from the Information Commissioner's Office (ICO).
            </p>
            <p className="text-muted-foreground">
              The platform processes special category personal data (health data) and is therefore considered high-risk processing requiring a full DPIA. This assessment evaluates privacy risks, identifies mitigations, and ensures compliance with UK data protection law, NHS Digital standards, and the Data Security and Protection Toolkit (DSPT).
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Screening Decision</h2>
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-1" />
              <div>
                <div className="font-semibold text-lg">DPIA Required: YES</div>
                <div className="text-muted-foreground mt-2">Justification:</div>
                <ul className="list-disc list-inside space-y-1 mt-2 text-muted-foreground">
                  <li>Systematic and extensive profiling with significant effects</li>
                  <li>Large-scale processing of special category data (health records)</li>
                  <li>Systematic monitoring of publicly accessible areas (audio recording)</li>
                  <li>Use of new technologies (AI-assisted clinical decision support)</li>
                  <li>Processing that prevents data subjects exercising a right (in some contexts)</li>
                  <li>Matching or combining datasets from multiple sources</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Processing Activities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: "Complaints Management", desc: "Patient complaint handling and investigation" },
                { name: "Meeting Transcription", desc: "AI-powered meeting recording and transcription" },
                { name: "AI4GP Clinical Support", desc: "Medical translation and consultation assistance" },
                { name: "CQC Evidence Management", desc: "Regulatory compliance documentation" },
                { name: "Document Storage", desc: "Secure file storage and sharing" },
                { name: "User Authentication", desc: "Staff management and access control" },
                { name: "Audit Logging", desc: "Comprehensive security monitoring" },
              ].map((activity, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="font-semibold">{activity.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{activity.desc}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Stakeholder Consultation</h2>
            <div className="space-y-3">
              {[
                "Data Protection Officer",
                "Caldicott Guardian",
                "Senior Information Risk Owner (SIRO)",
                "Clinical Safety Officer",
                "Information Governance Lead",
                "Clinical Lead (GP)",
                "Practice Manager",
                "IT Security Lead"
              ].map((stakeholder, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>{stakeholder}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Risk Assessment */}
        <TabsContent value="risks" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Risk Assessment Methodology</h2>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold mb-2">Likelihood Scale</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><strong>Very Low (1):</strong> Event highly unlikely</li>
                  <li><strong>Low (2):</strong> Event possible but unlikely</li>
                  <li><strong>Medium (3):</strong> Event could occur</li>
                  <li><strong>High (4):</strong> Event likely to occur</li>
                  <li><strong>Very High (5):</strong> Event expected without controls</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Severity Scale (Impact)</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><strong>Very Low (1):</strong> Negligible impact</li>
                  <li><strong>Low (2):</strong> Some impact, potential distress</li>
                  <li><strong>Medium (3):</strong> Moderate impact, significant distress</li>
                  <li><strong>High (4):</strong> Major impact, significant harm</li>
                  <li><strong>Very High (5):</strong> Catastrophic impact, severe harm</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Privacy Risk Register</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Risk ID</th>
                    <th className="text-left p-2">Risk Description</th>
                    <th className="text-left p-2">Initial Score</th>
                    <th className="text-left p-2">Residual Score</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "RISK 1", desc: "Unauthorised access to patient records", initial: "15 (Very High)", residual: "6 (Medium)", status: "tolerable" },
                    { id: "RISK 2", desc: "Data breach due to cyber attack", initial: "15 (Very High)", residual: "9 (Medium)", status: "tolerable" },
                    { id: "RISK 3", desc: "Insufficient consent or legal basis", initial: "8 (Medium)", residual: "4 (Low)", status: "acceptable" },
                    { id: "RISK 4", desc: "Disproportionate data collection", initial: "6 (Medium)", residual: "3 (Low)", status: "acceptable" },
                    { id: "RISK 5", desc: "Third-party processor non-compliance", initial: "12 (High)", residual: "6 (Medium)", status: "tolerable" },
                    { id: "RISK 6", desc: "AI-generated clinical inaccuracies", initial: "15 (Very High)", residual: "6 (Medium)", status: "tolerable" },
                    { id: "RISK 7", desc: "Inadequate transparency", initial: "6 (Medium)", residual: "2 (Very Low)", status: "acceptable" },
                    { id: "RISK 8", desc: "Failure to honour data subject rights", initial: "8 (Medium)", residual: "4 (Low)", status: "acceptable" },
                    { id: "RISK 9", desc: "Cross-border transfers without safeguards", initial: "8 (Medium)", residual: "4 (Low)", status: "acceptable" },
                    { id: "RISK 10", desc: "Insufficient incident response", initial: "8 (Medium)", residual: "4 (Low)", status: "acceptable" },
                  ].map((risk, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono">{risk.id}</td>
                      <td className="p-2">{risk.desc}</td>
                      <td className="p-2">{risk.initial}</td>
                      <td className="p-2 font-semibold">{risk.residual}</td>
                      <td className="p-2">
                        {risk.status === "acceptable" ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Acceptable
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            Tolerable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 border-green-200 bg-green-50 dark:bg-green-950/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-green-800 dark:text-green-200">Overall Risk Profile: ACCEPTABLE</h3>
                <p className="text-green-700 dark:text-green-300 mt-2">
                  All residual risks reduced to acceptable or tolerable levels with planned additional measures.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">High-Priority Actions</h2>
            <div className="space-y-3">
              {[
                { action: "Enforce MFA for all users", deadline: "Q1 2026", risk: "RISK 1" },
                { action: "Achieve Cyber Essentials Plus certification", deadline: "Q2 2026", risk: "RISK 2" },
                { action: "Replace EmailJS with UK-based service", deadline: "Q2 2026", risk: "RISK 5, RISK 9" },
                { action: "Implement AI output confidence scoring", deadline: "Q2 2026", risk: "RISK 6" },
                { action: "Create clinical validation checklist for AI", deadline: "Q1 2026", risk: "RISK 6" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-semibold">{item.action}</div>
                    <div className="text-sm text-muted-foreground mt-1">Mitigates: {item.risk}</div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">{item.deadline}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Third-Party Processors */}
        <TabsContent value="processors" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Data Processor Assessment</h2>
            <p className="text-muted-foreground mb-4">
              Comprehensive due diligence has been conducted on all third-party data processors to ensure compliance with UK GDPR Article 28 requirements.
            </p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                name: "Supabase",
                service: "Database, storage, authentication",
                location: "UK/EU",
                transfer: "N/A (UK/EU)",
                risk: "LOW",
                riskColor: "green",
                certs: ["ISO 27001", "SOC 2 Type II"],
                retention: "Customer controlled",
                status: "approved"
              },
              {
                name: "OpenAI",
                service: "AI content generation",
                location: "United States",
                transfer: "UK IDTA",
                risk: "MEDIUM",
                riskColor: "amber",
                certs: ["SOC 2 Type II"],
                retention: "Zero-day retention",
                status: "conditional"
              },
              {
                name: "ElevenLabs",
                service: "Voice synthesis",
                location: "US/Europe",
                transfer: "UK IDTA",
                risk: "LOW",
                riskColor: "green",
                certs: ["SOC 2 (in progress)"],
                retention: "Transient processing",
                status: "approved"
              },
              {
                name: "EmailJS",
                service: "Email delivery",
                location: "United States",
                transfer: "SCCs",
                risk: "LOW-MEDIUM",
                riskColor: "amber",
                certs: ["GDPR compliant"],
                retention: "Transient",
                status: "temporary"
              },
              {
                name: "AssemblyAI",
                service: "Speech-to-text transcription",
                location: "United States",
                transfer: "UK IDTA",
                risk: "MEDIUM",
                riskColor: "amber",
                certs: ["SOC 2 Type II", "HIPAA eligible"],
                retention: "Zero-day retention",
                status: "conditional"
              },
            ].map((processor, idx) => (
              <Card key={idx} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{processor.name}</h3>
                    <p className="text-sm text-muted-foreground">{processor.service}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    processor.riskColor === "green" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" 
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                  }`}>
                    {processor.risk}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{processor.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transfer:</span>
                    <span className="font-medium">{processor.transfer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retention:</span>
                    <span className="font-medium">{processor.retention}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-muted-foreground mb-2">Certifications:</div>
                  <div className="flex flex-wrap gap-2">
                    {processor.certs.map((cert, certIdx) => (
                      <span key={certIdx} className="px-2 py-1 bg-muted rounded text-xs">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  {processor.status === "approved" && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">Approved</span>
                    </div>
                  )}
                  {processor.status === "conditional" && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-semibold">Approved with Conditions</span>
                    </div>
                  )}
                  {processor.status === "temporary" && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-semibold">Temporary Approval - Replace by Q2 2026</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Data Subject Rights */}
        <TabsContent value="rights" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Data Subject Rights Under UK GDPR</h2>
            <p className="text-muted-foreground mb-6">
              The platform provides comprehensive mechanisms for data subjects to exercise their rights under Articles 12-22 of the UK GDPR.
            </p>
            
            <div className="space-y-4">
              {[
                {
                  title: "Right of Access (Article 15)",
                  desc: "Request a copy of personal data held",
                  timeline: "1 month (extendable to 3 months if complex)"
                },
                {
                  title: "Right to Rectification (Article 16)",
                  desc: "Correct inaccurate or incomplete data",
                  timeline: "1 month"
                },
                {
                  title: "Right to Erasure (Article 17)",
                  desc: "Request deletion of personal data (subject to exemptions)",
                  timeline: "1 month"
                },
                {
                  title: "Right to Restriction (Article 18)",
                  desc: "Restrict processing while accuracy is verified",
                  timeline: "Immediate upon request"
                },
                {
                  title: "Right to Data Portability (Article 20)",
                  desc: "Receive data in structured, machine-readable format",
                  timeline: "1 month"
                },
                {
                  title: "Right to Object (Article 21)",
                  desc: "Object to processing based on legitimate interests",
                  timeline: "Immediate assessment required"
                },
                {
                  title: "Rights Related to Automated Decision-Making (Article 22)",
                  desc: "Human review of AI-assisted decisions",
                  timeline: "Immediate upon request"
                },
              ].map((right, idx) => (
                <Card key={idx} className="p-4 border-l-4 border-l-primary">
                  <div className="font-semibold">{right.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{right.desc}</div>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                    <span className="font-mono">⏱</span>
                    <span>Response time: {right.timeline}</span>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">How to Exercise Your Rights</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Data Protection Officer (DPO)</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>Email: dpo@pcnservices.nhs.uk</div>
                  <div>Phone: [DPO Contact Number]</div>
                  <div>Post: [Practice Address]</div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Expected Response Times</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>• Initial acknowledgement: 2 working days</div>
                  <div>• Full response: 1 month (standard)</div>
                  <div>• Complex requests: 3 months (with explanation)</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How to Complain</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>If you are unhappy with how your rights have been handled:</div>
                  <div>1. Internal review by Data Protection Officer</div>
                  <div>2. Escalate to Information Commissioner's Office (ICO):</div>
                  <div className="ml-4">
                    <div>• Website: <a href="https://ico.org.uk/make-a-complaint/" className="text-primary hover:underline">https://ico.org.uk/make-a-complaint/</a></div>
                    <div>• Phone: 0303 123 1113</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Compliance Framework Integration</h2>
            <p className="text-muted-foreground mb-6">
              This DPIA integrates with and supports compliance across multiple NHS and data protection frameworks.
            </p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">NHS Data Security & Protection Toolkit (DSPT)</h3>
              <div className="space-y-2">
                {[
                  "Leadership (SIRO, DPO, Caldicott)",
                  "Staff Training",
                  "Managing Data Access",
                  "Process Reviews",
                  "Incident Response",
                  "Continuity Planning",
                  "IT Protection",
                  "Accountable Suppliers"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="font-semibold text-green-600">Status: Standards Met (target)</div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">DCB0129 Clinical Safety</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold">Integration Points:</div>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>Clinical Safety Case references DPIA</li>
                    <li>Privacy risks in Hazard Log</li>
                    <li>Clinical Safety Officer approval</li>
                    <li>AI hazards cross-referenced</li>
                  </ul>
                </div>
                <div>
                  <div className="font-semibold">Hazard Alignment:</div>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>HAZ-012: AI fabrication → RISK 6</li>
                    <li>HAZ-020: Unauthorised access → RISK 1</li>
                    <li>HAZ-025: Data breach → RISK 2</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4">
                <Link to="/safety-case">
                  <Button variant="outline" size="sm">View Clinical Safety Case</Button>
                </Link>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Caldicott Principles</h3>
              <div className="space-y-2">
                {[
                  "1. Justify the purpose",
                  "2. Don't use unless necessary",
                  "3. Use minimum necessary",
                  "4. Need-to-know access",
                  "5. Everyone understands responsibilities",
                  "6. Comply with the law",
                  "7. Duty to share (when appropriate)",
                  "8. Inform patients"
                ].map((principle, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{principle}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">CQC Requirements</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold">Well-Led Domain:</div>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>Governance structures</li>
                    <li>Risk management</li>
                    <li>Information governance</li>
                  </ul>
                </div>
                <div>
                  <div className="font-semibold">Safe Domain:</div>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>Patient safety</li>
                    <li>Information security</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">DPIA Sign-off and Approval</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This DPIA must be reviewed and approved by the following stakeholders before system deployment to new organisations or major changes to processing activities.
            </p>
            
            <div className="space-y-3">
              <h3 className="font-semibold">Mandatory Approvals:</h3>
              {[
                { role: "Data Protection Officer (DPO)", purpose: "Privacy compliance sign-off" },
                { role: "Senior Information Risk Owner (SIRO)", purpose: "Risk acceptance" },
                { role: "Caldicott Guardian", purpose: "Patient data governance" },
                { role: "Clinical Safety Officer", purpose: "Clinical safety (DCB0129) integration" },
              ].map((approver, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-semibold">{approver.role}</div>
                    <div className="text-sm text-muted-foreground">{approver.purpose}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">Status: Pending</div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-3">Recommended Approvals (for ICB deployment):</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Information Governance Lead",
                  "Chief Technology Officer",
                  "Medical Director",
                  "ICB Data Protection Lead"
                ].map((approver, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                    <span className="text-sm">{approver}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Related Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/data-flow-architecture">
                <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="font-semibold">Data Flow Architecture</div>
                  <div className="text-sm text-muted-foreground mt-1">System architecture and data flows</div>
                </Card>
              </Link>
              <Link to="/cso-report">
                <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="font-semibold">CSO Report</div>
                  <div className="text-sm text-muted-foreground mt-1">Clinical Safety Officer report</div>
                </Card>
              </Link>
              <Link to="/safety-case">
                <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="font-semibold">Clinical Safety Case</div>
                  <div className="text-sm text-muted-foreground mt-1">DCB0129 safety documentation</div>
                </Card>
              </Link>
              <Link to="/security-compliance">
                <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="font-semibold">Security Compliance</div>
                  <div className="text-sm text-muted-foreground mt-1">Technical security posture</div>
                </Card>
              </Link>
              <Link to="/privacy-policy">
                <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="font-semibold">Privacy Policy</div>
                  <div className="text-sm text-muted-foreground mt-1">Public-facing privacy notice</div>
                </Card>
              </Link>
              <Link to="/hazard-log">
                <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="font-semibold">Hazard Log</div>
                  <div className="text-sm text-muted-foreground mt-1">Clinical safety hazard register</div>
                </Card>
              </Link>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card className="p-6 mt-8 border-primary">
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-primary mt-1" />
          <div>
            <h3 className="font-bold text-lg">DPIA Conclusion</h3>
            <p className="text-muted-foreground mt-2">
              This Data Protection Impact Assessment demonstrates that the PCN Services Ltd Integrated Clinical & Administrative Platform can process personal data, including special category health data, in compliance with UK GDPR, NHS data protection standards, and the Data Security and Protection Toolkit.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Clear legal basis for all processing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Comprehensive risk mitigation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Third-party due diligence completed</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Data subject rights procedures in place</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="font-bold text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Recommendation: APPROVE subject to implementation of high-priority actions
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DPIA;
