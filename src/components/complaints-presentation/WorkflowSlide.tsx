import React from 'react';
import { Mail, FileText, Bot, BarChart3, Search, Target, Users, CheckCircle, Clock, Shield as ShieldIcon, Gavel, BookOpen, Award, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const WorkflowSlide = () => {
  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content */}
      <div className="flex-1 flex items-center px-16 py-12">
        <div className="max-w-6xl space-y-8 animate-fade-in">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-[#003087] leading-tight">
              How The System Works
            </h1>
            <p className="text-2xl text-foreground">
              Four-stage intelligent workflow for comprehensive complaint management
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-6 pt-6">
            <Card className="p-6 border-2 border-primary/20 bg-primary/5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">1. Intelligent Intake & Processing</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Search className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">AI automatically extracts patient details, incident information, and key concerns</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">Categorises complaints by type, severity, and required response timeframe</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm">Identifies all staff members mentioned and creates response workflows</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-secondary/20 bg-secondary/5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-secondary" />
                </div>
                <h2 className="text-xl font-bold">2. Evidence & Documentation</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                  <span className="text-sm">Secure document upload and storage with complete audit trails</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                  <span className="text-sm">Timeline tracking with automatic reminders for key deadlines</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldIcon className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                  <span className="text-sm">Staff response collection with secure access links</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-accent/20 bg-accent/5 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-xl font-bold">3. Professional Letter Generation</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span className="text-sm">AI-generated acknowledgement letters within NHS timeframes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Gavel className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span className="text-sm">Outcome letters with appropriate tone and legal compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span className="text-sm">Built-in templates following NHS complaints procedure guidelines</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-[#003087]/20 bg-[#003087]/5 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#003087]/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#003087]" />
                </div>
                <h2 className="text-xl font-bold">4. CQC-Ready Compliance Reporting</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Award className="w-4 h-4 text-[#003087] mt-1 flex-shrink-0" />
                  <span className="text-sm">Maps every complaint to the 15 CQC fundamental standards</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-[#003087] mt-1 flex-shrink-0" />
                  <span className="text-sm">Demonstrates learning outcomes and service improvements</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#003087] mt-1 flex-shrink-0" />
                  <span className="text-sm">Evidence of fair, thorough investigation processes</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* Bottom Message */}
          <div className="pt-2 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <p className="text-sm text-muted-foreground">
              End-to-end solution designed for NHS complaint handling requirements
            </p>
          </div>
        </div>
      </div>

      {/* Turquoise Accent Bar at Bottom */}
      <div className="h-16 bg-gradient-to-r from-[#00A9CE] to-[#00A9CE]" />

      {/* Navigation Hint */}
      <p className="absolute bottom-20 left-16 text-sm text-muted-foreground">
        Press space or → to continue
      </p>
    </div>
  );
};
