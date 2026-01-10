import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultationTypeSelector } from "./ConsultationTypeSelector";
import { PatientConsentBanner } from "./PatientConsentBanner";
import { ScribeDevDisclaimer } from "./ScribeDevDisclaimer";
import { PatientContextCapture } from "./PatientContextCapture";
import { ConsultationType, ConsultationCategory, ScribeSettings, PatientContext } from "@/types/scribe";
import { Mic, Settings2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

          {/* Consultation Type */}
          <ConsultationTypeSelector
            value={consultationType}
            category={consultationCategory}
            onChange={onTypeChange}
            onCategoryChange={onCategoryChange}
          />

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
    </div>
  );
};
