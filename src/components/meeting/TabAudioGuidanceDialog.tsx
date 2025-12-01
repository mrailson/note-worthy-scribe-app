import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Monitor, Chrome, Headphones, AlertTriangle } from "lucide-react";

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
              <p className="font-semibold text-foreground mb-2">Chrome can only capture audio from browser tabs, not applications</p>
              <p className="text-sm">To record your Teams meeting audio, please follow these steps:</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Chrome className="h-4 w-4" />
                    Open Teams in your browser
                  </h4>
                  <p className="text-sm">Go to <span className="font-mono bg-secondary px-2 py-0.5 rounded">teams.microsoft.com</span> instead of using the Teams desktop app</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Select "Chrome Tab" when prompted
                  </h4>
                  <p className="text-sm">When you click "Start Recording", Chrome will ask what to share. Select <strong>"Chrome Tab"</strong> (not Window or Screen)</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Headphones className="h-4 w-4" />
                    Tick "Also share tab audio"
                  </h4>
                  <p className="text-sm">Make sure to <strong>tick the "Also share tab audio" checkbox</strong> at the bottom of the sharing dialog</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm"><strong>Alternative:</strong> If you can't open Teams in a browser, switch to "Microphone Only" mode. Your microphone will pick up the meeting audio acoustically from your speakers.</p>
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
