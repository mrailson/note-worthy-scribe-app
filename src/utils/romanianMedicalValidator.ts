interface MedicalTermMapping {
  romanian: string;
  english: string[];
  category: 'diagnosis' | 'medication' | 'procedure' | 'anatomical' | 'measurement';
  commonErrors?: string[];
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  suggestions: string[];
  medicalTermsFound: MedicalTermMapping[];
}

export class RomanianMedicalValidator {
  private static medicalTerms: MedicalTermMapping[] = [
    // Diagnoses
    {
      romanian: 'colecistitâ cronică litiazică',
      english: ['chronic calculous cholecystitis', 'chronic lithiasis cholecystitis'],
      category: 'diagnosis',
      commonErrors: ['chronic lithiasis cholecystitis']
    },
    {
      romanian: 'HTA esentialâ',
      english: ['essential hypertension'],
      category: 'diagnosis'
    },
    {
      romanian: 'dislipidemie mixtă',
      english: ['mixed dyslipidemia'],
      category: 'diagnosis'
    },
    
    // Medications
    {
      romanian: 'Atacand',
      english: ['Atacand', 'Candesartan'],
      category: 'medication',
      commonErrors: ['Atocand']
    },
    {
      romanian: 'Atorvastatină',
      english: ['Atorvastatin'],
      category: 'medication'
    },
    {
      romanian: 'No-Spa',
      english: ['No-Spa', 'Drotaverine'],
      category: 'medication'
    },
    
    // Procedures
    {
      romanian: 'ecografie abdominală',
      english: ['abdominal ultrasound', 'abdominal ultrasonography'],
      category: 'procedure'
    },
    {
      romanian: 'colecistectomie laparoscopică',
      english: ['laparoscopic cholecystectomy'],
      category: 'procedure',
      commonErrors: ['laparoscopic cholestectomie']
    },
    
    // Anatomical terms
    {
      romanian: 'vezică biliară',
      english: ['gallbladder'],
      category: 'anatomical'
    },
    {
      romanian: 'calculi multipli',
      english: ['multiple stones', 'multiple calculi'],
      category: 'anatomical'
    },
    
    // Measurements and lab values
    {
      romanian: 'transaminaze',
      english: ['transaminases'],
      category: 'measurement'
    },
    {
      romanian: 'colesterol total',
      english: ['total cholesterol'],
      category: 'measurement'
    }
  ];

  private static dosagePatterns = [
    { pattern: /(\d+)\s*mg/gi, unit: 'mg', normalRanges: { min: 0.1, max: 2000 } },
    { pattern: /(\d+\.?\d*)\s*mmol\/L/gi, unit: 'mmol/L', normalRanges: { min: 0.1, max: 20 } },
    { pattern: /(\d+)\s*cp\/zi/gi, unit: 'tablets per day', normalRanges: { min: 0.5, max: 10 } }
  ];

  static validateMedicalTranslation(originalText: string, translatedText: string): ValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const medicalTermsFound: MedicalTermMapping[] = [];
    let confidence = 1.0;

    // Check for medical term preservation and accuracy
    this.medicalTerms.forEach(term => {
      const romanianFound = originalText.toLowerCase().includes(term.romanian.toLowerCase());
      
      if (romanianFound) {
        const englishFound = term.english.some(eng => 
          translatedText.toLowerCase().includes(eng.toLowerCase())
        );
        
        if (englishFound) {
          medicalTermsFound.push(term);
        } else {
          // Check for common errors
          const commonErrorFound = term.commonErrors?.some(error =>
            translatedText.toLowerCase().includes(error.toLowerCase())
          );
          
          if (commonErrorFound) {
            warnings.push(`Incorrect translation of "${term.romanian}" - should be one of: ${term.english.join(', ')}`);
            suggestions.push(`Replace incorrect term with: ${term.english[0]}`);
            confidence -= 0.2;
          } else {
            warnings.push(`Medical term "${term.romanian}" may not be properly translated`);
            confidence -= 0.1;
          }
        }
      }
    });

    // Validate dosages and measurements
    const dosageValidation = this.validateDosages(translatedText);
    warnings.push(...dosageValidation.warnings);
    suggestions.push(...dosageValidation.suggestions);
    confidence -= dosageValidation.confidencePenalty;

    // Check for specific known errors
    const errorChecks = this.checkForKnownErrors(translatedText);
    warnings.push(...errorChecks.warnings);
    suggestions.push(...errorChecks.suggestions);
    confidence -= errorChecks.confidencePenalty;

    return {
      isValid: warnings.length === 0,
      confidence: Math.max(0, confidence),
      warnings,
      suggestions,
      medicalTermsFound
    };
  }

  private static validateDosages(text: string): { warnings: string[], suggestions: string[], confidencePenalty: number } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let confidencePenalty = 0;

    this.dosagePatterns.forEach(({ pattern, unit, normalRanges }) => {
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        const value = parseFloat(match[1]);
        
        if (value < normalRanges.min || value > normalRanges.max) {
          warnings.push(`Unusual ${unit} value: ${value} - please verify this is correct`);
          suggestions.push(`Typical ${unit} range is ${normalRanges.min} - ${normalRanges.max}`);
          confidencePenalty += 0.15;
        }
      }
    });

    // Specific checks for common medical value errors
    const cholesterolMatch = text.match(/cholesterol.*?(\d+\.?\d*)\s*mmol\/L/i);
    if (cholesterolMatch) {
      const value = parseFloat(cholesterolMatch[1]);
      if (value > 20) {
        warnings.push(`Extremely high cholesterol value: ${value} mmol/L - likely OCR error (normal range: 3-7 mmol/L)`);
        suggestions.push('Verify if this should be a decimal value (e.g., 6.9 instead of 69)');
        confidencePenalty += 0.3;
      }
    }

    return { warnings, suggestions, confidencePenalty };
  }

  private static checkForKnownErrors(text: string): { warnings: string[], suggestions: string[], confidencePenalty: number } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let confidencePenalty = 0;

    // Check for medication name errors
    if (text.includes('Atocand')) {
      warnings.push('Medication name error: "Atocand" should be "Atacand"');
      suggestions.push('Replace "Atocand" with "Atacand"');
      confidencePenalty += 0.2;
    }

    // Check for duplicated phrases
    const duplicatePattern = /(.{10,})\1/gi;
    if (duplicatePattern.test(text)) {
      warnings.push('Duplicated text detected - possible translation error');
      suggestions.push('Remove duplicate phrases');
      confidencePenalty += 0.15;
    }

    // Check for garbled medical terms
    const garbledTerms = ['ngctalulu', 'cholestectoromie', 'laparoscopico cholestectoromie'];
    garbledTerms.forEach(term => {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        warnings.push(`Garbled medical term detected: "${term}"`);
        suggestions.push('This appears to be an OCR or translation error requiring manual correction');
        confidencePenalty += 0.25;
      }
    });

    // Check for mixed language terms
    const mixedLanguagePattern = /biliară with|per duleri|sevara/gi;
    if (mixedLanguagePattern.test(text)) {
      warnings.push('Mixed language terms detected - incomplete translation');
      suggestions.push('Complete the translation of all terms');
      confidencePenalty += 0.2;
    }

    return { warnings, suggestions, confidencePenalty };
  }

  static getMedicalTermSuggestions(term: string): string[] {
    const suggestions: string[] = [];
    
    this.medicalTerms.forEach(medTerm => {
      if (term.toLowerCase().includes(medTerm.romanian.toLowerCase())) {
        suggestions.push(...medTerm.english);
      }
    });

    return [...new Set(suggestions)];
  }

  static validateMedicalContext(text: string): { isValid: boolean, context: string[], warnings: string[] } {
    const contexts: string[] = [];
    const warnings: string[] = [];

    // Identify medical document type
    if (text.toLowerCase().includes('scrisoare medicală') || text.toLowerCase().includes('medical letter')) {
      contexts.push('medical_discharge_letter');
    }

    if (text.toLowerCase().includes('diagnostic') || text.toLowerCase().includes('diagnosis')) {
      contexts.push('diagnostic_information');
    }

    if (text.toLowerCase().includes('tratament') || text.toLowerCase().includes('treatment')) {
      contexts.push('treatment_plan');
    }

    if (text.toLowerCase().includes('recomandări') || text.toLowerCase().includes('recommendations')) {
      contexts.push('medical_recommendations');
    }

    // Check for context consistency
    if (contexts.length === 0) {
      warnings.push('Unable to identify medical document context');
    }

    return {
      isValid: contexts.length > 0,
      context: contexts,
      warnings
    };
  }
}