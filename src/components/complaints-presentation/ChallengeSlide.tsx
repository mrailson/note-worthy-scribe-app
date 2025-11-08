import React from 'react';
import { AlertTriangle, Bot, TrendingUp, Shield, Gavel } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const ChallengeSlide = () => {
  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content */}
      <div className="flex-1 flex items-center px-16 py-12">
        <div className="max-w-6xl space-y-8 animate-fade-in">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-[#003087] leading-tight">
              The Growing Challenge
            </h1>
            <p className="text-2xl text-foreground">
              Modern healthcare complaints are becoming increasingly sophisticated and complex
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-8 pt-6">
            <Card className="p-8 border-2 border-[#003087]/20 bg-[#003087]/5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#003087]/10 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[#003087]" />
                </div>
                <h2 className="text-2xl font-bold">AI-Generated Complaints</h2>
              </div>
              <ul className="space-y-4 text-lg">
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Increasingly sophisticated complaint letters written with AI assistance</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>More detailed, technical, and legally-aware language</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Complex multi-faceted complaints covering multiple issues</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Higher expectations for thorough, professional responses</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-2 border-[#003087]/20 bg-[#003087]/5 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#003087]/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#003087]" />
                </div>
                <h2 className="text-2xl font-bold">Rising Complexity</h2>
              </div>
              <ul className="space-y-4 text-lg">
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Complaints now reference specific NHS guidelines and protocols</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Patients cite legal precedents and regulatory frameworks</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Multiple staff members and departments often involved</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003087] mt-1">•</span>
                  <span>Increased scrutiny from CQC and regulatory bodies</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* Bottom Message */}
          <div className="pt-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#003087]/10 text-[#003087] font-medium text-lg">
              <Shield className="w-5 h-5" />
              <span>Practice Managers face the difficult balance of handling complaints empathetically while maintaining professional boundaries - particularly when concerns involve senior colleagues</span>
            </div>
          </div>
        </div>
      </div>

      {/* Turquoise Accent Bar at Bottom */}
      <div className="h-16 bg-gradient-to-r from-[#00A9CE] to-[#00A9CE]" />
    </div>
  );
};
