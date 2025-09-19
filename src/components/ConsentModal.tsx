import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getConsentMessage } from '@/constants/consentTranslations';
import { CheckCircle, XCircle } from 'lucide-react';

interface ConsentModalProps {
  open: boolean;
  onConsentGiven: () => void;
  onConsentDenied: () => void;
  languageCode: string;
  languageName: string;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  open,
  onConsentGiven,
  onConsentDenied,
  languageCode,
  languageName,
}) => {
  const consentMessage = getConsentMessage(languageCode);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8"
      >
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-center text-2xl font-bold text-primary">
            Patient Consent Required
          </DialogTitle>
          <div className="text-center text-lg text-muted-foreground">
            Language Support Service - {languageName}
          </div>
        </DialogHeader>

        <div className="space-y-8">
          {/* Patient consent message in their language */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
            <div className="text-center text-lg font-medium text-primary mb-4">
              Patient Consent Message ({languageName})
            </div>
            <div 
              className="text-2xl leading-relaxed text-center font-medium"
              style={{ fontFamily: 'system-ui', lineHeight: '1.6' }}
            >
              {consentMessage}
            </div>
          </div>

          {/* Clinician reference in English */}
          <div className="bg-muted/50 border border-muted rounded-lg p-4">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              For clinician reference (English):
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              "We are using a language support service to help with today's consultation. 
              Please be aware this service is not always 100% accurate. If something does not 
              sound correct, please let the clinician know or ask for it to be repeated. 
              By continuing, you are giving your consent for us to use this service to support 
              communication during your appointment. If you would like a copy of the translation 
              record at the end of the consultation, please let us know and we will provide this. 
              Do you give your consent to proceed?"
            </div>
          </div>

          {/* Consent buttons */}
          <div className="flex gap-6 justify-center pt-4">
            <Button
              onClick={onConsentDenied}
              variant="outline"
              size="lg"
              className="px-8 py-4 text-lg font-medium min-w-[180px]"
            >
              <XCircle className="w-5 h-5 mr-2" />
              No, Go Back
            </Button>
            <Button
              onClick={onConsentGiven}
              size="lg"
              className="px-8 py-4 text-lg font-medium min-w-[180px] bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Yes, I Consent
            </Button>
          </div>

          {/* Instructions for clinician */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <strong>Instructions:</strong> Please read the consent message above to the patient 
            in their language, then click their response below.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};