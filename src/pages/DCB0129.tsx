import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  FileText, 
  Download,
  ExternalLink,
  AlertTriangle,
  Lock,
  Activity,
  Users,
  FileCheck,
  ArrowLeft,
  Package,
  Presentation
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

const DCB0129 = () => {
  const navigate = useNavigate();
  
  // Overall compliance score
  const overallCompliance = 85;
  
  // DCB0129 Requirements with status
  const requirements = [
    { 
      id: 1, 
      name: 'Clinical Safety Officer Appointment', 
      status: 'complete', 
      completion: 100,
      link: '/cso-report',
      evidence: 'CSO Appointment Letter'
    },
    { 
      id: 2, 
      name: 'Clinical Risk Management File', 
      status: 'in-progress', 
      completion: 85,
      link: '/safety-case',
      evidence: 'Risk Management Documentation'
    },
    { 
      id: 3, 
      name: 'Hazard Log', 
      status: 'complete', 
      completion: 100,
      link: '/hazard-log',
      evidence: 'Hazard Log (23 identified hazards)'
    },
    { 
      id: 4, 
      name: 'Clinical Safety Case Report', 
      status: 'complete', 
      completion: 100,
      link: '/safety-case',
      evidence: 'Clinical Safety Case Document'
    },
    { 
      id: 5, 
      name: 'Clinical Safety Plan', 
      status: 'pending', 
      completion: 75,
      link: null,
      evidence: 'Draft - Awaiting CSO Approval'
    },
    { 
      id: 6, 
      name: 'Risk Analysis Documentation', 
      status: 'complete', 
      completion: 100,
      link: '/hazard-log',
      evidence: 'Risk Analysis & Assessment Matrix'
    },
    { 
      id: 7, 
      name: 'Risk Evaluation Matrix', 
      status: 'complete', 
      completion: 100,
      link: '/hazard-log',
      evidence: 'Risk Matrix with Severity/Likelihood'
    },
    { 
      id: 8, 
      name: 'Risk Control Measures', 
      status: 'complete', 
      completion: 100,
      link: null,
      evidence: 'Technical & Procedural Controls'
    },
    { 
      id: 9, 
      name: 'Residual Risk Evaluation', 
      status: 'in-progress', 
      completion: 70,
      link: null,
      evidence: 'In Progress - Due 2 weeks'
    },
    { 
      id: 10, 
      name: 'Post-Market Surveillance Plan', 
      status: 'pending', 
      completion: 60,
      link: null,
      evidence: 'Draft - Needs Sign-off'
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Complete</Badge>;
      case 'in-progress':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">In Progress</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">Pending</Badge>;
      default:
        return null;
    }
  };

  // Hazard summary data
  const hazardSummary = {
    total: 23,
    high: 3,
    medium: 12,
    low: 8,
    bySystem: [
      { name: 'AI4GP Service', count: 8 },
      { name: 'Meeting Manager', count: 7 },
      { name: 'Complaints System', count: 8 }
    ]
  };

  // Outstanding actions
  const outstandingActions = [
    { 
      priority: 'critical', 
      action: 'CSO Formal Sign-off on Safety Case', 
      dueDate: 'This week',
      assignee: 'Clinical Safety Officer'
    },
    { 
      priority: 'high', 
      action: 'Complete Residual Risk Evaluation documentation', 
      dueDate: '2 weeks',
      assignee: 'Risk Management Team'
    },
    { 
      priority: 'medium', 
      action: 'Post-Market Surveillance Plan final approval', 
      dueDate: '1 month',
      assignee: 'Clinical Safety Officer'
    },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Medium</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
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

        {/* Hero Section - Compliance Dashboard */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-l-4 border-blue-600 p-8 mb-8 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
            <Badge variant="outline" className="text-xs">NHS OFFICIAL-SENSITIVE</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-2">DCB0129 Compliance Hub</h1>
          <p className="text-xl text-muted-foreground mb-6">NoteWell AI Healthcare Management System</p>
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-white/80 dark:bg-gray-900/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Compliance</p>
                    <p className="text-3xl font-bold text-blue-600">{overallCompliance}%</p>
                  </div>
                  <FileCheck className="w-8 h-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 dark:bg-gray-900/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hazards</p>
                    <p className="text-3xl font-bold text-orange-600">{hazardSummary.total}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 dark:bg-gray-900/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Requirements Met</p>
                    <p className="text-3xl font-bold text-green-600">6/10</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 dark:bg-gray-900/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding Actions</p>
                    <p className="text-3xl font-bold text-amber-600">{outstandingActions.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Status Badge */}
          <div className="mt-6 flex items-center gap-3">
            <span className="font-semibold">System Status:</span>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-4 py-1 text-base">
              AMBER - Conditionally Acceptable
            </Badge>
          </div>
        </div>

        {/* DCB0129 Requirements Checklist */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileCheck className="w-6 h-6" />
              DCB0129 Requirements Checklist
            </CardTitle>
            <CardDescription>
              Comprehensive tracking of all DCB0129 Clinical Risk Management requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requirements.map((req) => (
                <div key={req.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(req.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{req.name}</h3>
                          {getStatusBadge(req.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{req.evidence}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {req.link && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={req.link}>
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Progress value={req.completion} className="flex-1" />
                    <span className="text-sm font-medium min-w-[3rem] text-right">{req.completion}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clinical Safety Officer Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="w-6 h-6" />
              Clinical Safety Officer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">CSO Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">[To be appointed]</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Qualifications:</span>
                    <span className="font-medium">DCB0129 Certified</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Appointed:</span>
                    <span className="font-medium">[Date pending]</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Responsibilities</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Clinical risk management oversight</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Hazard log maintenance & review</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Safety case report approval</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <span>Post-deployment surveillance</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hazard & Risk Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              Hazard & Risk Summary
            </CardTitle>
            <CardDescription>
              Overview of identified hazards across all NoteWell AI systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-4">Risk Distribution</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                    <span className="font-medium">HIGH Risk</span>
                    <Badge variant="destructive" className="text-lg px-3">{hazardSummary.high}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                    <span className="font-medium">MEDIUM Risk</span>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-lg px-3">{hazardSummary.medium}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                    <span className="font-medium">LOW Risk</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 text-lg px-3">{hazardSummary.low}</Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-4">By System Component</h3>
                <div className="space-y-3">
                  {hazardSummary.bySystem.map((system, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                      <span className="font-medium">{system.name}</span>
                      <Badge variant="outline" className="text-lg px-3">{system.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <Button variant="outline" className="w-full" asChild>
                <Link to="/hazard-log">
                  <FileText className="w-4 h-4 mr-2" />
                  View Complete Hazard Log
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Safety Controls & Mitigations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Safety Controls & Mitigations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="technical">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Technical Controls
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 ml-7">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Row Level Security (RLS):</strong> Enforced on all database tables</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Authentication:</strong> Multi-factor authentication with session management</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Encryption:</strong> TLS 1.3 in transit, AES-256 at rest</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Audit Logging:</strong> Comprehensive audit trail for all data access</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="procedural">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Procedural Controls
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 ml-7">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>User Training:</strong> Mandatory training for all system users</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Clinical Validation:</strong> Human-in-loop review for AI outputs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-1" />
                      <span><strong>Standard Operating Procedures:</strong> In development</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="monitoring">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Monitoring Controls
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 ml-7">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Real-time Alerts:</strong> Automated monitoring for system anomalies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Incident Reporting:</strong> Structured incident management process</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Performance Metrics:</strong> Continuous quality monitoring</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ai-safety">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    AI Safety Controls
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 ml-7">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Human-in-Loop:</strong> Mandatory clinical review before action</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Confidence Scoring:</strong> AI outputs include confidence metrics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-1" />
                      <span><strong>Output Validation:</strong> Automated checks for clinical appropriateness</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-1" />
                      <span><strong>Model Versioning:</strong> Tracking and rollback capability</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Outstanding Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-600" />
              Outstanding Actions
            </CardTitle>
            <CardDescription>
              Critical actions required for full DCB0129 compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outstandingActions.map((action, idx) => (
                <div key={idx} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getPriorityBadge(action.priority)}
                        <span className="text-sm text-muted-foreground">Due: {action.dueDate}</span>
                      </div>
                      <h3 className="font-semibold mb-1">{action.action}</h3>
                      <p className="text-sm text-muted-foreground">Assigned to: {action.assignee}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Standards Alignment */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileCheck className="w-6 h-6" />
              Integration with Existing Standards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <span className="font-medium">DCB0129 (Clinical Risk Management)</span>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <span className="font-medium">DCB0160 (Deployment)</span>
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <span className="font-medium">ISO 14971 (Medical Device Risk)</span>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <span className="font-medium">GDPR / Data Protection Act 2018</span>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <span className="font-medium">DTAC (Digital Assessment)</span>
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <span className="font-medium">MHRA Medical Device Regulations</span>
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ExternalLink className="w-6 h-6" />
              Quick Actions & Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
                <Link to="/hazard-log">
                  <AlertTriangle className="w-6 h-6" />
                  <span>View Hazard Log</span>
                </Link>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
                <Link to="/safety-case">
                  <Shield className="w-6 h-6" />
                  <span>View Safety Case</span>
                </Link>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
                <Link to="/cso-report">
                  <FileText className="w-6 h-6" />
                  <span>View CSO Report</span>
                </Link>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
                <Link to="/dpia">
                  <Lock className="w-6 h-6" />
                  <span>View DPIA</span>
                </Link>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
                <Package className="w-6 h-6" />
                <span>Download Evidence Pack</span>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
                <Presentation className="w-6 h-6" />
                <span>Generate Presentation</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DCB0129;
