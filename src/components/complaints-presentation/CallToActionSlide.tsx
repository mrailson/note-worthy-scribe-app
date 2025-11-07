import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import complaintPage1 from '@/assets/complaint-page-1.jpg';
import complaintPage2 from '@/assets/complaint-page-2.jpg';

export const CallToActionSlide = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content */}
      <div className="flex-1 flex items-center px-16 py-6">
        <div className="max-w-7xl w-full space-y-3 animate-fade-in">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-[#003087] leading-tight">
              Demonstration Complaint
            </h1>
            <p className="text-xl text-foreground">
              Example of a modern, detailed complaint we'll process through the system
            </p>
          </div>

          {/* Two complaint pages side by side */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-[#003087]/20 animate-fade-in max-h-[calc(100vh-280px)]" style={{ animationDelay: '0.2s' }}>
              <img 
                src={complaintPage1} 
                alt="Complaint Letter Page 1" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-[#003087]/20 animate-fade-in relative max-h-[calc(100vh-280px)]" style={{ animationDelay: '0.3s' }}>
              <img 
                src={complaintPage2} 
                alt="Complaint Letter Page 2" 
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <Button
                  onClick={() => navigate('/complaints')}
                  size="lg"
                  className="bg-[#003087] hover:bg-[#005EB8] text-white font-bold px-8 py-4 text-base shadow-xl"
                >
                  Open Complaint System
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
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
