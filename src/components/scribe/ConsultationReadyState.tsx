import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConsultationTypeSelector } from "./ConsultationTypeSelector";
import { PatientConsentBanner } from "./PatientConsentBanner";
import { ScribeDevDisclaimer } from "./ScribeDevDisclaimer";
import { PatientContextCapture } from "./PatientContextCapture";
import { ConsultationType, ConsultationCategory, ScribeSettings, PatientContext } from "@/types/scribe";
import { Mic, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import scribeExplainer from "@/assets/scribe-explainer.png";

interface ConsultationReadyStateProps {
  consultationType: ConsultationType;
  consultationCategory: ConsultationCategory;
  patientConsent: boolean;
  settings: ScribeSettings;
  patientContext: PatientContext | null;
  onTypeChange: (type: ConsultationType) => void;
  onCategoryChange: (category: ConsultationCategory) => void;
  onConsentChange: (consent: boolean) => void;
  onPatientContextChange: (context: PatientContext | null) => void;
  onStart: () => void;
  onOpenSettings: () => void;
}

export const ConsultationReadyState = ({
  consultationType,
  consultationCategory,
  patientConsent,
  settings,
  patientContext,
  onTypeChange,
  onCategoryChange,
  onConsentChange,
  onPatientContextChange,
  onStart,
  onOpenSettings
}: ConsultationReadyStateProps) => {
  const isMobile = useIsMobile();
  const [showExplainer, setShowExplainer] = useState(false);
  
  const canStart = !settings.showConsentReminder || patientConsent;

  return (
    <div className={`flex flex-col items-center justify-center min-h-[60vh] gap-4 ${isMobile ? 'px-2' : 'px-4'}`}>
      {/* Development Disclaimer */}
      {settings.showDevDisclaimer && <ScribeDevDisclaimer className="w-full max-w-xl" />}
      
      <Card className="w-full max-w-xl">
        <CardContent className={`space-y-5 ${isMobile ? 'pt-4 px-3' : 'pt-6 space-y-6'}`}>
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className={`font-semibold text-foreground ${isMobile ? 'text-xl' : 'text-2xl'}`}>
              Ready for Consultation
            </h2>
            <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Select consultation type and confirm consent to begin
            </p>
          </div>

          {/* Patient Context Capture */}
          <PatientContextCapture
            patientContext={patientContext}
            onPatientContextChange={onPatientContextChange}
            emrFormat={settings.emrFormat}
          />

          {/* Consultation Type with Info Button */}
          <div className="flex items-start gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 mt-0.5"
                    onClick={() => setShowExplainer(true)}
                    aria-label="Show patient explainer"
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Patient Consent and AVT Scribe Explainer</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex-1">
              <ConsultationTypeSelector
                value={consultationType}
                category={consultationCategory}
                onChange={onTypeChange}
                onCategoryChange={onCategoryChange}
              />
            </div>
          </div>

          {/* Patient Consent */}
          {settings.showConsentReminder && (
            <PatientConsentBanner
              checked={patientConsent}
              onCheckedChange={onConsentChange}
            />
          )}

          {/* Start Button */}
          <Button
            onClick={onStart}
            disabled={!canStart}
            size="lg"
            className={`
              w-full font-medium gap-3 touch-manipulation
              ${isMobile ? 'h-16 text-lg' : 'h-14 text-lg'}
              ${canStart 
                ? 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all' 
                : 'opacity-50 cursor-not-allowed'
              }
            `}
          >
            <Mic className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
            Start Consultation
          </Button>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      {!isMobile && (
        <div className="mt-8 text-center text-sm text-muted-foreground max-w-md">
          <p className="font-medium mb-2">Quick Tips:</p>
          <ul className="space-y-1 text-xs">
            <li>• Speak naturally during the consultation</li>
            <li>• The AI will create structured SOAP notes</li>
            <li>• You can edit and copy notes when finished</li>
          </ul>
        </div>
      )}

      {/* Patient Explainer Modal */}
      <Dialog open={showExplainer} onOpenChange={setShowExplainer}>
        <DialogContent className="max-w-5xl w-[98vw] h-[95vh] p-2 border-0 flex flex-col">
          <DialogTitle className="sr-only">How the Scribing Service Works</DialogTitle>
          
          {/* Image container - takes maximum space */}
          <div className="flex-1 flex items-center justify-center overflow-auto min-h-0">
            <img 
              src={scribeExplainer} 
              alt="How the scribing service works - Real-time transcription helps the GP take notes, no recordings are kept, and the clinician verifies everything at the end"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          
          {/* Footer with Close button */}
          <div className="flex justify-center pt-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowExplainer(false)}
              className="min-w-[120px]"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
