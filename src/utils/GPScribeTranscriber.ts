export class GPScribeTranscriber {
  private isActive = false;
  private consultationContext: string = '';

  constructor(
    private onTranscript: (transcript: string) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription(consultationType: 'face-to-face' | 'telephone' | 'video' = 'face-to-face') {
    try {
      this.isActive = true;
      this.consultationContext = consultationType;
      
      this.onStatusChange('Initializing consultation transcription...');
      console.log(`🩺 Starting GP Scribe transcription for ${consultationType} consultation`);
      
      // Consultation-specific initialization
      await this.initializeConsultationTranscription();
      
      this.onStatusChange('Ready for consultation transcription');
      
    } catch (error) {
      console.error('Failed to start GP Scribe transcription:', error);
      this.onError(`Transcription initialization failed: ${error.message}`);
    }
  }

  private async initializeConsultationTranscription() {
    // Set up consultation-specific transcription context
    console.log('🔧 Configuring transcription for medical consultation...');
    
    // Medical terminology optimizations would go here
    // This could include:
    // - Medical vocabulary enhancements
    // - Symptom keyword recognition
    // - Drug name pronunciation models
    // - Medical abbreviation expansion
    
    console.log('✅ Consultation transcription configured');
  }

  async processConsultationAudio(audioData: string): Promise<string> {
    if (!this.isActive) {
      throw new Error('Transcription not active');
    }

    try {
      this.onStatusChange('Transcribing consultation audio...');
      
      // Use consultation-specific transcription endpoint
      const response = await fetch('https://dphcnbricafkbtizkoal.supabase.co/functions/v1/speech-to-text-consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`
        },
        body: JSON.stringify({ 
          audio: audioData,
          consultationType: this.consultationContext,
          enhanceMedicalTerms: true 
        })
      });

      if (!response.ok) {
        throw new Error(`Consultation transcription failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.text) {
        const transcribedText = this.enhanceConsultationTranscript(result.text);
        this.onTranscript(transcribedText);
        this.onStatusChange('Consultation transcribed');
        return transcribedText;
      }
      
      throw new Error('No transcription result received');
      
    } catch (error) {
      console.error('GP Scribe transcription error:', error);
      this.onError(`Transcription failed: ${error.message}`);
      throw error;
    }
  }

  private enhanceConsultationTranscript(text: string): string {
    // Medical consultation-specific enhancements
    let enhanced = text;

    // Common medical abbreviations and corrections
    const medicalCorrections = {
      'bee pee': 'BP',
      'heart rate': 'HR', 
      'temperature': 'temp',
      'milligrams': 'mg',
      'milliliters': 'ml',
      'paracetamol': 'paracetamol',
      'ibuprofen': 'ibuprofen',
      'chest pain': 'chest pain',
      'shortness of breath': 'SOB',
      'nausea and vomiting': 'N&V'
    };

    // Apply medical corrections
    Object.entries(medicalCorrections).forEach(([original, corrected]) => {
      const regex = new RegExp(original, 'gi');
      enhanced = enhanced.replace(regex, corrected);
    });

    // Capitalize medical terms
    const medicalTerms = [
      'ECG', 'EKG', 'BP', 'HR', 'BMI', 'NHS', 'GP', 'A&E', 'ICU', 'CCU',
      'paracetamol', 'ibuprofen', 'aspirin', 'insulin', 'metformin'
    ];

    medicalTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      enhanced = enhanced.replace(regex, term.toUpperCase());
    });

    console.log('🩺 Enhanced consultation transcript for medical terminology');
    return enhanced;
  }

  stopTranscription() {
    this.isActive = false;
    this.onStatusChange('Consultation transcription stopped');
    console.log('🛑 GP Scribe transcription stopped');
  }

  isTranscriptionActive(): boolean {
    return this.isActive;
  }

  getConsultationContext(): string {
    return this.consultationContext;
  }

  // Consultation-specific helpers
  setConsultationType(type: 'face-to-face' | 'telephone' | 'video') {
    this.consultationContext = type;
    console.log(`🔄 Consultation type updated to: ${type}`);
  }

  // Process medical terminology for better recognition
  preprocessMedicalAudio(audioData: string): string {
    // This could include audio preprocessing specific to medical consultations
    // such as noise reduction for clinical environments, frequency adjustments
    // for medical equipment sounds, etc.
    
    console.log('🔧 Preprocessing audio for medical consultation context');
    return audioData;
  }
}