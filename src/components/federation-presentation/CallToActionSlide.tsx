import { Button } from "@/components/ui/button";
import { Mail, FileCheck, Sparkles } from "lucide-react";

export const CallToActionSlide = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-nhs-blue via-nhs-light-blue to-nhs-aqua-blue text-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-5xl">
        {/* Main heading */}
        <h2 className="text-6xl font-bold mb-6">
          Ready to Transform Your Practice?
        </h2>
        
        <div className="w-32 h-1 bg-white mx-auto mb-8" />

        {/* Subtitle */}
        <p className="text-3xl mb-12 font-light opacity-90">
          Let's discuss how these integrated systems can benefit Northamptonshire practices
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
          <Button 
            size="lg" 
            variant="secondary"
            className="text-xl py-6 px-8 h-auto"
            onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Schedule a Meeting - Notewell AI Systems'}
          >
            <Mail className="mr-3 h-6 w-6" />
            Schedule a Meeting
          </Button>
          
          <Button 
            size="lg" 
            variant="outline"
            className="text-xl py-6 px-8 h-auto bg-white/10 hover:bg-white/20 text-white border-2 border-white"
            onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Request for Full Proposal - Notewell AI Systems'}
          >
            <FileCheck className="mr-3 h-6 w-6" />
            Request Detailed Proposal
          </Button>
          
          <Button 
            size="lg" 
            variant="outline"
            className="text-xl py-6 px-8 h-auto bg-white/10 hover:bg-white/20 text-white border-2 border-white"
            onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Request for Live Demo - Notewell AI Systems'}
          >
            <Sparkles className="mr-3 h-6 w-6" />
            View Live Demonstration
          </Button>
        </div>

        {/* Contact information */}
        <div className="space-y-4 text-xl opacity-90">
          <p className="font-medium">Malcolm Railson</p>
          <p>Digital Innovation Lead</p>
          <p className="text-2xl font-semibold">malcolm.railson@nhs.net</p>
        </div>

        {/* Closing message */}
        <div className="mt-16 text-2xl font-light opacity-80">
          Thank you for your time and consideration
        </div>
      </div>
    </div>
  );
};
