import { Sparkles, FileText, MessageSquare, Globe } from "lucide-react";

export const TitleSlide = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-nhs-blue via-nhs-light-blue to-nhs-aqua-blue text-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-5xl">
        {/* Logo area */}
        <div className="mb-8">
          <img 
            src="/oak-lane-logo.png" 
            alt="Blue PCN Logo" 
            className="h-24 mx-auto mb-4 drop-shadow-lg"
          />
        </div>

        {/* Main title */}
        <h1 className="text-6xl font-bold mb-6 animate-fade-in">
          Transforming GP Practice Management
        </h1>
        
        {/* Subtitle */}
        <p className="text-3xl mb-8 font-light opacity-90">
          Four Integrated AI Systems for Operational Excellence
        </p>

        {/* Feature badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg p-4">
            <FileText className="h-6 w-6" />
            <span className="font-medium">Complaints</span>
          </div>
          <div className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg p-4">
            <MessageSquare className="h-6 w-6" />
            <span className="font-medium">Meeting Notes</span>
          </div>
          <div className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg p-4">
            <Sparkles className="h-6 w-6" />
            <span className="font-medium">AI Assistant</span>
          </div>
          <div className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg p-4">
            <Globe className="h-6 w-6" />
            <span className="font-medium">Translation</span>
          </div>
        </div>

        {/* Turquoise accent bar */}
        <div className="w-32 h-1 bg-nhs-aqua-blue mx-auto mb-8" />

        {/* Presenter info */}
        <div className="text-xl opacity-90">
          <p className="font-medium">Presented to Northamptonshire GP Federation</p>
          <p className="mt-2">Malcolm Railson, Digital Innovation Lead</p>
          <p className="text-lg mt-1">malcolm.railson@nhs.net</p>
        </div>
      </div>
    </div>
  );
};
