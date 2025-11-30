import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Volume2, Wifi } from 'lucide-react';
import QRCode from 'qrcode';

interface PhoneRecordingGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PhoneRecordingGuide: React.FC<PhoneRecordingGuideProps> = ({
  open,
  onOpenChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentUrl = window.location.origin;

  useEffect(() => {
    if (open && canvasRef.current) {
      // Generate QR code for current Notewell URL
      QRCode.toCanvas(
        canvasRef.current,
        currentUrl,
        {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
        }
      );
    }
  }, [open, currentUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-centre gap-3 mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <DialogTitle className="text-xl">Phone Recording Guide</DialogTitle>
          </div>
          <DialogDescription>
            Use your phone to capture high-quality audio from everyone in the meeting room
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* QR Code Section */}
          <Card className="border-primary/30">
            <CardContent className="pt-6">
              <div className="flex flex-col items-centre gap-4">
                <h3 className="font-semibold text-centre">
                  Step 1: Open Notewell on Your Phone
                </h3>
                <canvas ref={canvasRef} className="border rounded-lg" />
                <p className="text-sm text-muted-foreground text-centre max-w-sm">
                  Scan this QR code with your phone's camera to open Notewell
                </p>
                <p className="text-xs text-muted-foreground text-centre font-mono bg-muted px-3 py-2 rounded">
                  {currentUrl}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Setup Instructions */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Step 2: Position Your Phone</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-centre justify-centre text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Place on Table</p>
                    <p className="text-sm text-muted-foreground">
                      Put your phone face-up in the centre of the meeting table or desk
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-centre justify-centre text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Ensure Clear Path</p>
                    <p className="text-sm text-muted-foreground">
                      Make sure the microphone (usually at bottom of phone) isn't blocked
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-centre justify-centre text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Check Distance</p>
                    <p className="text-sm text-muted-foreground">
                      Within 1-2 metres of speakers for best quality (phone mics are surprisingly good!)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recording Tips */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Step 3: Start Recording</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Volume2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Audio Quality Tips</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside mt-1 space-y-1">
                      <li>Keep phone plugged in or fully charged</li>
                      <li>Turn off notifications to avoid interruptions</li>
                      <li>Use 'Do Not Disturb' mode</li>
                      <li>Test audio level before the meeting starts</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Wifi className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Connection</p>
                    <p className="text-sm text-muted-foreground">
                      Ensure stable Wi-Fi or mobile data connection. Recording works offline but transcription requires internet.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Why This Works */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">💡 Why This Works</h3>
              <p className="text-sm text-muted-foreground">
                Phone microphones are designed to capture voices clearly from all directions. 
                Unlike laptop mics (which focus on the person in front), phone mics in the centre 
                of a room capture everyone equally well. This is ideal for face-to-face meetings 
                where NHS laptops can't capture system audio.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
