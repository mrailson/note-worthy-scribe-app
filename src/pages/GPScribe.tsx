import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Mic, MicOff, Play, Pause, Square, Volume2, VolumeX, FileText, Settings, MessageSquare, Download, Copy, Edit, Save, X, RotateCcw, Upload, ChevronDown, ChevronUp, Languages, Speaker, Users, Bot, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { consultationExamples } from "@/data/consultationExamples";
import { GPScribeRecorder } from "@/components/GPScribeRecorder";
import { MP3TranscriptionTest } from "@/components/MP3TranscriptionTest";

interface TranscriptData {
  text: string;
  speaker?: string;
  timestamp?: string;
  isFinal?: boolean;
  isCompleteSession?: boolean;
  confidence?: number;
}

// Healthcare languages for translation
const HEALTHCARE_LANGUAGES = [
  { code: 'none', name: 'No Translation', flag: '🚫', voice: '' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', voice: 'ar-XA-Wavenet-A' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', voice: 'bn-IN-Wavenet-A' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳', voice: 'cmn-CN-Wavenet-A' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', voice: 'cs-CZ-Wavenet-A' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', voice: 'nl-NL-Wavenet-A' },
  { code: 'en', name: 'English', flag: '🇺🇸', voice: 'en-US-Wavenet-F' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮', voice: 'fi-FI-Wavenet-A' },
  { code: 'fr', name: 'French', flag: '🇫🇷', voice: 'fr-FR-Wavenet-A' },
  { code: 'de', name: 'German', flag: '🇩🇪', voice: 'de-DE-Wavenet-A' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voice: 'el-GR-Wavenet-A' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', voice: 'gu-IN-Wavenet-A' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', voice: 'hi-IN-Wavenet-A' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voice: 'hu-HU-Wavenet-A' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voice: 'it-IT-Wavenet-A' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', voice: 'ja-JP-Wavenet-A' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', voice: 'ko-KR-Wavenet-A' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', voice: 'pa-IN-Wavenet-A' },
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

const GPScribe = () => {
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
  
  // Consultation states
  const [consultationType, setConsultationType] = useState<'face-to-face' | 'telephone' | 'video'>('face-to-face');
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [gpSummary, setGpSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [patientCopy, setPatientCopy] = useState("");
  const [traineeFeedback, setTraineeFeedback] = useState("");
  const [referralLetter, setReferralLetter] = useState("");
  const [outputLevel, setOutputLevel] = useState("3");
  const [showSnomedCodes, setShowSnomedCodes] = useState(false);
  const [formatForEmis, setFormatForEmis] = useState(false);
  const [formatForSystmOne, setFormatForSystmOne] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [activeTab, setActiveTab] = useState("consultation");
  const [completedConsultation, setCompletedConsultation] = useState<any>(null);
  
  // User settings - simplified without database calls
  const [settingsLoaded, setSettingsLoaded] = useState(true);

  const handleLanguageSelect = (languageCode: string) => {
    setTranslationLanguage(languageCode);
    
    if (languageCode !== 'none') {
      setIsTranslationEnabled(true);
    } else {
      setIsTranslationEnabled(false);
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
      return data.translatedText || text;
    } catch (error: any) {
      console.error('Translation error:', error);
      return text;
    }
  };

  const speakTranslation = async (text: string, languageCode: string, id = Date.now().toString()) => {
    if (isMuted || !autoSpeak) return;
    
    const isCurrentlyPlaying = !currentAudioRef.current?.paused;
    
    if (!isCurrentlyPlaying) {
      processAudioQueue();
    }
  };

  const processAudioQueue = async () => {
    if (audioQueueRef.current.length === 0) return;
    
    const { text, languageCode } = audioQueueRef.current.shift()!;
    
    try {
      const language = HEALTHCARE_LANGUAGES.find(lang => lang.code === languageCode);
      if (!language?.voice) {
        console.error('No voice found for language:', languageCode);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text,
          voice: language.voice,
          languageCode: languageCode
        }
      });
      
      if (error) throw error;
      
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      const audio = new Audio(data.audioUrl);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        currentAudioRef.current = null;
        processNextInQueue();
      };
      
      audio.onerror = () => {
        console.error('Audio playback error');
        processNextInQueue();
      };
      
      await audio.play();
    } catch (error: any) {
      console.error('Text-to-speech error:', error);
      processNextInQueue();
    }
  };

  const processNextInQueue = () => {
    if (audioQueueRef.current.length > 0) {
      setTimeout(() => {
        if (audioQueueRef.current.length > 0) {
          processAudioQueue();
        }
      }, 500);
    }
  };

  const processTranslation = async (transcriptText: string) => {
    if (!isTranslationEnabled || translationLanguage === 'none') return;
    
    setIsTranslating(true);
    try {
      const translatedText = await translateText(transcriptText, translationLanguage);
      const newTranslation = {
        id: Date.now().toString(),
        original: transcriptText,
        translated: translatedText,
        language: translationLanguage,
        timestamp: new Date().toLocaleTimeString(),
        speaker: 'mixed'
      };
      
      setTranslations(prev => [...prev.slice(-2), newTranslation]);
      
      if (autoSpeak && !isMuted) {
        speakTranslation(translatedText, translationLanguage, newTranslation.id);
      }
    } catch (error) {
      console.error('Translation processing error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const processQuickTranslation = async (transcriptData: TranscriptData) => {
    if (!isTranslationEnabled || translationLanguage === 'none' || !transcriptData.text?.trim()) {
      return;
    }
    
    // Determine speaker type for translation context
    const speakerName = transcriptData.speaker?.toLowerCase() || '';
    let speakerType: 'GP' | 'Patient' = 'GP';
    
    if (speakerName.includes('doctor') || speakerName.includes('gp') || speakerName.includes('physician') || speakerName === 'speaker') {
      speakerType = 'GP';
    } else {
      speakerType = 'Patient';
    }
    
    setIsTranslating(true);
    
    try {
      const translatedText = await translateText(transcriptData.text, translationLanguage);
      
      const newTranslation = {
        id: `${Date.now()}-${Math.random()}`,
        original: transcriptData.text,
        translated: translatedText,
        language: translationLanguage,
        timestamp: new Date().toLocaleTimeString(),
        speaker: speakerType,
        isFinal: transcriptData.isFinal || false
      };
      
      setTranslations(prev => {
        const updated = [...prev, newTranslation];
        return updated.slice(-3); // Keep only last 3 translations
      });
      
      if (transcriptData.isFinal && autoSpeak && !isMuted && !playedTranslations.has(newTranslation.id)) {
        speakTranslation(translatedText, translationLanguage, newTranslation.id);
        setPlayedTranslations(prev => new Set([...prev, newTranslation.id]));
      }
    } catch (error) {
      console.error('Quick translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleMicMute = () => {
    setIsMuted(prev => {
      const newMutedState = !prev;
      
      if (newMutedState) {
        // Stop any currently playing audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
      } else {
        // Resume from queue if available
        if (audioQueueRef.current.length > 0) {
          processAudioQueue();
        }
      }
      
      return newMutedState;
    });
  };

  const handleSpeakerMuteToggle = () => {
    setIsMuted(prev => {
      const newMutedState = !prev;
      
      if (newMutedState) {
        // Stop any currently playing audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
          audioQueueRef.current = []; // Clear the queue
        }
      } else {
        // Allow audio to resume normally
        processAudioQueue();
      }
      
      return newMutedState;
    });
  };

  const handleImportedTranscript = async (importedText: string) => {
    try {
      console.log('📁 Processing imported transcript:', importedText.length, 'characters');
      
      // First, clean the transcript
      setTranscript(importedText);
      
      const { data: cleaningResult, error: cleaningError } = await supabase.functions.invoke('clean-transcript', {
        body: {
          transcript: importedText,
          speakerLabels: true
        }
      });
      
      if (cleaningError) {
        console.error('Error cleaning transcript:', cleaningError);
        toast.error("Failed to clean imported transcript");
        return;
      }
      
      if (cleaningResult?.cleanedTranscript) {
        setCleanedTranscript(cleaningResult.cleanedTranscript);
        console.log('📝 Transcript cleaned:', {
          original: importedText.length,
          cleaned: cleaningResult.cleanedTranscript.length,
          speakers: cleaningResult.speakers || []
        });
      }
      
      // Try to identify speakers in the imported transcript
      try {
        const { data: speakerResult, error: speakerError } = await supabase.functions.invoke('identify-speakers', {
          body: {
            transcript: importedText,
            meetingType: 'consultation'
          }
        });
        
        if (speakerError) {
          console.error('Speaker identification error:', speakerError);
        } else if (speakerResult?.success) {
          console.log('🎭 Speaker identification completed:', speakerResult);
          
          const identification = speakerResult.identification;
          if (identification.meetingType === 'consultation') {
            console.log('✅ Identified as consultation with speakers:', identification.speakers);
            
            if (identification.speakers.length > 0) {
              const speakerMapping = new Map();
              
              identification.speakers.forEach((speaker, index) => {
                const role = index === 0 ? 'GP' : 'Patient';
                speakerMapping.set(speaker, role);
              });
              
              speakerMapping.forEach((role, originalSpeaker) => {
                console.log(`Mapping: ${originalSpeaker} → ${role}`);
              });
            }
          } else {
            console.log('ℹ️ Not identified as consultation format');
          }
        }
      } catch (speakerError) {
        console.error('Speaker identification failed:', speakerError);
      }
      
      // Set word count and duration estimates
      const words = importedText.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      
      // Estimate duration (average speaking rate: 150 words per minute)
      const estimatedMinutes = Math.ceil(words.length / 150);
      setDuration(estimatedMinutes * 60);
      
      // Create consultation data for navigation
      const consultationData = {
        id: `imported-consultation-${Date.now()}`,
        title: `Imported Consultation - ${format(new Date(), "do MMMM yyyy 'at' h.mm a")}`,
        type: consultationType,
        transcript: importedText,
        cleanedTranscript: cleaningResult?.cleanedTranscript || importedText,
        duration: formatDuration(estimatedMinutes * 60),
        wordCount: words.length,
        startTime: new Date().toISOString(),
        isExample: false,
        isImported: true
      };
      
      // If we have a substantial transcript, navigate to summary
      const enhancedTranscript = cleaningResult?.cleanedTranscript || importedText;
      if (enhancedTranscript && enhancedTranscript.trim().length > 50) {
        console.log('📋 Navigating to consultation summary with imported data');
        navigate('/consultation-summary', { state: consultationData });
      }
      
      // Show success message
      if (words.length > 50) {
        toast.success(`Successfully imported consultation with ${words.length} words`);
      }
      
    } catch (error: any) {
      console.error('Error processing imported transcript:', error);
      toast.error("Failed to process imported file");
    }
  };

  const handleTranscript = (transcriptData: TranscriptData) => {
    console.log('🔄 handleTranscript called with:', {
      text: transcriptData.text?.substring(0, 50) + '...',
      speaker: transcriptData.speaker,
      isFinal: transcriptData.isFinal,
      isCompleteSession: transcriptData.isCompleteSession
    });
    
    if (transcriptData.isCompleteSession || transcriptData.isFinal) {
      setTranscript(transcriptData.text || '');
      setWordCount(transcriptData.text ? transcriptData.text.split(' ').filter(word => word.length > 0).length : 0);
    } else {
      // Handle interim results for real-time display
      setRealtimeTranscripts(prev => [...prev.slice(-10), transcriptData]);
    }
  };

  const debouncedGenerateGuidance = (text: string) => {
    // Implementation for real-time guidance generation
    // This would call the AI to provide consultation guidance
  };

  const performQuickCleaning = (text: string): string => {
    if (!text || text.length < 10) return text;
    
    return text
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
      .replace(/\b(um|uh|er|ah|hmm)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/([.!?]){2,}/g, '$1')
      .replace(/^[.!?]+/, '')
      .replace(/[.!?]+$/, '.')
      .trim();
  };

  // Refs for audio and timer management
  const audioQueueRef = useRef<Array<{text: string, languageCode: string}>>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoCleanTimeoutRef = useRef<NodeJS.Timeout>();
  const guidanceTimeoutRef = useRef<NodeJS.Timeout>();

  const debounceAutoCleaning = (text: string) => {
    if (autoCleanTimeoutRef.current) {
      clearTimeout(autoCleanTimeoutRef.current);
    }
    
    autoCleanTimeoutRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('clean-transcript', {
          body: {
            transcript: text,
            speakerLabels: true,
            quickClean: true
          }
        });
        
        if (data.cleanedTranscript && data.cleanedTranscript !== text) {
          setCleanedTranscript(data.cleanedTranscript);
        }
      } catch (error: any) {
        console.error('Auto-cleaning error:', error);
      }
    }, 3000);
  };

  const handleUpdateConnectionStatus = (status: string) => {
    queueMicrotask(() => setConnectionStatus(status));
  };

  // All recording functions removed - handled by GPScribeRecorder component

  const resetSession = () => {
    setTranscript("");
    setCleanedTranscript("");
    setDuration(0);
    setWordCount(0);
    setConnectionStatus("Disconnected");
    setGpSummary("");
    setFullNote("");
    setPatientCopy("");
    setTraineeFeedback("");
    setReferralLetter("");
    setCompletedConsultation(null);
    console.log("🔄 GP Scribe session reset");
  };

  // Legacy stopRecording function - now handled by GPScribeRecorder component
  const stopRecording = () => {
    console.log("stopRecording called - handled by GPScribeRecorder component");
  };

  const resetSession2 = () => {
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
    
    // Clear translations
    setTranslations([]);
    setPlayedTranslations(new Set());
    
    // Reset UI states
    setIsTranscriptOpen(false);
    setConnectionStatus("Disconnected");
    setCompletedConsultation(null);
    
    // Clear guidance
    setGuidance(null);
    
    // Clear edit states
    setEditStates({
      gpSummary: false,
      fullNote: false,
      patientCopy: false,
      traineeFeedback: false,
      referralLetter: false
    });
    
    setEditContent({
      gpSummary: "",
      fullNote: "",
      patientCopy: "",
      traineeFeedback: "",
      referralLetter: ""
    });
    
    console.log("🔄 Complete session reset");
  };

  const generateSummaryBackground = async () => {
    if (!transcript || transcript.trim().length < 50) {
      console.log("⚠️ Transcript too short for background generation");
      return;
    }

    try {
      console.log("🤖 Starting background summary generation...");
      
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript: cleanedTranscript || transcript,
          consultationType,
          outputLevel: parseInt(outputLevel),
          includeSnomedCodes: showSnomedCodes,
          formatForEmis,
          formatForSystmOne
        }
      });

      if (error) {
        console.error("Background generation error:", error);
        return;
      }

      if (data) {
        console.log("✅ Background generation completed");
        setGpSummary(data.gpSummary || "");
        setFullNote(data.fullNote || "");
        setPatientCopy(data.patientCopy || "");
        setTraineeFeedback(data.traineeFeedback || "");
        setReferralLetter(data.referralLetter || "");
      }
    } catch (error) {
      console.error("Background generation failed:", error);
    }
  };

  const generateGuidance = async (transcriptText: string) => {
    if (!transcriptText || transcriptText.trim().length < 100) return;
    
    if (guidanceTimeoutRef.current) {
      clearTimeout(guidanceTimeoutRef.current);
    }
    
    guidanceTimeoutRef.current = setTimeout(async () => {
      setIsGuidanceLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('gp-consultation-guidance', {
          body: {
            transcript: transcriptText,
            consultationType
          }
        });
        
        if (error) throw error;
        
        if (data) {
          setGuidance(data);
        }
      } catch (error) {
        console.error('Guidance generation error:', error);
      } finally {
        setIsGuidanceLoading(false);
      }
    }, 5000); // Wait 5 seconds before generating guidance
  };

  const downloadAsDocx = async (content: string, filename: string) => {
    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/generate-docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
        },
        body: JSON.stringify({ content, filename }),
      });

      if (!response.ok) throw new Error('Failed to generate document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`${filename} downloaded successfully`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${type} copied to clipboard`);
    }).catch((error) => {
      console.error('Copy failed:', error);
      toast.error('Failed to copy to clipboard');
    });
  };

  const toggleEdit = (section: keyof typeof editStates) => {
    if (editStates[section]) {
      // Save the edit
      const content = editContent[section];
      switch (section) {
        case 'gpSummary':
          setGpSummary(content);
          break;
        case 'fullNote':
          setFullNote(content);
          break;
        case 'patientCopy':
          setPatientCopy(content);
          break;
        case 'traineeFeedback':
          setTraineeFeedback(content);
          break;
        case 'referralLetter':
          setReferralLetter(content);
          break;
      }
      toast.success(`${section.replace(/([A-Z])/g, ' $1').toLowerCase()} updated`);
    } else {
      // Start editing - populate with current content
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
    }

    setEditStates(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const generateSummary = async () => {
    if (!transcript || transcript.trim().length < 50) {
      toast.error("Please record at least 30 seconds of consultation before generating notes.");
      return;
    }

    try {
      toast.success("Generating consultation notes...");
      
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript: cleanedTranscript || transcript,
          consultationType,
          outputLevel: parseInt(outputLevel),
          includeSnomedCodes: showSnomedCodes,
          formatForEmis,
          formatForSystmOne
        }
      });

      if (error) {
        console.error("Generation error:", error);
        toast.error("Failed to generate consultation notes. Please try again.");
        return;
      }

      if (data) {
        setGpSummary(data.gpSummary || "");
        setFullNote(data.fullNote || "");
        setPatientCopy(data.patientCopy || "");
        setTraineeFeedback(data.traineeFeedback || "");
        setReferralLetter(data.referralLetter || "");
        
        toast.success("Consultation notes generated successfully!");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Failed to generate consultation notes. Please try again.");
    }
  };

  const loadExampleConsultation = (example: any) => {
    setTranscript(example.transcript);
    setCleanedTranscript(example.cleanedTranscript || example.transcript);
    setDuration(example.duration);
    setWordCount(example.wordCount);
    setConsultationType(example.type);
    setGpSummary(example.gpSummary || "");
    setFullNote(example.fullNote || "");
    setPatientCopy(example.patientCopy || "");
    setTraineeFeedback(example.traineeFeedback || "");
    setReferralLetter(example.referralLetter || "");
    setShowExamples(false);
    setActiveTab("consultation");
    toast.success(`Loaded example: ${example.title}`);
  };

  // Generate ticker text
  const [tickerText, setTickerText] = useState("");
  const [tickerEnabled, setTickerEnabled] = useState(true);

  // Load user settings on component mount
  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
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
          <TabsList className="grid w-full grid-cols-6 p-1 rounded-xl">
            <TabsTrigger 
              value="consultation" 
              className="rounded-lg transition-all duration-200 font-medium"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Record</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="gp-genie" 
              className="rounded-lg transition-all duration-200 font-medium"
            >
              <Bot className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">GP Genie</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="examples" 
              className="rounded-lg transition-all duration-200 font-medium"
            >
              <TestTube className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Examples</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="settings" 
              className="rounded-lg transition-all duration-200 font-medium"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="ai4gp" 
              className="rounded-lg transition-all duration-200 font-medium"
            >
              <MessageSquare className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">AI4GP</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="import" 
              className="rounded-lg transition-all duration-200 font-medium"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
          </TabsList>

          {/* GP Scribe Recording Tab */}
          <TabsContent value="consultation" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Recording Panel */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="shadow-lg border-0">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl font-bold text-foreground">GP Scribe Recording</CardTitle>
                        <CardDescription className="text-muted-foreground">
                          Record and transcribe GP consultations with AI-powered note generation
                        </CardDescription>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <Select value={consultationType} onValueChange={(value: 'face-to-face' | 'telephone' | 'video') => setConsultationType(value)}>
                          <SelectTrigger className="w-full sm:w-[160px]">
                            <SelectValue placeholder="Consultation type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="face-to-face">
                              <div className="flex items-center">
                                {consultationType === "face-to-face" && (
                                  <Users className="h-4 w-4 mr-2" />
                                )}
                                Face-to-face
                              </div>
                            </SelectItem>
                            <SelectItem value="telephone">
                              <div className="flex items-center">
                                {consultationType === "telephone" && (
                                  <Users className="h-4 w-4 mr-2" />
                                )}
                                Telephone
                              </div>
                            </SelectItem>
                            <SelectItem value="video">Video Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {(connectionStatus === "Disconnected" || connectionStatus === "Stopped") && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-medium text-blue-900 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          GP Scribe Recording Tips
                        </h4>
                        <ul className="text-sm text-blue-800 space-y-1 ml-6">
                          <li>• Ensure clear audio quality for accurate transcription</li>
                          <li>• Speak naturally during the consultation</li>
                          <li>• Record for at least 30 seconds for meaningful notes</li>
                          <li>• The system works best with structured consultations</li>
                        </ul>
                      </div>
                    )}
                    
                    {/* New GP Scribe Recorder Component */}
                    <GPScribeRecorder
                      onTranscriptUpdate={handleTranscript}
                      onRecordingComplete={(data) => {
                        console.log("Recording completed:", data);
                        setTranscript(data.transcript || "");
                        setDuration(data.duration || 0);
                        setWordCount(data.wordCount || 0);
                      }}
                      consultationType={consultationType}
                    />
                    
                    {/* Translation Panel */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-foreground">Real-time Translation</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsTranslationCollapsed(!isTranslationCollapsed)}
                        >
                          {isTranslationCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      {!isTranslationCollapsed && (
                        <div className="space-y-3">
                          {isTranslationEnabled && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleMicMute}
                              >
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                              </Button>
                              
                              <div className="flex items-center space-x-2">
                                <label className="text-sm font-medium">Auto-speak:</label>
                                <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
                              </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm font-medium mb-2 block">Translation Language</label>
                              <Select value={translationLanguage} onValueChange={handleLanguageSelect}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  {HEALTHCARE_LANGUAGES.map((language) => (
                                    <SelectItem key={language.code} value={language.code}>
                                      <span className="mr-2">{language.flag}</span>
                                      {language.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {isTranslationEnabled && translationLanguage !== 'none' && (
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium text-sm">Live Translation</h5>
                                {isTranslating && (
                                  <div className="flex items-center text-xs text-muted-foreground">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-primary mr-1"></div>
                                    Translating...
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {translations.slice(-3).map((translation) => (
                                  <div key={translation.id} className="bg-background rounded p-2 text-sm border">
                                    <div className="flex items-start justify-between mb-1">
                                      <span className="font-medium text-xs text-muted-foreground flex items-center">
                                        {translation.speaker === 'GP' ? '🩺' : '👤'} {translation.speaker}
                                        {playedTranslations.has(translation.id) && (
                                          <Volume2 className="h-3 w-3 ml-1 text-green-600" />
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground">{translation.timestamp}</span>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      {translation.speaker === 'GP' && (
                                        <>
                                          <p className="text-muted-foreground text-xs">Original: {translation.original}</p>
                                          <p className="font-medium">Translation: {translation.translated}</p>
                                        </>
                                      )}
                                      {translation.speaker === 'Patient' && (
                                        <>
                                          <p className="font-medium">Patient: {translation.translated}</p>
                                          <p className="text-muted-foreground text-xs">Original: {translation.original}</p>
                                        </>
                                      )}
                                    </div>
                                    
                                    <div className="flex justify-end mt-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => speakTranslation(translation.translated, translationLanguage, translation.id)}
                                        className="h-6 px-2"
                                      >
                                        <Volume2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                
                                {translations.length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-4">
                                    Start recording to see live translations
                                  </p>
                                )}
                                
                                {isTranslating && (
                                  <div className="flex items-center justify-center py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b border-primary"></div>
                                    <span className="ml-2 text-xs text-muted-foreground">Translating...</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Recording Status and Controls */}
                    {isRecording && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {tickerEnabled ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-pulse h-3 w-3 bg-red-500 rounded-full"></div>
                                <span className="font-medium text-red-900">RECORDING</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                                <span className="font-medium text-red-900">RECORDING</span>
                              </div>
                            )}
                          </div>
                          
                          {tickerText && (
                            <div className="flex-1 overflow-hidden mx-4">
                              <div className="animate-scroll whitespace-nowrap text-sm text-red-800">
                                {tickerText}
                              </div>
                            </div>
                          )}
                          
                          <div className="text-sm text-red-800 font-mono">
                            {formatDuration(duration)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {!isRecording ? (
                        <Button onClick={resetSession2} variant="outline" size="sm">
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset Session
                        </Button>
                      ) : null}
                      
                      {isRecording && (
                        <Button onClick={resetSession2} variant="destructive" size="sm">
                          <Square className="h-4 w-4 mr-1" />
                          Stop & Reset
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Guidance Panel */}
              {completedConsultation && (
                <div className="space-y-4">
                  <Card className="shadow-lg border-0">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-foreground">Consultation Complete</CardTitle>
                      <CardDescription>
                        Recording finished. Generate detailed consultation notes below.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">{formatDuration(duration)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Words</p>
                          <p className="font-medium">{wordCount}</p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={generateSummary} 
                        className="w-full"
                        disabled={!transcript || transcript.trim().length < 50}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Consultation Notes
                      </Button>
                    </CardContent>
                  </Card>
                  
                  {cleanedTranscript && (
                    <Card className="shadow-lg border-0">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-foreground">Cleaned Transcript</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-40 w-full border rounded p-3">
                          <p className="text-sm whitespace-pre-wrap">{cleanedTranscript}</p>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
            
            {(gpSummary || fullNote || patientCopy) && (
              <div className="space-y-6">
                <Separator />
                
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Generated Consultation Notes</h2>
                  
                  {/* Output Level Selection */}
                  <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Output Detail:</label>
                        <Select value={outputLevel} onValueChange={setOutputLevel}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((level) => (
                              <SelectItem key={level} value={level.toString()}>
                                Level {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Generated Content */}
                  <div className="space-y-6">
                    {/* GP Summary */}
                    {gpSummary && (
                      <Card className="shadow-lg border-0">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-foreground">GP Summary</CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(gpSummary, 'GP Summary')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadAsDocx(gpSummary, 'GP-Summary')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleEdit('gpSummary')}
                              >
                                {editStates.gpSummary ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editStates.gpSummary ? (
                            <Textarea
                              value={editContent.gpSummary}
                              onChange={(e) => setEditContent(prev => ({ ...prev, gpSummary: e.target.value }))}
                              className="min-h-[200px]"
                            />
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <pre className="whitespace-pre-wrap font-sans text-sm">{gpSummary}</pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Full Clinical Note */}
                    {fullNote && (
                      <Card className="shadow-lg border-0">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-foreground">Full Clinical Note</CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(fullNote, 'Full Clinical Note')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadAsDocx(fullNote, 'Full-Clinical-Note')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleEdit('fullNote')}
                              >
                                {editStates.fullNote ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editStates.fullNote ? (
                            <Textarea
                              value={editContent.fullNote}
                              onChange={(e) => setEditContent(prev => ({ ...prev, fullNote: e.target.value }))}
                              className="min-h-[300px]"
                            />
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <pre className="whitespace-pre-wrap font-sans text-sm">{fullNote}</pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Patient Copy */}
                    {patientCopy && (
                      <Card className="shadow-lg border-0">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-foreground">Patient Copy</CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(patientCopy, 'Patient Copy')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadAsDocx(patientCopy, 'Patient-Copy')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleEdit('patientCopy')}
                              >
                                {editStates.patientCopy ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editStates.patientCopy ? (
                            <Textarea
                              value={editContent.patientCopy}
                              onChange={(e) => setEditContent(prev => ({ ...prev, patientCopy: e.target.value }))}
                              className="min-h-[200px]"
                            />
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <pre className="whitespace-pre-wrap font-sans text-sm">{patientCopy}</pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Trainee Feedback */}
                    {traineeFeedback && (
                      <Card className="shadow-lg border-0">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-foreground">Teaching Feedback</CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(traineeFeedback, 'Teaching Feedback')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadAsDocx(traineeFeedback, 'Teaching-Feedback')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleEdit('traineeFeedback')}
                              >
                                {editStates.traineeFeedback ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editStates.traineeFeedback ? (
                            <Textarea
                              value={editContent.traineeFeedback}
                              onChange={(e) => setEditContent(prev => ({ ...prev, traineeFeedback: e.target.value }))}
                              className="min-h-[200px]"
                            />
                          ) : (
                            <div className="space-y-4">
                              <div className="prose prose-sm max-w-none">
                                <pre className="whitespace-pre-wrap font-sans text-sm">{traineeFeedback}</pre>
                              </div>
                              
                              {guidance && (
                                <div className="border-t pt-4">
                                  <h4 className="font-medium mb-3">Real-time Consultation Guidance</h4>
                                  {isGuidanceLoading && (
                                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b border-primary mr-2"></div>
                                      Analyzing consultation...
                                    </div>
                                  )}
                                  
                                  <div className="space-y-4">
                                    {guidance.suggestedQuestions.length > 0 && (
                                      <div>
                                        <h5 className="font-medium text-sm mb-2">Suggested Questions</h5>
                                        <ul className="text-sm space-y-1">
                                          {guidance.suggestedQuestions.map((question, index) => (
                                            <li key={index} className="flex items-start">
                                              <span className="text-muted-foreground mr-2">•</span>
                                              {question}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {guidance.potentialRedFlags.length > 0 && (
                                      <div>
                                        <h5 className="font-medium text-sm mb-2 text-red-600">Potential Red Flags</h5>
                                        <ul className="text-sm space-y-1">
                                          {guidance.potentialRedFlags.map((flag, index) => (
                                            <li key={index} className="flex items-start text-red-600">
                                              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                              {flag}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {guidance.missedOpportunities.length > 0 && (
                                      <div>
                                        <h5 className="font-medium text-sm mb-2">Missed Opportunities</h5>
                                        <ul className="text-sm space-y-1">
                                          {guidance.missedOpportunities.map((opportunity, index) => (
                                            <li key={index} className="flex items-start">
                                              <span className="text-muted-foreground mr-2">•</span>
                                              {opportunity}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {guidance.safetyNetting.length > 0 && (
                                      <div>
                                        <h5 className="font-medium text-sm mb-2">Safety Netting</h5>
                                        <ul className="text-sm space-y-1">
                                          {guidance.safetyNetting.map((safety, index) => (
                                            <li key={index} className="flex items-start">
                                              <span className="text-muted-foreground mr-2">•</span>
                                              {safety}
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
                        </CardContent>
                      </Card>
                    )}

                    {/* Referral Letter */}
                    {referralLetter && (
                      <Card className="shadow-lg border-0">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-foreground">Referral Letter</CardTitle>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(referralLetter, 'Referral Letter')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadAsDocx(referralLetter, 'Referral-Letter')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleEdit('referralLetter')}
                              >
                                {editStates.referralLetter ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editStates.referralLetter ? (
                            <Textarea
                              value={editContent.referralLetter}
                              onChange={(e) => setEditContent(prev => ({ ...prev, referralLetter: e.target.value }))}
                              className="min-h-[300px]"
                            />
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <pre className="whitespace-pre-wrap font-sans text-sm">{referralLetter}</pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Live Transcript Tab */}
          {!["gp-genie", "examples", "ai4gp"].includes(activeTab) && (
            <TabsContent value="transcript" className="space-y-4">
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Live Transcript
                    {wordCount > 0 && (
                      <Badge variant="secondary" className="ml-2">{wordCount} words</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}>
                      {isTranscriptOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                {isTranscriptOpen && (
                  <CardContent>
                    {transcript ? (
                      <ScrollArea className="h-80 w-full border rounded p-4">
                        <div className="space-y-3">
                          <div className="prose prose-sm max-w-none">
                            <p className="whitespace-pre-wrap text-sm">{transcript}</p>
                          </div>
                          
                          {isTranslationEnabled && translationLanguage && translations.length > 0 && (
                            <div className="border-t pt-3 space-y-2">
                              <h4 className="font-medium text-sm">Recent Translations</h4>
                              {translations.slice(-3).map((translation) => (
                                <div key={translation.id} className="bg-muted/50 rounded p-2 text-sm">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-xs">{translation.speaker}</span>
                                    <span className="text-xs text-muted-foreground">{translation.timestamp}</span>
                                  </div>
                                  <p className="text-muted-foreground">Original: {translation.original}</p>
                                  <p className="font-medium">Translation: {translation.translated}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No transcript available</p>
                        <p className="text-sm">Start recording to see live transcription</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          )}

          {/* Results Tab */}
          {(gpSummary || fullNote || patientCopy || traineeFeedback || referralLetter) && (
            <TabsContent value="results" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Consultation Notes</h2>
                
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium">Output Detail:</label>
                      <Select value={outputLevel} onValueChange={setOutputLevel}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((level) => (
                            <SelectItem key={level} value={level.toString()}>
                              Level {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <Button onClick={generateSummary} className="mb-6">
                  <FileText className="h-4 w-4 mr-2" />
                  Regenerate Notes
                </Button>
                
                <div className="space-y-6">
                  {/* All the generated content cards would go here, same as above */}
                </div>
              </div>
            </TabsContent>
          )}

          {/* GP Genie Tab */}
          <TabsContent value="gp-genie" className="space-y-4">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground flex items-center">
                  <Bot className="h-6 w-6 mr-2" />
                  GP Genie - AI Assistant
                </CardTitle>
                <CardDescription>
                  Voice-powered AI assistant for GP consultations and clinical decision support
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">GP Genie Features</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Voice-activated consultation support</li>
                    <li>• Real-time clinical guidance</li>
                    <li>• Symptom analysis and differential diagnosis</li>
                    <li>• Treatment recommendations</li>
                    <li>• Drug interaction checking</li>
                  </ul>
                </div>
                
                <Button className="w-full" size="lg">
                  <Bot className="h-5 w-5 mr-2" />
                  Launch GP Genie
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-4">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground">Example Consultations</CardTitle>
                <CardDescription>
                  Load pre-recorded consultation examples to test GP Scribe features
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showExamples && (
                  <div className="space-y-4 mb-6">
                    {consultationExamples.map((example) => (
                      <Card key={example.id} className="border border-muted">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{example.title}</CardTitle>
                              <CardDescription className="mt-1">
                                {example.type} • {example.duration} • {example.wordCount} words
                              </CardDescription>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadExampleConsultation(example)}
                            >
                              Load Example
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-3">
                            {example.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {example.tags?.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => setShowExamples(!showExamples)}
                  className="w-full"
                >
                  {showExamples ? 'Hide Examples' : 'Show Example Consultations'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground">GP Scribe Settings</CardTitle>
                <CardDescription>
                  Configure your consultation recording and note generation preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Note Generation</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Include SNOMED codes</label>
                        <Switch checked={showSnomedCodes} onCheckedChange={setShowSnomedCodes} />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Format for EMIS</label>
                        <Switch checked={formatForEmis} onCheckedChange={setFormatForEmis} />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Format for SystmOne</label>
                        <Switch checked={formatForSystmOne} onCheckedChange={setFormatForSystmOne} />
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-3">Audio & Recording</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Auto-transcription cleaning</label>
                        <Switch checked={true} onCheckedChange={() => {}} />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Speaker identification</label>
                        <Switch checked={true} onCheckedChange={() => {}} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI4GP Tab */}
          <TabsContent value="ai4gp" className="space-y-4">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground flex items-center">
                  <MessageSquare className="h-6 w-6 mr-2" />
                  AI4GP Chat
                </CardTitle>
                <CardDescription>
                  Intelligent AI assistant for clinical decision support and consultation guidance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-amber-900 mb-2">AI4GP Features</h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Clinical decision support</li>
                    <li>• Diagnosis assistance</li>
                    <li>• Treatment recommendations</li>
                    <li>• Clinical guideline reference</li>
                    <li>• Drug information and interactions</li>
                  </ul>
                </div>
                
                <Button className="w-full" size="lg">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Launch AI4GP Chat
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audio Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground flex items-center">
                  <Upload className="h-6 w-6 mr-2" />
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

export default GPScribe;
