import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileCheck, AlertTriangle, Settings, CheckCircle, AlertCircle, TestTube, Calendar, Clock, Activity, Shield } from 'lucide-react';

export function DCB0129Panel() {
  return (
    <div className="space-y-6">
      {/* DCB0129 Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-blue-600" />
            DCB0129 Clinical Risk Management Standard
          </CardTitle>
          <CardDescription>
            NHS Digital Standard for Clinical Risk Management Systems - Complete Compliance Documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>DCB0129 Compliance Status</AlertTitle>
            <AlertDescription>
              This system implements DCB0129 requirements for clinical risk management. All documentation, processes,
              and safety controls are designed to meet NHS Digital standards for healthcare systems.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">85%</div>
                  <div className="text-sm text-blue-600">Implementation Complete</div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">12</div>
                  <div className="text-sm text-green-600">Processes Documented</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-700">3</div>
                  <div className="text-sm text-amber-600">Actions Required</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Risk Management Process */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            Clinical Risk Management Process
          </CardTitle>
          <CardDescription>
            Systematic approach to identifying, assessing, and managing clinical risks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-purple-700 mb-3">Risk Management Lifecycle</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <div className="font-medium">Risk Identification</div>
                      <div className="text-sm text-muted-foreground">Systematic identification of potential clinical hazards</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <div className="font-medium">Risk Analysis</div>
                      <div className="text-sm text-muted-foreground">Assessment of likelihood and severity</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <div className="font-medium">Risk Evaluation</div>
                      <div className="text-sm text-muted-foreground">Determination of risk acceptability</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">4</div>
                    <div>
                      <div className="font-medium">Risk Control</div>
                      <div className="text-sm text-muted-foreground">Implementation of mitigation measures</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">5</div>
                    <div>
                      <div className="font-medium">Monitoring</div>
                      <div className="text-sm text-muted-foreground">Ongoing surveillance and review</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-purple-700 mb-3">DCB0129 Requirements</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Clinical Safety Officer appointed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Clinical Risk Management Plan established</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Hazard identification process defined</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Risk assessment methodology documented</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">Clinical evaluation protocols (In Progress)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Post-deployment monitoring framework</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Safety Case */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Clinical Safety Case
          </CardTitle>
          <CardDescription>
            Structured argument demonstrating that the system is acceptably safe for use
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-700 mb-3">Safety Arguments</h4>
                <div className="space-y-3">
                  <Card className="border-green-200">
                    <CardContent className="pt-3">
                      <div className="font-medium">Argument 1: System Architecture</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        The system architecture implements defence-in-depth security with multiple layers
                        of protection including authentication, authorization, and audit controls.
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-green-200">
                    <CardContent className="pt-3">
                      <div className="font-medium">Argument 2: Data Integrity</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        All clinical data is protected through encryption, access controls, and comprehensive
                        audit logging to ensure integrity and traceability.
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-green-200">
                    <CardContent className="pt-3">
                      <div className="font-medium">Argument 3: AI Safety</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        AI-generated content includes confidence scoring and requires human validation
                        before clinical use, with clear labelling of AI involvement.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-green-700 mb-3">Supporting Evidence</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Security Assessment Report</div>
                      <div className="text-xs text-muted-foreground">Comprehensive security analysis with 0 critical issues</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Hazard Analysis Documentation</div>
                      <div className="text-xs text-muted-foreground">Systematic identification and assessment of clinical hazards</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Risk Control Measures</div>
                      <div className="text-xs text-muted-foreground">Implementation of risk reduction strategies</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Compliance Documentation</div>
                      <div className="text-xs text-muted-foreground">Evidence of regulatory compliance (GDPR, NHS Digital)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Management Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Risk Management Plan
          </CardTitle>
          <CardDescription>
            Comprehensive plan for ongoing risk management throughout the system lifecycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-orange-700">Pre-Deployment</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Hazard identification complete</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Risk assessment documented</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span>Clinical evaluation pending</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Security controls implemented</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-orange-700">Deployment</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span>User training programme</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span>Phased rollout strategy</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Incident reporting system</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Support procedures defined</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-orange-700">Post-Deployment</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Continuous monitoring</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Regular risk reviews</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Performance metrics tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span>Change control process</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Evaluation Framework */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-blue-600" />
            Clinical Evaluation Framework
          </CardTitle>
          <CardDescription>
            Systematic approach to evaluating clinical effectiveness and safety
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <TestTube className="h-4 w-4" />
              <AlertTitle>Evaluation Methodology</AlertTitle>
              <AlertDescription>
                Clinical evaluation combines literature review, clinical data analysis, and user feedback
                to assess the system's impact on clinical outcomes and patient safety.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-blue-700 mb-3">Evaluation Criteria</h4>
                <div className="space-y-2">
                  <div className="p-3 border border-blue-200 rounded-lg">
                    <div className="font-medium text-sm">Clinical Effectiveness</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Assessment of impact on clinical decision-making and patient outcomes
                    </div>
                  </div>
                  <div className="p-3 border border-blue-200 rounded-lg">
                    <div className="font-medium text-sm">Usability & User Experience</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Evaluation of system usability and integration into clinical workflows
                    </div>
                  </div>
                  <div className="p-3 border border-blue-200 rounded-lg">
                    <div className="font-medium text-sm">Safety Performance</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Monitoring of safety incidents and near-miss events
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-blue-700 mb-3">Data Collection Methods</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium text-sm">User Feedback Surveys</div>
                      <div className="text-xs text-muted-foreground">Regular collection of clinician experiences</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium text-sm">Clinical Outcome Metrics</div>
                      <div className="text-xs text-muted-foreground">Analysis of patient safety indicators</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium text-sm">Incident Reporting Analysis</div>
                      <div className="text-xs text-muted-foreground">Review of safety incidents and patterns</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium text-sm">Performance Analytics</div>
                      <div className="text-xs text-muted-foreground">System performance and usage metrics</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            DCB0129 Implementation Roadmap
          </CardTitle>
          <CardDescription>
            Structured timeline for completing DCB0129 compliance requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="font-semibold text-green-700">Phase 1: Foundation (Complete)</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ✅ Clinical Safety Officer framework established<br/>
                  ✅ Risk management processes documented<br/>
                  ✅ Hazard analysis completed<br/>
                  ✅ Security controls implemented
                </div>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <div className="font-semibold text-amber-700">Phase 2: Clinical Evaluation (In Progress)</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  🔄 Clinical validation protocols<br/>
                  🔄 User training programme development<br/>
                  🔄 Performance baseline establishment<br/>
                  📅 Target completion: Next 4 weeks
                </div>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <div className="font-semibold text-blue-700">Phase 3: Deployment Preparation (Planned)</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  📋 Final safety case review<br/>
                  📋 Stakeholder sign-off process<br/>
                  📋 Deployment readiness assessment<br/>
                  📅 Target completion: 6-8 weeks
                </div>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <div className="font-semibold text-purple-700">Phase 4: Post-Deployment Monitoring (Ongoing)</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  📊 Continuous risk monitoring<br/>
                  📊 Clinical outcome tracking<br/>
                  📊 Regular compliance reviews<br/>
                  📅 Ongoing after deployment
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
