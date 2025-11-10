import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import complaintPage1 from '@/assets/complaint-page-1.jpg';
import complaintPage2 from '@/assets/complaint-page-2.jpg';

export const CallToActionSlide = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content */}
      <div className="flex-1 flex items-center px-16 py-6">
        <div className="max-w-7xl w-full space-y-3 animate-fade-in">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-[#003087] leading-tight">
              Simulated Example Complaint
            </h1>
            <p className="text-xl text-foreground">
              Example of a modern, detailed complaint we'll process through the system
            </p>
          </div>

          {/* Key Components - Collapsible */}
          <div className="bg-[#003087]/5 rounded-lg border border-[#003087]/20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-[#003087]/10 transition-colors rounded-lg"
            >
              <h3 className="text-lg font-semibold text-[#003087]">Key Components</h3>
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-[#003087]" />
              ) : (
                <ChevronRight className="h-5 w-5 text-[#003087]" />
              )}
            </button>
            
            {isExpanded && (
              <div className="px-4 pb-4 animate-fade-in">
                <ul className="grid grid-cols-2 gap-2 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-[#00A9CE] mt-1">•</span>
                    <span>4 appointments cancelled in 3 months</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00A9CE] mt-1">•</span>
                    <span>Short notice cancellations (less than 24 hours)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00A9CE] mt-1">•</span>
                    <span>Poor communication from practice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00A9CE] mt-1">•</span>
                    <span>Delayed treatment for chronic back pain</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Two complaint pages side by side */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-[#003087]/20 animate-fade-in max-h-[calc((100vh-280px)*0.85)]" style={{ animationDelay: '0.2s' }}>
              <img 
                src={complaintPage1} 
                alt="Complaint Letter Page 1" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-[#003087]/20 animate-fade-in relative max-h-[calc((100vh-280px)*0.85)]" style={{ animationDelay: '0.3s' }}>
              <img 
                src={complaintPage2} 
                alt="Complaint Letter Page 2" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Turquoise Accent Bar at Bottom with Button */}
      <div className="h-16 bg-gradient-to-r from-[#00A9CE] to-[#00A9CE] flex items-center justify-center">
        <Button
          onClick={() => navigate('/complaints')}
          size="lg"
          className="bg-white hover:bg-white/90 text-[#003087] font-bold px-8 py-4 text-lg shadow-xl"
        >
          Open Notewell AI Complaints System
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
