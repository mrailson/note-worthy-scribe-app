import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingConfiguration } from "../MeetingConfiguration";
import { MeetingImporter } from "../MeetingImporter";
import { useDashboard } from "../utils/DashboardContext";
import { Settings, Upload } from "lucide-react";
import { showToast } from '@/utils/toastWrapper';
import { useNavigate } from 'react-router-dom';

export const MeetingSetupTab = () => {
  const { meetingConfig, updateMeetingConfig } = useDashboard();
  const navigate = useNavigate();

  const handleMeetingCreated = (meetingId: string) => {
    showToast.success('Meeting imported! Redirecting to Meeting History...', { section: 'meeting_manager' });
    
    // Navigate to Meeting History tab with scroll-to functionality
    navigate('/?tab=history', { 
      state: { 
        viewNotes: meetingId,
        openModal: true,
        scrollToMeetingId: meetingId
      } 
    });
  };

  const handleConfigChange = (newConfig: any) => {
    updateMeetingConfig(newConfig);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="configure" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configure" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure Meeting
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Content
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configure" className="mt-6">
          <MeetingConfiguration
            config={{
              title: meetingConfig.title || '',
              attendees: meetingConfig.attendees || [],
              agenda: meetingConfig.agenda || '',
              format: meetingConfig.format || 'teams',
              agendaFiles: meetingConfig.agendaFiles || []
            }}
            onConfigChange={handleConfigChange}
          />
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <MeetingImporter
            onMeetingCreated={handleMeetingCreated}
            meetingConfig={{
              title: meetingConfig.title || 'Imported Meeting',
              attendees: meetingConfig.attendees || [],
              agenda: meetingConfig.agenda,
              format: meetingConfig.format
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};