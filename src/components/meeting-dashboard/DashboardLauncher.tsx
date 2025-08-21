import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";
import { RealtimeMeetingDashboard } from "./RealtimeMeetingDashboard";

interface DashboardLauncherProps {
  isRecording: boolean;
  meetingData: {
    transcript: string;
    duration: number;
    wordCount: number;
    connectionStatus: string;
  };
}

export const DashboardLauncher = ({ isRecording, meetingData }: DashboardLauncherProps) => {
  const [dashboardOpen, setDashboardOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setDashboardOpen(true)}
        variant="outline"
        size="sm"
        className="text-xs"
      >
        <Monitor className="h-3 w-3 mr-2" />
        Dashboard
      </Button>

      <RealtimeMeetingDashboard
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        isRecording={isRecording}
        meetingData={meetingData}
      />
    </>
  );
};