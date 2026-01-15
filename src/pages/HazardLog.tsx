import { Header } from '@/components/Header';
import { HazardAnalysisReport } from '@/components/HazardAnalysisReport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from "react-router-dom";

const HazardLog = () => {
  const navigate = useNavigate();
  
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

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-l-4 border-orange-500 p-6 mb-8 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <Badge variant="outline" className="text-xs">NHS OFFICIAL-SENSITIVE</Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">Clinical Safety Hazard Log</h1>
          <p className="text-xl text-muted-foreground mb-4">NoteWell AI Healthcare Management System</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-semibold">Version:</span> 2.0</div>
            <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString('en-GB')}</div>
            <div><span className="font-semibold">Standard:</span> DCB0129 Compliant</div>
            <div><span className="font-semibold">Status:</span> <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">ACTIVE</Badge></div>
          </div>
        </div>

        {/* Introduction Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6" />
              About This Hazard Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base leading-relaxed">
              This Hazard Log provides a comprehensive record of identified hazards across all NoteWell AI systems, 
              in accordance with <strong>DCB0129 Clinical Risk Management</strong> standard requirements.
            </p>
            <p className="text-base leading-relaxed">
              Each hazard has been systematically identified, assessed, and mitigated through a structured clinical 
              risk management process. This log is maintained by the appointed Clinical Safety Officer and reviewed 
              regularly as part of our ongoing safety monitoring programme.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Covered Systems (Initial Pilot):</p>
              <ul className="list-disc ml-6 space-y-1 text-sm text-blue-800 dark:text-blue-400">
                <li>Meeting Manager (Scribe & Meeting Notes)</li>
                <li>Complaint Management System</li>
              </ul>
              <p className="text-sm text-blue-700 dark:text-blue-500 mt-2 italic">Note: AI4GP Clinical Decision Support Service is out of scope for the initial pilot.</p>
            </div>
          </CardContent>
        </Card>

        {/* Main Hazard Analysis Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 w-5 text-orange-600" />
              Hazard Analysis & Risk Assessment
            </CardTitle>
            <CardDescription>
              Comprehensive hazard identification and risk assessment for NoteWell systems (DCB0129 compliant)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HazardAnalysisReport />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
          <p className="font-semibold">NHS OFFICIAL-SENSITIVE</p>
          <p className="mt-1">This Hazard Log is maintained in accordance with DCB0129 requirements</p>
          <p className="mt-1">© {new Date().getFullYear()} PCN Services Ltd trading as NoteWell AI. All rights reserved.</p>
          <p className="mt-2 text-xs">MHRA Class I Medical Device | Clinical Safety Officer: [To be assigned]</p>
        </div>
      </div>
    </div>
  );
};

export default HazardLog;
