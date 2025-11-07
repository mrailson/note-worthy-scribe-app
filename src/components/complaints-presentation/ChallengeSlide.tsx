import React from 'react';
import { AlertTriangle, Bot, TrendingUp, Shield, Gavel } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const ChallengeSlide = () => {
  return (
    <div className="h-full flex flex-col justify-center space-y-8 p-8">
      <div className="text-center mb-6 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <h1 className="text-5xl font-bold text-foreground">The Growing Challenge</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Modern healthcare complaints are becoming increasingly sophisticated and complex
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto w-full">
        <Card className="p-8 border-2 border-destructive/20 bg-destructive/5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">AI-Generated Complaints</h2>
          </div>
          <ul className="space-y-4 text-lg">
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Increasingly sophisticated complaint letters written with AI assistance</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>More detailed, technical, and legally-aware language</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Complex multi-faceted complaints covering multiple issues</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Higher expectations for thorough, professional responses</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8 border-2 border-destructive/20 bg-destructive/5 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Rising Complexity</h2>
          </div>
          <ul className="space-y-4 text-lg">
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Complaints now reference specific NHS guidelines and protocols</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Patients cite legal precedents and regulatory frameworks</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Multiple staff members and departments often involved</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-destructive mt-1">•</span>
              <span>Increased scrutiny from CQC and regulatory bodies</span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="text-center pt-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-destructive/10 text-destructive font-medium">
          <Shield className="w-5 h-5" />
          <span>Practices need intelligent tools to respond effectively</span>
        </div>
      </div>
    </div>
  );
};
