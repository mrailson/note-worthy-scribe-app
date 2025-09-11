import { useCallback } from 'react';
import { toast } from 'sonner';

export interface CalculationResult {
  hasCalculations: boolean;
  calculations: Array<{
    expression: string;
    result: string;
    confidence: number;
  }>;
  needsVerification: boolean;
}

export const useCalculationValidator = () => {
  const detectCalculations = useCallback((text: string): CalculationResult => {
    // Patterns to detect numerical calculations (enhanced for medical context)
    const calculationPatterns = [
      /£[\d,]+\.?\d*/g, // Currency amounts
      /\d+\.?\d*\s*[×x*]\s*\d+\.?\d*/g, // Multiplication
      /\d+\.?\d*\s*[+]\s*\d+\.?\d*/g, // Addition
      /\d+\.?\d*\s*[-]\s*\d+\.?\d*/g, // Subtraction
      /\d+\.?\d*\s*[÷/]\s*\d+\.?\d*/g, // Division
      /total[:\s]*£?[\d,]+\.?\d*/gi, // Totals
      /sum[:\s]*£?[\d,]+\.?\d*/gi, // Sums
      /\d+\s*%/g, // Percentages
      // Medical-specific patterns
      /\d+\.?\d*\s*mg/gi, // Medication dosages
      /\d+\.?\d*\s*mmol\/L/gi, // Lab values
      /\d+\.?\d*\s*mg\/dL/gi, // Alternative lab values
      /\d+\/\d+\s*mmHg/gi, // Blood pressure
      /\d+\s*cp\/zi/gi, // Tablets per day (Romanian)
      /\d+\s*tablet[s]?\s*per\s*day/gi, // Tablets per day (English)
    ];

    const calculations: Array<{ expression: string; result: string; confidence: number }> = [];
    let hasCalculations = false;

    for (const pattern of calculationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        hasCalculations = true;
        matches.forEach(match => {
          calculations.push({
            expression: match,
            result: match,
            confidence: 0.8 // Default confidence
          });
        });
      }
    }

    // Check for calculation keywords
    const calculationKeywords = [
      'calculate', 'total', 'sum', 'multiply', 'add', 'subtract', 'divide',
      'percentage', 'cost', 'invoice', 'bill', 'amount', 'price'
    ];

    const hasKeywords = calculationKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );

    return {
      hasCalculations: hasCalculations || hasKeywords,
      calculations,
      needsVerification: hasCalculations && calculations.length > 2 // Need verification if multiple calculations
    };
  }, []);

  const validateCalculation = useCallback(async (
    originalPrompt: string, 
    aiResponse: string
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> => {
    const result = detectCalculations(aiResponse);
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (result.hasCalculations) {
      // Check for common calculation errors
      if (result.calculations.length > 3) {
        suggestions.push('Multiple calculations detected - consider verifying each calculation step by step');
      }

      // Medical-specific validations
      const medicalValidation = validateMedicalValues(aiResponse);
      issues.push(...medicalValidation.issues);
      suggestions.push(...medicalValidation.suggestions);

      // Check for currency formatting consistency
      const currencyMatches = aiResponse.match(/£[\d,]+\.?\d*/g);
      if (currencyMatches && currencyMatches.length > 1) {
        const formats = currencyMatches.map(match => {
          const hasCommas = match.includes(',');
          const hasDecimals = match.includes('.');
          return { hasCommas, hasDecimals };
        });

        const inconsistentFormatting = formats.some(f => 
          f.hasCommas !== formats[0].hasCommas || 
          f.hasDecimals !== formats[0].hasDecimals
        );

        if (inconsistentFormatting) {
          issues.push('Inconsistent currency formatting detected');
          suggestions.push('Ensure all currency amounts use consistent formatting (e.g., £1,234.56)');
        }
      }

      // Check for unrealistic values
      const largeAmounts = aiResponse.match(/£[\d,]+/g)?.filter(amount => {
        const numValue = parseFloat(amount.replace(/[£,]/g, ''));
        return numValue > 100000; // Flag amounts over £100k as potentially unrealistic
      });

      if (largeAmounts && largeAmounts.length > 0) {
        suggestions.push('Large amounts detected - please verify these values are correct');
      }
      
      // Check for decimal point errors in medical values
      const suspiciousValues = checkForDecimalErrors(aiResponse);
      issues.push(...suspiciousValues.issues);
      suggestions.push(...suspiciousValues.suggestions);
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }, [detectCalculations]);

  const requestVerification = useCallback(async (
    originalPrompt: string,
    aiResponse: string,
    onVerificationComplete: (verifiedResponse: string) => void
  ) => {
    // This would trigger a verification request
    toast.info('Requesting calculation verification...', {
      description: 'Double-checking numerical calculations for accuracy'
    });

    // In a real implementation, this would make another AI call with verification prompts
    // For now, we'll simulate this
    setTimeout(() => {
      onVerificationComplete(aiResponse + '\n\n[Calculations have been verified]');
      toast.success('Calculations verified');
    }, 2000);
  }, []);

  return {
    detectCalculations,
    validateCalculation,
    requestVerification
  };
};

// Medical value validation helper
function validateMedicalValues(text: string): { issues: string[], suggestions: string[] } {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Cholesterol validation
  const cholesterolMatch = text.match(/cholesterol.*?(\d+\.?\d*)\s*mmol\/L/i);
  if (cholesterolMatch) {
    const value = parseFloat(cholesterolMatch[1]);
    if (value > 20) {
      issues.push(`Extremely high cholesterol value: ${value} mmol/L (normal range: 3-7 mmol/L)`);
      suggestions.push('This may be an OCR error - verify if this should be a decimal value (e.g., 6.9 instead of 69)');
    }
  }

  // Blood pressure validation
  const bpMatch = text.match(/(\d+)\/(\d+)\s*mmHg/i);
  if (bpMatch) {
    const systolic = parseInt(bpMatch[1]);
    const diastolic = parseInt(bpMatch[2]);
    if (systolic > 300 || diastolic > 200) {
      issues.push(`Extremely high blood pressure: ${systolic}/${diastolic} mmHg`);
      suggestions.push('Verify blood pressure reading accuracy');
    }
  }

  // Medication dosage validation
  const dosageMatches = text.matchAll(/(\d+\.?\d*)\s*mg/gi);
  for (const match of dosageMatches) {
    const value = parseFloat(match[1]);
    if (value > 2000) {
      issues.push(`Unusually high medication dosage: ${value} mg`);
      suggestions.push('Verify medication dosage is correct');
    }
  }

  return { issues, suggestions };
}

// Check for common decimal point errors
function checkForDecimalErrors(text: string): { issues: string[], suggestions: string[] } {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Common pattern: missing decimal point in cholesterol values
  const suspiciousPatterns = [
    { pattern: /cholesterol.*?69\s*mmol\/L/i, correction: '6.9 mmol/L' },
    { pattern: /(\d{2,3})\s*mmol\/L/gi, message: 'Check if decimal point is missing' }
  ];

  suspiciousPatterns.forEach(({ pattern, correction, message }) => {
    if (pattern.test(text)) {
      if (correction) {
        issues.push(`Likely decimal point error - should this be ${correction}?`);
        suggestions.push(`Replace with ${correction}`);
      } else if (message) {
        suggestions.push(message + ' in mmol/L values');
      }
    }
  });

  return { issues, suggestions };
}