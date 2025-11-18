import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Users, Clock, FileText, Phone, Shield, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const IncidentResponsePolicy = () => {
  const navigate = useNavigate();
  
  const incidentTeam = [
    {
      role: "Incident Response Lead",
      name: "Clinical Safety Officer",
      responsibilities: [
        "Overall coordination of incident response",
        "Decision-making authority for major incidents",
        "External communications and regulatory notifications",
        "Post-incident review leadership"
      ],
      contact: "Available via practice escalation procedures"
    },
    {
      role: "Technical Lead",
      name: "Development Team Lead",
      responsibilities: [
        "Technical investigation and root cause analysis",
        "System restoration and recovery",
        "Implementation of technical fixes",
        "Security vulnerability assessment"
      ],
      contact: "On-call rotation 24/7"
    },
    {
      role: "Data Protection Officer",
      name: "Practice DPO",
      responsibilities: [
        "Assessment of data breach impact",
        "GDPR compliance coordination",
        "ICO notification (if required)",
        "Patient notification coordination"
      ],
      contact: "Available during business hours + emergency escalation"
    },
    {
      role: "Communications Lead",
      name: "Practice Manager",
      responsibilities: [
        "Internal staff communications",
        "Patient communications (if required)",
        "Stakeholder updates",
        "Media liaison (if required)"
      ],
      contact: "Available during business hours"
    }
  ];

  const incidentClassification = [
    {
      severity: "Critical (P1)",
      color: "destructive",
      criteria: [
        "System-wide outage affecting patient care",
        "Data breach involving >100 patients",
        "Critical security vulnerability actively exploited",
        "Patient safety incident",
        "Ransomware or malicious attack"
      ],
      responseTime: "Immediate (within 15 minutes)",
      escalation: "Automatic escalation to CSO and senior management"
    },
    {
      severity: "High (P2)",
      color: "warning",
      criteria: [
        "Major feature outage affecting multiple users",
        "Data breach involving <100 patients",
        "Security vulnerability with known exploit",
        "Significant performance degradation",
        "Multiple user complaints about data accuracy"
      ],
      responseTime: "Within 1 hour",
      escalation: "Escalation to technical lead and CSO"
    },
    {
      severity: "Medium (P3)",
      color: "default",
      criteria: [
        "Minor feature outage affecting single users",
        "Non-sensitive data exposure",
        "Performance issues with workarounds",
        "Configuration errors without patient impact"
      ],
      responseTime: "Within 4 hours",
      escalation: "Technical team assessment"
    },
    {
      severity: "Low (P4)",
      color: "secondary",
      criteria: [
        "Cosmetic issues",
        "Minor bugs with no patient impact",
        "Non-urgent enhancement requests",
        "Documentation issues"
      ],
      responseTime: "Within 24 hours",
      escalation: "Standard support queue"
    }
  ];

  const responsePhases = [
    {
      phase: "1. Detection & Identification",
      icon: AlertCircle,
      duration: "0-15 minutes",
      activities: [
        "Incident reported via support channel or automated monitoring",
        "Initial assessment and classification",
        "Incident response team notified",
        "Incident ticket created with unique reference number",
        "Initial containment measures if required"
      ]
    },
    {
      phase: "2. Containment",
      icon: Shield,
      duration: "15 minutes - 2 hours",
      activities: [
        "Isolate affected systems to prevent spread",
        "Preserve evidence for investigation",
        "Implement temporary workarounds if possible",
        "Begin user communications if required",
        "Escalate to senior management if P1/P2"
      ]
    },
    {
      phase: "3. Investigation & Analysis",
      icon: FileText,
      duration: "2-24 hours",
      activities: [
        "Root cause analysis",
        "Impact assessment (users, data, systems affected)",
        "Timeline reconstruction",
        "Security implications review",
        "Regulatory notification assessment (ICO, MHRA, CQC)"
      ]
    },
    {
      phase: "4. Eradication & Recovery",
      icon: CheckCircle2,
      duration: "Variable",
      activities: [
        "Implement permanent fix",
        "Restore systems from backups if required",
        "Verify system integrity",
        "Remove any malicious elements",
        "Gradual service restoration with monitoring"
      ]
    },
    {
      phase: "5. Post-Incident Review",
      icon: Users,
      duration: "Within 7 days",
      activities: [
        "Incident retrospective meeting",
        "Documentation of lessons learned",
        "Identification of preventive measures",
        "Update incident response procedures",
        "Hazard log and risk register updates"
      ]
    }
  ];

  const notificationRequirements = [
    {
      authority: "Information Commissioner's Office (ICO)",
      trigger: "Personal data breach likely to result in risk to rights and freedoms",
      timeframe: "Within 72 hours of becoming aware",
      method: "Online notification form at ico.org.uk",
      content: "Nature of breach, approximate number of data subjects, contact details, likely consequences, measures taken"
    },
    {
      authority: "Medicines and Healthcare products Regulatory Agency (MHRA)",
      trigger: "Serious incident related to medical device functionality",
      timeframe: "Immediately for fatalities, within 10 days for serious injuries",
      method: "Yellow Card reporting system",
      content: "Device details, incident description, patient impact, corrective actions"
    },
    {
      authority: "Care Quality Commission (CQC)",
      trigger: "Notifiable safety incident affecting regulated activity",
      timeframe: "Without delay",
      method: "CQC notification portal",
      content: "Incident details, immediate actions, ongoing investigation"
    },
    {
      authority: "Affected Patients",
      trigger: "Personal data breach likely to result in high risk",
      timeframe: "Without undue delay",
      method: "Direct communication (letter, email, or phone)",
      content: "Nature of breach, contact details for queries, advice on protective measures"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Navigation */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/cso-report')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CSO Report
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Incident Response Policy</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl mb-4">
            PCN Services Ltd trading as NotewellAI - Comprehensive incident response procedures for security, 
            data protection, and patient safety incidents affecting the NotewellAI Medical Practice Management System.
          </p>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Policy Owner:</strong> Clinical Safety Officer<br />
              <strong>Last Reviewed:</strong> November 2024<br />
              <strong>Next Review:</strong> November 2025<br />
              <strong>Version:</strong> 2.1
            </AlertDescription>
          </Alert>
        </div>

        {/* Organisation Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
            <CardDescription>PCN Services Ltd trading as NotewellAI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold mb-1">Registered Company:</p>
                <p className="text-muted-foreground">PCN Services Ltd</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Trading Name:</p>
                <p className="text-muted-foreground">NotewellAI</p>
              </div>
              <div>
                <p className="font-semibold mb-1">System Classification:</p>
                <p className="text-muted-foreground">MHRA Class I Medical Device</p>
              </div>
              <div>
                <p className="font-semibold mb-1">DCB0129 Compliant:</p>
                <p className="text-muted-foreground">Clinical Safety Officer registered</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Data Controller:</p>
                <p className="text-muted-foreground">PCN Services Ltd</p>
              </div>
              <div>
                <p className="font-semibold mb-1">ICO Registration:</p>
                <p className="text-muted-foreground">Registered Data Controller</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incident Response Team */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Incident Response Team</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {incidentTeam.map((member, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{member.role}</CardTitle>
                      <CardDescription>{member.name}</CardDescription>
                    </div>
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-semibold mb-2">Key Responsibilities:</p>
                  <ul className="space-y-1 mb-3">
                    {member.responsibilities.map((resp, rIdx) => (
                      <li key={rIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">{member.contact}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Incident Classification */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Incident Classification & Response Times</h2>
          <div className="space-y-4">
            {incidentClassification.map((level, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">{level.severity}</CardTitle>
                        <Badge variant={level.color as any}>{level.responseTime}</Badge>
                      </div>
                      <CardDescription>{level.escalation}</CardDescription>
                    </div>
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-semibold mb-2">Triggers:</p>
                  <ul className="space-y-1">
                    {level.criteria.map((criterion, cIdx) => (
                      <li key={cIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 text-primary mt-1 flex-shrink-0" />
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Response Phases */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Incident Response Phases</h2>
          <div className="space-y-4">
            {responsePhases.map((phase, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <phase.icon className="w-6 h-6 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{phase.phase}</CardTitle>
                        <CardDescription>Typical duration: {phase.duration}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {phase.activities.map((activity, aIdx) => (
                      <li key={aIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{activity}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Regulatory Notifications */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Regulatory Notification Requirements</h2>
          <div className="space-y-4">
            {notificationRequirements.map((req, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-lg">{req.authority}</CardTitle>
                  <CardDescription>Required timeframe: {req.timeframe}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold mb-1">Notification Trigger:</p>
                    <p className="text-sm text-muted-foreground">{req.trigger}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Method:</p>
                    <p className="text-sm text-muted-foreground">{req.method}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Required Information:</p>
                    <p className="text-sm text-muted-foreground">{req.content}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Emergency Contacts */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Emergency Contact Procedures</CardTitle>
            <CardDescription>How to report an incident</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">For Users (Healthcare Professionals):</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-primary mt-0.5" />
                    <span>Report via in-app support button or practice escalation procedures</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary mt-0.5" />
                    <span>For patient safety incidents: Immediately contact Clinical Safety Officer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-primary mt-0.5" />
                    <span>For suspected security breach: Do not attempt to investigate - report immediately</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">For Technical Team:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-primary mt-0.5" />
                    <span>24/7 on-call rotation for P1/P2 incidents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-primary mt-0.5" />
                    <span>All incidents logged in incident management system with unique reference</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation & Review */}
        <Card>
          <CardHeader>
            <CardTitle>Documentation & Continuous Improvement</CardTitle>
            <CardDescription>Post-incident processes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Required Documentation:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Incident timeline with all actions taken</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Root cause analysis findings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Impact assessment and affected users</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Preventive actions and implementation timeline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Updates to hazard log and risk register</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Regulatory notifications (if applicable)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Review & Training:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Annual review of incident response procedures</li>
                  <li>• Quarterly incident response drills for P1 scenarios</li>
                  <li>• Team training on new procedures within 30 days of updates</li>
                  <li>• Integration of lessons learned into development processes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IncidentResponsePolicy;
