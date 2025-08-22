import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X, Settings, Monitor, CheckSquare, FileText } from "lucide-react";
import { MeetingSetupTab } from "./tabs/MeetingSetupTab";
import { LiveMonitorTab } from "./tabs/LiveMonitorTab";
import { SmartValidationTab } from "./tabs/SmartValidationTab";
import { LiveNotesTab } from "./tabs/LiveNotesTab";
import { DashboardProvider } from "./utils/DashboardContext";
import { cn } from "@/lib/utils";

interface RealtimeMeetingDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  isRecording: boolean;
  meetingData: {
    transcript: string;
    duration: number;
    wordCount: number;
    connectionStatus: string;
  };
}

export const RealtimeMeetingDashboard = ({
  isOpen,
  onClose,
  isRecording,
  meetingData
}: RealtimeMeetingDashboardProps) => {
  const [activeTab, setActiveTab] = useState("setup");
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-switch to monitor tab when recording starts
  useEffect(() => {
    if (isRecording && activeTab === "setup") {
      setActiveTab("monitor");
    }
  }, [isRecording, activeTab]);

  const tabs = [
    { 
      id: "setup", 
      label: "Setup", 
      icon: Settings, 
      disabled: false 
    },
    { 
      id: "monitor", 
      label: "Monitor", 
      icon: Monitor, 
      disabled: !isRecording 
    },
    { 
      id: "validation", 
      label: "Validation", 
      icon: CheckSquare, 
      disabled: !isRecording 
    },
    { 
      id: "notes", 
      label: "Live Notes", 
      icon: FileText, 
      disabled: !isRecording 
    }
  ];

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsMinimized(false)}
          className="h-12 w-12 rounded-full shadow-lg"
          size="icon"
        >
          <Monitor className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <DashboardProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col [&>button]:hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                Real-time Meeting Dashboard
                {isRecording && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm text-muted-foreground">Recording</span>
                  </div>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsMinimized(true)}
                >
                  Minimize
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="mx-6 mt-4 grid grid-cols-4 w-full shrink-0">
                {tabs.map((tab) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id}
                    disabled={tab.disabled}
                    className={cn(
                      "flex items-center gap-2",
                      tab.disabled && "opacity-50"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 p-6 min-h-0 overflow-hidden">
                <TabsContent value="setup" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full">
                    <MeetingSetupTab />
                  </div>
                </TabsContent>
                
                <TabsContent value="monitor" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full">
                    <LiveMonitorTab meetingData={meetingData} />
                  </div>
                </TabsContent>
                
                <TabsContent value="validation" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full">
                    <SmartValidationTab meetingData={meetingData} />
                  </div>
                </TabsContent>
                
                <TabsContent value="notes" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full">
                    <LiveNotesTab meetingData={meetingData} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardProvider>
  );
};