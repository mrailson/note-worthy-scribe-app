import React from 'react';
import { CheckCircle, Bot, Shield, Award, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const SolutionSlide = () => {
  return (
    <div className="h-full flex flex-col justify-center space-y-8 p-8">
      <div className="text-center mb-6 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <CheckCircle className="w-12 h-12 text-primary" />
          <h1 className="text-5xl font-bold text-foreground">Our Intelligent Solution</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Designed specifically to help NHS practices manage modern complaints efficiently, 
          fairly, and in full compliance with NHS protocols
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
        <Card className="p-8 text-center border-2 border-primary/20 bg-primary/5 hover:border-primary/40 transition-colors animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">AI-Powered Analysis</h2>
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
          <h2 className="text-2xl font-bold mb-4">NHS Compliant</h2>
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
          <h2 className="text-2xl font-bold mb-4">CQC Ready</h2>
          <p className="text-lg text-muted-foreground">
            Generates comprehensive reports mapping to all 15 CQC fundamental standards for inspection readiness
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-accent font-medium">
            <Award className="w-4 h-4" />
            <span>Inspection Ready</span>
          </div>
        </Card>
      </div>

      <div className="text-center pt-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
        <p className="text-lg text-muted-foreground">
          <span className="font-semibold text-foreground">Comprehensive solution</span> that combines AI efficiency with regulatory compliance
        </p>
      </div>
    </div>
  );
};
