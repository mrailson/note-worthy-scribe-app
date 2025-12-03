import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Camera, Brain, Download, List, ArrowRight, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function LGCaptureLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [practiceOds, setPracticeOds] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      // First try to load from database if user is logged in
      if (user?.id) {
        const { data } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('user_id', user.id)
          .eq('setting_key', 'lg_capture_defaults')
          .maybeSingle();
        
        if (data?.setting_value) {
          const defaults = data.setting_value as { practiceOds?: string; uploaderName?: string };
          if (defaults.practiceOds) {
            setPracticeOds(defaults.practiceOds);
            localStorage.setItem('lg_practice_ods', defaults.practiceOds);
          }
          if (defaults.uploaderName) {
            setUploaderName(defaults.uploaderName);
            localStorage.setItem('lg_uploader_name', defaults.uploaderName);
          }
          if (defaults.practiceOds && defaults.uploaderName) {
            return; // Settings loaded from DB, don't show settings panel
          }
        }
      }
      
      // Fall back to localStorage
      const savedOds = localStorage.getItem('lg_practice_ods') || '';
      const savedName = localStorage.getItem('lg_uploader_name') || '';
      if (savedOds) setPracticeOds(savedOds);
      if (savedName) setUploaderName(savedName);
      
      // Show settings if not configured
      if (!savedOds || !savedName) {
        setShowSettings(true);
      }
    };
    
    loadSettings();
  }, [user?.id]);

  const saveSettings = () => {
    localStorage.setItem('lg_practice_ods', practiceOds.trim());
    localStorage.setItem('lg_uploader_name', uploaderName.trim());
    setShowSettings(false);
  };

  const canStart = practiceOds.trim() && uploaderName.trim();

  const features = [
    {
      icon: Camera,
      title: 'Mobile Capture',
      description: 'Photograph Lloyd George notes directly with your phone camera',
    },
    {
      icon: FileText,
      title: 'Searchable PDF',
      description: 'Auto-generates a single searchable PDF with correct page order',
    },
    {
      icon: Brain,
      title: 'AI Summary',
      description: 'Structured clinical summary following NHS standards',
    },
    {
      icon: Download,
      title: 'Import Ready',
      description: 'SNOMED CT codes in JSON & CSV for EMIS/SystmOne workflows',
    },
  ];

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Notewell LG Capture</h1>
        <p className="text-muted-foreground">
          Digitise Lloyd George paper records with AI-powered processing
        </p>
        <p className="text-xs text-muted-foreground">Proof of Concept</p>
      </div>

      {/* Settings Section */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowSettings(!showSettings)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Capture Settings
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {canStart ? `${uploaderName} • ${practiceOds}` : 'Not configured'}
            </span>
          </CardTitle>
        </CardHeader>
        {showSettings && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="practiceOds">Practice ODS Code</Label>
              <Input
                id="practiceOds"
                value={practiceOds}
                onChange={(e) => setPracticeOds(e.target.value.toUpperCase())}
                placeholder="e.g. K83042"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploaderName">Your Name</Label>
              <Input
                id="uploaderName"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                placeholder="e.g. Malcolm Railson"
              />
            </div>
            <Button onClick={saveSettings} className="w-full" disabled={!canStart}>
              Save Settings
            </Button>
          </CardContent>
        )}
      </Card>

      <Button
        onClick={() => navigate('/lg-capture/start')}
        className="w-full h-14 text-lg"
        size="lg"
        disabled={!canStart}
      >
        <Camera className="mr-2 h-6 w-6" />
        Start New Patient
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>

      <Button
        variant="outline"
        onClick={() => navigate('/lg-capture/patients')}
        className="w-full"
      >
        <List className="mr-2 h-4 w-4" />
        View Recent Captures
      </Button>

      <div className="grid grid-cols-2 gap-4">
        {features.map((feature) => (
          <Card key={feature.title} className="bg-muted/30">
            <CardContent className="pt-6">
              <feature.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-medium mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <span>Enter patient details (name, NHS number, DOB)</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Photograph each page of Lloyd George notes</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>Reorder pages and remove any bad shots</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              <span>Submit for AI processing and download results</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
