import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Camera, Brain, Download, List, ArrowRight, Settings, Home } from 'lucide-react';
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
      if (!user?.id) {
        setShowSettings(true);
        return;
      }

      let loadedOds = '';
      let loadedName = '';

      // 1. Try to load from lg_capture_defaults in user_settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'lg_capture_defaults')
        .maybeSingle();
      
      if (settingsData?.setting_value) {
        const defaults = settingsData.setting_value as { practiceOds?: string; uploaderName?: string };
        if (defaults.practiceOds) loadedOds = defaults.practiceOds;
        if (defaults.uploaderName) loadedName = defaults.uploaderName;
      }

      // 2. If name not set, get from user profile
      if (!loadedName) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profileData?.full_name) {
          loadedName = profileData.full_name;
        } else if (profileData?.email) {
          // Fallback to email prefix if no name
          loadedName = profileData.email.split('@')[0];
        }
      }

      // 3. If ODS not set, try to get practice name from practice_details
      if (!loadedOds) {
        const { data: practiceData } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .maybeSingle();
        
        if (practiceData?.practice_name) {
          loadedOds = practiceData.practice_name;
        }
      }

      // 4. Fall back to localStorage if still empty
      if (!loadedOds) loadedOds = localStorage.getItem('lg_practice_ods') || '';
      if (!loadedName) loadedName = localStorage.getItem('lg_uploader_name') || '';

      // Set state
      if (loadedOds) {
        setPracticeOds(loadedOds);
        localStorage.setItem('lg_practice_ods', loadedOds);
      }
      if (loadedName) {
        setUploaderName(loadedName);
        localStorage.setItem('lg_uploader_name', loadedName);
      }
      
      // Show settings only if still not configured
      if (!loadedOds || !loadedName) {
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
      {/* Home Navigation */}
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="mb-2"
      >
        <Home className="mr-2 h-4 w-4" />
        Back to Notewell Home
      </Button>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Notewell LG Capture</h1>
        <p className="text-muted-foreground">
          Digitise Lloyd George paper records with AI-powered processing
        </p>
        <p className="text-xs text-muted-foreground">Proof of Concept</p>
      </div>

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
              <span>Tap to photograph each page of the Lloyd George notes</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Reorder pages if needed and remove any poor quality shots</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>Submit for processing - AI extracts patient details automatically</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              <span>Receive summary email with PDF, clinical summary and SNOMED codes</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Settings Section - moved to bottom */}
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
    </div>
  );
}
