import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';

interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  isEnglish: boolean;
  suggestedSpeaker: 'gp' | 'patient';
}

export class LanguageDetector {
  private targetLanguage: string;
  private targetLanguageName: string;

  constructor(targetLanguage: string, targetLanguageName: string) {
    this.targetLanguage = targetLanguage;
    this.targetLanguageName = targetLanguageName;
    console.log('🔧 LanguageDetector initialized for:', { targetLanguage, targetLanguageName });
  }

  detectLanguage(text: string): LanguageDetectionResult {
    const cleanText = text.trim().toLowerCase();
    console.log('🔍 Language detection for text:', cleanText.substring(0, 50), 'Target:', this.targetLanguageName);
    
    // Simple English detection - only look for very common English words
    const basicEnglishWords = [
      'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 
      'will', 'would', 'could', 'should', 'can', 'may', 'do', 'does', 'did',
      'hello', 'hi', 'yes', 'no', 'please', 'thank', 'you', 'sorry', 'how', 'what', 'when', 'where',
      'pain', 'feel', 'hurt', 'take', 'medication', 'doctor', 'need', 'help'
    ];
    
    const words = cleanText.split(/\s+/);
    const englishWordCount = words.filter(word => basicEnglishWords.includes(word)).length;
    const englishRatio = englishWordCount / Math.max(words.length, 1);
    
    console.log('📊 English detection:', { englishWordCount, totalWords: words.length, ratio: englishRatio });
    
    // If we detect English words (even just one in a short phrase), assume GP speaking English
    if (englishRatio > 0.15 || englishWordCount > 0) {
      console.log('✅ Detected as English (GP speaking)');
      return {
        detectedLanguage: 'en',
        confidence: Math.min(95, 70 + (englishRatio * 25)),
        isEnglish: true,
        suggestedSpeaker: 'gp'
      };
    }

    // Otherwise, assume patient speaking in the target language
    console.log('✅ Detected as', this.targetLanguageName, '(Patient speaking)');
    return {
      detectedLanguage: this.targetLanguage,
      confidence: 85,
      isEnglish: false,
      suggestedSpeaker: 'patient'
    };
  }

  private calculatePatternScore(text: string, patterns: RegExp[]): number {
    let totalMatches = 0;
    let totalWords = text.split(/\s+/).length;

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        totalMatches += matches.length;
      }
    });

    return totalMatches / Math.max(totalWords, 1);
  }

  private detectTargetLanguage(text: string): number {
    // Language-specific detection patterns
    const languagePatterns: Record<string, RegExp[]> = {
      'ar': [
        /[\u0600-\u06FF]/g, // Arabic script
        /\b(نعم|لا|شكرا|مرحبا|طبيب|مستشفى|دواء)\b/g
      ],
      'zh': [
        /[\u4e00-\u9fff]/g, // Chinese characters
        /\b(是|不|谢谢|你好|医生|医院|药)\b/g
      ],
      'hi': [
        /[\u0900-\u097F]/g, // Devanagari script
        /\b(हाँ|नहीं|धन्यवाद|नमस्ते|डॉक्टर|अस्पताल|दवा)\b/g
      ],
      'fr': [
        /\b(le|la|les|un|une|des|et|ou|mais|est|sont|avoir|être)\b/g,
        /\b(oui|non|merci|bonjour|docteur|hôpital|médicament|douleur)\b/g
      ],
      'es': [
        /\b(el|la|los|las|un|una|y|o|pero|es|son|tener|ser)\b/g,
        /\b(sí|no|gracias|hola|doctor|hospital|medicina|dolor)\b/g
      ],
      'de': [
        /\b(der|die|das|ein|eine|und|oder|aber|ist|sind|haben|sein)\b/g,
        /\b(ja|nein|danke|hallo|arzt|krankenhaus|medikament|schmerz)\b/g
      ],
      'it': [
        /\b(il|la|gli|le|un|una|e|o|ma|è|sono|avere|essere)\b/g,
        /\b(sì|no|grazie|ciao|dottore|ospedale|medicina|dolore)\b/g
      ],
      'pt': [
        /\b(o|a|os|as|um|uma|e|ou|mas|é|são|ter|ser)\b/g,
        /\b(sim|não|obrigado|olá|doutor|hospital|remédio|dor)\b/g
      ],
      'ru': [
        /[\u0400-\u04FF]/g, // Cyrillic script
        /\b(да|нет|спасибо|привет|врач|больница|лекарство)\b/g
      ],
      'tr': [
        /\b(bir|ve|veya|ama|değil|var|yok|ben|sen|o)\b/g,
        /\b(evet|hayır|teşekkür|merhaba|doktor|hastane|ilaç)\b/g
      ],
      'fa': [
        /[\u0600-\u06FF]/g, // Persian uses Arabic script
        /\b(بله|نه|متشکرم|سلام|دکتر|بیمارستان|دارو)\b/g
      ]
    };

    const patterns = languagePatterns[this.targetLanguage];
    if (!patterns) {
      return 0; // Unknown language
    }

    return this.calculatePatternScore(text, patterns);
  }
}

// Web Speech Recognition language detection helper
export class WebSpeechLanguageDetector {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  async detectLanguageFromSpeech(
    targetLanguage: string,
    onResult: (result: { text: string; isEnglish: boolean; confidence: number }) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    // Try English first
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence || 0.8;
        
        if (transcript && result.isFinal) {
          // Use our language detector to determine the actual language
          const detector = new LanguageDetector(targetLanguage, '');
          const detection = detector.detectLanguage(transcript);
          
          onResult({
            text: transcript,
            isEnglish: detection.isEnglish,
            confidence: confidence * (detection.confidence / 100)
          });
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.start();
    this.isListening = true;
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getLanguageCode(languageName: string): string {
    const language = HEALTHCARE_LANGUAGES.find(
      lang => lang.name.toLowerCase() === languageName.toLowerCase()
    );
    return language?.code || 'auto';
  }
}