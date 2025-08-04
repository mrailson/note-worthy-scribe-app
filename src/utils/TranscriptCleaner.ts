export class TranscriptCleaner {
  // Clinical-grade transcript post-processing for medical accuracy
  
  static async cleanTranscript(rawTranscript: string, meetingTitle?: string): Promise<string> {
    try {
      console.log('🧹 Starting clinical transcript cleaning...');
      
      // Use the clean-transcript edge function for comprehensive cleaning
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/clean-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
        },
        body: JSON.stringify({ 
          rawTranscript,
          meetingTitle: meetingTitle || 'Clinical Consultation'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Transcript cleaned successfully');
        return result.cleanedTranscript || rawTranscript;
      } else {
        console.warn('⚠️ Cleaning service unavailable, using local cleaning');
        return this.localClean(rawTranscript);
      }
    } catch (error) {
      console.error('❌ Error cleaning transcript:', error);
      return this.localClean(rawTranscript);
    }
  }

  private static localClean(text: string): string {
    // Local fallback cleaning for clinical accuracy
    
    // Remove repetitive filler words and sounds
    text = text.replace(/\b(um|uh|ah|er|mm|hmm)\b/gi, '');
    text = text.replace(/\b(like|you know|sort of|kind of)\b/gi, '');
    
    // Fix common medical transcription errors
    const medicalCorrections = [
      // Medication names
      [/\baspring\b/gi, 'aspirin'],
      [/\bparacetmal\b/gi, 'paracetamol'],
      [/\bibuprophen\b/gi, 'ibuprofen'],
      [/\bamethomine\b/gi, 'metformin'],
      [/\bramapril\b/gi, 'ramipril'],
      [/\blisinopril\b/gi, 'lisinopril'],
      
      // Body parts and symptoms
      [/\bcheast\b/gi, 'chest'],
      [/\bbreth\b/gi, 'breath'],
      [/\bbreathing\b/gi, 'breathing'],
      [/\btemprature\b/gi, 'temperature'],
      [/\bblood preasure\b/gi, 'blood pressure'],
      [/\bheart beat\b/gi, 'heartbeat'],
      
      // Medical terms
      [/\bdiebetes\b/gi, 'diabetes'],
      [/\bhypertention\b/gi, 'hypertension'],
      [/\basthama\b/gi, 'asthma'],
      [/\banxiety\b/gi, 'anxiety'],
      [/\bdepresion\b/gi, 'depression'],
      
      // Time and measurements
      [/\bmg\s/gi, 'mg '],
      [/\bml\s/gi, 'ml '],
      [/\bonce daily\b/gi, 'once daily'],
      [/\btwice daily\b/gi, 'twice daily'],
      [/\bthree times a day\b/gi, 'three times daily'],
      
      // Common misheard words in clinical context
      [/\bpatients\b/gi, 'patient'],
      [/\bdoctor\b/gi, 'doctor'],
      [/\bnurse\b/gi, 'nurse'],
      [/\bgp\b/gi, 'GP'],
      [/\bnhs\b/gi, 'NHS'],
      [/\baccident and emergency\b/gi, 'A&E'],
      [/\bemergency department\b/gi, 'emergency department']
    ];

    // Apply medical corrections
    medicalCorrections.forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement as string);
    });

    // Fix sentence structure
    text = text.replace(/\s+/g, ' '); // Multiple spaces to single
    text = text.replace(/\s+([.!?])/g, '$1'); // Remove space before punctuation
    text = text.replace(/([.!?])\s*([a-z])/g, '$1 $2'); // Space after punctuation
    
    // Capitalize sentences properly
    text = text.replace(/(^|\. )([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    // Ensure proper ending punctuation
    text = text.trim();
    if (text.length > 0 && !/[.!?]$/.test(text)) {
      text += '.';
    }

    return text;
  }

  static createBufferedCleaner(onCleanedTranscript: (text: string) => void, bufferTime = 5000) {
    let buffer: string[] = [];
    let timer: NodeJS.Timeout | null = null;

    return {
      addText: (text: string) => {
        buffer.push(text);
        
        if (timer) clearTimeout(timer);
        
        timer = setTimeout(async () => {
          if (buffer.length > 0) {
            const combined = buffer.join(' ');
            const cleaned = await TranscriptCleaner.cleanTranscript(combined);
            onCleanedTranscript(cleaned);
            buffer = [];
          }
        }, bufferTime);
      },
      
      flush: async () => {
        if (timer) clearTimeout(timer);
        if (buffer.length > 0) {
          const combined = buffer.join(' ');
          const cleaned = await TranscriptCleaner.cleanTranscript(combined);
          onCleanedTranscript(cleaned);
          buffer = [];
        }
      }
    };
  }
}