import React from 'react';
import complaintPage1 from '@/assets/complaint-page-1.jpg';
import complaintPage2 from '@/assets/complaint-page-2.jpg';

export const CallToActionSlide = () => {
  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content */}
      <div className="flex-1 flex items-center px-16 py-12">
        <div className="max-w-7xl w-full space-y-6 animate-fade-in">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-[#003087] leading-tight">
              Demonstration Complaint
            </h1>
            <p className="text-2xl text-foreground">
              Example of a modern, detailed complaint we'll process through the system
            </p>
          </div>

          {/* Two complaint pages side by side */}
          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-[#003087]/20 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <img 
                src={complaintPage1} 
                alt="Complaint Letter Page 1" 
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-[#003087]/20 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <img 
                src={complaintPage2} 
                alt="Complaint Letter Page 2" 
                className="w-full h-auto object-contain"
              />
            </div>
          </div>

          {/* Key details callout */}
          <div className="pt-2 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <p className="text-lg text-foreground">
              <span className="font-semibold">Subject:</span> Repeated Appointment Cancellations and Poor Communication
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
