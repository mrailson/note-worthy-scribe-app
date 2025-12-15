import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { FileText, Camera, Brain, Download, List, ArrowRight, Settings, Home, ChevronsUpDown, Check, Search, Loader2, Play, BarChart3, Files, Zap, Sparkles, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsIPhone } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
// Toast messages removed from LG Capture service
import { LGAIModel } from '@/contexts/LGUploadQueueContext';
import { CompressionLevel, COMPRESSION_LEVELS, DEFAULT_COMPRESSION_LEVEL, getCompressionSettings } from '@/utils/lgImageCompressor';

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
  const [serviceLevel, setServiceLevel] = useState<'rename_only' | 'index_summary' | 'full_service'>('full_service');
  const [aiModel, setAiModel] = useState<LGAIModel>('gpt-4o-mini');
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(DEFAULT_COMPRESSION_LEVEL);
  const [mixedPatientDetection, setMixedPatientDetection] = useState(true);
  const [preserveQuality, setPreserveQuality] = useState(false);
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
        const defaults = settingsData.setting_value as { 
          practiceOds?: string; 
          uploaderName?: string; 
          practiceName?: string; 
          serviceLevel?: 'rename_only' | 'index_summary' | 'full_service'; 
          aiModel?: LGAIModel;
          compressionLevel?: CompressionLevel;
          mixedPatientDetection?: boolean;
          preserveQuality?: boolean;
        };
        if (defaults.practiceOds) loadedOds = defaults.practiceOds;
        if (defaults.uploaderName) loadedName = defaults.uploaderName;
        if (defaults.practiceName) loadedPracticeName = defaults.practiceName;
        if (defaults.serviceLevel) setServiceLevel(defaults.serviceLevel);
        if (defaults.aiModel) setAiModel(defaults.aiModel);
        if (defaults.compressionLevel) setCompressionLevel(defaults.compressionLevel);
        if (defaults.mixedPatientDetection !== undefined) setMixedPatientDetection(defaults.mixedPatientDetection);
        if (defaults.preserveQuality !== undefined) setPreserveQuality(defaults.preserveQuality);
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
  const saveToDatabase = async (ods: string, name: string, pName: string, svcLevel: 'rename_only' | 'index_summary' | 'full_service', model: LGAIModel, compLevel: CompressionLevel, mixedDetect: boolean, preserveQual: boolean) => {
    if (!user?.id) return false;
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        setting_key: 'lg_capture_defaults',
        setting_value: {
          practiceOds: ods.trim(),
          practiceName: pName.trim(),
          uploaderName: name.trim(),
          serviceLevel: svcLevel,
          aiModel: model,
          compressionLevel: compLevel,
          mixedPatientDetection: mixedDetect,
          preserveQuality: preserveQual
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
    localStorage.setItem('lg-ai-model-preference', model);
    localStorage.setItem('lg_mixed_patient_detection', String(mixedDetect));
    localStorage.setItem('lg_preserve_quality', String(preserveQual));
    
    return true;
  };

  // Auto-save immediately when practice is selected
  const handlePracticeSelect = async (practice: Practice) => {
    setPracticeOds(practice.practice_code);
    setPracticeName(practice.name);
    setPracticeSearchOpen(false);
    setSearchTerm('');

    // Auto-save to database immediately
    const saved = await saveToDatabase(practice.practice_code, uploaderName, practice.name, serviceLevel, aiModel, compressionLevel, mixedPatientDetection, preserveQuality);
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
      return;
    }

    if (!practiceOds.trim() || !uploaderName.trim()) {
      return;
    }

    setIsSaving(true);
    const saved = await saveToDatabase(practiceOds, uploaderName, practiceName, serviceLevel, aiModel, compressionLevel, mixedPatientDetection, preserveQuality);
    setIsSaving(false);

    if (saved) {
      setShowSettings(false);
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
      </div>

      <Button
        onClick={() => navigate('/lg-capture/upload')}
        className="w-full h-14 text-lg"
        size="lg"
        disabled={!canStart}
      >
        <Camera className="mr-2 h-6 w-6" />
        Start Capture
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>

      <div className="grid grid-cols-3 gap-3">
        <Button
          variant="outline"
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              return;
            }
            const { generateULID } = await import('@/utils/ulid');
            const patientId = generateULID();
            const { error } = await supabase
              .from('lg_patients')
              .insert({
                id: patientId,
                user_id: user.id,
                practice_ods: practiceOds || 'DEMO',
                uploader_name: uploaderName || 'Demo User',
                job_status: 'draft',
                sex: 'unknown',
              });
            if (error) {
              return;
            }
            navigate(`/lg-capture/demo/${patientId}`);
          }}
          className="w-full"
        >
          <Play className="mr-2 h-4 w-4" />
          Demo
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/lg-capture/bulk')}
          className="w-full"
        >
          <Files className="mr-2 h-4 w-4" />
          Bulk Capture
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/lg-capture/patients')}
          className="w-full"
        >
          <List className="mr-2 h-4 w-4" />
          History
        </Button>
      </div>


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
              <span>Upload files or use camera to capture Lloyd George pages</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Reorder pages if needed • blank pages auto-detected</span>
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
            <div className="space-y-2">
              <Label>Service Level</Label>
              <div className="space-y-2">
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  serviceLevel === 'rename_only' ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}>
                  <input
                    type="radio"
                    name="serviceLevel"
                    value="rename_only"
                    checked={serviceLevel === 'rename_only'}
                    onChange={(e) => setServiceLevel(e.target.value as 'rename_only')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-sm">Rename Only</p>
                    <p className="text-xs text-muted-foreground">Quick rename to Lloyd George format, no AI processing</p>
                  </div>
                </label>
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  serviceLevel === 'index_summary' ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}>
                  <input
                    type="radio"
                    name="serviceLevel"
                    value="index_summary"
                    checked={serviceLevel === 'index_summary'}
                    onChange={(e) => setServiceLevel(e.target.value as 'index_summary')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-sm">Rename + Index</p>
                    <p className="text-xs text-muted-foreground">Add index page and summary header, no SNOMED coding</p>
                  </div>
                </label>
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  serviceLevel === 'full_service' ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}>
                  <input
                    type="radio"
                    name="serviceLevel"
                    value="full_service"
                    checked={serviceLevel === 'full_service'}
                    onChange={(e) => setServiceLevel(e.target.value as 'full_service')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-sm">Full Service</p>
                    <p className="text-xs text-muted-foreground">Complete AI summary with SNOMED codes</p>
                  </div>
                </label>
              </div>
            </div>
            
            {/* AI Model Selector */}
            <div className="space-y-3">
              <Label>AI Model</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className={cn("h-4 w-4", aiModel === 'gpt-4o-mini' ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn(aiModel === 'gpt-4o-mini' ? "font-medium" : "text-muted-foreground")}>
                      GPT-4o Mini
                    </span>
                  </div>
                  <Slider
                    value={[aiModel === 'gpt-4o-mini' ? 0 : 1]}
                    onValueChange={(value) => setAiModel(value[0] === 0 ? 'gpt-4o-mini' : 'gpt-5')}
                    max={1}
                    step={1}
                    className="w-20"
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <span className={cn(aiModel === 'gpt-5' ? "font-medium" : "text-muted-foreground")}>
                      GPT-5
                    </span>
                    <Sparkles className={cn("h-4 w-4", aiModel === 'gpt-5' ? "text-primary" : "text-muted-foreground")} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiModel === 'gpt-4o-mini' 
                    ? "Faster & cheaper (default)" 
                    : "More powerful extraction"}
                </p>
              </div>
            </div>

            {/* Preserve Original Quality Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className={cn("h-5 w-5", preserveQuality ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="font-medium text-sm">Preserve Original Quality</p>
                  <p className="text-xs text-muted-foreground">
                    For pre-optimised scans (MFD/scanner output). Skips compression.
                  </p>
                </div>
              </div>
              <Switch
                checked={preserveQuality}
                onCheckedChange={setPreserveQuality}
              />
            </div>

            {/* File Compression Slider - only show when not preserving quality */}
            {!preserveQuality && (
              <div className="space-y-3">
                <Label>File Compression</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground whitespace-nowrap">Smallest Files</span>
                    <Slider
                      value={[compressionLevel]}
                      onValueChange={(value) => setCompressionLevel(value[0] as CompressionLevel)}
                      min={1}
                      max={7}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground whitespace-nowrap">Best Quality</span>
                  </div>
                  <div className="text-center">
                    <span className="font-medium text-sm">
                      Level {compressionLevel}: {getCompressionSettings(compressionLevel).label}
                    </span>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({getCompressionSettings(compressionLevel).estimatedSize})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    All images converted to black & white. Adjust for storage vs readability.
                  </p>
                </div>
              </div>
            )}

            {/* Mixed Patient Detection Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <ShieldAlert className={cn("h-5 w-5", mixedPatientDetection ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="font-medium text-sm">Mixed Patient Detection</p>
                  <p className="text-xs text-muted-foreground">
                    Alert when multiple NHS numbers/DOBs found in same file
                  </p>
                </div>
              </div>
              <Switch
                checked={mixedPatientDetection}
                onCheckedChange={setMixedPatientDetection}
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
