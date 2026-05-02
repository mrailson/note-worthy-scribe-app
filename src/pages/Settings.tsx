import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Trash2, 
  Plus, 
  SettingsIcon, 
  Shield, 
  BookOpen, 
  Building, 
  HelpCircle, 
  Clock, 
  Calendar, 
  BarChart3, 
  Timer, 
  TrendingUp, 
  Lock, 
  Eye, 
  EyeOff, 
  User,
  Key,
  Search,
  Pencil,
  X,
  Mail,
  Globe,
  ExternalLink,
  Users,
  Database,
  FileCheck,
  FolderOpen,
  Headphones,
  Volume2,
  Stethoscope,
  Sparkles,
  Bell,
  Plug,
  Play,
  Square,
  Loader2,
  Presentation
} from 'lucide-react';
import { PlaudIntegrationSettings } from '@/components/settings/PlaudIntegrationSettings';
import { TavilyTestSection } from '@/components/settings/TavilyTestSection';
import { ServiceVisibilitySettings } from '@/components/settings/ServiceVisibilitySettings';
import { QuickRecordSettings } from '@/components/settings/QuickRecordSettings';
import { PresentationTemplateSettings } from '@/components/settings/PresentationTemplateSettings';
import { ReferralDestinationsManager } from '@/components/settings/ReferralDestinationsManager';
import { ContactDirectory } from '@/components/settings/ContactDirectory';
import { MeetingGroupsManager } from '@/components/settings/MeetingGroupsManager';
import { useToast } from '@/hooks/use-toast';
import { useToastPreferences } from '@/hooks/useToastPreferences';
import { useVoicePreference, VOICE_OPTIONS, VoiceOption } from '@/hooks/useVoicePreference';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Header } from '@/components/Header';
import { PracticeManager } from '@/components/PracticeManager';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface NHSTerm {
  id: string;
  term: string;
  definition: string;
  is_master: boolean;
  user_id: string | null;
  created_at: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile, updateProfile } = useUserProfile();
  
  // NHS Terms state
  const [terms, setTerms] = useState<NHSTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<NHSTerm[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<NHSTerm | null>(null);
  const [newTerm, setNewTerm] = useState({ term: "", definition: "" });
  
  // Meeting retention policy state
  const [retentionPolicy, setRetentionPolicy] = useState<string>('forever');
  const [retentionLoading, setRetentionLoading] = useState(false);
  
  // 'default' resolves server-side to Gemini 3.1 Pro (with auto-fallback to Flash, 2.5 Pro, GPT-5).
  // Other accepted values: 'gemini-3-flash', 'claude-sonnet-4-6'.
  const DEFAULT_MEETING_LLM = 'default';
  const PREF_LAST_CHANGED_KEY = 'meeting-regenerate-llm-last-changed';
  const MIGRATION_TOAST_KEY = 'meeting-regenerate-llm-pro-migration-shown';

  // LLM model preference for note regeneration.
  // Legacy-value migration (incl. stale Sonnet) lives in src/utils/resolveMeetingModel.ts
  // (ensureMigration). Settings is now ONLY responsible for read+write of the user's
  // explicit choice — never for normalisation.
  const [regenerateLlm, setRegenerateLlm] = useState<string>(() => {
    const stored = localStorage.getItem('meeting-regenerate-llm');
    if (!stored) {
      localStorage.setItem('meeting-regenerate-llm', DEFAULT_MEETING_LLM);
      return DEFAULT_MEETING_LLM;
    }
    return stored;
  });

  // One-time migration toast — fires once per user after the Pro upgrade.
  useEffect(() => {
    if (regenerateLlm === DEFAULT_MEETING_LLM && !localStorage.getItem(MIGRATION_TOAST_KEY)) {
      localStorage.setItem(MIGRATION_TOAST_KEY, '1');
      toast({
        title: '✨ Default model upgraded',
        description: 'Your default model has been upgraded to Gemini 3.1 Pro for better extraction quality. You can change this in Settings.',
        duration: 8000,
      });
    }
  }, []);

  const handleRegenerateLlmChange = (value: string) => {
    setRegenerateLlm(value);
    localStorage.setItem('meeting-regenerate-llm', value);
    localStorage.setItem(PREF_LAST_CHANGED_KEY, String(Date.now()));
    toast({ title: "AI model preference updated" });
  };

  
  // Usage statistics state
  const [usageStats, setUsageStats] = useState({
    lastLogin: null as string | null,
    currentMonth: { meetings: 0, hours: 0 },
    lastMonth: { meetings: 0, hours: 0 },
    last12Months: { meetings: 0, hours: 0 }
  });
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);

  // Toast preferences
  const {
    preferences: toastPreferences,
    toggleSection: toggleToastSection,
    enableAll: enableAllToasts,
    disableAll: disableAllToasts,
    resetToDefaults: resetToastDefaults,
    allEnabled: allToastsEnabled,
    allDisabled: allToastsDisabled,
  } = useToastPreferences();

  // Voice preferences
  const { voicePreference, setVoicePreference } = useVoicePreference();

  // Voice sample playback state
  const DEFAULT_SAMPLE_SCRIPT = "Hello, this is a sample of my voice. I'll help you with meeting summaries.";
  const VOICE_SAMPLE_STORAGE_KEY = 'voiceSampleScriptV2'; // Changed key to reset old long values
  const [sampleScript, setSampleScript] = useState(() => {
    return localStorage.getItem(VOICE_SAMPLE_STORAGE_KEY) || DEFAULT_SAMPLE_SCRIPT;
  });
  const [playingVoice, setPlayingVoice] = useState<VoiceOption | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<VoiceOption | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  // Save sample script to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(VOICE_SAMPLE_STORAGE_KEY, sampleScript);

    // Clear audio cache when script changes (revoke old blob URLs first)
    audioCacheRef.current.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    audioCacheRef.current.clear();
  }, [sampleScript]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Revoke any blob URLs we created
      audioCacheRef.current.forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      audioCacheRef.current.clear();
    };
  }, []);

  const base64Mp3ToBlobUrl = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  };

  // Play voice sample
  const playVoiceSample = async (voice: VoiceOption) => {
    const voiceConfig = VOICE_OPTIONS[voice];

    // If this voice is currently playing, stop it
    if (playingVoice === voice) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoice(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Check cache first
    const cacheKey = `${voice}-${sampleScript}`;
    const cachedUrl = audioCacheRef.current.get(cacheKey);

    if (cachedUrl) {
      const audio = new Audio(cachedUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => {
        setPlayingVoice(null);
        toast({
          title: "Failed to play audio sample",
          description: "Your browser couldn't play the generated audio. Please try again.",
          variant: "destructive"
        });
      };
      setPlayingVoice(voice);
      try {
        await audio.play();
      } catch (e) {
        console.error('Audio play failed:', e);
        setPlayingVoice(null);
        toast({
          title: "Failed to play audio sample",
          description: "Your browser blocked or couldn't play the audio. Please try again.",
          variant: "destructive"
        });
      }
      return;
    }

    // Generate new audio
    setLoadingVoice(voice);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: sampleScript,
          voiceId: voiceConfig.voiceId
        }
      });

      if (error) throw error;

      // Check for quota exceeded error in response
      if (data?.error) {
        if (data.error.includes('quota_exceeded') || data.error.includes('quota')) {
          throw new Error('ElevenLabs quota exceeded. Please try a shorter sample text or top up your ElevenLabs credits.');
        }
        throw new Error(data.error);
      }

      if (!data?.audioContent) throw new Error('No audio content received');

      // Convert base64 MP3 to blob URL (more reliable than data: URIs)
      const audioUrl = base64Mp3ToBlobUrl(data.audioContent);

      // Cache the URL
      audioCacheRef.current.set(cacheKey, audioUrl);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => {
        setPlayingVoice(null);
        toast({
          title: "Failed to play audio sample",
          description: "Your browser couldn't play the generated audio. Please try again.",
          variant: "destructive"
        });
      };

      setPlayingVoice(voice);
      await audio.play();
    } catch (error: any) {
      console.error('Error generating voice sample:', error);
      const errorMessage = error?.message || '';

      // Handle quota exceeded specifically
      if (errorMessage.includes('quota') || errorMessage.includes('credits')) {
        toast({
          title: "ElevenLabs quota exceeded",
          description: "Try a shorter sample text or top up your ElevenLabs credits.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Failed to generate voice sample",
          description: errorMessage || "Please try again",
          variant: "destructive"
        });
      }
    } finally {
      setLoadingVoice(null);
    }
  };



  // Fetch NHS terms
  const fetchTerms = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('nhs_terms')
        .select('*')
        .order('term', { ascending: true });

      if (error) throw error;
      setTerms(data || []);
    } catch (error) {
      console.error('Error fetching terms:', error);
      toast({
        title: "Failed to load NHS terms",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter terms based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTerms(terms);
    } else {
      const filtered = terms.filter(term =>
        term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.definition.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTerms(filtered);
    }
  }, [terms, searchQuery]);

  // Check if user is admin
  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data: adminData, error } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      if (error) throw error;
      setIsAdmin(adminData);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  // Fetch terms, retention policy, and usage stats on mount
  useEffect(() => {
    fetchTerms();
    fetchRetentionPolicy();
    fetchUsageStats();
    checkAdminStatus();
  }, [user]);

  // Fetch retention policy
  const fetchRetentionPolicy = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('meeting_retention_policy')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.meeting_retention_policy) {
        setRetentionPolicy(data.meeting_retention_policy);
      }
    } catch (error) {
      console.error('Error fetching retention policy:', error);
    }
  };

  // Update retention policy
  const handleRetentionPolicyChange = async (value: string) => {
    if (!user) return;

    setRetentionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ meeting_retention_policy: value })
        .eq('user_id', user.id);

      if (error) throw error;

      setRetentionPolicy(value);
      toast({
        title: "Meeting retention policy updated successfully"
      });
    } catch (error) {
      console.error('Error updating retention policy:', error);
      toast({
        title: "Failed to update retention policy",
        variant: "destructive"
      });
    } finally {
      setRetentionLoading(false);
    }
  };

  // Fetch usage statistics
  const fetchUsageStats = async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      // Get user's last_sign_in_at from auth metadata
      const { data: authData } = await supabase.auth.getUser();
      const lastLogin = authData.user?.last_sign_in_at || null;

      // Calculate date ranges
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const last12MonthsStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);

      // Fetch meetings for different periods
      const [currentMonthData, lastMonthData, last12MonthsData] = await Promise.all([
        // Current month
        supabase
          .from('meetings')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString()),

        // Last month  
        supabase
          .from('meetings')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .gte('created_at', lastMonthStart.toISOString())
          .lt('created_at', currentMonthStart.toISOString()),

        // Last 12 months
        supabase
          .from('meetings')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .gte('created_at', last12MonthsStart.toISOString())
      ]);

      const calculateStats = (meetings: any[]) => ({
        meetings: meetings.length,
        hours: Math.round((meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / 60) * 10) / 10
      });

      setUsageStats({
        lastLogin,
        currentMonth: calculateStats(currentMonthData.data || []),
        lastMonth: calculateStats(lastMonthData.data || []),
        last12Months: calculateStats(last12MonthsData.data || [])
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Add new term
  const handleAddTerm = async () => {
    if (!user || !newTerm.term.trim() || !newTerm.definition.trim()) {
      toast({
        title: "Please fill in both term and definition",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('nhs_terms')
        .insert({
          term: newTerm.term.trim(),
          definition: newTerm.definition.trim(),
          user_id: user.id,
          is_master: false
        });

      if (error) throw error;

      toast({
        title: "Term added successfully"
      });
      setNewTerm({ term: "", definition: "" });
      setShowAddForm(false);
      fetchTerms();
    } catch (error) {
      console.error('Error adding term:', error);
      toast({
        title: "Failed to add term",
        variant: "destructive"
      });
    }
  };

  // Update term
  const handleUpdateTerm = async (termId: string, updatedTerm: { term: string; definition: string }) => {
    if (!user || !updatedTerm.term.trim() || !updatedTerm.definition.trim()) {
      toast({
        title: "Please fill in both term and definition",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('nhs_terms')
        .update({
          term: updatedTerm.term.trim(),
          definition: updatedTerm.definition.trim()
        })
        .eq('id', termId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Term updated successfully"
      });
      setEditingTerm(null);
      fetchTerms();
    } catch (error) {
      console.error('Error updating term:', error);
      toast({
        title: "Failed to update term",
        variant: "destructive"
      });
    }
  };

  // Delete term
  const handleDeleteTerm = async (termId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('nhs_terms')
        .delete()
        .eq('id', termId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Term deleted successfully"
      });
      fetchTerms();
    } catch (error) {
      console.error('Error deleting term:', error);
      toast({
        title: "Failed to delete term",
        variant: "destructive"
      });
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Please fill in all password fields",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "New password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Password updated successfully"
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: error.message || "Failed to update password",
        variant: "destructive"
      });
    } finally {
      setPasswordLoading(false);
    }
  };


  
  console.log('Settings page loaded, user:', user);

  return (
    <div className="min-h-screen bg-background mobile-container safe-area-top safe-area-bottom">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto p-4 sm:p-6 mobile-scroll">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Notewell AI - System Settings Area</p>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="general" className="space-y-4 sm:space-y-6">
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="general" className="flex items-center gap-2 mobile-touch-target">
                <SettingsIcon className="h-4 w-4" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2 mobile-touch-target">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Contacts</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2 mobile-touch-target">
                <Plug className="h-4 w-4" />
                <span className="hidden sm:inline">Integrations</span>
              </TabsTrigger>
              <TabsTrigger value="presentations" className="flex items-center gap-2 mobile-touch-target">
                <Presentation className="h-4 w-4" />
                <span className="hidden sm:inline">Presentations</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="practices" className="flex items-center gap-2 mobile-touch-target">
                  <Building className="h-4 w-4" />
                  <span className="hidden sm:inline">Practices</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="notifications" className="flex items-center gap-2 mobile-touch-target">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2 mobile-touch-target">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="help" className="flex items-center gap-2 mobile-touch-target">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Help</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              {/* Local Policy Guidance */}
              <Card className="border-2 border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-green-600" />
                    Local Policy Guidance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Northamptonshire ICB</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable Northamptonshire integrated Care Board local guidance and traffic-light medicines policy
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Active</span>
                        <Switch
                          id="northamptonshire-icb"
                          checked={profile?.northamptonshire_icb_active || false}
                          onCheckedChange={async (checked) => {
                            await updateProfile({ northamptonshire_icb_active: checked });
                          }}
                        />
                      </div>
                    </div>
                    
                    {profile?.northamptonshire_icb_active && (
                      <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-md">
                        <Badge variant="outline" className="bg-green-600 text-white border-green-600">
                          📋 Northamptonshire ICB Active
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Local medicines policies, pathways, and traffic-light guidance enabled
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Default Home Page */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Default Home Page
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Choose which page loads first when you open Notewell on each device type. The Home button will always take you to the Meeting Recorder.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-home-page-desktop">Desktop / Browser</Label>
                      <Select
                        value={profile?.default_home_page_desktop || '/'}
                        onValueChange={async (value) => {
                          await updateProfile({ default_home_page_desktop: value === '/' ? null : value });
                        }}
                      >
                        <SelectTrigger id="default-home-page-desktop" className="w-full">
                          <SelectValue placeholder="Select default page" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="/">Meeting Recorder (default)</SelectItem>
                          <SelectItem value="/ai4gp">Ask AI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default-home-page-mobile">Mobile</Label>
                      <Select
                        value={profile?.default_home_page_mobile || '/'}
                        onValueChange={async (value) => {
                          await updateProfile({ default_home_page_mobile: value === '/' ? null : value });
                        }}
                      >
                        <SelectTrigger id="default-home-page-mobile" className="w-full">
                          <SelectValue placeholder="Select default page" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="/">Meeting Recorder (default)</SelectItem>
                          <SelectItem value="/ai4gp">Ask AI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Menu Visibility */}
              <ServiceVisibilitySettings />

              {/* Quick Record for iPhone */}
              <QuickRecordSettings />

              {/* Referral Destinations */}
              <ReferralDestinationsManager />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Meeting Retention Policy
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Choose how long to keep your meeting records in the system.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="retention-policy">Meeting Data Retention</Label>
                      <Select
                        value={retentionPolicy}
                        onValueChange={handleRetentionPolicyChange}
                        disabled={retentionLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select retention policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forever">Keep Forever</SelectItem>
                          <SelectItem value="after_email">Delete as soon as I have emailed the notes to me</SelectItem>
                          <SelectItem value="1_week">Delete after 1 week</SelectItem>
                          <SelectItem value="1_month">Delete after 1 month</SelectItem>
                          <SelectItem value="1_year">Delete after 1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">
                        <strong>Current setting:</strong> {
                          retentionPolicy === 'forever' ? 'Keep Forever (default)' :
                          retentionPolicy === 'after_email' ? 'Delete after emailing notes' :
                          retentionPolicy === '1_week' ? 'Delete after 1 week' :
                          retentionPolicy === '1_month' ? 'Delete after 1 month' :
                          retentionPolicy === '1_year' ? 'Delete after 1 year' : 'Keep Forever'
                        }
                      </p>
                      <p>
                        This setting affects all future meetings. Existing meetings will not be automatically deleted unless you change this setting.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* AI Model for Note Regeneration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Model for Note Regeneration
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Choose which AI model is used when you regenerate meeting notes. This is for quality comparison testing.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="regenerate-llm">AI Model</Label>
                      <Select
                        value={regenerateLlm}
                        onValueChange={handleRegenerateLlmChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Gemini 3.1 Pro (Default — best quality)</SelectItem>
                          <SelectItem value="gemini-3-flash">Gemini 3 Flash (faster, lower cost)</SelectItem>
                          <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6 (alternative perspective)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">
                        <strong>Current model:</strong> {
                          regenerateLlm === 'default' ? 'Gemini 3.1 Pro (default — best quality)' :
                          regenerateLlm === 'gemini-3-flash' ? 'Gemini 3 Flash (faster, lower cost)' :
                          regenerateLlm === 'claude-sonnet-4-6' ? 'Claude Sonnet 4.6 (alternative perspective)' :
                          'Gemini 3.1 Pro (default)'
                        }
                      </p>
                      <p>
                        This model is used for both initial note generation (after stopping a recording) and manual "Regenerate Notes" actions. If the default Pro model fails or times out, the system automatically falls back to Gemini 3 Flash, then Gemini 2.5 Pro, then GPT-5.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Usage Statistics Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Usage Statistics
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Your account activity and meeting usage overview.
                  </p>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted-foreground">Loading statistics...</div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Last Login */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Account Activity</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Last login: </span>
                          {usageStats.lastLogin ? (
                            <span>{new Date(usageStats.lastLogin).toLocaleString()}</span>
                          ) : (
                            <span>Unknown</span>
                          )}
                        </div>
                      </div>

                      {/* Meeting Statistics */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Meeting Statistics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Current Month */}
                          <div className="p-4 border rounded-lg bg-accent/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">Current Month</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold text-primary">
                                {usageStats.currentMonth.meetings}
                              </div>
                              <div className="text-xs text-muted-foreground">meetings</div>
                              <div className="flex items-center gap-1 text-sm">
                                <Timer className="h-3 w-3" />
                                <span>{usageStats.currentMonth.hours}h</span>
                              </div>
                            </div>
                          </div>

                          {/* Last Month */}
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">Last Month</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold">
                                {usageStats.lastMonth.meetings}
                              </div>
                              <div className="text-xs text-muted-foreground">meetings</div>
                              <div className="flex items-center gap-1 text-sm">
                                <Timer className="h-3 w-3" />
                                <span>{usageStats.lastMonth.hours}h</span>
                              </div>
                            </div>
                          </div>

                          {/* Last 12 Months */}
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <BarChart3 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">Last 12 Months</span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold">
                                {usageStats.last12Months.meetings}
                              </div>
                              <div className="text-xs text-muted-foreground">meetings</div>
                              <div className="flex items-center gap-1 text-sm">
                                <Timer className="h-3 w-3" />
                                <span>{usageStats.last12Months.hours}h</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>




              {/* Password Change Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Update your account password for enhanced security.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          disabled={passwordLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                        >
                          {showPasswords.current ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          disabled={passwordLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                        >
                          {showPasswords.new ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          disabled={passwordLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                        >
                          {showPasswords.confirm ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button 
                        onClick={handlePasswordChange} 
                        disabled={passwordLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        className="w-full"
                      >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </Button>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>Password requirements:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>At least 6 characters long</li>
                        <li>Mix of letters, numbers, and symbols recommended</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-6">
              <PlaudIntegrationSettings />
              
              {/* Future integrations can be added here */}
              <Card className="border-dashed">
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Plug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">More integrations coming soon</p>
                    <p className="text-xs">Microsoft Teams, Google Meet, Zoom, and more</p>
                  </div>
                </CardContent>
              </Card>

              {/* Developer Tools */}
              <TavilyTestSection />
            </TabsContent>

            {/* Presentations Tab */}
            <TabsContent value="presentations" className="space-y-6">
              <PresentationTemplateSettings />
            </TabsContent>


            {isAdmin && (
              <TabsContent value="practices" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Practice Management
                    </CardTitle>
                    <p className="text-muted-foreground">
                      Manage your practice details. You can set up multiple practices if you work 
                      across different locations or set one as your default practice for all meetings.
                    </p>
                  </CardHeader>
                </Card>
                <PracticeManager />
              </TabsContent>
            )}


            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Control which types of toast notifications you want to see. You can enable or disable notifications by section.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Master Controls */}
                  <div className="space-y-4 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">Master Control</Label>
                        <p className="text-sm text-muted-foreground">
                          {allToastsEnabled ? 'All notifications are enabled' : allToastsDisabled ? 'All notifications are disabled' : 'Some notifications are enabled'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={allToastsEnabled ? disableAllToasts : enableAllToasts}
                        >
                          {allToastsEnabled ? 'Disable All' : 'Enable All'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetToastDefaults}
                        >
                          Reset to Defaults
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Individual Section Controls */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Notification Sections</h3>
                    
                    {/* AI4GP Service */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-ai4gp" className="font-medium cursor-pointer">
                            AI4GP Service
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifications for AI letter generation, email sending, and document processing operations
                        </p>
                      </div>
                      <Switch
                        id="toast-ai4gp"
                        checked={toastPreferences.ai4gp}
                        onCheckedChange={() => toggleToastSection('ai4gp')}
                      />
                    </div>

                    {/* Meeting Manager */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-meeting" className="font-medium cursor-pointer">
                            Meeting Manager
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifications for meeting recording, saving, transcription status, and audio processing
                        </p>
                      </div>
                      <Switch
                        id="toast-meeting"
                        checked={toastPreferences.meeting_manager}
                        onCheckedChange={() => toggleToastSection('meeting_manager')}
                      />
                    </div>

                    {/* Translation Service */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-translation" className="font-medium cursor-pointer">
                            Translation Service
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifications for translation operations, language detection, and translation completion
                        </p>
                      </div>
                      <Switch
                        id="toast-translation"
                        checked={toastPreferences.translation}
                        onCheckedChange={() => toggleToastSection('translation')}
                      />
                    </div>

                    {/* Complaints System */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-complaints" className="font-medium cursor-pointer">
                            Complaints System
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifications for complaint submissions, status updates, and workflow actions
                        </p>
                      </div>
                      <Switch
                        id="toast-complaints"
                        checked={toastPreferences.complaints}
                        onCheckedChange={() => toggleToastSection('complaints')}
                      />
                    </div>

                    {/* GPScribe */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-gpscribe" className="font-medium cursor-pointer">
                            GPScribe
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifications for consultation notes, recording controls, and medical documentation
                        </p>
                      </div>
                      <Switch
                        id="toast-gpscribe"
                        checked={toastPreferences.gpscribe}
                        onCheckedChange={() => toggleToastSection('gpscribe')}
                      />
                    </div>

                    {/* System Notifications */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <SettingsIcon className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-system" className="font-medium cursor-pointer">
                            System & General
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          General system notifications, authentication messages, and settings updates
                        </p>
                      </div>
                      <Switch
                        id="toast-system"
                        checked={toastPreferences.system}
                        onCheckedChange={() => toggleToastSection('system')}
                      />
                    </div>

                    {/* Security Notifications */}
                    <div className="flex items-start justify-between space-x-4 p-4 rounded-lg border">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <Label htmlFor="toast-security" className="font-medium cursor-pointer">
                            Security & Permissions
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Important security alerts, permission warnings, and access control notifications
                        </p>
                      </div>
                      <Switch
                        id="toast-security"
                        checked={toastPreferences.security}
                        onCheckedChange={() => toggleToastSection('security')}
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Disabling notifications for a section will prevent all toast messages from that area. 
                      However, critical error messages may still appear to ensure you're aware of important issues.
                      Changes are saved automatically and will persist across sessions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Notewell AI V1.3 - Security & NHS IT Governance
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Everything you need to know about security, compliance, and getting IT governance sorted for your practice.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Don't worry - we've got you covered!</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Getting IT governance sorted might sound daunting, but <strong>Notewell AI will walk you through each step</strong>. 
                      It's really not as bad as it sounds and will be totally worth it! Our team works directly with your CSO and DPO 
                      to make the process as smooth as possible.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Complete Platform Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    What is Notewell AI V1.3? - The Complete Platform
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Comprehensive Medical Practice Management System</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Notewell AI V1.3 is a complete suite of tools designed specifically for GP practices and healthcare teams. 
                      Think of it as your digital assistant that helps with everything from patient consultations to compliance management.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Clinical Tools */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary">Clinical Documentation Tools</h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">GP Scribe (MHRA Class 1 Medical Device)</h6>
                          <p className="text-xs text-muted-foreground">AI-powered consultation transcription, clinical note generation, patient summaries, and referral letters</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Meeting & Consultation Management</h6>
                          <p className="text-xs text-muted-foreground">Real-time transcription, automated minutes, audio backup, and collaboration features</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Translation Services</h6>
                          <p className="text-xs text-muted-foreground">50+ languages for patient communication with voice synthesis and cultural guidelines</p>
                        </div>
                      </div>
                    </div>

                    {/* AI & Intelligence */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary">AI Intelligence Suite</h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">AI4GP Service</h6>
                          <p className="text-xs text-muted-foreground">Advanced clinical assistant with GPT-4, Claude, and Gemini integration for decision support</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">AI4PM Service</h6>
                          <p className="text-xs text-muted-foreground">Practice management intelligence with analytics, reporting, and workflow optimization</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">AI Image Generation</h6>
                          <p className="text-xs text-muted-foreground">Create patient education materials, practice visuals, and medical illustrations</p>
                        </div>
                      </div>
                    </div>

                    {/* Compliance & Management */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary">Compliance & Governance</h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">CQC Compliance Suite</h6>
                          <p className="text-xs text-muted-foreground">15-point monitoring, complaints management, 20-day rule tracking, and automated reporting</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Enhanced Access Reporting</h6>
                          <p className="text-xs text-muted-foreground">Hub/spoke tracking, COVID adjustments, automated calculations, and compliance reporting</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Staff & User Management</h6>
                          <p className="text-xs text-muted-foreground">Role-based access, training records, contractor management, and performance analytics</p>
                        </div>
                      </div>
                    </div>

                    {/* Collaboration & Storage */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary">Collaboration & Storage</h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Shared Drive System</h6>
                          <p className="text-xs text-muted-foreground">Cloud-based document management with version control and secure sharing</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Document Processing</h6>
                          <p className="text-xs text-muted-foreground">OCR, PDF processing, Word/Excel integration, and automated categorization</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Real-time Collaboration</h6>
                          <p className="text-xs text-muted-foreground">Multi-user editing, meeting dashboards, and live monitoring capabilities</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* IT Governance Made Simple */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    IT Governance Made Simple - We'll Guide You Through It
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">What do I need to do to use this system?</h5>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      As a Practice Manager or GP, here's what's involved in getting Notewell AI V1.3 up and running. 
                      Remember - <strong>we handle most of the technical work and walk you through every step!</strong>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                        Clinical Safety Assessment (DCB0129)
                      </h5>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground"><strong>What we provide:</strong> Complete DCB0129 documentation package (supplied by Notewell AI)</p>
                        <p className="text-xs text-muted-foreground"><strong>What you do:</strong> Introduce us to your Clinical Safety Officer (CSO)</p>
                        <p className="text-xs text-muted-foreground"><strong>We handle:</strong> All technical documentation, risk assessments, and CSO meetings</p>
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs text-green-700 dark:text-green-300">
                          ✓ Typical timeframe: 2-3 weeks with CSO approval
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                        Data Protection Impact Assessment
                      </h5>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground"><strong>What we provide:</strong> Pre-completed DPIA template and GDPR compliance documentation</p>
                        <p className="text-xs text-muted-foreground"><strong>What you do:</strong> Connect us with your Data Protection Officer (DPO)</p>
                        <p className="text-xs text-muted-foreground"><strong>We handle:</strong> Data flow mapping, privacy impact assessment, and DPO collaboration</p>
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs text-green-700 dark:text-green-300">
                          ✓ Typical timeframe: 1-2 weeks with DPO review
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                        Technical Integration
                      </h5>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground"><strong>What we provide:</strong> Complete technical setup and security configuration</p>
                        <p className="text-xs text-muted-foreground"><strong>What you do:</strong> Provide practice details and user requirements</p>
                        <p className="text-xs text-muted-foreground"><strong>We handle:</strong> System configuration, security testing, and integration verification</p>
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs text-green-700 dark:text-green-300">
                          ✓ Typical timeframe: 1 week technical setup
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">4</span>
                        Training & Go-Live
                      </h5>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground"><strong>What we provide:</strong> Comprehensive staff training and ongoing support</p>
                        <p className="text-xs text-muted-foreground"><strong>What you do:</strong> Schedule training sessions for your team</p>
                        <p className="text-xs text-muted-foreground"><strong>We handle:</strong> All training delivery, pilot testing, and post-launch support</p>
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs text-green-700 dark:text-green-300">
                          ✓ Typical timeframe: 1-2 weeks training and go-live
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <h5 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Total Timeline: 5-8 weeks from start to full operation</h5>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Most practices are up and running within 6 weeks. We've done this hundreds of times - 
                      trust us, it's much smoother than you think and the benefits are immediate!
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Security & Compliance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    How Secure Is Notewell AI V1.3?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Enterprise-Grade Security (Explained Simply)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Bank-Level Encryption
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          All your data is encrypted using the same technology banks use. Even we can't read your data without proper authorization.
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          NHS IT Governance
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          Infrastructure under continuous NHS IT Governance review during pilot phase. Designed for transition to NHS-provided infrastructure with full compliance monitoring.
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2">Zero-Trust Architecture</h5>
                        <p className="text-xs text-muted-foreground">
                          Every user and device is verified before accessing any data. No exceptions, no backdoors.
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg bg-accent/20">
                        <h5 className="font-medium text-sm mb-2">24/7 Monitoring</h5>
                        <p className="text-xs text-muted-foreground">
                          Automated threat detection and immediate alerts. Our security team monitors the system around the clock.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">NHS Compliance Standards</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { name: "DCB0129", desc: "Clinical Risk Management", status: "Draft Ready" },
                        { name: "DCB0160", desc: "Clinical Safety Management", status: "Compliant" },
                        { name: "DSPT", desc: "Data Security Protection Toolkit", status: "Pending" },
                        { name: "GDPR", desc: "Data Protection Regulation", status: "Compliant" },
                        { name: "ISO 27001", desc: "Information Security Standard", status: "Certified" },
                        { name: "MHRA", desc: "Medical Device Regulation (PCN Services Ltd)", status: "Registered" }
                      ].map((cert) => (
                        <div key={cert.name} className="p-3 border rounded-lg text-center">
                          <h6 className="font-medium text-xs mb-1">{cert.name}</h6>
                          <p className="text-xs text-muted-foreground mb-2">{cert.desc}</p>
                          <Badge 
                            variant={cert.status === "Under Review" || cert.status === "Pending" ? "secondary" : "default"} 
                            className={cert.status === "Under Review" ? "bg-amber-500" : cert.status === "Pending" ? "bg-amber-500" : cert.status === "Draft Ready" ? "bg-blue-500" : "bg-green-600"}
                          >
                            {cert.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h5 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Bottom Line for Practice Managers</h5>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Notewell AI V1.3 exceeds NHS security requirements and has been designed specifically for healthcare. 
                      You can be confident that all data is protected to the highest standards. We handle all the technical 
                      security measures so you can focus on patient care.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Support & Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    Getting Started & Support
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Implementation Support</h5>
                      <p className="text-xs text-muted-foreground mb-2">
                        Dedicated implementation manager assigned to your practice
                      </p>
                      <p className="text-xs font-medium">malcolm.railson@nhs.net</p>
                      <p className="text-xs text-muted-foreground">Response time: Within 2 hours</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h5 className="font-medium text-sm mb-2">Clinical Safety Officer</h5>
                      <p className="text-xs text-muted-foreground mb-2">
                        Direct contact for all clinical safety matters
                      </p>
                      <p className="text-xs font-medium">malcolm.railson@nhs.net</p>
                      <p className="text-xs text-muted-foreground">Available for CSO consultations</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <h5 className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2">Ready to Get Started?</h5>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                      Contact our team today for a free consultation and demo. We'll show you exactly how Notewell AI V1.3 
                      can transform your practice operations while keeping everything secure and compliant.
                    </p>
                    <Button className="w-full">
                      <Mail className="h-4 w-4 mr-2" />
                      Contact Implementation Team
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="help" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Notewell AI V1.3 - Help & About
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Your complete guide to understanding and using Notewell AI V1.3 - the comprehensive medical practice management platform.
                  </p>
                </CardHeader>
              </Card>

              {/* What is Notewell AI V1.3 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    What is Notewell AI V1.3?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Your Complete Digital Practice Assistant</h4>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      Notewell AI V1.3 is a comprehensive, AI-powered platform designed specifically for GP practices and healthcare teams. 
                      Think of it as having a highly intelligent assistant that helps with everything from patient consultations to 
                      compliance management, freeing you up to focus on what matters most - patient care.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-primary">Built by Healthcare Professionals, for Healthcare Professionals</h4>
                    <div className="p-3 border rounded-lg bg-accent/20">
                      <p className="text-sm font-medium mb-2">Developed by a PCN Manager with Deep Healthcare IT Expertise</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Notewell AI V1.3 has been built by a PCN Manager with over 25 years as an IT Professional, 
                        previously responsible for building and delivering IT systems used by tens of thousands of users across the world. 
                        This unique combination of healthcare management experience and enterprise-level IT expertise ensures that every feature 
                        is designed with real-world practice needs in mind, while maintaining the highest standards of security and reliability.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Why this matters:</strong> Unlike generic software companies, we understand the daily challenges of running a practice, 
                        the complexity of NHS IT governance requirements, and the critical importance of patient data security. Every decision in 
                        Notewell AI reflects this deep understanding of both healthcare and technology.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Built Specifically for Healthcare</h4>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      Unlike generic AI tools, Notewell AI V1.3 understands medical terminology, NHS processes, and healthcare workflows. 
                      It's like having a team member who knows exactly how your practice works and can help with both clinical and 
                      administrative tasks while maintaining the highest security standards.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Why Practice Managers and GPs Love It</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h5 className="font-medium text-sm mb-1">Saves Hours Every Day</h5>
                          <p className="text-xs text-muted-foreground">Automates note-taking, generates letters, and handles routine documentation</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h5 className="font-medium text-sm mb-1">Improves Patient Care</h5>
                          <p className="text-xs text-muted-foreground">More time with patients, better documentation, and enhanced communication</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h5 className="font-medium text-sm mb-1">Ensures Compliance</h5>
                          <p className="text-xs text-muted-foreground">Automatic CQC monitoring, complaints tracking, and audit trails</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h5 className="font-medium text-sm mb-1">Reduces Admin Burden</h5>
                          <p className="text-xs text-muted-foreground">Intelligent scheduling, automated reporting, and streamlined workflows</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h5 className="font-medium text-sm mb-1">Enhances Team Collaboration</h5>
                          <p className="text-xs text-muted-foreground">Shared documents, meeting management, and real-time communication</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h5 className="font-medium text-sm mb-1">Completely Secure</h5>
                          <p className="text-xs text-muted-foreground">NHS-approved security, GDPR compliant, and built for healthcare data</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Complete Feature Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Complete Feature Overview - All the Tools You Get</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Clinical Documentation */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        Clinical Documentation Suite
                      </h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">GP Scribe (MHRA Medical Device Class 1)</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• AI-powered consultation transcription</li>
                            <li>• Automated clinical note generation</li>
                            <li>• Patient-friendly summary generation</li>
                            <li>• SNOMED CT coding integration</li>
                            <li>• Clinical decision support</li>
                            <li>• Prescription automation</li>
                            <li>• Referral letter generation</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Meeting & Consultation Management</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Real-time audio transcription</li>
                            <li>• Speaker identification</li>
                            <li>• Automated meeting minutes</li>
                            <li>• Audio backup and reprocessing</li>
                            <li>• Meeting history and search</li>
                            <li>• Attendee management</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Translation Services</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• 50+ language support</li>
                            <li>• Real-time translation</li>
                            <li>• Voice synthesis</li>
                            <li>• Cultural sensitivity guidelines</li>
                            <li>• Patient communication templates</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* AI Intelligence & Automation */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Intelligence & Automation
                      </h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">AI4GP Service</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Multi-modal AI (GPT-4, Claude, Gemini)</li>
                            <li>• Clinical guidance and decision support</li>
                            <li>• Interactive voice agents</li>
                            <li>• Medical document processing</li>
                            <li>• Image analysis and interpretation</li>
                            <li>• Quick action buttons</li>
                            <li>• Search history with categorization</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">AI4PM Service</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Practice analytics and monitoring</li>
                            <li>• Automated reporting</li>
                            <li>• Staff management insights</li>
                            <li>• Resource optimization</li>
                            <li>• Predictive analytics</li>
                            <li>• Enhanced access reporting</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">AI Image Generation Tool</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Patient education materials</li>
                            <li>• Practice visual content</li>
                            <li>• Medical illustrations</li>
                            <li>• Document processing and OCR</li>
                            <li>• Automated categorization</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Compliance & Governance */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Compliance & Governance
                      </h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">CQC Compliance Suite</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• 15-point compliance monitoring</li>
                            <li>• Real-time CQC domain tracking</li>
                            <li>• Comprehensive complaints management</li>
                            <li>• 20-day rule automated tracking</li>
                            <li>• Evidence collection workflows</li>
                            <li>• Investigation management</li>
                            <li>• Automated CQC reporting</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Enhanced Access Reporting</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Hub delivery tracking</li>
                            <li>• COVID-19 adjustments</li>
                            <li>• Spoke balance calculations</li>
                            <li>• Practice allocation splits</li>
                            <li>• Historical trend analysis</li>
                            <li>• Compliance reporting</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Security & Data Protection</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• GDPR compliance framework</li>
                            <li>• DCB0129/DCB0160 compliance</li>
                            <li>• Automated audit trails</li>
                            <li>• Role-based access controls</li>
                            <li>• Data retention policies</li>
                            <li>• Security monitoring</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Practice Management */}
                    <div className="space-y-4">
                      <h5 className="font-semibold text-primary flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Practice Management Tools
                      </h5>
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Staff & User Management</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Role-based permissions</li>
                            <li>• Staff scheduling and shifts</li>
                            <li>• Contractor management</li>
                            <li>• Training record tracking</li>
                            <li>• Performance analytics</li>
                            <li>• Automated workflows</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Shared Drive & Collaboration</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Cloud document management</li>
                            <li>• Real-time collaboration</li>
                            <li>• Version control</li>
                            <li>• Secure file sharing</li>
                            <li>• Advanced search</li>
                            <li>• Mobile access</li>
                          </ul>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <h6 className="font-medium text-sm mb-1">Reporting & Analytics</h6>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Practice performance dashboards</li>
                            <li>• Usage statistics</li>
                            <li>• Compliance reporting</li>
                            <li>• Custom report generation</li>
                            <li>• Trend analysis</li>
                            <li>• Export capabilities</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Getting Started Guide */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Getting Started - It's Easier Than You Think!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Don't worry about the technical stuff!</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Getting started with Notewell AI V1.3 is much simpler than you might think. We handle all the technical 
                      setup, IT governance, and training. Most practices are fully operational within 6 weeks.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-semibold text-primary">Quick Start Guide for Practice Managers</h5>
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">1</div>
                        <div>
                          <h6 className="font-medium text-sm">Initial Setup & Practice Configuration</h6>
                          <p className="text-xs text-muted-foreground">Add your practice details, staff members, and preferences. We'll guide you through each step.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">2</div>
                        <div>
                          <h6 className="font-medium text-sm">Try Your First Consultation</h6>
                          <p className="text-xs text-muted-foreground">Start with GP Scribe for a simple consultation - you'll be amazed at the results!</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">3</div>
                        <div>
                          <h6 className="font-medium text-sm">Explore AI4GP for Clinical Decisions</h6>
                          <p className="text-xs text-muted-foreground">Use the AI clinical assistant for guidance, medication checks, and decision support.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">4</div>
                        <div>
                          <h6 className="font-medium text-sm">Set Up Compliance Monitoring</h6>
                          <p className="text-xs text-muted-foreground">Configure CQC monitoring and complaints management for automated compliance.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">5</div>
                        <div>
                          <h6 className="font-medium text-sm">Train Your Team</h6>
                          <p className="text-xs text-muted-foreground">We provide comprehensive training materials and live sessions for all staff members.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-semibold text-primary mb-3">Essential Tips for Success</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg">
                        <h6 className="font-medium text-sm mb-1">Start Small</h6>
                        <p className="text-xs text-muted-foreground">Begin with one or two features and gradually expand as your team gets comfortable.</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h6 className="font-medium text-sm mb-1">Use Templates</h6>
                        <p className="text-xs text-muted-foreground">We provide templates for common consultations, meetings, and documents to get you started quickly.</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h6 className="font-medium text-sm mb-1">Ask Questions</h6>
                        <p className="text-xs text-muted-foreground">Our support team is always available to help. No question is too small!</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <h6 className="font-medium text-sm mb-1">Join User Groups</h6>
                        <p className="text-xs text-muted-foreground">Connect with other practices using Notewell AI to share tips and best practices.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Support & Resources */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Support & Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-primary">We're Here to Help Every Step of the Way</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Email Support</p>
                            <p className="text-xs text-muted-foreground">malcolm.railson@nhs.net</p>
                            <p className="text-xs text-muted-foreground">Response within 2 hours</p>
                          </div>
                        </div>
                        

                        <div className="flex items-start gap-3">
                          <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Live Training Sessions</p>
                            <p className="text-xs text-muted-foreground">Weekly group sessions and 1-on-1 training available</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Headphones className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Phone Support</p>
                            <p className="text-xs text-muted-foreground">+44 (0) 7740 812180</p>
                            <p className="text-xs text-muted-foreground">Mon-Fri 8am-6pm</p>
                          </div>
                        </div>

                        

                        <div className="flex items-start gap-3">
                          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Video Tutorials</p>
                            <p className="text-xs text-muted-foreground">Step-by-step guides for every feature</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Implementation Guarantee</h5>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      We guarantee your practice will be fully operational with Notewell AI V1.3 within 8 weeks, or we'll work 
                      with you at no additional cost until you're completely satisfied. That's our commitment to your success.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">System Requirements</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-sm mb-2">Minimum Requirements</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
                          <li>Stable internet connection (5 Mbps minimum)</li>
                          <li>Microphone for voice recording features</li>
                          <li>JavaScript enabled</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-sm mb-2">Recommended for Best Experience</h5>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>High-speed broadband (25+ Mbps)</li>
                          <li>External microphone for better audio quality</li>
                          <li>Large screen (24+ inches) for dashboard views</li>
                          <li>Modern device (less than 3 years old)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-primary">Version Information</h4>
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm font-medium">Notewell AI V1.3 - Complete Medical Practice Management Platform</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Released: {new Date().toLocaleDateString()} | 
                        Next update: Quarterly feature releases | 
                        Support until: Ongoing with active subscription
                      </p>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-6">
              <ContactDirectory />
              <MeetingGroupsManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};