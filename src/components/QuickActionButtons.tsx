import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface QuickActionButtonsProps {
  content: string;
  onQuickResponse: (response: string) => void;
  className?: string;
}

interface QuickAction {
  type: 'yes-no' | 'options' | 'follow-up';
  question?: string;
  options?: string[];
  followUps?: string[];
}

const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  content,
  onQuickResponse,
  className = ""
}) => {
  // Analyze content to detect actionable patterns
  const detectQuickActions = (text: string): QuickAction | null => {
    const lowerText = text.toLowerCase();
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    
    // Look for yes/no questions in the last few sentences
    const lastSentences = sentences.slice(-3);
    for (const sentence of lastSentences) {
      const lowerSentence = sentence.toLowerCase();
      
      // Detect "Would you like me to..." patterns
      if (lowerSentence.includes('would you like me to') || 
          lowerSentence.includes('do you want me to') ||
          lowerSentence.includes('should i') ||
          lowerSentence.includes('would you prefer') ||
          lowerSentence.includes('shall i')) {
        return {
          type: 'yes-no',
          question: sentence.trim()
        };
      }
      
      // Detect option-based questions
      if (lowerSentence.includes('would you prefer') && 
          (lowerSentence.includes(' or ') || lowerSentence.includes('either'))) {
        // Extract options from the sentence
        const optionMatch = sentence.match(/(?:would you prefer|choose between|either)\s+(.*?)(?:\?|$)/i);
        if (optionMatch) {
          const optionsText = optionMatch[1];
          const options = optionsText.split(/ or | vs | versus /).map(opt => opt.trim());
          if (options.length >= 2) {
            return {
              type: 'options',
              question: sentence.trim(),
              options: options.slice(0, 3) // Limit to 3 options
            };
          }
        }
      }
    }
    
    // Look for follow-up suggestions patterns
    const followUpPatterns = [
      /(?:i can also|i could also|you might also want to|consider also) (.*?)(?:[.!?]|$)/gi,
      /(?:other options include|alternatives include|you could also) (.*?)(?:[.!?]|$)/gi
    ];
    
    for (const pattern of followUpPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const followUps = matches.map(match => match[1].trim()).slice(0, 3);
        return {
          type: 'follow-up',
          followUps
        };
      }
    }
    
    return null;
  };

  const quickAction = detectQuickActions(content);
  
  if (!quickAction) {
    return null;
  }

  const handleQuickResponse = (response: string) => {
    onQuickResponse(response);
  };

  return (
    <div className={`mt-3 pt-3 border-t border-border/20 animate-fade-in ${className}`}>
      <div className="flex flex-wrap gap-2">
        {quickAction.type === 'yes-no' && (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleQuickResponse('Yes, please do that.')}
              className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-3 w-3 mr-1" />
              Yes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickResponse('No, thank you.')}
              className="h-7 px-3 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              No
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickResponse(`You are being asked to validate your previous reply.
Do not generate new advice or speculate. Instead:

**Confirm Sources**
Identify the exact primary sources you used.
Prioritise:
• NICE guidelines
• NHS.uk
• BNF (Medicines Complete/NICE)
• MHRA alerts
• Green Book (immunisations)
• UKHSA
• ICB / NHS England official documents
Provide direct URLs to the relevant guidance/documents.

**Evidence & Reasoning**
Show the logic you followed step-by-step.
Explicitly link each conclusion to a cited source.
If no source exists, state clearly: "No NHS or NICE source available – this part is uncertain/speculative."

**Confidence Level**
Rate overall confidence in your previous reply:
• High – directly supported by explicit NHS/NICE wording.
• Medium – some interpretation required, but evidence reasonably strong.
• Low – no direct NHS/NICE guidance, answer inferred from indirect or outdated evidence.

**Corrections (if needed)**
If your original reply was inaccurate or incomplete, correct it now using cited evidence.
Mark clearly: "Correction:" followed by the updated evidence-based reply.

Output should be structured like this:
**Validation Report**
-----------------
**Sources:** [list with URLs]
**Evidence & Reasoning:** [step-by-step explanation]
**Confidence Level:** [High / Medium / Low]
**Corrections:** [if any]`)}
              className="h-7 px-3 text-xs ml-2"
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              I need proof this is right
            </Button>
          </>
        )}
        
        {quickAction.type === 'options' && quickAction.options && (
          <>
            {quickAction.options.map((option, index) => (
              <Button
                key={index}
                variant={index === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickResponse(`I choose: ${option}`)}
                className="h-7 px-3 text-xs"
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                {option.length > 20 ? `${option.substring(0, 20)}...` : option}
              </Button>
            ))}
          </>
        )}
        
        {quickAction.type === 'follow-up' && quickAction.followUps && (
          <>
            {quickAction.followUps.map((followUp, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickResponse(`Tell me more about: ${followUp}`)}
                className="h-7 px-3 text-xs opacity-70 hover:opacity-100"
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                {followUp.length > 25 ? `${followUp.substring(0, 25)}...` : followUp}
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default QuickActionButtons;