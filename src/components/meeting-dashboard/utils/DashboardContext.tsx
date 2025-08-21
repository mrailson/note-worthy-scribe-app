import { createContext, useContext, useState, ReactNode } from "react";

interface MeetingConfig {
  title: string;
  format: "teams" | "f2f" | "hybrid";
  attendees: any[];
  agenda: string;
  agendaFiles: any[];
  contextFiles: any[];
  contextText: string;
}

interface DashboardContextType {
  meetingConfig: MeetingConfig;
  updateMeetingConfig: (updates: Partial<MeetingConfig>) => void;
  validationCorrections: Map<string, string>;
  addCorrection: (incorrect: string, correct: string) => void;
  liveNotes: string;
  updateLiveNotes: (notes: string) => void;
  processingSettings: {
    enableCleaning: boolean;
    enableValidation: boolean;
    enableRealTimeCorrection: boolean;
  };
  updateProcessingSettings: (settings: Partial<DashboardContextType['processingSettings']>) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig>({
    title: "",
    format: "teams",
    attendees: [],
    agenda: "",
    agendaFiles: [],
    contextFiles: [],
    contextText: ""
  });

  const [validationCorrections, setValidationCorrections] = useState(new Map<string, string>());
  const [liveNotes, setLiveNotes] = useState("");
  const [processingSettings, setProcessingSettings] = useState({
    enableCleaning: true,
    enableValidation: true,
    enableRealTimeCorrection: true
  });

  const updateMeetingConfig = (updates: Partial<MeetingConfig>) => {
    setMeetingConfig(prev => ({ ...prev, ...updates }));
  };

  const addCorrection = (incorrect: string, correct: string) => {
    setValidationCorrections(prev => {
      const newMap = new Map(prev);
      newMap.set(incorrect, correct);
      return newMap;
    });
  };

  const updateLiveNotes = (notes: string) => {
    setLiveNotes(notes);
  };

  const updateProcessingSettings = (settings: Partial<DashboardContextType['processingSettings']>) => {
    setProcessingSettings(prev => ({ ...prev, ...settings }));
  };

  return (
    <DashboardContext.Provider value={{
      meetingConfig,
      updateMeetingConfig,
      validationCorrections,
      addCorrection,
      liveNotes,
      updateLiveNotes,
      processingSettings,
      updateProcessingSettings
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};