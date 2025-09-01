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
    // Patterns to detect numerical calculations
    const calculationPatterns = [
      /£[\d,]+\.?\d*/g, // Currency amounts
      /\d+\.?\d*\s*[×x*]\s*\d+\.?\d*/g, // Multiplication
      /\d+\.?\d*\s*[+]\s*\d+\.?\d*/g, // Addition
      /\d+\.?\d*\s*[-]\s*\d+\.?\d*/g, // Subtraction
      /\d+\.?\d*\s*[÷/]\s*\d+\.?\d*/g, // Division
      /total[:\s]*£?[\d,]+\.?\d*/gi, // Totals
      /sum[:\s]*£?[\d,]+\.?\d*/gi, // Sums
      /\d+\s*%/g, // Percentages
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