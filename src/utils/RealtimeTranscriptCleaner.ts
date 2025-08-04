export class RealtimeTranscriptCleaner {
  private previousTranscripts: string[] = [];
  private cleaningBuffer: string[] = [];
  private lastCleanTime = Date.now();
  
  constructor(
    private onCleanedTranscript: (cleaned: string, context: string) => void
  ) {}

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
    // First apply local medical corrections
    let cleaned = this.applyMedicalCorrections(text);
    
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
    // Enhanced medical corrections for real-time processing
    const corrections = [
      // Common medical misheard words
      [/\basprin\b/gi, 'aspirin'],
      [/\bparacetmal\b/gi, 'paracetamol'],
      [/\bibuprophen\b/gi, 'ibuprofen'],
      [/\bametformin\b/gi, 'metformin'],
      [/\bramapril\b/gi, 'ramipril'],
      [/\blisinopril\b/gi, 'lisinopril'],
      [/\bsimvastatin\b/gi, 'simvastatin'],
      
      // Body parts and symptoms
      [/\bcheast\b/gi, 'chest'],
      [/\bbreth\b/gi, 'breath'],
      [/\bbreathing\b/gi, 'breathing'],
      [/\btemprature\b/gi, 'temperature'],
      [/\bblood preasure\b/gi, 'blood pressure'],
      [/\bheart beat\b/gi, 'heartbeat'],
      [/\bstomach\b/gi, 'stomach'],
      [/\bthroat\b/gi, 'throat'],
      
      // Medical conditions
      [/\bdiebetes\b/gi, 'diabetes'],
      [/\bhypertention\b/gi, 'hypertension'],
      [/\basthama\b/gi, 'asthma'],
      [/\banxiety\b/gi, 'anxiety'],
      [/\bdepresion\b/gi, 'depression'],
      [/\bmigrane\b/gi, 'migraine'],
      [/\beczama\b/gi, 'eczema'],
      
      // Medical professional terms
      [/\bdoctor\b/gi, 'doctor'],
      [/\bnurse\b/gi, 'nurse'],
      [/\bgp\b/gi, 'GP'],
      [/\bnhs\b/gi, 'NHS'],
      [/\baccident and emergency\b/gi, 'A&E'],
      [/\bemergency department\b/gi, 'emergency department'],
      
      // Measurements and dosages
      [/\bmg\s/gi, 'mg '],
      [/\bml\s/gi, 'ml '],
      [/\bmcg\s/gi, 'mcg '],
      [/\bonce daily\b/gi, 'once daily'],
      [/\btwice daily\b/gi, 'twice daily'],
      [/\bthree times a day\b/gi, 'three times daily'],
      [/\bfour times a day\b/gi, 'four times daily'],
      
      // Common clinical phrases
      [/\btake as needed\b/gi, 'take as needed'],
      [/\bwith food\b/gi, 'with food'],
      [/\bon empty stomach\b/gi, 'on empty stomach'],
      [/\bfollow up\b/gi, 'follow up'],
      [/\bappointment\b/gi, 'appointment'],
    ];

    let corrected = text;
    corrections.forEach(([pattern, replacement]) => {
      corrected = corrected.replace(pattern, replacement as string);
    });

    // Fix basic grammar and spacing
    corrected = corrected.replace(/\s+/g, ' '); // Multiple spaces to single
    corrected = corrected.replace(/\s+([.!?])/g, '$1'); // Remove space before punctuation
    corrected = corrected.replace(/([.!?])\s*([a-z])/g, '$1 $2'); // Space after punctuation
    corrected = corrected.trim();

    return corrected;
  }

  flush() {
    if (this.cleaningBuffer.length > 0) {
      this.processWithContext();
    }
  }
}
