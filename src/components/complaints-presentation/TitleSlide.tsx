import React from 'react';
import bluePCNLogo from '@/assets/blue-pcn-logo-grey.png';

export const TitleSlide = () => {
  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Content - Left Aligned */}
      <div className="flex-1 flex items-center px-16 py-12">
        <div className="max-w-5xl space-y-8 animate-fade-in">
          {/* Session and Context */}
          <div className="space-y-2">
            <p className="text-2xl text-muted-foreground font-medium">
              ICS Digital, Data and Technology
            </p>
            <p className="text-lg text-muted-foreground">
              Innovation Showcase - Session 15:20
            </p>
          </div>

          {/* Main Title */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-[#003087] leading-tight">
              Streamlining NHS Complaints Management
            </h1>
            <h2 className="text-5xl font-bold text-[#005EB8]">
              with AI-Powered NoteWell
            </h2>
          </div>

          {/* Event Details */}
          <p className="text-3xl font-bold text-[#003087]">
            14 November 2025, 14:00-16:00
          </p>

          {/* Description */}
          <p className="text-xl text-foreground max-w-4xl leading-relaxed">
            An intelligent complaints management system that automates NHS complaint workflows for GP practices, 
            ensuring CQC compliance whilst reducing administrative burden. From acknowledgement to resolution, 
            NoteWell guides practices through statutory timelines and generates professional responses aligned with NHS procedures.
          </p>

          {/* Presenter Details with Logo */}
          <div className="flex items-center gap-6 pt-6">
            <img src={bluePCNLogo} alt="Blue PCN Logo" className="h-16 w-auto" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                Malcolm Railson
              </p>
              <p className="text-lg text-muted-foreground">
                Digital & Transformation Lead, Blue PCN
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Turquoise Accent Bar at Bottom */}
      <div className="h-16 bg-gradient-to-r from-[#00A9CE] to-[#00A9CE]" />
    </div>
  );
};
