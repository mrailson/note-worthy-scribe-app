import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Smartphone,
  WifiOff,
  Mic,
  Shield,
  Volume2,
  Square,
  Upload,
  Pause,
  Info,
} from "lucide-react";

export const RecordingSetupGuide = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Info className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">iPhone Offline (No Internet Available) Recording Guide</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-5 w-5 text-primary" />
            iPhone Offline Recording Guide
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Intro */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Offline, in-person, NHS-safe
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Best option: <strong>iPhone + Voice Memos</strong> (audio-only).
              This gives the cleanest audio with the least risk of failure.
              No internet required during recording.
            </p>
          </div>

          {/* Step 1 */}
          <GuideStep
            number={1}
            title="Before the meeting"
            icon={<WifiOff className="h-3.5 w-3.5" />}
          >
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Open <strong>Voice Memos</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Switch <strong>Aeroplane Mode ON</strong> — prevents calls, notifications &amp; radio noise</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Place the phone <strong>flat on the table</strong>, mic pointing upward, roughly central to participants</span>
              </li>
            </ul>
            <div className="mt-2 bg-primary/5 rounded p-2 border border-primary/10">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3 text-primary shrink-0" />
                Positioning alone improves transcription accuracy by ~15–25%.
              </p>
            </div>
          </GuideStep>

          {/* Step 2 */}
          <GuideStep
            number={2}
            title="Start recording"
            icon={<Mic className="h-3.5 w-3.5" />}
          >
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">●</span>
                <span>Tap the red record button</span>
              </li>
              <li className="flex items-start gap-2">
                <Volume2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span>
                  Say aloud: <em>&quot;This meeting is being recorded for note-taking purposes.&quot;</em>
                </span>
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              This helps with consent, provides clear opening context, and improves speaker separation.
            </p>
          </GuideStep>

          {/* Step 3 */}
          <GuideStep
            number={3}
            title="During the meeting"
            icon={<Pause className="h-3.5 w-3.5" />}
          >
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span><strong>Do not move</strong> the phone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Avoid placing near laptops, cups, or paper shuffling</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>For long meetings — <strong>pause/resume</strong> is safe in Voice Memos</span>
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Voice Memos records locally — no internet required.
            </p>
          </GuideStep>

          {/* Step 4 */}
          <GuideStep
            number={4}
            title="Stop & name the file"
            icon={<Square className="h-3.5 w-3.5" />}
          >
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Tap <strong>Stop</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Rename immediately, e.g. <em>&quot;PCN Board – 21 Feb 2026&quot;</em>
                </span>
              </li>
            </ul>
          </GuideStep>

          {/* Step 5 - Uploading */}
          <GuideStep
            number={5}
            title="Upload to Notewell"
            icon={<Upload className="h-3.5 w-3.5" />}
          >
            <p className="text-xs text-muted-foreground mb-1.5">
              When you have internet again:
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">1.</span>
                <span>Open <strong>Voice Memos</strong> → tap the recording → tap <strong>Share</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">2.</span>
                <span>Save to <strong>Files</strong>, <strong>OneDrive</strong>, or NHS-approved storage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">3.</span>
                <span>Use the <strong>Import Audio</strong> tab above to upload &amp; transcribe</span>
              </li>
            </ul>
          </GuideStep>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GuideStep = ({
  number,
  title,
  icon,
  children,
}: {
  number: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
        {number}
      </span>
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-semibold text-foreground">{title}</span>
    </div>
    <div className="ml-7 text-xs text-foreground/90 leading-relaxed">
      {children}
    </div>
  </div>
);
