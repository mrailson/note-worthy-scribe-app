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
    
    // CRITICAL RULE: Any English text = GP speaker, Any other language = Patient speaker
    
    // Comprehensive English detection with medical and common terms
    const commonEnglishWords = [
      // Basic function words (most common)
      'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 
      'will', 'would', 'could', 'should', 'can', 'may', 'do', 'does', 'did', 'be', 'been',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those',
      'what', 'when', 'where', 'why', 'how', 'who', 'which', 'with', 'from', 'to', 'for',
      'in', 'on', 'at', 'by', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
      'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'd', 'll',
      
      // Common conversational words
      'hello', 'hi', 'yes', 'no', 'please', 'thank', 'thanks', 'sorry', 'okay', 'ok', 'right',
      'good', 'well', 'today', 'now', 'here', 'there', 'about', 'some', 'any', 'all',
      'really', 'quite', 'very', 'much', 'many', 'little', 'big', 'small', 'new', 'old',
      
      // Medical/healthcare terms commonly used by GPs
      'pain', 'feel', 'feeling', 'hurt', 'hurts', 'take', 'taking', 'medication', 'medicine',
      'doctor', 'need', 'needs', 'help', 'symptoms', 'symptom', 'problem', 'problems',
      'prescription', 'tablet', 'tablets', 'dose', 'treatment', 'condition', 'patient',
      'blood', 'pressure', 'heart', 'breathing', 'chest', 'head', 'stomach', 'back',
      'better', 'worse', 'improving', 'getting', 'days', 'weeks', 'months', 'morning',
      'evening', 'night', 'before', 'after', 'during', 'since', 'started', 'stopped',
      'hospital', 'clinic', 'appointment', 'visit', 'surgery', 'operation', 'scan', 'test',
      
      // GP consultation phrases
      'tell', 'me', 'let\'s', 'lets', 'see', 'check', 'examine', 'look', 'show', 'describe',
      'explain', 'understand', 'concerned', 'worry', 'worried', 'follow', 'up', 'appointment',
      'next', 'come', 'back', 'contact', 'call', 'if', 'anything', 'changes', 'continue',
      'stop', 'start', 'increase', 'decrease', 'twice', 'once', 'daily', 'weekly', 'monthly',
      
      // Common question words and phrases
      'what\'s', 'whats', 'how\'s', 'hows', 'where\'s', 'wheres', 'when\'s', 'whens',
      'tell', 'say', 'said', 'ask', 'asked', 'think', 'thought', 'know', 'knew',
      
      // Time and frequency
      'time', 'times', 'hour', 'hours', 'minute', 'minutes', 'day', 'night', 'week', 'month',
      'year', 'today', 'yesterday', 'tomorrow', 'always', 'never', 'sometimes', 'often',
      
      // Numbers spelled out
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'first', 'second', 'third', 'last', 'next'
    ];
    
    // Additional English patterns for extra detection
    const englishPatterns = [
      /\b(ing|ed|er|est|ly|tion|sion|ness|ment|able|ible)\b/g, // English suffixes
      /\b(un|re|pre|dis|over|under|out|up)\w+/g, // English prefixes
      /\b\w+'(s|t|d|ll|ve|re|m)\b/g, // Contractions
      /\b(th|ch|sh|wh|ph)\w+/g // Common English letter combinations
    ];
    
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    const totalWords = words.length;
    
    // Count English words
    const englishWordCount = words.filter(word => 
      commonEnglishWords.includes(word.replace(/[.,!?;:'"]/g, ''))
    ).length;
    
    // Count English patterns
    let patternMatches = 0;
    englishPatterns.forEach(pattern => {
      const matches = cleanText.match(pattern);
      if (matches) patternMatches += matches.length;
    });
    
    const englishRatio = englishWordCount / Math.max(totalWords, 1);
    const patternRatio = patternMatches / Math.max(totalWords, 1);
    const combinedScore = englishRatio + (patternRatio * 0.3); // Pattern matches contribute but less weight
    
    console.log('📊 Enhanced English detection:', { 
      text: cleanText,
      englishWordCount, 
      totalWords, 
      englishRatio: englishRatio.toFixed(2),
      patternMatches,
      patternRatio: patternRatio.toFixed(2),
      combinedScore: combinedScore.toFixed(2),
      detectedWords: words.filter(word => commonEnglishWords.includes(word.replace(/[.,!?;:'"]/g, '')))
    });
    
    // MUCH MORE AGGRESSIVE English detection - any sign of English = GP
    let isEnglishDetected = false;
    let englishConfidence = 80; // base, will adjust below
    
    if (totalWords === 1) {
      // Single word - if it's English, it's definitely English
      isEnglishDetected = englishWordCount >= 1 || patternMatches >= 1;
    } else if (totalWords <= 3) {
      // Short phrases - require at least 1 English word OR English pattern
      isEnglishDetected = englishWordCount >= 1 || patternMatches >= 1;
    } else if (totalWords <= 8) {
      // Medium phrases - require at least 20% English content OR significant patterns
      isEnglishDetected = englishRatio >= 0.2 || combinedScore >= 0.25 || englishWordCount >= 2;
    } else {
      // Longer phrases - require at least 15% English content OR patterns
      isEnglishDetected = englishRatio >= 0.15 || combinedScore >= 0.2 || (englishWordCount >= 2 && patternMatches >= 1);
    }

    // Fallback: Detect English spoken but transcribed in Hindi script (Devanagari)
    if (!isEnglishDetected && this.targetLanguage === 'hi' && /[\u0900-\u097F]/.test(cleanText)) {
      const translitEnglishPatterns: RegExp[] = [
        /हेलो/g, /गुड/g, /मॉर्निंग/g, /ईवनिंग/g, /नाइट/g,
        /हाउ/g, /आर/g, /यू/g, /कैन/g, /आई/g, /हेल्प/g,
        /प्लीज़/g, /थैंक/g, /थैंक्स/g, /ओके/g, /राइट/g,
        /टुडे/g, /टुमारो/g, /लॉन्ग/g, /दिस/g, /इज़/g,
        /डॉक्टर/g, /पेशेंट/g
      ];
      let translitMatches = 0;
      translitEnglishPatterns.forEach(p => {
        const m = cleanText.match(p);
        if (m) translitMatches += m.length;
      });
      const translitRatio = translitMatches / Math.max(totalWords, 1);
      if (translitMatches >= 2 || translitRatio >= 0.25) {
        console.log('🇬🇧 Detected English via Hindi-script transliteration, treating as GP', { translitMatches, translitRatio: translitRatio.toFixed(2) });
        isEnglishDetected = true;
        // Confidence weighted by transliteration ratio
        englishConfidence = Math.min(95, Math.max(78, 75 + translitRatio * 20));
      }
    }
    
    console.log('🎯 Detection decision:', {
      isEnglishDetected,
      reasoning: isEnglishDetected ? 'English detected -> GP speaker' : 'Non-English detected -> Patient speaker'
    });
    
    // EXPLICIT RULE: Any English = GP, Any other language = Patient
    if (isEnglishDetected) {
      console.log('✅ CONFIRMED: English detected -> GP speaking');
      return {
        detectedLanguage: 'en',
        confidence: englishConfidence || Math.min(95, Math.max(75, 60 + (combinedScore * 35))),
        isEnglish: true,
        suggestedSpeaker: 'gp'
      };
    }

    // Otherwise, assume patient speaking in the target language
    console.log('✅ CONFIRMED: Non-English detected ->', this.targetLanguageName, '(Patient speaking)');
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

    // Try English first (UK)
    this.recognition.lang = 'en-GB';
    
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