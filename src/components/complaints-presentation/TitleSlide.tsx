import React from 'react';
import { Shield, Award, Bot } from 'lucide-react';

export const TitleSlide = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 px-8">
      <div className="space-y-6">
        <div className="flex justify-center gap-4 mb-6">
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

        <div className="space-y-2 animate-fade-in">
          <p className="text-lg text-muted-foreground font-medium">Session 1520</p>
          <h1 className="text-5xl font-bold text-foreground">
            Streamlining NHS Complaints Management
          </h1>
          <h2 className="text-4xl font-bold text-primary">
            with AI-Powered NoteWell
          </h2>
        </div>
        
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.3s' }}>
          An intelligent complaints management system that automates NHS complaint workflows for GP practices, 
          ensuring CQC compliance whilst reducing administrative burden. From acknowledgement to resolution, 
          NoteWell guides practices through statutory timelines and generates professional responses aligned with NHS procedures.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="px-6 py-3 rounded-full bg-primary/10 text-primary font-medium">
            AI-Powered Automation
          </div>
          <div className="px-6 py-3 rounded-full bg-secondary/10 text-secondary font-medium">
            NHS Protocol Compliant
          </div>
          <div className="px-6 py-3 rounded-full bg-accent/10 text-accent font-medium">
            CQC Ready Reporting
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 mt-8 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <p className="text-base text-muted-foreground font-medium">
            Malcolm Railson
          </p>
          <p className="text-sm text-muted-foreground">
            Digital & Transformation Lead, Blue PCN
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground pt-6 animate-fade-in" style={{ animationDelay: '1s' }}>
        Press space or → to continue
      </p>
    </div>
  );
};
