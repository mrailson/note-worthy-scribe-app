import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import screenShareGuide from "@/assets/screen-share-guide.png";

interface TabAudioGuidanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TabAudioGuidanceDialog = ({ open, onOpenChange, onConfirm, onCancel }: TabAudioGuidanceDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Important: How to Capture Teams Audio in Chrome</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 pt-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="font-semibold text-foreground mb-2">How to capture system audio in Chrome</p>
              <p className="text-sm">Follow these 3 simple steps when the sharing prompt appears:</p>
            </div>

            <div className="flex justify-center my-4">
              <img 
                src={screenShareGuide} 
                alt="Screen sharing guide showing the three steps" 
                className="max-w-full max-h-[50vh] h-auto rounded-lg border border-border shadow-sm"
              />
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Click "Entire screen" tab
                  </h4>
                  <p className="text-sm">Select the "Entire screen" option at the top of the dialog</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Select your screen
                  </h4>
                  <p className="text-sm">Click on the screen preview image showing your desktop</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Enable "Also share system audio"
                  </h4>
                  <p className="text-sm">Slide the toggle at the bottom to <strong>ON</strong>, then click <strong>Share</strong></p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-primary">
            I Understand - Start Recording
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
