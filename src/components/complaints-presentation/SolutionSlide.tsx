import React from 'react';
import { CheckCircle, Bot, Shield, Award, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const SolutionSlide = () => {
  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content */}
      <div className="flex-1 flex items-center px-16 py-12">
        <div className="max-w-6xl space-y-8 animate-fade-in">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-[#003087] leading-tight">
              Our Intelligent Solution
            </h1>
            <p className="text-2xl text-foreground">
              Designed specifically to help NHS practices manage modern complaints efficiently, 
              fairly, and in full compliance with NHS protocols
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6 pt-6">
            <Card className="p-8 text-center border-2 border-primary/20 bg-primary/5 hover:border-primary/40 transition-colors animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Bot className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">AI-Powered Analysis</h2>
              <p className="text-lg text-muted-foreground">
                Automatically extracts key information, categorizes complaints, and identifies all relevant staff and issues
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <Sparkles className="w-4 h-4" />
                <span>Intelligent Processing</span>
              </div>
            </Card>

            <Card className="p-8 text-center border-2 border-secondary/20 bg-secondary/5 hover:border-secondary/40 transition-colors animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-secondary" />
              </div>
              <h2 className="text-2xl font-bold">NHS Compliant</h2>
              <p className="text-lg text-muted-foreground">
                Built-in protocols ensure all responses meet NHS standards, deadlines, and complaint handling procedures
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-secondary font-medium">
                <Shield className="w-4 h-4" />
                <span>Protocol Adherence</span>
              </div>
            </Card>

            <Card className="p-8 text-center border-2 border-accent/20 bg-accent/5 hover:border-accent/40 transition-colors animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <Award className="w-10 h-10 text-accent" />
              </div>
              <h2 className="text-2xl font-bold">CQC Ready</h2>
              <p className="text-lg text-muted-foreground">
                Generates comprehensive reports mapping to all 15 CQC fundamental standards for inspection readiness
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-accent font-medium">
                <Award className="w-4 h-4" />
                <span>Inspection Ready</span>
              </div>
            </Card>
          </div>

          {/* Bottom Message */}
          <div className="pt-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <p className="text-lg text-foreground">
              <span className="font-semibold">Comprehensive solution</span> that combines AI efficiency with regulatory compliance
            </p>
          </div>
        </div>
      </div>

      {/* Turquoise Accent Bar at Bottom */}
      <div className="h-16 bg-gradient-to-r from-[#00A9CE] to-[#00A9CE]" />
    </div>
  );
};
