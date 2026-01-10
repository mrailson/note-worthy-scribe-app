import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultationTypeSelector } from "./ConsultationTypeSelector";
import { PatientConsentBanner } from "./PatientConsentBanner";
import { ConsultationType, ScribeSettings } from "@/types/scribe";
import { Mic, Settings2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConsultationReadyStateProps {
  consultationType: ConsultationType;
  patientConsent: boolean;
  settings: ScribeSettings;
  onTypeChange: (type: ConsultationType) => void;
  onConsentChange: (consent: boolean) => void;
  onStart: () => void;
  onOpenSettings: () => void;
}

export const ConsultationReadyState = ({
  consultationType,
  patientConsent,
  settings,
  onTypeChange,
  onConsentChange,
  onStart,
  onOpenSettings
}: ConsultationReadyStateProps) => {
  const isMobile = useIsMobile();
  
  const canStart = !settings.showConsentReminder || patientConsent;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Ready for Consultation
            </h2>
            <p className="text-muted-foreground text-sm">
              Select consultation type and confirm consent to begin
            </p>
          </div>

          {/* Consultation Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Consultation Type
            </label>
            <ConsultationTypeSelector
              value={consultationType}
              onChange={onTypeChange}
            />
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
              w-full h-14 text-lg font-medium gap-3
              ${canStart 
                ? 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all' 
                : 'opacity-50 cursor-not-allowed'
              }
            `}
          >
            <Mic className="h-5 w-5" />
            Start Consultation
          </Button>

          {/* Settings Link */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <Settings2 className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
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
