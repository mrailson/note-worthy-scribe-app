import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, MicOff, Wifi, WifiOff, Brain, Copy, Download, Mail, Save, Play, Pause, FileText, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, BookOpen, Shield, BarChart3, Edit, Check, X, Send, Settings, Languages, Volume2, VolumeX, Stethoscope, Eye, EyeOff, Maximize2, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import { UnifiedAudioCapture } from "@/utils/UnifiedAudioCapture";

// Simple transcript data interface for single session mode
interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  isCompleteSession?: boolean;
}
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import { consultationExamples, type ConsultationExample } from "@/data/consultationExamples";
import { TranslationInterface } from "@/components/TranslationInterface";
import { MP3TranscriptionTest } from "@/components/MP3TranscriptionTest";
import { ConsultationHistory } from "@/components/ConsultationHistory";

import { PatientTranslationView } from "@/components/PatientTranslationView";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";
import AI4GPService from "@/components/AI4GPService";
import GPGenieVoiceAgent from "@/components/GPGenieVoiceAgent";
import { LiveTranscript } from "@/components/LiveTranscript";
import { iPhoneWhisperTranscriber, TranscriptData as IPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';

const HEALTHCARE_LANGUAGES = [
  { code: 'none', name: 'No Translation', flag: '🚫' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', voice: 'ar-XA-Wavenet-A' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', voice: 'bn-IN-Wavenet-A' },
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬', voice: 'bg-BG-Standard-A' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳', voice: 'cmn-CN-Wavenet-A' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷', voice: 'hr-HR-Wavenet-A' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', voice: 'cs-CZ-Wavenet-A' },
  { code: 'da', name: 'Danish', flag: '🇩🇰', voice: 'da-DK-Wavenet-A' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', voice: 'nl-NL-Wavenet-A' },
  { code: 'fr', name: 'French', flag: '🇫🇷', voice: 'fr-FR-Wavenet-A' },
  { code: 'de', name: 'German', flag: '🇩🇪', voice: 'de-DE-Wavenet-A' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voice: 'el-GR-Wavenet-A' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', voice: 'hi-IN-Wavenet-A' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voice: 'hu-HU-Wavenet-A' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voice: 'it-IT-Wavenet-A' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', voice: 'pl-PL-Wavenet-A' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', voice: 'pt-PT-Wavenet-A' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', voice: 'ro-RO-Wavenet-A' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voice: 'ru-RU-Wavenet-A' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', voice: 'es-ES-Wavenet-A' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', voice: 'tr-TR-Wavenet-A' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', voice: 'ur-IN-Wavenet-A' }
];

interface ConsultationGuidance {
  suggestedQuestions: string[];
  potentialRedFlags: string[];
  missedOpportunities: string[];
  safetyNetting: string[];
  consultationQuality: {
    score: number;
    feedback: string;
  };
}

const Index = () => {
  const { user, loading } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [wordCount, setWordCount] = useState(0);
  
  // UI states
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTranslationCollapsed, setIsTranslationCollapsed] = useState(true); // Collapsed by default
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [showExamples, setShowExamples] = useState(true);
  const [activeTab, setActiveTab] = useState("consultation");
  const [showTicker, setShowTicker] = useState(false);
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [tickerText, setTickerText] = useState<string>("");
  const [showTranscriptTimestamps, setShowTranscriptTimestamps] = useState(true);
  const [currentConfidence, setCurrentConfidence] = useState<number | undefined>(undefined);
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);
  const [completedConsultation, setCompletedConsultation] = useState<any>(null);
  
  // New consultation setup states
  const [consultationType, setConsultationType] = useState<"face-to-face" | "telephone">("face-to-face");
  const [translationLanguage, setTranslationLanguage] = useState<string>('none');
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
  const [translations, setTranslations] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [playedTranslations, setPlayedTranslations] = useState<Set<string>>(new Set());
  
  // Audio queue management
  const audioQueueRef = useRef<Array<{text: string, languageCode: string, id: string}>>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Guidance states - Removed guidance UI but keep for trainee feedback integration
  const [guidance, setGuidance] = useState<ConsultationGuidance | null>(null);
  const [isGuidanceLoading, setIsGuidanceLoading] = useState(false);
  const [autoGuidance, setAutoGuidance] = useState(true);
  
  // Output configuration - Will be loaded from user settings
  const [outputLevel, setOutputLevel] = useState<number>(3); // Default to Standard
  const [showSnomedCodes, setShowSnomedCodes] = useState(true); // Default to true
  const [formatForEmis, setFormatForEmis] = useState(true); // Default to true
  const [formatForSystmOne, setFormatForSystmOne] = useState(false);
  
  // User settings loading state
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Generated outputs
  const [isGenerating, setIsGenerating] = useState(false);
  const [gpSummary, setGpSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [patientCopy, setPatientCopy] = useState("");
  const [traineeFeedback, setTraineeFeedback] = useState("");
  const [referralLetter, setReferralLetter] = useState("");
  
  // Edit states
  const [editStates, setEditStates] = useState({
    gpSummary: false,
    fullNote: false,
    patientCopy: false,
    traineeFeedback: false,
    referralLetter: false
  });
  
  // Temporary edit content
  const [editContent, setEditContent] = useState({
    gpSummary: "",
    fullNote: "",
    patientCopy: "",
    traineeFeedback: "",
    referralLetter: ""
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transciberRef = useRef<UnifiedAudioCapture | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);

  const outputLevels = [
    { value: 1, label: "Code", description: "GP shorthand only (e.g., 'URTI, 2/7, safety-netted')" },
    { value: 2, label: "Brief", description: "Concise summary with key points" },
    { value: 3, label: "Standard", description: "Complete clinical note" },
    { value: 4, label: "Detailed", description: "Comprehensive with examination findings" },
    { value: 5, label: "Full", description: "Complete with patient quotes and context" }
  ];

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load user settings on component mount
  const loadUserSettings = async () => {
    if (!user || settingsLoaded) return;

    try {
      const { data: settings, error } = await supabase
        .from('gp_scribe_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error loading user settings:', error);
        return;
      }

      if (settings) {
        setOutputLevel(settings.default_output_level);
        setShowSnomedCodes(settings.default_show_snomed_codes);
        setFormatForEmis(settings.default_format_for_emis);
        setFormatForSystmOne(settings.default_format_for_systmone);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    } finally {
      setSettingsLoaded(true);
    }
  };

  // Save user settings when they change
  const saveUserSettings = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('gp_scribe_settings')
        .upsert({
          user_id: user.id,
          default_output_level: outputLevel,
          default_show_snomed_codes: showSnomedCodes,
          default_format_for_emis: formatForEmis,
          default_format_for_systmone: formatForSystmOne,
        });

      if (error) {
        console.error('Error saving user settings:', error);
      }
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  };

  // Translation functions
  const handleLanguageSelect = (languageCode: string) => {
    setTranslationLanguage(languageCode);
    setIsTranslationEnabled(languageCode !== 'none');
    if (languageCode !== 'none') {
      // Translation enabled
    } else {
      setTranslations([]);
      // Translation disabled
    }
  };

  const translateText = async (text: string, targetLanguage: string, sourceLanguage: string = 'en'): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          targetLanguage,
          sourceLanguage
        }
      });

      if (error) throw error;
      return data.translatedText;
    } catch (error: any) {
      console.error(`Translation failed: ${error.message}`);
      return text;
    }
  };

  const speakTranslation = async (text: string, languageCode: string, id = Date.now().toString()) => {
    if (isMuted || isMicMuted) return;
    
    // Add to queue
    audioQueueRef.current.push({ text, languageCode, id });
    
    // Process queue if not already playing
    if (!isCurrentlyPlaying) {
      processAudioQueue();
    }
  };

  const processAudioQueue = async () => {
    if (audioQueueRef.current.length === 0 || isCurrentlyPlaying) return;
    
    setIsCurrentlyPlaying(true);
    const audioItem = audioQueueRef.current.shift()!;
    
    try {
      const language = HEALTHCARE_LANGUAGES.find(l => l.code === audioItem.languageCode);
      if (!language?.voice) {
        processNextInQueue();
        return;
      }

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: audioItem.text,
          languageCode: audioItem.languageCode,
          voiceName: language.voice
        }
      });

      if (error) throw error;

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      const audioData = `data:audio/mp3;base64,${data.audioContent}`;
      const audio = new Audio(audioData);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        processNextInQueue();
      };
      
      audio.onerror = () => {
        console.error('Audio playback error');
        processNextInQueue();
      };

      await audio.play();
    } catch (error: any) {
      console.error('TTS Error:', error);
      processNextInQueue();
    }
  };

  const processNextInQueue = () => {
    setIsCurrentlyPlaying(false);
    currentAudioRef.current = null;
    
    // Process next item in queue after a short delay
    setTimeout(() => {
      if (audioQueueRef.current.length > 0) {
        processAudioQueue();
      }
    }, 100);
  };

  const processTranslation = async (transcriptText: string) => {
    if (!isTranslationEnabled || translationLanguage === 'none' || !transcriptText.trim()) return;
    
    setIsTranslating(true);
    try {
      const translated = await translateText(transcriptText, translationLanguage);
      const newTranslation = {
        id: Date.now().toString(),
        original: transcriptText,
        translated,
        speaker: 'Consultation',
        timestamp: new Date(),
        languageCode: translationLanguage
      };
      
      setTranslations(prev => [...prev.slice(-9), newTranslation]); // Keep last 10
      
      if (autoSpeak && !isMuted) {
        speakTranslation(translated, translationLanguage, newTranslation.id);
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Quick translation for immediate feedback
  const processQuickTranslation = async (transcriptData: TranscriptData) => {
    if (!isTranslationEnabled || translationLanguage === 'none' || !transcriptData.text.trim()) return;
    
    // Detect speaker type from the transcript data
    const speakerName = transcriptData.speaker.toLowerCase();
    let detectedSpeaker: 'GP' | 'Patient';
    let sourceLanguage: string;
    let targetLanguage: string;
    
    // Better speaker detection
    if (speakerName.includes('doctor') || speakerName.includes('gp') || speakerName.includes('physician') || speakerName === 'speaker') {
      detectedSpeaker = 'GP';
      sourceLanguage = 'en';
      targetLanguage = translationLanguage;
    } else {
      detectedSpeaker = 'Patient';
      sourceLanguage = translationLanguage;
      targetLanguage = 'en';
    }
    
    setIsTranslating(true);
    
    try {
      const translated = await translateText(transcriptData.text, targetLanguage, sourceLanguage);
      
      const newTranslation = {
        id: `${Date.now()}-${transcriptData.speaker}`,
        speaker: detectedSpeaker,
        originalText: transcriptData.text,
        translatedText: translated,
        timestamp: new Date(),
        languageCode: targetLanguage,
        sourceLanguageCode: sourceLanguage
      };
      
      // Replace or add translation for this speaker
      setTranslations(prev => {
        const filtered = prev.filter(t => !t.id.includes(transcriptData.speaker) || transcriptData.isFinal);
        return [...filtered.slice(-9), newTranslation];
      });
      
      // Auto-play only for final transcripts and only if not already played
      if (transcriptData.isFinal && autoSpeak && !isMuted && !playedTranslations.has(newTranslation.id)) {
        setPlayedTranslations(prev => new Set([...prev, newTranslation.id]));
        speakTranslation(translated, targetLanguage, newTranslation.id);
      }
      
    } catch (error) {
      console.error('Quick translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Microphone mute toggle - actually pause/resume recording
  const toggleMicMute = () => {
    const newMutedState = !isMicMuted;
    setIsMicMuted(newMutedState);
    
    if (transciberRef.current && isRecording) {
      if (newMutedState) {
        console.log('🔇 Microphone muted - single session mode continues recording');
        // In single session mode, we don't pause - just mute the mic effect
      } else {
        console.log('🎤 Microphone unmuted - single session mode continues');
      }
    }
  };

  // Stop all audio and clear queue when muting - this is for SPEAKER mute
  const handleSpeakerMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (newMutedState) {
      // Stop current audio and clear queue
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      audioQueueRef.current = [];
      setIsCurrentlyPlaying(false);
      // Translation audio muted
    } else {
      // Translation audio unmuted
    }
  };

  // Handler for imported audio transcripts with speaker identification
  const handleImportedTranscript = async (importedText: string) => {
    try {
      console.log('📁 Processing imported transcript for GP Scribe...');
      
      // Clean the transcript using GPT-4
      toast.info('Cleaning transcript with AI...');
      
      const { data: cleaningResult, error: cleaningError } = await supabase.functions.invoke('clean-transcript', {
        body: {
          rawTranscript: importedText,
          meetingTitle: 'GP Consultation'
        }
      });

      if (cleaningError) {
        console.error('Error cleaning transcript:', cleaningError);
        toast.error('Failed to clean transcript, using original');
      }

      const cleanedText = cleaningResult?.cleanedTranscript || importedText;
      
      if (cleaningResult?.cleanedTranscript) {
        toast.success('Transcript cleaned and formatted!');
        console.log('📝 Transcript cleaned:', {
          originalLength: cleaningResult.originalLength,
          cleanedLength: cleaningResult.cleanedLength
        });
      }

      // Identify speakers using AI for GP consultation
      toast.info('Identifying GP and Patient with AI...');
      
      let enhancedTranscript = cleanedText;
      
      try {
        const { data: speakerResult, error: speakerError } = await supabase.functions.invoke('identify-speakers', {
          body: {
            transcript: cleanedText,
            meetingTitle: 'GP Consultation',
            agenda: 'Medical consultation between healthcare provider and patient'
          }
        });

        if (speakerError) {
          console.error('Error identifying speakers:', speakerError);
          toast.warning('Speaker identification failed, proceeding with original transcript');
        } else if (speakerResult?.success) {
          console.log('🎭 Speakers identified:', speakerResult.identification);
          
          const identification = speakerResult.identification;
          
          // Show identification results to user
          if (identification.meetingType === 'consultation') {
            toast.success('Medical consultation detected - GP and Patient identified!');
            
            // Update the transcript with identified speaker labels
            if (identification.speakers.length > 0) {
              // Create a mapping of generic speakers to identified roles
              const speakerMapping = new Map();
              identification.speakers.forEach((speaker, index) => {
                speakerMapping.set(`Speaker ${index + 1}`, speaker.role);
                speakerMapping.set(`Speaker${index + 1}`, speaker.role);
              });

              // Replace speaker labels in transcript
              speakerMapping.forEach((role, originalSpeaker) => {
                const regex = new RegExp(`\\b${originalSpeaker}\\b`, 'gi');
                enhancedTranscript = enhancedTranscript.replace(regex, role);
              });
              
              console.log('🎯 Enhanced transcript with speaker identification');
            }
          } else {
            toast.info('Transcript processed - may not be a medical consultation');
          }
        }
      } catch (speakerError) {
        console.error('Speaker identification failed:', speakerError);
        toast.warning('Speaker identification failed, using cleaned transcript');
      }
      
      // Set the enhanced transcript
      setTranscript(enhancedTranscript);
      setCleanedTranscript(enhancedTranscript);
      
      // Update word count
      const words = enhancedTranscript.split(' ').filter(word => word.length > 0);
      setWordCount(words.length);
      
      toast.success(`Audio imported and processed! ${words.length} words, speakers identified.`);
      
      // Navigate to consultation summary with the imported data
      console.log("Navigating to consultation summary with imported data...");
      const consultationData = {
        id: `consultation-import-${Date.now()}`,
        title: `GP Consultation (Imported) - ${format(new Date(), "do MMMM yyyy 'at' h.mm a")}`,
        type: consultationType,
        transcript: enhancedTranscript,
        duration: '00:00', // Duration not available from imported audio
        wordCount: words.length,
        startTime: new Date().toISOString(),
        isExample: false,
        isImported: true
      };
      
      console.log("Navigating with imported consultation data:", consultationData);
      navigate('/consultation-summary', { state: consultationData });
      
      // Start background generation since we have processed content
      if (enhancedTranscript && enhancedTranscript.trim().length > 50) {
        console.log("Starting background generation for imported consultation...");
        // Don't await this - let it run in background with imported flag
        generateSummaryBackground(true);
      }
      
      // Auto-trigger consultation processing if we have a good transcript
      if (words.length > 50) {
        processTranslation(enhancedTranscript);
      }
      
    } catch (error: any) {
      console.error('Error processing imported transcript:', error);
      toast.error('Failed to process imported audio');
    }
  };

  // Single session mode - only process final transcripts
  const handleTranscript = (transcriptData: TranscriptData) => {
    console.log('🔄 handleTranscript called with:', {
      textLength: transcriptData.text?.length || 0,
      isFinal: transcriptData.isFinal,
      isCompleteSession: transcriptData.isCompleteSession,
      speaker: transcriptData.speaker
    });
    
    // Only process final/complete session transcripts in single session mode
    if (transcriptData.isCompleteSession || transcriptData.isFinal) {
      console.log('📝 Processing final transcript:', transcriptData.text);
      const next = performQuickCleaning(transcriptData.text).trim();
      setTranscript((prev) => {
        const prevText = prev || '';
        const prevWordsArr = prevText.trim().split(/\s+/);
        const nextWordsArr = next.split(/\s+/);
        let ov = 0;
        const mx = Math.min(20, prevWordsArr.length, nextWordsArr.length);
        for (let i = mx; i >= 3; i--) {
          const tail = prevWordsArr.slice(-i).join(' ').toLowerCase();
          const head = nextWordsArr.slice(0, i).join(' ').toLowerCase();
          if (tail === head) { ov = i; break; }
        }
        const appendedPart = ov > 0 ? nextWordsArr.slice(ov).join(' ') : next;
        const merged = (prevText + (prevText && appendedPart ? ' ' : '') + appendedPart).trim();
        const words = merged.split(' ').filter(w => w.length > 0);
        setWordCount(words.length);
        return merged;
      });
      setCurrentConfidence(transcriptData.confidence);
      console.log('✅ Transcript merged');
    } else if (transcriptData.text && transcriptData.text.length > 0) {
      // Show partial transcripts in real-time for better UX
      console.log('⏳ Processing partial transcript:', transcriptData.text.substring(0, 50) + '...');
      const next = performQuickCleaning(transcriptData.text).trim();
      setTranscript((prev) => {
        const prevText = prev || '';
        const prevWordsArr = prevText.trim().split(/\s+/);
        const nextWordsArr = next.split(/\s+/);
        let ov = 0;
        const mx = Math.min(20, prevWordsArr.length, nextWordsArr.length);
        for (let i = mx; i >= 3; i--) {
          const tail = prevWordsArr.slice(-i).join(' ').toLowerCase();
          const head = nextWordsArr.slice(0, i).join(' ').toLowerCase();
          if (tail === head) { ov = i; break; }
        }
        const appendedPart = ov > 0 ? nextWordsArr.slice(ov).join(' ') : next;
        const merged = (prevText + (prevText && appendedPart ? ' ' : '') + appendedPart).trim();
        const words = merged.split(' ').filter(w => w.length > 0);
        setWordCount(words.length);
        return merged;
      });
      setCurrentConfidence(transcriptData.confidence);
      console.log('📝 Partial transcript merged');
    } else {
      console.log('⏳ Ignoring empty partial transcript in single session mode');
    }
  };
  const debouncedGenerateGuidance = (text: string) => {
    console.log('Single session mode - guidance disabled during recording');
  };

  // Quick cleaning function for immediate text improvement
  const performQuickCleaning = (text: string): string => {
    let cleaned = text
      // Fix spacing around punctuation
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([,.!?;:])\s+/g, '$1 ')
      // Collapse excessive punctuation
      .replace(/([!?.,])\1{2,}/g, '$1')
      // Fix multiple spaces
      .replace(/\s+/g, ' ')
      // Fix broken sentences from chunking (e.g., "word. New" should be "word. New")
      .replace(/([a-z])\.\s*([A-Z])/g, '$1. $2')
      // Remove basic filler words
      .replace(/\b(uh|um|er|ah)\b/gi, '')
      .trim();

    // Remove long laughter or onomatopoeia runs (ha/hehe/lol/woo/beep) of 4+ repetitions
    cleaned = cleaned
      .replace(/(?:\b(?:ha|haha|ha-ha|hee|hehe|lol|woo|beep)[\s,!.?-]*){4,}/gi, '')
      // Collapse any immediate repeated word sequences (3+ times) down to a single instance
      .replace(/\b(\w{2,})(?:\s+\1){2,}\b/gi, '$1')
      // Collapse repeated short tokens like "ha" when under threshold
      .replace(/\b(ha|hee|hehe|lol)(?:\s+\1){1,}\b/gi, '$1');

    // Final tidy multiple spaces after removals
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };
  // Debounced auto-cleaning function
  const autoCleanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceAutoCleaning = (text: string) => {
    if (autoCleanTimeoutRef.current) {
      clearTimeout(autoCleanTimeoutRef.current);
    }
    
    autoCleanTimeoutRef.current = setTimeout(async () => {
      console.log('Auto-cleaning transcript...');
      try {
        const { data, error } = await supabase.functions.invoke('clean-transcript', {
          body: {
            rawTranscript: text,
            meetingTitle: `GP Consultation - ${consultationType}`
          }
        });

        if (error) throw error;

        if (data.cleanedTranscript && data.cleanedTranscript !== text) {
          setCleanedTranscript(data.cleanedTranscript);
          setTranscript(data.cleanedTranscript); // Update the main transcript with cleaned version
          // Transcript automatically tidied up
        }
      } catch (error: any) {
        console.error("Error auto-cleaning transcript:", error);
      }
    }, 10000); // Wait 10 seconds after transcript stops changing
  };

  // Debounced guidance function to avoid too many API calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceGuidance = (text: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      generateGuidance(text);
    }, 5000); // Wait 5 seconds after transcript stops changing
  };

  const handleTranscriptionError = (error: string) => {
    console.error(`Transcription Error: ${error}`);
    setConnectionStatus("Error");
  };

  const handleStatusChange = (status: string) => {
    queueMicrotask(() => setConnectionStatus(status));
  };

  // Filter out common hallucinations and prompt leaks
  const isLikelyHallucination = (text: string): boolean => {
    const cleanText = text.toLowerCase().trim();
    const hallucinationPatterns = [
      'if silence or background noise, return nothing',
      'thank you for watching',
      'thanks for watching',
      'subscribe and hit the bell',
      'like and subscribe',
      'don\'t forget to subscribe',
      'see you in the next video',
      'outro music',
      'background music',
      'applause',
      'music playing',
      'silence',
      'background noise',
      'return nothing',
      'transcription complete',
      'end of audio'
    ];
    
    return hallucinationPatterns.some(pattern => cleanText.includes(pattern)) ||
           cleanText.length < 3 ||
           /^[^a-zA-Z]*$/.test(cleanText);
  };

  // Map Whisper chunk results to GP Scribe transcript handler
  const handleWhisperTranscript = (data: IPhoneTranscriptData | DesktopTranscriptData) => {
    if (!data?.text || !data.text.trim()) return;
    
    const cleanText = data.text.trim();
    if (isLikelyHallucination(cleanText)) {
      console.log('🚫 Filtered hallucination:', cleanText);
      return;
    }
    
    const mapped = {
      text: cleanText,
      speaker: data.speaker || 'Speaker',
      confidence: data.confidence || 0.9,
      timestamp: new Date().toISOString(),
      isFinal: data.is_final,
    } as TranscriptData;
    handleTranscript(mapped);
  };
  const startRecording = async () => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      // Preserve existing transcript across restarts
      setDuration(0); // Reset duration counter
      console.log("Starting recording - duration reset to 0 (transcript preserved)");

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        iPhoneTranscriberRef.current = new iPhoneWhisperTranscriber(
          handleWhisperTranscript,
          handleTranscriptionError,
          handleStatusChange
        );
        await iPhoneTranscriberRef.current.startTranscription();
      } else {
        desktopTranscriberRef.current = new DesktopWhisperTranscriber(
          handleWhisperTranscript,
          handleTranscriptionError,
          handleStatusChange
        );
        await desktopTranscriberRef.current.startTranscription();
      }

      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          console.log("Duration updated to:", newDuration);
          return newDuration;
        });
      }, 1000);

      // Recording started for consultation

    } catch (error) {
      console.error("Failed to start recording", error);
      setIsRecording(false);
    }
  };

  const pauseRecording = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      // Recording paused
    } else {
      // Recording resumed
    }
  };

  const stopRecording = async () => {
    console.log("stopRecording called");
    console.log("Current duration when stopping:", duration);
    console.log("Duration state:", duration);
    console.log("IntervalRef status:", intervalRef.current ? "active" : "null");
    
    // Set status to indicate we're finalizing
    setConnectionStatus("Finalizing...");
    // Recording stopped - finalizing transcript
    
    // Stop the timer first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
    
    // Stop active transcribers
    const iphoneRef = iPhoneTranscriberRef.current;
    const desktopRef = desktopTranscriberRef.current;

    if (iphoneRef) {
      await iphoneRef.stopTranscription();
      iPhoneTranscriberRef.current = null;
    }
    if (desktopRef) {
      await desktopRef.stopTranscription();
      try {
        const finalFromDesktop = await desktopRef.getCompleteTranscript?.();
        if (finalFromDesktop && finalFromDesktop.length > (transcript?.length || 0)) {
          const cleaned = performQuickCleaning(finalFromDesktop);
          setTranscript(cleaned);
          const wordsFinal = cleaned.split(' ').filter(w => w.length > 0);
          setWordCount(wordsFinal.length);
          console.log('🧵 Updated transcript with final merged desktop text, words:', wordsFinal.length);
        }
      } catch (e) {
        console.error('Failed to fetch final desktop transcript:', e);
      }
      desktopTranscriberRef.current = null;
    }
    // Stop the unified audio capture if it was used previously
    if (transciberRef.current) {
      console.log("🛑 Stopping single session recording...");
      transciberRef.current.stopCapture();
      transciberRef.current = null;
    }
    
    // Conditional delay based on recording duration
    const delayTime = 1000; // Reduced delay to 1 second for better user experience
    console.log(`Recording duration: ${duration}s, using ${delayTime/1000}s delay`);
    
    // Reduced delay since we're using 5-second chunks now
    setTimeout(() => {
      setConnectionStatus("Stopped");
      console.log("Transcript length:", transcript ? transcript.trim().length : 0);
      console.log("Recording duration for navigation check:", duration, "seconds");
      
      // Check if recording is too short (under 30 seconds)
      if (duration < 30) {
        console.log("Recording too short (under 30 seconds), staying on current page");
        console.log("Duration value:", duration, "Type:", typeof duration);
        toast.error("Recording too short. Please record for at least 30 seconds for meaningful consultation notes.");
        return;
      }
      
      console.log("Duration check passed, proceeding with navigation...");
      
      // Navigate immediately to consultation summary without waiting for generation
      console.log("Navigating immediately to consultation summary...");
      const consultationData = {
        id: `consultation-${Date.now()}`,
        title: `GP Consultation - ${format(new Date(), "do MMMM yyyy 'at' h.mm a")}`,
        type: consultationType,
        transcript: (cleanedTranscript || transcript) || '',
        duration: formatDuration(duration),
        wordCount: transcript ? transcript.split(' ').filter(word => word.length > 0).length : 0,
        startTime: new Date().toISOString(),
        isExample: false
      };
      
      console.log("Navigating with data:", consultationData);
      navigate('/consultation-summary', { state: consultationData });
      
      // Start background generation if there's meaningful content
      if (transcript && transcript.trim().length > 50) {
        console.log("Starting background generation...");
        // Don't await this - let it run in background
        generateSummaryBackground();
      }
    }, delayTime);
  };

  const resetSession = () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Clear all transcription data
    setTranscript("");
    setCleanedTranscript("");
    setRealtimeTranscripts([]);
    setDuration(0);
    setWordCount(0);
    
    // Clear generated content
    setGpSummary("");
    setFullNote("");
    setPatientCopy("");
    setTraineeFeedback("");
    setReferralLetter("");
    
    // Reset UI states
    setIsTranscriptOpen(false);
    setIsTranslationCollapsed(true);
    setActiveTab("consultation");
    
    // Reset translation data
    setTranslations([]);
    setPlayedTranslations(new Set());
    
    // Reset guidance
    setGuidance(null);
    setIsGuidanceLoading(false);
    
    // Reset connection status
    setConnectionStatus("Disconnected");
    
    console.log("Session reset - all data cleared");
    toast.success("Session reset successfully");
  };

  const loadExample = (exampleId: string) => {
    const example = consultationExamples.find(ex => ex.id === exampleId);
    if (example) {
      // Prepare consultation data for the summary view
      const consultationData = {
        id: `example-${exampleId}`,
        title: example.title,
        type: example.type,
        transcript: example.transcript,
        duration: formatDuration(300), // 5 minutes example duration
        wordCount: example.transcript.split(' ').filter(word => word.length > 0).length,
        startTime: new Date().toISOString(),
        isExample: true,
        exampleData: {
          gpSummary: example.expectedNotes.gpSummary,
          fullNote: example.expectedNotes.fullNote,
          patientCopy: example.expectedNotes.patientCopy,
          traineeFeedback: example.traineeFeedback,
          guidance: null // Will be generated
        }
      };
      
      // Loading example
      
      // Navigate to consultation summary view
      navigate('/consultation-summary', { state: consultationData });
    }
  };

  const generateGuidance = async (transcriptText?: string) => {
    const textToAnalyze = transcriptText || transcript;
    if (!textToAnalyze.trim()) {
      console.error("No transcript available for guidance");
      return;
    }

    setIsGuidanceLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('gp-consultation-guidance', {
        body: {
          transcript: textToAnalyze
        }
      });

      if (error) throw error;

      setGuidance(data);
      
      if (!transcriptText) { // Only show console log for manual requests
        console.log("Consultation guidance generated");
      }
    } catch (error: any) {
      console.error('Error generating guidance:', error);
      if (!transcriptText) { // Only show error for manual requests
        console.error(`Error generating guidance: ${error.message}`);
      }
    } finally {
      setIsGuidanceLoading(false);
    }
  };

  // Clean transcript with AI
  const cleanTranscript = async () => {
    if (!transcript || transcript.length < 10) {
      console.error("No transcript available to clean");
      return;
    }

    setIsCleaningTranscript(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('clean-transcript', {
        body: {
          rawTranscript: transcript,
          meetingTitle: `GP Consultation - ${consultationType}`
        }
      });

      if (error) throw error;

      setCleanedTranscript(data.cleanedTranscript);
      
      // Also update the main transcript with the cleaned version 
      // so it gets saved when the consultation is saved to history
      setTranscript(data.cleanedTranscript);
      
      console.log('✅ Transcript cleaned and updated in session');
      toast.success('Transcript cleaned successfully!');
      
      // Transcript cleaned successfully
    } catch (error: any) {
      console.error("Error cleaning transcript:", error);
      console.error(`Failed to clean transcript: ${error.message}`);
      toast.error('Failed to clean transcript');
    } finally {
      setIsCleaningTranscript(false);
    }
  };

  const generateSummary = async () => {
    const transcriptToUse = cleanedTranscript || transcript;
    
    if (!transcriptToUse.trim()) {
      console.error("No transcript available to generate summary");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript: transcriptToUse,
          outputLevel,
          showSnomedCodes,
          formatForEmis,
          formatForSystmOne,
          userId: user?.id
        }
      });

      if (error) throw error;

      setGpSummary(data.gpSummary || "");
      setFullNote(data.fullNote || "");
      setPatientCopy(data.patientCopy || "");
      setTraineeFeedback(data.traineeFeedback || "");
      setReferralLetter(data.referralLetter || "");
      
      // Update edit content as well
      setEditContent({
        gpSummary: data.gpSummary || "",
        fullNote: data.fullNote || "",
        patientCopy: data.patientCopy || "",
        traineeFeedback: data.traineeFeedback || "",
        referralLetter: data.referralLetter || ""
      });
      
      // Save to history
      await saveToHistory(data);
      
      console.log("Navigating to consultation summary with generated data...");
      // Navigate to consultation summary with the generated data
      const consultationData = {
        id: `consultation-${Date.now()}`,
        title: `GP Consultation - ${format(new Date(), "do MMMM yyyy 'at' h.mm a")}`,
        type: 'gp_consultation',
        transcript: transcript,
        duration: formatDuration(duration),
        wordCount: transcript.split(' ').filter(word => word.length > 0).length,
        startTime: new Date().toISOString(),
        isExample: false,
        generatedData: {
          gpSummary: data.gpSummary,
          fullNote: data.fullNote,
          patientCopy: data.patientCopy,
          traineeFeedback: data.traineeFeedback
        }
      };
      
      console.log("Navigation data:", consultationData);
      navigate('/consultation-summary', { state: consultationData });
      // Clinical summary generated successfully
    } catch (error: any) {
      console.error(`Error generating summary: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Background generation that doesn't block navigation
  const generateSummaryBackground = async (isImported: boolean = false) => {
    const transcriptToUse = cleanedTranscript || transcript;
    
    if (!transcriptToUse.trim()) {
      console.error("No transcript available to generate summary");
      return;
    }

    console.log("Starting background generation of consultation notes...");
    console.log("Transcript length:", transcriptToUse.length);
    console.log("User ID:", user?.id);
    console.log("Is imported:", isImported);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript: transcriptToUse,
          outputLevel,
          showSnomedCodes,
          formatForEmis,
          formatForSystmOne,
          consultationType: consultationType,
          userId: user?.id
        }
      });

      console.log("Edge function response:", { data, error });

      if (error) throw error;

      // Save to history for future reference
      console.log("About to save to history with data:", data);
      await saveToHistory(data, isImported);
      
      console.log("Background generation completed successfully");
      toast.success("Consultation notes generated and saved to history");
      
    } catch (error: any) {
      console.error(`Error generating summary in background: ${error.message}`);
      console.error("Full error object:", error);
      toast.error("Failed to generate consultation notes in background");
    }
  };

  const saveToHistory = async (summaryData: any, isImported: boolean = false) => {
    if (!user) {
      console.error("No user available to save history");
      return;
    }

    console.log("Starting saveToHistory with:", { summaryData, isImported, userId: user.id });

    try {
      // Create meeting record
      const title = isImported 
        ? `GP Consultation (Imported) - ${format(new Date(), "do MMMM yyyy 'at' h.mm a")}`
        : `GP Consultation - ${format(new Date(), "do MMMM yyyy 'at' h.mm a")}`;
        
      console.log("Creating meeting with title:", title);
      
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: title,
          description: isImported ? "GP Scribe consultation notes (Imported Audio)" : "GP Scribe consultation notes",
          meeting_type: "gp_consultation",
          duration_minutes: isImported ? 0 : Math.ceil(duration / 60),
          status: "completed"
        })
        .select()
        .single();

      console.log("Meeting creation result:", { meeting, meetingError });

      if (meetingError) throw meetingError;

      // Save transcript
      const transcriptToSave = cleanedTranscript || transcript;
      console.log("Saving transcript, length:", transcriptToSave?.length || 0);
      
      if (transcriptToSave) {
        const { data: transcriptData, error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: transcriptToSave,
            speaker_name: "Consultation",
            timestamp_seconds: 0
          });
          
        console.log("Transcript save result:", { transcriptData, transcriptError });
        if (transcriptError) console.error("Transcript save error:", transcriptError);
      }

      // Save summary
      console.log("Saving summary data:", summaryData);
      const { data: summaryResult, error: summaryError } = await supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: meeting.id,
          summary: summaryData.gpSummary,
          key_points: summaryData.fullNote ? [summaryData.fullNote] : [],
          action_items: summaryData.patientCopy ? [summaryData.patientCopy] : [],
          next_steps: summaryData.traineeFeedback ? [summaryData.traineeFeedback] : []
        });

      console.log("Summary save result:", { summaryResult, summaryError });
      if (summaryError) throw summaryError;

      console.log(`✅ Consultation saved to history: ${title}`);
      toast.success("Consultation saved to history successfully!");

    } catch (error: any) {
      console.error('Error saving to history:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast.error('Failed to save consultation to history');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      // Remove markdown formatting for clipboard
      const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      await navigator.clipboard.writeText(cleanText);
      // Copied to clipboard
    } catch (error) {
      console.error("Failed to copy to clipboard");
    }
  };

  // Function to format text for display (convert markdown to JSX)
  const formatTextForDisplay = (text: string) => {
    if (!text) return null;
    
    // Split by double asterisks for bold
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Auto-regenerate GP Summary when output level changes
  const handleOutputLevelChange = async (newLevel: number) => {
    setOutputLevel(newLevel);
    
    // Auto-regenerate if there's content
    if (transcript && transcript.trim().length > 50) {
      setTimeout(() => generateSummary(), 500);
    }
  };

  // Edit functions
  const startEdit = (section: keyof typeof editStates) => {
    const currentContent = {
      gpSummary,
      fullNote,
      patientCopy,
      traineeFeedback,
      referralLetter
    };
    
    setEditContent(prev => ({
      ...prev,
      [section]: currentContent[section]
    }));
    
    setEditStates(prev => ({
      ...prev,
      [section]: true
    }));
  };

  const saveEdit = (section: keyof typeof editStates) => {
    const setters = {
      gpSummary: setGpSummary,
      fullNote: setFullNote,
      patientCopy: setPatientCopy,
      traineeFeedback: setTraineeFeedback,
      referralLetter: setReferralLetter
    };
    
    setters[section](editContent[section]);
    setEditStates(prev => ({
      ...prev,
      [section]: false
    }));
    
    // Changes saved
  };

  const cancelEdit = (section: keyof typeof editStates) => {
    setEditStates(prev => ({
      ...prev,
      [section]: false
    }));
  };

  const generateReferralLetter = async () => {
    if (!transcript.trim()) {
      console.error("No transcript available for referral letter");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-referral-letter', {
        body: {
          transcript,
          gpSummary,
          fullNote,
          userId: user?.id
        }
      });

      if (error) throw error;

      setReferralLetter(data.referralLetter || "");
      setEditContent(prev => ({
        ...prev,
        referralLetter: data.referralLetter || ""
      }));
      
      // Referral letter generated
    } catch (error: any) {
      console.error(`Error generating referral letter: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAsPDF = (content: string, filename: string) => {
    // Remove markdown formatting for PDF
    const cleanContent = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(cleanContent, 180);
    doc.text(splitText, 10, 10);
    doc.save(`${filename}.pdf`);
    // PDF downloaded
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Handle navigation state (e.g., returning from consultation summary)
  useEffect(() => {
    const navState = location.state as { activeTab?: string } | null;
    if (navState?.activeTab) {
      setActiveTab(navState.activeTab);
    }
  }, [location.state]);

  // Load user settings on component mount
  useEffect(() => {
    loadUserSettings();
  }, [user]);

  // Save user settings when they change
  useEffect(() => {
    if (settingsLoaded) {
      saveUserSettings();
    }
  }, [outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please sign in to use GP Scribe</h2>
            <p className="text-muted-foreground">Authentication is required to access consultation note features.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-6xl">
        
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full gap-1 overflow-x-auto sm:grid sm:grid-cols-6 p-1 rounded-xl">
            <TabsTrigger 
              value="consultation" 
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              Consultation
            </TabsTrigger>
            <TabsTrigger 
              value="examples" 
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              Examples
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              History
            </TabsTrigger>
            <TabsTrigger 
              value="ai4gp" 
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              AI4GP
            </TabsTrigger>
            <TabsTrigger 
              value="gp-genie" 
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              GP Genie
            </TabsTrigger>
            <TabsTrigger 
              value="test-mp3" 
              className="rounded-lg transition-all duration-200 font-medium shrink-0"
            >
              Audio Import + AI
            </TabsTrigger>
          </TabsList>

        {/* Consultation Tab - Recording Interface */}
        <TabsContent value="consultation" className="space-y-4">
          <Card className="shadow-medium border-accent/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  GP Scribe - Consultation Notes
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1 text-xs">
                    {getConnectionStatusIcon()}
                    <span className="hidden sm:inline">{connectionStatus}</span>
                  </Badge>
                  {(connectionStatus === "Disconnected" || connectionStatus === "Stopped") && (
                    <Button
                      onClick={resetSession}
                      variant="outline"
                      size="sm"
                      className="text-xs px-3 py-1 h-6"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Consultation Setup - Enhanced Design */}
              <div className="bg-gradient-to-br from-primary/5 to-accent/10 rounded-xl p-6 border border-primary/20 shadow-subtle">
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  {/* Left Side - Setup Options */}
                  <div className="flex-1 space-y-6">
                    {/* Consultation Type */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Consultation Type
                        </h4>
                        <div className="flex gap-3">
                          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            consultationType === "face-to-face" 
                              ? "border-primary bg-primary/10 shadow-sm" 
                              : "border-border hover:border-primary/50 bg-background"
                          }`}>
                            <input
                              type="radio"
                              name="consultationType"
                              value="face-to-face"
                              checked={consultationType === "face-to-face"}
                              onChange={(e) => setConsultationType(e.target.value as "face-to-face" | "telephone")}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              consultationType === "face-to-face" ? "border-primary" : "border-muted-foreground"
                            }`}>
                              {consultationType === "face-to-face" && (
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                              )}
                            </div>
                            <span className="text-sm font-medium">Face to Face</span>
                          </label>
                          
                          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            consultationType === "telephone" 
                              ? "border-primary bg-primary/10 shadow-sm" 
                              : "border-border hover:border-primary/50 bg-background"
                          }`}>
                            <input
                              type="radio"
                              name="consultationType"
                              value="telephone"
                              checked={consultationType === "telephone"}
                              onChange={(e) => setConsultationType(e.target.value as "face-to-face" | "telephone")}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              consultationType === "telephone" ? "border-primary" : "border-muted-foreground"
                            }`}>
                              {consultationType === "telephone" && (
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                              )}
                            </div>
                            <span className="text-sm font-medium">Telephone</span>
                          </label>
                        </div>
                      </div>
                    </div>


                    {/* Translation Settings - Collapsible */}
                    <Collapsible open={!isTranslationCollapsed} onOpenChange={(open) => setIsTranslationCollapsed(!open)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer hover:bg-accent/10 transition-colors rounded-lg p-2">
                          <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                            <Languages className="h-4 w-4" />
                            Real-time Translation
                          </h4>
                          {isTranslationCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                       <CollapsibleContent>
                        <div className="space-y-4 mt-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            {isTranslationEnabled && (
                              <div className="flex items-center gap-4 text-xs">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={autoSpeak}
                                    onChange={(e) => setAutoSpeak(e.target.checked)}
                                    className="rounded"
                                  />
                                  Auto-speak
                                </label>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={toggleMicMute}
                                    className="h-6 px-2"
                                  >
                                    {isMicMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                                    {isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSpeakerMuteToggle}
                                    className="h-6 px-2"
                                  >
                                    {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                                    {isMuted ? 'Unmute Speaker' : 'Mute Speaker'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <Select value={translationLanguage} onValueChange={handleLanguageSelect}>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select translation language" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60" position="item-aligned" side="bottom" align="start">
                                {HEALTHCARE_LANGUAGES.map((language) => (
                                  <SelectItem key={language.code} value={language.code}>
                                    <div className="flex items-center gap-2">
                                      <span>{language.flag}</span>
                                      <span>{language.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                           </div>
                          
                          {/* Live Translation Display */}
                          {isTranslationEnabled && translationLanguage !== 'none' && (
                            <div className="bg-gradient-to-br from-primary/5 to-accent/10 rounded-xl p-4 border-2 border-primary/20 shadow-subtle animate-fade-in">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Languages className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold text-primary">
                                    Live Translation: {HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage)?.flag} {HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage)?.name}
                                  </span>
                                </div>
                          <div className="flex items-center gap-2">
                            {/* EXPAND BUTTON - this is the right place! */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0 bg-primary/10 border-primary/20 hover:bg-primary/20"
                              title="Expand translation view for patient"
                              onClick={() => {
                                // Create modal with REAL translation data
                                const modal = document.createElement('div');
                                modal.className = 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4';
                                
                                const currentTranslation = translations.length > 0 ? translations[translations.length - 1] : null;
                                const languageInfo = HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage);
                                
                                modal.innerHTML = `
                                  <div class="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
                                    <button class="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-2xl" onclick="this.closest('.fixed').remove()">&times;</button>
                                    <h2 class="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-900 dark:text-white">
                                      🌐 Live Translation: ${languageInfo?.flag || '🌐'} ${languageInfo?.name || 'Unknown'}
                                    </h2>
                                    <div class="border-2 border-blue-200 dark:border-blue-700 rounded-xl p-8 min-h-[400px] bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                                      ${currentTranslation ? `
                                        <div class="space-y-6">
                                          <!-- Speaker Badge -->
                                          <div class="flex items-center justify-between">
                                            <span class="px-4 py-2 rounded-full text-sm font-medium ${currentTranslation.speaker === 'GP' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}">${currentTranslation.speaker}</span>
                                            <span class="text-sm text-gray-500 dark:text-gray-400">${new Date(currentTranslation.timestamp).toLocaleTimeString()}</span>
                                          </div>
                                          
                                          <!-- Original Text -->
                                          <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                                            <div class="text-lg font-medium text-gray-600 dark:text-gray-300 mb-3">English Original:</div>
                                            <div class="text-2xl leading-relaxed text-gray-900 dark:text-white">${currentTranslation.original}</div>
                                          </div>
                                          
                                          <!-- Translated Text -->
                                          <div class="bg-blue-50 dark:bg-blue-900 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-8">
                                            <div class="text-xl font-medium text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-3">
                                              ${languageInfo?.flag || '🌐'} ${languageInfo?.name || 'Translation'}:
                                            </div>
                                            <div class="text-4xl leading-relaxed font-medium text-gray-900 dark:text-white text-center py-4">
                                              ${currentTranslation.translated}
                                            </div>
                                          </div>
                                        </div>
                                      ` : `
                                        <div class="text-center text-gray-500 dark:text-gray-400 py-16">
                                          <div class="text-6xl mb-4">🌐</div>
                                          <p class="text-2xl mb-2">Waiting for translation...</p>
                                          <p class="text-lg">The translated text will appear here in large format</p>
                                          <p class="text-sm mt-4">Start speaking to see live translations</p>
                                        </div>
                                      `}
                                    </div>
                                  </div>
                                `;
                                document.body.appendChild(modal);
                                modal.onclick = (e) => {
                                  if (e.target === modal) modal.remove();
                                };
                              }}
                            >
                              <Maximize2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={toggleMicMute}
                              className={`h-6 w-6 p-0 ${isMicMuted ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-muted-foreground hover:bg-muted'}`}
                              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                            >
                              {isMicMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                            </Button>
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={handleSpeakerMuteToggle}
                               className={`h-6 w-6 p-0 ${isMuted ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-muted-foreground hover:bg-muted'}`}
                               title={isMuted ? 'Unmute speaker' : 'Mute speaker'}
                             >
                               {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                             </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-3 max-h-40 overflow-y-auto">
                          {translations.slice(-3).map((translation) => (
                            <div
                              key={translation.id}
                              className={`p-3 rounded-lg border animate-scale-in ${
                                translation.speaker === 'GP'
                                  ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                                  : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                              }`}
                            >
                               <div className="flex items-center justify-between mb-2">
                                 <div className="flex items-center gap-2">
                                   <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                                     translation.speaker === 'GP' ? 'bg-blue-600' : 'bg-green-600'
                                   }`}>
                                     {translation.speaker}
                                   </span>
                                   <span className="text-xs text-muted-foreground">
                                     {translation.timestamp.toLocaleTimeString()}
                                   </span>
                                   {playedTranslations.has(translation.id) && (
                                     <span className="text-xs text-green-600 font-medium">✓ Played</span>
                                   )}
                                 </div>
                                 
                                 {/* Action buttons */}
                                 <div className="flex items-center gap-1">
                                   {/* Repeat Speaker Button */}
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     className="h-6 w-6 p-0 hover:bg-black/10"
                                     title="Repeat translation"
                                     onClick={async () => {
                                       // Repeat the translated text
                                       await speakTranslation(translation.translatedText, translationLanguage, translation.id + '-repeat');
                                       toast.success('Repeating translation');
                                     }}
                                   >
                                     <Volume2 className="h-3 w-3 text-primary" />
                                   </Button>
                                   
                                   {/* Incorrect Translation Button - Only show for GP translations */}
                                   {translation.speaker === 'GP' && (
                                     <Button
                                       size="sm"
                                       variant="ghost"
                                       className="h-6 w-6 p-0 hover:bg-red-50 text-orange-600 hover:text-red-600"
                                       title="Mark as incorrect translation"
                                       onClick={async () => {
                                         try {
                                           // Show confirmation
                                           const confirmed = window.confirm('Mark this translation as incorrect? This will help improve future translations.');
                                           if (!confirmed) return;
                                           
                                           // Speak apology in the target language
                                           const apologyMessage = "I am sorry, that translation was incorrect. Let me try again.";
                                           
                                           // Translate the apology message
                                           const { data, error } = await supabase.functions.invoke('translate-text', {
                                             body: {
                                               text: apologyMessage,
                                               targetLanguage: translationLanguage,
                                               sourceLanguage: 'en'
                                             }
                                           });
                                           
                                           if (!error && data.translatedText) {
                                             await speakTranslation(data.translatedText, translationLanguage, 'apology-' + Date.now());
                                           }
                                           
                                           // Mark translation for improvement (could log to analytics)
                                           console.log('Incorrect translation marked:', translation);
                                           toast.success('Marked as incorrect. Apology spoken in ' + HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage)?.name);
                                           
                                         } catch (error) {
                                           console.error('Error handling incorrect translation:', error);
                                           toast.error('Failed to process incorrect translation request');
                                         }
                                       }}
                                     >
                                       <AlertTriangle className="h-3 w-3" />
                                     </Button>
                                   )}
                                 </div>
                               </div>
                              
                               {/* Original Text */}
                               <div className="mb-2">
                                 <p className="text-xs font-medium text-muted-foreground">
                                   {translation.speaker === 'GP' ? 'English:' : `${HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage)?.name}:`}
                                 </p>
                                 <p className="text-sm">{translation.originalText}</p>
                               </div>
                               
                               {/* Translated Text */}
                               <div>
                                 <p className="text-xs font-medium text-muted-foreground">
                                   {translation.speaker === 'GP' ? `${HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage)?.name}:` : 'English:'}
                                 </p>
                                 <p className="text-sm font-semibold text-primary">{translation.translatedText}</p>
                               </div>
                            </div>
                          ))}
                          
                          {translations.length === 0 && (
                            <div className="text-center py-4">
                              <Languages className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Start speaking to see translations</p>
                            </div>
                          )}
                          
                          {isTranslating && (
                            <div className="flex items-center justify-center py-2">
                              <div className="flex items-center gap-2 text-primary">
                                <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full"></div>
                                <span className="text-xs">Translating...</span>
                              </div>
                            </div>
                          )}
                                 </div>
                               </div>
                             )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                    {/* Live Speech Controls and Display - Hidden on Edge */}
                    {isRecording && !/Edg/.test(navigator.userAgent) && (
                      <>
                        {/* Eye toggle for live speech */}
                        <div className="flex items-center justify-center mb-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTickerEnabled(!tickerEnabled)}
                            className="flex items-center gap-2"
                          >
                            {tickerEnabled ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                            <p>{tickerEnabled ? "Hide Live Speech" : "Show Live Speech"}</p>
                          </Button>
                        </div>
                        
                        {/* Live speech ticker */}
                        <div className={`transition-all duration-500 mb-4 ${showTicker && tickerEnabled ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
                          {tickerText && (
                            <div className="bg-background/90 backdrop-blur-sm border border-primary/20 rounded-lg p-3 shadow-subtle">
                              <p className="text-sm text-primary font-medium animate-pulse text-center">
                                {tickerText}
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Recording Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-accent/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{formatDuration(duration)}</div>
                        <div className="text-sm text-muted-foreground">Duration</div>
                      </div>
                      <div className="bg-accent/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{wordCount}</div>
                        <div className="text-sm text-muted-foreground">Words</div>
                      </div>
                    </div>
                  
                  </div>

                  {/* Right Side - Recording Button */}
                  <div className="lg:border-l lg:border-primary/20 lg:pl-6 flex flex-col items-center">
                    <div className="flex flex-col items-center gap-4">
                      {!isRecording ? (
                        <Button 
                          onClick={startRecording}
                          className="shadow-elegant px-8 py-6 text-lg font-semibold min-h-[64px] rounded-xl transition-all duration-300 bg-gradient-primary hover:bg-primary-hover hover:shadow-glow hover:scale-105"
                        >
                          <Mic className="h-6 w-6 mr-3" />
                          Start Recording
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <Button 
                            onClick={pauseRecording}
                            variant="secondary"
                            className="shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px] rounded-xl"
                          >
                            {isPaused ? <Play className="h-5 w-5 mr-3" /> : <Pause className="h-5 w-5 mr-3" />}
                            {isPaused ? 'Resume' : 'Pause'}
                          </Button>
                          <Button 
                            onClick={stopRecording}
                            variant="destructive"
                            className="shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px] rounded-xl"
                          >
                            <MicOff className="h-5 w-5 mr-3" />
                            Stop Recording
                          </Button>
                        </div>
                      )}
                      
                      {isRecording && (
                        <div className={`flex items-center justify-center gap-3 rounded-lg p-4 mt-4 ${
                          isMicMuted 
                            ? "text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" 
                            : "text-primary bg-accent/20 animate-pulse"
                        }`}>
                          <div className={`w-3 h-3 rounded-full ${isMicMuted ? 'bg-red-500' : 'bg-primary'}`}></div>
                          <span className="text-base font-medium">
                            {isMicMuted ? "Microphone muted..." : (isPaused ? "Recording paused..." : "Recording consultation...")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Completed Consultation Tab */}
        <TabsContent value="completed" className="space-y-4">
          {completedConsultation && (
            <Card className="shadow-medium border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Consultation Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-accent/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{completedConsultation.duration}</div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                  </div>
                  <div className="bg-accent/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{completedConsultation.wordCount}</div>
                    <div className="text-sm text-muted-foreground">Words</div>
                  </div>
                  <div className="bg-accent/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{completedConsultation.consultationType}</div>
                    <div className="text-sm text-muted-foreground">Type</div>
                  </div>
                  <div className="bg-accent/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">
                      {new Date(completedConsultation.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                </div>

                {/* Live transcript - aligned with Meeting Recorder */}
                <LiveTranscript 
                  transcript={transcript}
                  confidence={currentConfidence}
                  showTimestamps={showTranscriptTimestamps}
                  onTimestampsToggle={setShowTranscriptTimestamps}
                />

                {/* Generated notes display */}
                {(gpSummary || fullNote || patientCopy) && (
                  <Card className="border-accent/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Generated Clinical Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="summary" className="w-full">
                        <TabsList className="flex w-full gap-1 overflow-x-auto sm:grid sm:grid-cols-4">
                          <TabsTrigger value="summary" className="shrink-0">GP Summary</TabsTrigger>
                          <TabsTrigger value="full" className="shrink-0">Full Note</TabsTrigger>
                          <TabsTrigger value="patient" className="shrink-0">Patient Copy</TabsTrigger>
                          {traineeFeedback && <TabsTrigger value="trainee" className="shrink-0">Trainee Feedback</TabsTrigger>}
                        </TabsList>
                        
                        <TabsContent value="summary" className="space-y-4">
                          <div className="bg-accent/10 rounded-lg p-4">
                            <SafeMessageRenderer content={gpSummary || 'No GP summary generated'} />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="full" className="space-y-4">
                          <div className="bg-accent/10 rounded-lg p-4">
                            <SafeMessageRenderer content={fullNote || 'No full note generated'} />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="patient" className="space-y-4">
                          <div className="bg-accent/10 rounded-lg p-4">
                            <SafeMessageRenderer content={patientCopy || 'No patient copy generated'} />
                          </div>
                        </TabsContent>
                        
                        {traineeFeedback && (
                          <TabsContent value="trainee" className="space-y-4">
                            <div className="bg-accent/10 rounded-lg p-4">
                              <SafeMessageRenderer content={traineeFeedback} />
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </CardContent>
                  </Card>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setActiveTab("consultation")}
                    variant="outline"
                  >
                    Start New Consultation
                  </Button>
                  <Button
                    onClick={() => navigate('/consultation-history')}
                    variant="outline"
                  >
                    View History
                  </Button>
                  {transcript && (
                    <Button
                      onClick={generateSummary}
                      disabled={isGenerating}
                      className="bg-gradient-primary hover:bg-primary-hover"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      {isGenerating ? 'Generating...' : 'Regenerate Notes'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

          {/* Tab Content */}
          <Card className="shadow-medium border-accent/20">
            <CardContent className="p-6">

              {/* Consultation Examples Tab */}
              <TabsContent value="examples" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Typical Consultation Examples - For Training on how the system works.</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExamples(!showExamples)}
                    >
                      {showExamples ? "Hide Examples" : "Show Examples"}
                    </Button>
                  </div>
                  
                  {showExamples && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {consultationExamples.map((example) => (
                        <Card key={example.id} className="cursor-pointer hover:shadow-md transition-shadow border-accent/20">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm sm:text-base">{example.title}</h4>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {example.description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {example.type}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadExample(example.id)}
                                className="ml-2 shrink-0"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Load
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Settings Tab - Combined Configuration and Settings */}
              <TabsContent value="settings" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Output Configuration Section */}
                  <Card className="border-accent/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Output Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Output Level</label>
                        <Select value={outputLevel.toString()} onValueChange={(value) => handleOutputLevelChange(parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select output level" />
                          </SelectTrigger>
                          <SelectContent>
                            {outputLevels.map((level) => (
                              <SelectItem key={level.value} value={level.value.toString()}>
                                <div>
                                  <div className="font-medium">Level {level.value}: {level.label}</div>
                                  <div className="text-xs text-muted-foreground">{level.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Clinical Coding & Formatting</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="snomed-codes" 
                            checked={showSnomedCodes}
                            onCheckedChange={(checked) => setShowSnomedCodes(checked === true)}
                          />
                          <label htmlFor="snomed-codes" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Include SNOMED CT codes
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="emis-format" 
                            checked={formatForEmis}
                            onCheckedChange={(checked) => setFormatForEmis(checked === true)}
                          />
                          <label htmlFor="emis-format" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Format for EMIS Web
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="systmone-format" 
                            checked={formatForSystmOne}
                            onCheckedChange={(checked) => setFormatForSystmOne(checked === true)}
                          />
                          <label htmlFor="systmone-format" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Format for SystmOne
                          </label>
                        </div>
                      </div>

                      <Button
                        onClick={generateSummary}
                        disabled={!transcript.trim() || isGenerating}
                        className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle text-lg font-medium py-4"
                      >
                        <Brain className="h-5 w-5 mr-3" />
                        {isGenerating ? "Generating consultation notes..." : "🧠 Generate Clinical Summary"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Practice Settings Section */}
                  <Card className="border-accent/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Practice Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-6">
                        <h4 className="text-base font-semibold mb-3">GP Scribe Settings</h4>
                        <p className="text-muted-foreground mb-6 text-sm">
                          Configure your practice details, specialist services, and GP signature settings.
                        </p>
                        <Button
                          onClick={() => navigate('/gp-scribe/settings')}
                          className="flex items-center gap-2"
                        >
                          <Settings className="h-4 w-4" />
                          Open Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>


              {/* Consultation History Tab */}
              <TabsContent value="history" className="space-y-4">
                <ConsultationHistory />
              </TabsContent>
            </CardContent>
          </Card>

        {/* Transcript - Collapsible (Hidden on GP Genie, Examples, and AI4GP tabs) */}
        {!["gp-genie", "examples", "ai4gp"].includes(activeTab) && (
        <Card className="shadow-medium border-accent/20">
          <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/10 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    Transcript
                    {wordCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {wordCount} words
                      </Badge>
                    )}
                  </span>
                  {isTranscriptOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="bg-secondary/50 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  {transcript ? (
                    <div className="space-y-4">
                      {/* Original Transcript */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          Original Transcript
                        </h4>
                        <pre className="whitespace-pre-wrap text-sm bg-blue-50 dark:bg-blue-950/20 rounded p-3">{transcript}</pre>
                      </div>
                      
                      {/* Translations */}
                      {isTranslationEnabled && translationLanguage && translations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Translation ({HEALTHCARE_LANGUAGES.find(l => l.code === translationLanguage)?.name})
                            {isTranslating && <span className="text-xs text-muted-foreground">(translating...)</span>}
                          </h4>
                          <div className="space-y-2">
                            {translations.slice(-3).map((translation) => (
                              <div key={translation.id} className="bg-green-50 dark:bg-green-950/20 rounded p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm">{translation.translated}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {translation.timestamp.toLocaleTimeString()}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => speakTranslation(translation.translated, translation.languageCode)}
                                    disabled={isMuted}
                                    className="h-6 w-6 p-0 ml-2"
                                  >
                                    <Volume2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Start recording or load an example to see transcription...
                    </p>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        )}


        {/* Generated Output */}
        {(gpSummary || fullNote || patientCopy || traineeFeedback || referralLetter) && (
          <Card className="shadow-medium border-accent/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Clinical Notes</span>
                <Button
                  onClick={generateReferralLetter}
                  disabled={!transcript.trim() || isGenerating}
                  variant="outline"
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate Referral"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="flex w-full gap-1 overflow-x-auto sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto p-1">
                  <TabsTrigger value="summary" className="min-h-[44px] text-xs sm:text-sm touch-manipulation shrink-0">
                    <span className="hidden sm:inline">🟦 GP Summary</span>
                    <span className="sm:hidden">GP</span>
                  </TabsTrigger>
                  <TabsTrigger value="full" className="min-h-[44px] text-xs sm:text-sm touch-manipulation shrink-0">
                    <span className="hidden sm:inline">🟨 Full Note</span>
                    <span className="sm:hidden">Full</span>
                  </TabsTrigger>
                  <TabsTrigger value="patient" className="min-h-[44px] text-xs sm:text-sm touch-manipulation shrink-0">
                    <span className="hidden sm:inline">🟩 Patient Copy</span>
                    <span className="sm:hidden">Patient</span>
                  </TabsTrigger>
                  <TabsTrigger value="trainee" className="min-h-[44px] text-xs sm:text-sm touch-manipulation shrink-0">
                    <span className="hidden lg:inline">🟣 Trainee Feedback</span>
                    <span className="lg:hidden">Trainee</span>
                  </TabsTrigger>
                  <TabsTrigger value="referral" className="min-h-[44px] text-xs sm:text-sm touch-manipulation shrink-0">
                    <span className="hidden lg:inline">📄 Referral Letter</span>
                    <span className="lg:hidden">Referral</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="text-xs sm:text-sm font-medium">Quick Pick Level:</label>
                      <Select value={outputLevel.toString()} onValueChange={(value) => handleOutputLevelChange(parseInt(value))}>
                        <SelectTrigger className="w-full sm:w-40 min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {outputLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value.toString()}>
                              {level.value}: {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('gpSummary')}
                      disabled={editStates.gpSummary}
                      className="touch-manipulation min-h-[44px] w-full sm:w-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.gpSummary ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.gpSummary}
                        onChange={(e) => setEditContent(prev => ({ ...prev, gpSummary: e.target.value }))}
                        className="min-h-[200px] bg-blue-50 dark:bg-blue-950/20"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => saveEdit('gpSummary')}
                          className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => cancelEdit('gpSummary')}
                          className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      {formatTextForDisplay(gpSummary) || "No summary generated yet"}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => copyToClipboard(gpSummary)}
                      className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => downloadAsPDF(gpSummary, 'gp-summary')}
                      className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="full" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('fullNote')}
                      disabled={editStates.fullNote}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.fullNote ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.fullNote}
                        onChange={(e) => setEditContent(prev => ({ ...prev, fullNote: e.target.value }))}
                        className="min-h-[200px] bg-yellow-50 dark:bg-yellow-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('fullNote')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('fullNote')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      {formatTextForDisplay(fullNote) || "No full note generated yet"}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(fullNote)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(fullNote, 'full-note')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="patient" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('patientCopy')}
                      disabled={editStates.patientCopy}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.patientCopy ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.patientCopy}
                        onChange={(e) => setEditContent(prev => ({ ...prev, patientCopy: e.target.value }))}
                        className="min-h-[200px] bg-green-50 dark:bg-green-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('patientCopy')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('patientCopy')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      {formatTextForDisplay(patientCopy) || "No patient copy generated yet"}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(patientCopy)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(patientCopy, 'patient-copy')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="trainee" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('traineeFeedback')}
                      disabled={editStates.traineeFeedback}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.traineeFeedback ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.traineeFeedback}
                        onChange={(e) => setEditContent(prev => ({ ...prev, traineeFeedback: e.target.value }))}
                        className="min-h-[200px] bg-purple-50 dark:bg-purple-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('traineeFeedback')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('traineeFeedback')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                       
                       {/* Consultation Guidance Integration */}
                      {guidance && (
                        <div className="space-y-4 border-t pt-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Brain className="h-5 w-5 text-blue-500" />
                            Real-time Consultation Analysis
                            {isGuidanceLoading && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            )}
                          </h4>
                          
                          {/* Consultation Quality Score */}
                          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-blue-500" />
                              <span className="font-medium">Quality Score:</span>
                            </div>
                            <Badge variant="outline" className="text-lg font-semibold">
                              {guidance.consultationQuality.score}/10
                            </Badge>
                            <div className="flex-1 text-sm text-muted-foreground">
                              {guidance.consultationQuality.feedback}
                            </div>
                          </div>

                          <div className="grid gap-4">
                            {/* Suggested Questions */}
                            {guidance.suggestedQuestions.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <Brain className="h-4 w-4 text-blue-500" />
                                  Suggested Questions
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.suggestedQuestions.map((question, index) => (
                                    <li key={index} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                      • {question}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Red Flags */}
                            {guidance.potentialRedFlags.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                  Potential Red Flags
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.potentialRedFlags.map((flag, index) => (
                                    <li key={index} className="p-2 bg-red-50 dark:bg-red-950/20 rounded">
                                      ⚠️ {flag}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Missed Opportunities */}
                            {guidance.missedOpportunities.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-orange-500" />
                                  Consider Exploring
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.missedOpportunities.map((opportunity, index) => (
                                    <li key={index} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                                      💡 {opportunity}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Safety Netting */}
                            {guidance.safetyNetting.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-green-500" />
                                  Safety Netting
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.safetyNetting.map((safety, index) => (
                                    <li key={index} className="p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                      🛡️ {safety}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(traineeFeedback)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(traineeFeedback, 'trainee-feedback')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="referral" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('referralLetter')}
                      disabled={editStates.referralLetter}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.referralLetter ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.referralLetter}
                        onChange={(e) => setEditContent(prev => ({ ...prev, referralLetter: e.target.value }))}
                        className="min-h-[200px] bg-gray-50 dark:bg-gray-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('referralLetter')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('referralLetter')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      <SafeMessageRenderer 
                        content={(referralLetter || "No referral letter generated yet")
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>') 
                        }
                        className="min-h-[200px]"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(referralLetter)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(referralLetter, 'referral-letter')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
        
          <TabsContent value="ai4gp" className="space-y-6">
            <AI4GPService />
          </TabsContent>
          
          <TabsContent value="gp-genie" className="space-y-6">
            <GPGenieVoiceAgent />
          </TabsContent>
          
          <TabsContent value="test-mp3" className="space-y-6">
            <Card className="border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Audio Import with AI Speaker Recognition
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload audio files and automatically identify GP and Patient speakers using advanced AI analysis.
                  Perfect for consultations that need proper speaker attribution for clinical notes.
                </p>
              </CardHeader>
              <CardContent>
                <MP3TranscriptionTest onTranscriptReceived={handleImportedTranscript} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;