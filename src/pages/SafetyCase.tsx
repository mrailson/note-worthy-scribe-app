import { Header } from '@/components/Header';
import { CSOComplianceReport } from '@/components/CSOComplianceReport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, AlertCircle } from 'lucide-react';

const SafetyCase = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-l-4 border-purple-500 p-6 mb-8 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-purple-600" />
            <Badge variant="outline" className="text-xs">NHS OFFICIAL-SENSITIVE</Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">DCB0129 Clinical Safety Case</h1>
          <p className="text-xl text-muted-foreground mb-4">NoteWell AI Healthcare Management System</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-semibold">Version:</span> 2.0</div>
            <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString('en-GB')}</div>
            <div><span className="font-semibold">Standard:</span> DCB0129 & DCB0160</div>
            <div><span className="font-semibold">Status:</span> <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">IN PROGRESS</Badge></div>
          </div>
        </div>

        {/* Introduction Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Clinical Safety Case Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base leading-relaxed">
              This Clinical Safety Case demonstrates that <strong>NoteWell AI</strong> has been developed and deployed 
              in accordance with <strong>DCB0129 (Clinical Risk Management)</strong> and <strong>DCB0160 (Clinical 
              Risk Management: Manufacturer Requirements)</strong> standards.
            </p>
            <p className="text-base leading-relaxed">
              The Safety Case provides evidence that all clinical risks have been systematically identified, assessed, 
              controlled, and monitored throughout the system lifecycle.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">Key Strengths</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-green-800 dark:text-green-400">
                  <li>MHRA Class I Medical Device registration</li>
                  <li>Comprehensive hazard identification</li>
                  <li>Human-in-the-loop safeguards</li>
                  <li>Full audit trail implementation</li>
                  <li>Regular safety monitoring</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">Areas for Completion</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-yellow-800 dark:text-yellow-400">
                  <li>Final Clinical Safety Officer appointment</li>
                  <li>Complete hazard log review</li>
                  <li>Post-implementation monitoring plan</li>
                  <li>User training completion evidence</li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-700 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-300">Clinical Safety Framework</p>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                    This Safety Case is supported by comprehensive clinical risk management documentation including 
                    the Hazard Log, Risk Assessments, Safety Plan, and Clinical Safety Management File.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety Case Components */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 w-5 text-purple-600" />
              Safety Case Components
            </CardTitle>
            <CardDescription>
              Key documentation and evidence supporting clinical safety claims
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">1. Clinical Safety Plan</h4>
                <p className="text-sm text-muted-foreground">
                  Defines the overall approach to clinical safety management throughout the system lifecycle.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">2. Hazard Log</h4>
                <p className="text-sm text-muted-foreground">
                  Systematic record of all identified hazards, risks, and mitigation measures.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">3. Risk Assessments</h4>
                <p className="text-sm text-muted-foreground">
                  Clinical risk analysis for each system component and user interaction.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">4. Safety Requirements</h4>
                <p className="text-sm text-muted-foreground">
                  Specification of safety-critical requirements and design constraints.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">5. Test & Validation</h4>
                <p className="text-sm text-muted-foreground">
                  Evidence of safety testing and validation activities.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">6. Monitoring Plan</h4>
                <p className="text-sm text-muted-foreground">
                  Post-implementation surveillance and incident reporting procedures.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main CSO Compliance Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 w-5 text-purple-600" />
              DCB0129 Compliance Status
            </CardTitle>
            <CardDescription>
              Detailed compliance reporting including implementation timelines and action items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-4 mb-4">
              <p className="text-sm text-purple-700 dark:text-purple-400">
                This report provides comprehensive DCB0129 compliance status, including specific implementation 
                timelines, assigned responsibilities, and critical next steps required for full certification.
              </p>
            </div>
            <CSOComplianceReport 
              complaintId="" 
              complaintReference="SAFETY-CASE-2025" 
            />
          </CardContent>
        </Card>

        {/* Safety Case Statement */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Clinical Safety Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-900 rounded-lg p-6">
              <p className="text-base leading-relaxed mb-4">
                Based on the comprehensive clinical risk management activities documented in this Safety Case, 
                NoteWell AI has been assessed as <strong>conditionally safe for deployment</strong> within NHS 
                primary care settings, subject to completion of the outstanding actions identified in the compliance report.
              </p>
              <p className="text-base leading-relaxed mb-4">
                All identified clinical risks have been assessed and mitigated to an acceptable level through 
                technical controls, human-in-the-loop safeguards, user training, and comprehensive monitoring procedures.
              </p>
              <div className="border-t border-green-300 dark:border-green-800 pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Clinical Safety Officer:</strong> [To be assigned]<br />
                  <strong>Next Review Date:</strong> {new Date(Date.now() + 365*24*60*60*1000).toLocaleDateString('en-GB')}<br />
                  <strong>Version:</strong> 2.0
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
          <p className="font-semibold">NHS OFFICIAL-SENSITIVE</p>
          <p className="mt-1">This Safety Case is maintained in accordance with DCB0129 and DCB0160 requirements</p>
          <p className="mt-1">© {new Date().getFullYear()} PCN Services Ltd trading as NoteWell AI. All rights reserved.</p>
          <p className="mt-2 text-xs">MHRA Class I Medical Device | Manufacturer: PCN Services Ltd</p>
        </div>
      </div>
    </div>
  );
};

export default SafetyCase;
