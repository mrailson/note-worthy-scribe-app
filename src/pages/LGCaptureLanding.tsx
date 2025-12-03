import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Camera, Brain, Download, List, ArrowRight, Settings, Home, ChevronsUpDown, Check, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsIPhone } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Practice {
  id: string;
  name: string;
  practice_code: string;
}

export default function LGCaptureLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isIPhone = useIsIPhone();
  const [practiceOds, setPracticeOds] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch practices list
  useEffect(() => {
    const fetchPractices = async () => {
      const { data, error } = await supabase
        .from('gp_practices')
        .select('id, name, practice_code')
        .order('name');
      
      if (!error && data) {
        setPractices(data);
      }
    };
    fetchPractices();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) {
        setShowSettings(true);
        return;
      }

      let loadedOds = '';
      let loadedName = '';
      let loadedPracticeName = '';

      // 1. Try to load from lg_capture_defaults in user_settings (SOURCE OF TRUTH)
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'lg_capture_defaults')
        .maybeSingle();
      
      if (settingsData?.setting_value) {
        const defaults = settingsData.setting_value as { practiceOds?: string; uploaderName?: string; practiceName?: string };
        if (defaults.practiceOds) loadedOds = defaults.practiceOds;
        if (defaults.uploaderName) loadedName = defaults.uploaderName;
        if (defaults.practiceName) loadedPracticeName = defaults.practiceName;
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
          loadedName = profileData.email.split('@')[0];
        }
      }

      // 3. Fall back to localStorage ONLY if database had nothing
      if (!loadedOds) loadedOds = localStorage.getItem('lg_practice_ods') || '';
      if (!loadedName) loadedName = localStorage.getItem('lg_uploader_name') || '';
      if (!loadedPracticeName) loadedPracticeName = localStorage.getItem('lg_practice_name') || '';

      // Set state and sync to localStorage (cache)
      if (loadedOds) {
        setPracticeOds(loadedOds);
        localStorage.setItem('lg_practice_ods', loadedOds);
      }
      if (loadedName) {
        setUploaderName(loadedName);
        localStorage.setItem('lg_uploader_name', loadedName);
      }
      if (loadedPracticeName) {
        setPracticeName(loadedPracticeName);
        localStorage.setItem('lg_practice_name', loadedPracticeName);
      }
      
      // Show settings only if still not configured
      if (!loadedOds || !loadedName) {
        setShowSettings(true);
      }
    };
    
    loadSettings();
  }, [user?.id]);

  // Save to database helper - called on practice select AND save button
  const saveToDatabase = async (ods: string, name: string, pName: string) => {
    if (!user?.id) return false;
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        setting_key: 'lg_capture_defaults',
        setting_value: {
          practiceOds: ods.trim(),
          practiceName: pName.trim(),
          uploaderName: name.trim()
        },
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,setting_key' 
      });

    if (error) {
      console.error('Failed to save settings:', error);
      return false;
    }

    // Also sync to localStorage as cache
    localStorage.setItem('lg_practice_ods', ods.trim());
    localStorage.setItem('lg_practice_name', pName.trim());
    localStorage.setItem('lg_uploader_name', name.trim());
    
    return true;
  };

  // Auto-save immediately when practice is selected
  const handlePracticeSelect = async (practice: Practice) => {
    setPracticeOds(practice.practice_code);
    setPracticeName(practice.name);
    setPracticeSearchOpen(false);
    setSearchTerm('');

    // Auto-save to database immediately
    const saved = await saveToDatabase(practice.practice_code, uploaderName, practice.name);
    if (saved) {
      toast.success(`Practice saved: ${practice.name}`);
    }
  };

  const filteredPractices = practices.filter(practice => {
    if (!searchTerm) return true;
    const lowerSearchTerm = searchTerm.toLowerCase();
    const practiceCode = practice.practice_code.toLowerCase();
    
    if (practice.name.toLowerCase().includes(lowerSearchTerm)) return true;
    if (practiceCode.includes(lowerSearchTerm)) return true;
    
    // Handle K prefix variations
    if (lowerSearchTerm.startsWith('k')) {
      const searchWithoutK = lowerSearchTerm.substring(1);
      if (practiceCode.includes(searchWithoutK)) return true;
    }
    if (!lowerSearchTerm.startsWith('k')) {
      const searchWithK = 'k' + lowerSearchTerm;
      if (practiceCode.includes(searchWithK)) return true;
    }
    
    return false;
  });

  const saveSettings = async () => {
    if (!user?.id) {
      toast.error('Please log in to save settings');
      return;
    }

    if (!practiceOds.trim() || !uploaderName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSaving(true);
    const saved = await saveToDatabase(practiceOds, uploaderName, practiceName);
    setIsSaving(false);

    if (saved) {
      toast.success('Settings saved');
      setShowSettings(false);
    } else {
      toast.error('Failed to save settings');
    }
  };

  const canStart = practiceOds.trim() && uploaderName.trim();

  const displayPractice = practiceName 
    ? `${practiceName} (${practiceOds})` 
    : practiceOds;

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

  // Mobile-friendly practice selector modal for iPhone
  const PracticeSelectorMobile = () => (
    <Dialog open={practiceSearchOpen} onOpenChange={setPracticeSearchOpen}>
      <DialogContent className="h-[85vh] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>Select Practice</DialogTitle>
        </DialogHeader>
        <div className="p-4 pb-2 border-b sticky top-0 bg-background">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ODS code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredPractices.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No practice found</p>
            ) : (
              filteredPractices.slice(0, 100).map((practice) => (
                <button
                  key={practice.id}
                  onClick={() => handlePracticeSelect(practice)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg mb-2 flex items-center gap-3 transition-colors",
                    "active:bg-primary/20 hover:bg-muted",
                    practiceOds === practice.practice_code && "bg-primary/10 border-2 border-primary"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    practiceOds === practice.practice_code 
                      ? "border-primary bg-primary" 
                      : "border-muted-foreground/30"
                  )}>
                    {practiceOds === practice.practice_code && (
                      <Check className="h-4 w-4 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{practice.name}</p>
                    <p className="text-sm text-muted-foreground">{practice.practice_code}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  // Desktop practice selector using popover
  const PracticeSelectorDesktop = () => (
    <div className="relative">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={practiceSearchOpen}
        onClick={() => setPracticeSearchOpen(true)}
        className="w-full justify-between font-normal"
      >
        {displayPractice || "Select practice..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {practiceSearchOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ODS code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {filteredPractices.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">No practice found</p>
            ) : (
              filteredPractices.slice(0, 50).map((practice) => (
                <button
                  key={practice.id}
                  onClick={() => handlePracticeSelect(practice)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-sm flex items-center gap-2 text-sm",
                    "hover:bg-accent cursor-pointer",
                    practiceOds === practice.practice_code && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      practiceOds === practice.practice_code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{practice.name}</span>
                    <span className="text-xs text-muted-foreground">{practice.practice_code}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {practiceSearchOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setPracticeSearchOpen(false);
            setSearchTerm('');
          }} 
        />
      )}
    </div>
  );

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
              {canStart ? `${uploaderName} • ${displayPractice}` : 'Not configured'}
            </span>
          </CardTitle>
        </CardHeader>
        {showSettings && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Practice Name/ODS Code</Label>
              {isIPhone ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setPracticeSearchOpen(true)}
                    className="w-full justify-between font-normal h-12 text-base"
                  >
                    {displayPractice || "Select practice..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  <PracticeSelectorMobile />
                </>
              ) : (
                <PracticeSelectorDesktop />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploaderName">Your Name</Label>
              <Input
                id="uploaderName"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                placeholder="e.g. Malcolm Railson"
                className={isIPhone ? "h-12 text-base" : ""}
              />
            </div>
            <Button 
              onClick={saveSettings} 
              className={cn("w-full", isIPhone && "h-12 text-base")} 
              disabled={!canStart || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
