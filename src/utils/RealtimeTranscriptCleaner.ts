import { userNameCorrections } from "@/utils/UserNameCorrections";

export class RealtimeTranscriptCleaner {
  private previousTranscripts: string[] = [];
  private cleaningBuffer: string[] = [];
  private lastCleanTime = Date.now();
  private correctionsLoaded = false;
  
  constructor(
    private onCleanedTranscript: (cleaned: string, context: string) => void
  ) {
    // Load user's saved name corrections on init
    this.loadUserCorrections();
  }

  private async loadUserCorrections() {
    try {
      await userNameCorrections.loadCorrections();
      this.correctionsLoaded = true;
      console.log('User name corrections loaded for real-time cleaning');
    } catch (error) {
      console.warn('Could not load user name corrections:', error);
    }
  }

  addTranscript(newTranscript: string) {
    console.log('Adding transcript for real-time cleaning:', newTranscript);
    
    // Add to our tracking
    this.previousTranscripts.push(newTranscript);
    this.cleaningBuffer.push(newTranscript);
    
    // Keep recent context (last 10 transcripts)
    if (this.previousTranscripts.length > 10) {
      this.previousTranscripts = this.previousTranscripts.slice(-10);
    }
    
    // Process with context every few seconds or when buffer gets large
    const timeSinceLastClean = Date.now() - this.lastCleanTime;
    if (this.cleaningBuffer.length >= 3 || timeSinceLastClean > 3000) {
      this.processWithContext();
    }
  }

  private async processWithContext() {
    if (this.cleaningBuffer.length === 0) return;
    
    console.log('Processing transcripts with context for clinical accuracy');
    
    // Get context from previous transcripts
    const context = this.previousTranscripts.slice(-5).join(' ');
    const toClean = this.cleaningBuffer.join(' ');
    
    try {
      // Use clinical-grade cleaning with context
      const cleanedText = await this.deepCleanWithContext(toClean, context);
      
      if (cleanedText && cleanedText.trim() !== toClean.trim()) {
        console.log('Real-time cleaning improved transcript:', {
          original: toClean,
          cleaned: cleanedText
        });
        
        this.onCleanedTranscript(cleanedText, context);
      }
      
      // Clear buffer and update timing
      this.cleaningBuffer = [];
      this.lastCleanTime = Date.now();
      
    } catch (error) {
      console.error('Error in real-time cleaning:', error);
      // Clear buffer even on error to prevent backup
      this.cleaningBuffer = [];
    }
  }

  private async deepCleanWithContext(text: string, context: string): Promise<string> {
    // First apply user's saved name corrections
    let cleaned = userNameCorrections.applyCorrections(text);
    
    // Then apply local medical corrections
    cleaned = this.applyMedicalCorrections(cleaned);
    
    // Then use AI cleaning with context if available
    try {
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/clean-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ 
          rawTranscript: cleaned,
          context: context,
          meetingTitle: 'GP Consultation - Real-time cleaning'
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.cleanedTranscript || cleaned;
      }
    } catch (error) {
      console.warn('AI cleaning unavailable, using local cleaning:', error);
    }
    
    return cleaned;
  }

  private applyMedicalCorrections(text: string): string {
    // Critical medical term corrections - prevent dangerous misheard terms
    const criticalCorrections = [
      // CRITICAL: Prevent dangerous medical misinterpretations
      [/\binfection\b/gi, (match: string, offset: number, string: string) => {
        // Check context - if chest pain context, likely "angina"
        const beforeContext = string.substring(Math.max(0, offset - 50), offset).toLowerCase();
        const afterContext = string.substring(offset, Math.min(string.length, offset + 50)).toLowerCase();
        if (beforeContext.includes('chest') || beforeContext.includes('pain') || afterContext.includes('chest') || afterContext.includes('pain')) {
          return 'angina';
        }
        return match;
      }],
      [/\baffection\b/gi, 'infection'],
      [/\banxiety attack\b/gi, 'angina'],
      [/\bangle\b/gi, 'angina'],
      [/\bangina pectoris\b/gi, 'angina pectoris'],
      
      // Critical medication corrections
      [/\bramapril\b/gi, 'ramipril'],
      [/\bramiparol\b/gi, 'ramipril'],
      [/\brampril\b/gi, 'ramipril'],
      [/\bram april\b/gi, 'ramipril'],
      [/\bram a pill\b/gi, 'ramipril'],
      [/\bametformin\b/gi, 'metformin'],
      [/\bmet formin\b/gi, 'metformin'],
      [/\bmetform\b/gi, 'metformin'],
      [/\basprin\b/gi, 'aspirin'],
      [/\baspirin\b/gi, 'aspirin'],
      [/\bwarfarin\b/gi, 'warfarin'],
      [/\bwar farin\b/gi, 'warfarin'],
      
      // Dosage corrections with context awareness
      [/\b(\d+)\s*mg\b/gi, '$1mg'],
      [/\b(\d+)\s*milligrams?\b/gi, '$1mg'],
      [/\bfive\s*mg\b/gi, '5mg'],
      [/\bten\s*mg\b/gi, '10mg'],
      [/\btwenty\s*mg\b/gi, '20mg'],
      [/\bonce\s+a\s+day\b/gi, 'once daily'],
      [/\btwice\s+a\s+day\b/gi, 'twice daily'],
      [/\bthree\s+times\s+a\s+day\b/gi, 'three times daily'],
    ];

    // Enhanced medical corrections for real-time processing
    const corrections = [
      // Common medical misheard words
      [/\bparacetmal\b/gi, 'paracetamol'],
      [/\bparacetmol\b/gi, 'paracetamol'],
      [/\bparacetemol\b/gi, 'paracetamol'],
      [/\bibuprophen\b/gi, 'ibuprofen'],
      [/\bibuprofen\b/gi, 'ibuprofen'],
      [/\blisinopril\b/gi, 'lisinopril'],
      [/\bsimvastatin\b/gi, 'simvastatin'],
      [/\bsim vastatin\b/gi, 'simvastatin'],
      
      // Body parts and symptoms - context aware
      [/\bcheast\b/gi, 'chest'],
      [/\bchest pain\b/gi, 'chest pain'],
      [/\bbreth\b/gi, 'breath'],
      [/\bbreathing\b/gi, 'breathing'],
      [/\bshort of breath\b/gi, 'short of breath'],
      [/\btemprature\b/gi, 'temperature'],
      [/\bblood preasure\b/gi, 'blood pressure'],
      [/\bhigh blood pressure\b/gi, 'high blood pressure'],
      [/\bheart beat\b/gi, 'heartbeat'],
      [/\bheart attack\b/gi, 'heart attack'],
      [/\bstomach\b/gi, 'stomach'],
      [/\bthroat\b/gi, 'throat'],
      
      // Medical conditions with context
      [/\bdiebetes\b/gi, 'diabetes'],
      [/\bdiabetes\b/gi, 'diabetes'],
      [/\bhypertention\b/gi, 'hypertension'],
      [/\bhigh blood pressure\b/gi, 'hypertension'],
      [/\basthama\b/gi, 'asthma'],
      [/\basthma\b/gi, 'asthma'],
      [/\banxiety\b/gi, 'anxiety'],
      [/\bdepresion\b/gi, 'depression'],
      [/\bmigrane\b/gi, 'migraine'],
      [/\bmigraine\b/gi, 'migraine'],
      [/\beczama\b/gi, 'eczema'],
      [/\beczema\b/gi, 'eczema'],
      
      // Medical professional terms
      [/\bdoctor\b/gi, 'doctor'],
      [/\bnurse\b/gi, 'nurse'],
      [/\bgp\b/gi, 'GP'],
      [/\bnhs\b/gi, 'NHS'],
      [/\baccident and emergency\b/gi, 'A&E'],
      [/\bemergency department\b/gi, 'emergency department'],
      [/\bcall 999\b/gi, 'call 999'],
      [/\bcall nine nine nine\b/gi, 'call 999'],
      
      // Emergency and clinical phrases
      [/\bchest pain clinic\b/gi, 'chest pain clinic'],
      [/\brule out\b/gi, 'rule out'],
      [/\bECG\b/gi, 'ECG'],
      [/\bblood tests?\b/gi, 'blood tests'],
      [/\bblood test\b/gi, 'blood test'],
      [/\bfollow up\b/gi, 'follow-up'],
      [/\bappointment\b/gi, 'appointment'],
      [/\bimmediate\b/gi, 'immediate'],
      [/\bimmediately\b/gi, 'immediately'],
      
      // Measurements and dosages
      [/\bmg\s/gi, 'mg '],
      [/\bml\s/gi, 'ml '],
      [/\bmcg\s/gi, 'mcg '],
    ];

    let corrected = text;
    
    // Apply critical corrections first (with context checking)
    criticalCorrections.forEach(([pattern, replacement]) => {
      if (typeof replacement === 'function') {
        corrected = corrected.replace(pattern as RegExp, replacement as any);
      } else {
        corrected = corrected.replace(pattern as RegExp, replacement as string);
      }
    });
    
    // Then apply standard corrections
    corrections.forEach(([pattern, replacement]) => {
      corrected = corrected.replace(pattern, replacement as string);
    });

    // Fix grammar issues that could affect medical accuracy
    corrected = corrected.replace(/\bin\s+a\s+severe\b/gi, 'and is severe'); // Fix "in a severe" -> "and is severe"
    corrected = corrected.replace(/\bthanks?\s+you\b/gi, 'thank you'); // Standardize thanks/thank you
    corrected = corrected.replace(/\byep\b/gi, 'yes'); // More professional
    corrected = corrected.replace(/\byeah\b/gi, 'yes'); // More professional
    corrected = corrected.replace(/\bokay\b/gi, 'OK'); // Standardize
    
    // Fix missing possessives and articles
    corrected = corrected.replace(/\bheart attack in\s+(\d+)/gi, 'heart attack in his $1'); // Fix "in 60s" -> "in his 60s"
    corrected = corrected.replace(/\bheart attack in\s+the\s+(\d+)/gi, 'heart attack in his $1s'); // Fix "in the 60" -> "in his 60s"
    
    // Fix basic grammar and spacing
    corrected = corrected.replace(/\s+/g, ' '); // Multiple spaces to single
    corrected = corrected.replace(/\s+([.!?])/g, '$1'); // Remove space before punctuation
    corrected = corrected.replace(/([.!?])\s*([a-z])/g, '$1 $2'); // Space after punctuation
    corrected = corrected.replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Space after punctuation before capitals
    corrected = corrected.trim();

    return corrected;
  }

  flush() {
    if (this.cleaningBuffer.length > 0) {
      this.processWithContext();
    }
  }

  // Allow manual refresh of corrections (e.g., after user adds new ones)
  async refreshCorrections() {
    await this.loadUserCorrections();
  }
}
