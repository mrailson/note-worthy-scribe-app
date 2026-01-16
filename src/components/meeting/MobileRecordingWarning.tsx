import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Smartphone, AlertTriangle, Check } from "lucide-react";
import { detectDevice } from '@/utils/DeviceDetection';

interface MobileRecordingWarningProps {
  isRecording: boolean;
  onAcknowledge: () => void;
}

export const MobileRecordingWarning: React.FC<MobileRecordingWarningProps> = ({
  isRecording,
  onAcknowledge
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const device = detectDevice();

  // Show warning when recording starts on iOS
  useEffect(() => {
    if (isRecording && device.isIOS && !hasAcknowledged) {
      // Check if user has already acknowledged this session
      const acknowledged = sessionStorage.getItem('ios-recording-warning-acknowledged');
      if (!acknowledged) {
        setShowWarning(true);
      }
    }
  }, [isRecording, device.isIOS, hasAcknowledged]);

  const handleAcknowledge = () => {
    setShowWarning(false);
    setHasAcknowledged(true);
    sessionStorage.setItem('ios-recording-warning-acknowledged', 'true');
    onAcknowledge();
  };

  if (!device.isIOS) {
    return null;
  }

  return (
    <>
      {/* Modal warning on first recording */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-amber-500" />
              iPhone Recording Tips
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  For the best recording experience on your iPhone, please follow these guidelines:
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <p className="text-sm">
                      <strong>Keep this app open</strong> — don't switch to other apps while recording
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <p className="text-sm">
                      <strong>Keep screen on</strong> — tap occasionally to prevent auto-lock
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <p className="text-sm">
                      <strong>Plug in charger</strong> — long recordings can drain battery
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                    </div>
                    <p className="text-sm">
                      <strong>Avoid incoming calls</strong> — phone calls will interrupt recording
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    iOS Safari may pause web audio when backgrounded. For longer meetings, 
                    we recommend using a computer if possible.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleAcknowledge}>
              I Understand, Start Recording
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Persistent banner while recording on iOS */}
      {isRecording && hasAcknowledged && (
        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 mb-4">
          <Smartphone className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
            Keep this app in the foreground for reliable recording
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
