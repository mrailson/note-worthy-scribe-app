import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Shield, 
  Clock, 
  Users, 
  Gavel, 
  Bot,
  Target,
  BookOpen,
  Award,
  TrendingUp,
  Mail,
  Search,
  BarChart3,
  Lightbulb
} from 'lucide-react';

const ComplaintsUserGuide = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          NHS Complaints Management System
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Your comprehensive solution for managing increasingly complex patient complaints with AI assistance, 
          NHS protocol compliance, and CQC-ready reporting
        </p>
      </div>

      {/* The Challenge Section */}
      <Card className="p-8 mb-8 border-red-200 bg-red-50/30">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
          <h2 className="text-2xl font-bold text-red-800">The Growing Challenge</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI-Generated Complaints
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Increasingly sophisticated complaint letters written with AI assistance</li>
              <li>• More detailed, technical, and legally-aware language</li>
              <li>• Complex multi-faceted complaints covering multiple issues</li>
              <li>• Higher expectations for thorough, professional responses</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Rising Complexity
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Complaints now reference specific NHS guidelines and protocols</li>
              <li>• Patients cite legal precedents and regulatory frameworks</li>
              <li>• Multiple staff members and departments often involved</li>
              <li>• Increased scrutiny from CQC and regulatory bodies</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* The Solution Section */}
      <Card className="p-8 mb-8 border-green-200 bg-green-50/30">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-bold text-green-800">Our Intelligent Solution</h2>
        </div>
        
        <p className="text-lg mb-6 text-muted-foreground">
          This system is specifically designed to help NHS practices manage modern complaints efficiently, 
          fairly, and in full compliance with NHS protocols while preparing you for CQC inspections.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">AI-Powered Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Automatically extracts key information and categorizes complaints
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">NHS Compliant</h3>
            <p className="text-sm text-muted-foreground">
              Built-in protocols ensure all responses meet NHS standards
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">CQC Ready</h3>
            <p className="text-sm text-muted-foreground">
              Generates reports mapping to all 15 CQC fundamental standards
            </p>
          </div>
        </div>
      </Card>

      {/* Key Features Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-center mb-8">How The System Works</h2>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Intake & Processing */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold">1. Intelligent Intake & Processing</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Search className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">AI automatically extracts patient details, incident information, and key concerns</span>
              </li>
              <li className="flex items-start gap-2">
                <Target className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Categorizes complaints by type, severity, and required response timeframe</span>
              </li>
              <li className="flex items-start gap-2">
                <Users className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Identifies all staff members mentioned and creates response workflows</span>
              </li>
            </ul>
          </Card>

          {/* Evidence Management */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold">2. Evidence & Documentation</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Secure document upload and storage with audit trails</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Timeline tracking with automatic reminders for key deadlines</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Staff response collection with secure access links</span>
              </li>
            </ul>
          </Card>

          {/* Letter Generation */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold">3. Professional Letter Generation</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">AI-generated acknowledgement letters within NHS timeframes</span>
              </li>
              <li className="flex items-start gap-2">
                <Gavel className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Outcome letters with appropriate tone and legal compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Built-in templates following NHS complaints procedure guidelines</span>
              </li>
            </ul>
          </Card>

          {/* CQC Reporting */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-6 h-6 text-orange-600" />
              <h3 className="text-xl font-semibold">4. CQC-Ready Compliance Reporting</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Award className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Maps every complaint to the 15 CQC fundamental standards</span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Demonstrates learning outcomes and service improvements</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                <span className="text-sm">Evidence of fair, thorough investigation processes</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* CQC 15 Standards Section */}
      <Card className="p-8 mb-8 border-orange-200 bg-orange-50/30">
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-8 h-8 text-orange-600" />
          <h2 className="text-2xl font-bold text-orange-800">CQC 15 Fundamental Standards Mapping</h2>
        </div>
        
        <p className="text-lg mb-6 text-muted-foreground">
          Every complaint is automatically analyzed against the 15 CQC fundamental standards, 
          ensuring comprehensive compliance reporting for inspections.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            "Person-centred care", "Dignity and respect", "Consent",
            "Safety", "Safeguarding", "Food and drink",
            "Premises and equipment", "Complaints", "Good governance",
            "Staffing", "Fit and proper persons", "Registered manager",
            "Need for registration", "Display of ratings", "Notifications"
          ].map((standard, index) => (
            <Badge key={index} variant="outline" className="p-2 text-sm">
              {index + 1}. {standard}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Benefits Section */}
      <Card className="p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="w-8 h-8 text-yellow-600" />
          <h2 className="text-2xl font-bold">Key Benefits for Your Practice</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-700">Operational Excellence</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Reduce complaint handling time by up to 70%</li>
              <li>• Ensure consistent, professional responses</li>
              <li>• Automatic deadline tracking and reminders</li>
              <li>• Complete audit trail for all activities</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-700">Regulatory Compliance</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Built-in NHS complaints procedure compliance</li>
              <li>• CQC inspection-ready documentation</li>
              <li>• Demonstrated learning and improvement</li>
              <li>• Risk management and trend analysis</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Getting Started */}
      <Card className="p-8 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Complaints Management?</h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join NHS practices already using our system to handle complex, AI-generated complaints 
            with confidence and full regulatory compliance.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Badge className="bg-green-100 text-green-800 px-4 py-2">
              NHS Protocol Compliant
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 px-4 py-2">
              CQC Ready Reporting
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 px-4 py-2">
              AI-Powered Efficiency
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ComplaintsUserGuide;