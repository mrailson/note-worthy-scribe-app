import React from 'react';
import { Shield, Award, Bot } from 'lucide-react';

export const TitleSlide = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
      <div className="space-y-4">
        <div className="flex justify-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-fade-in">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Bot className="w-8 h-8 text-secondary" />
          </div>
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Award className="w-8 h-8 text-accent" />
          </div>
        </div>

        <h1 className="text-6xl font-bold text-foreground animate-fade-in">
          NHS Complaints Management System
        </h1>
        
        <p className="text-2xl text-muted-foreground max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Intelligent Solution for Modern Healthcare Complaint Management
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-8 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="px-6 py-3 rounded-full bg-primary/10 text-primary font-medium">
            AI-Powered Analysis
          </div>
          <div className="px-6 py-3 rounded-full bg-secondary/10 text-secondary font-medium">
            NHS Protocol Compliant
          </div>
          <div className="px-6 py-3 rounded-full bg-accent/10 text-accent font-medium">
            CQC Ready Reporting
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground pt-8 animate-fade-in" style={{ animationDelay: '0.9s' }}>
        Press space or → to continue
      </p>
    </div>
  );
};
