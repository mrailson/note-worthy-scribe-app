import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Settings, 
  ChevronDown, 
  Users, 
  Monitor, 
  FileText, 
  ClipboardPaste,
  Upload 
} from "lucide-react";

interface MeetingSettingsProps {
  onSettingsChange: (settings: any) => void;
}

export const MeetingSettings = ({ onSettingsChange }: MeetingSettingsProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [settings, setSettings] = useState({
    meetingType: "",
    location: "",
    format: "",
    attendees: "",
    agenda: ""
  });

  const updateSetting = (key: string, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <Card className="shadow-medium">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Meeting Settings
              </div>
              <ChevronDown 
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Meeting Type */}
            <div className="space-y-2">
              <Label htmlFor="meeting-type">Meeting Type</Label>
              <Select onValueChange={(value) => updateSetting('meetingType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meeting type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Meeting</SelectItem>
                  <SelectItem value="icb">ICB Meeting</SelectItem>
                  <SelectItem value="it-systems">IT and Systems Meeting</SelectItem>
                  <SelectItem value="pcn">PCN Meeting</SelectItem>
                  <SelectItem value="partnership">Partnership Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Site/Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Site/Location</Label>
              <Input
                id="location"
                placeholder="Search by Practice Name or Area"
                value={settings.location}
                onChange={(e) => updateSetting('location', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                K-Codes removed due to data inconsistencies
              </p>
            </div>

            {/* Meeting Format */}
            <div className="space-y-2">
              <Label>Meeting Format</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.format === 'face-to-face' ? 'default' : 'outline'}
                  onClick={() => updateSetting('format', 'face-to-face')}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Face to Face
                </Button>
                <Button
                  variant={settings.format === 'online' ? 'default' : 'outline'}
                  onClick={() => updateSetting('format', 'online')}
                  className="flex-1"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Teams/Web Meeting
                </Button>
              </div>
            </div>

            {/* Meeting Attendees */}
            <div className="space-y-2">
              <Label htmlFor="attendees">Meeting Attendees</Label>
              <div className="flex gap-2 mb-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Import from File
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Paste from Clipboard
                </Button>
              </div>
              <Textarea
                id="attendees"
                placeholder="Example: Dr. Smith, Nurse Johnson, Admin Manager Brown"
                value={settings.attendees}
                onChange={(e) => updateSetting('attendees', e.target.value)}
                rows={3}
              />
            </div>

            {/* Meeting Agenda */}
            <div className="space-y-2">
              <Label htmlFor="agenda">Meeting Agenda</Label>
              <div className="flex gap-2 mb-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Import from File
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Paste from Clipboard
                </Button>
              </div>
              <Textarea
                id="agenda"
                placeholder="Example:&#10;1. Review of previous actions&#10;2. Financial update&#10;3. Staffing matters&#10;4. Any other business"
                value={settings.agenda}
                onChange={(e) => updateSetting('agenda', e.target.value)}
                rows={5}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};