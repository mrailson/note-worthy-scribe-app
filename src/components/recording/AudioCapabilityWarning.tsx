import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Smartphone, Globe, Mic, RefreshCw } from 'lucide-react';
import { AudioCapabilities } from '@/utils/AudioCapabilityChecker';
import { PhoneRecordingGuide } from './PhoneRecordingGuide';
import { BrowserTeamsGuide } from './BrowserTeamsGuide';

interface AudioCapabilityWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capabilities: AudioCapabilities;
  onContinueAnyway: () => void;
  onRunTest: () => void;
}

export const AudioCapabilityWarning: React.FC<AudioCapabilityWarningProps> = ({
  open,
  onOpenChange,
  capabilities,
  onContinueAnyway,
  onRunTest,
}) => {
  const [showPhoneGuide, setShowPhoneGuide] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);

  const handleContinueAnyway = () => {
    onContinueAnyway();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-6 w-6 text-warning" />
              <DialogTitle className="text-xl">Limited Audio Capture Detected</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Your device can only capture your microphone. Other participants on Teams/Zoom won't be recorded.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Diagnosis Message */}
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  {capabilities.diagnosisMessage}
                </p>
                {capabilities.isLikelyLockedDown && (
                  <p className="text-sm text-muted-foreground mt-2">
                    This is common on NHS and corporate laptops with restricted permissions.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recommended Options */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Recommended Options
              </h3>

              {/* Phone Recording Option */}
              <Card className="border-primary/30 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setShowPhoneGuide(true)}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base mb-1">
                        📱 Use Your Phone <span className="text-xs text-primary">(Best Quality)</span>
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Record using iPhone or Android in the meeting room. The phone mic captures everyone clearly.
                      </p>
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPhoneGuide(true);
                        }}
                      >
                        Open Notewell on Phone
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Browser Teams Option */}
              <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setShowBrowserGuide(true)}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Globe className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base mb-1">
                        🌐 Join Teams in Browser <span className="text-xs text-muted-foreground">(If Available)</span>
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Join via browser instead of desktop app. Share the Teams tab to capture meeting audio.
                      </p>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBrowserGuide(true);
                        }}
                      >
                        Show Me How
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Continue with Mic Only */}
              <Card className="hover:border-muted transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Mic className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base mb-1">
                        🎤 Continue with Mic Only
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your voice will be captured clearly. Consider speaking a summary for remote participants at the end.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleContinueAnyway}
                      >
                        Continue Anyway
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Re-test Button */}
            <div className="flex justify-center pt-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRunTest}
                className="text-muted-foreground"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Audio Test Again
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Child Modals */}
      <PhoneRecordingGuide 
        open={showPhoneGuide}
        onOpenChange={setShowPhoneGuide}
      />
      
      <BrowserTeamsGuide 
        open={showBrowserGuide}
        onOpenChange={setShowBrowserGuide}
      />
    </>
  );
};
