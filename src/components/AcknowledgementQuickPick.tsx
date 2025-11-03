import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSub, 
  DropdownMenuSubContent, 
  DropdownMenuSubTrigger, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wand2, Loader2 } from "lucide-react";

interface AcknowledgementQuickPickProps {
  currentLetter: string;
  onLetterChange: (newLetter: string) => void;
  complaintId: string;
  complaintDescription: string;
  referenceNumber: string;
}

export function AcknowledgementQuickPick({ 
  currentLetter, 
  onLetterChange,
  complaintId,
  complaintDescription,
  referenceNumber
}: AcknowledgementQuickPickProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const quickPickOptions = {
    tone: {
      'more-empathetic': 'Enhance empathetic language throughout the letter. Show deeper understanding of the patient\'s experience and concerns. Use warmer, more compassionate phrasing whilst maintaining professionalism.',
      'more-apologetic': 'Strengthen the apology and acknowledgement of distress caused. Express deeper regret for the experience whilst remaining appropriate and professional.',
      'more-formal': 'Increase the professional tone and use more formal NHS language. Elevate the formality of phrasing and structure.',
      'warmer-personal': 'Add a personal touch to the letter whilst maintaining professional standards. Make the tone warmer and more human, showing genuine care and understanding.'
    },
    length: {
      'more-concise': 'Reduce the length of the letter whilst keeping all essential information. Make it more concise and easier to read without losing key details.',
      'add-detail': 'Expand on the investigation process and provide more detail about what the complainant can expect during the handling of their complaint. Add helpful context about next steps.'
    },
    content: {
      'strengthen-process': 'Emphasise the thoroughness and fairness of the complaint investigation process. Provide more reassurance about how seriously the complaint is being taken and the rigour of the investigation.',
      'emphasise-resolution': 'Highlight the practice\'s commitment to resolving the concerns raised and learning from the feedback. Show dedication to improvement.',
      'clarify-timelines': 'Make the response timelines and expectations clearer. Provide specific details about when the complainant can expect updates and the final response.',
      'simplify-language': 'Simplify the language to make it more accessible and easier to understand. Use plainer English whilst maintaining professionalism and all necessary information.'
    }
  };

  const handleQuickPick = async (option: string) => {
    if (!currentLetter.trim()) {
      toast.error("No letter content to modify");
      return;
    }

    setIsProcessing(true);
    
    try {
      const instructions = Object.values(quickPickOptions).flatMap(category => 
        Object.entries(category)
      ).find(([key]) => key === option)?.[1];

      if (!instructions) {
        throw new Error('Invalid quick pick option');
      }

      const { data, error } = await supabase.functions.invoke('regenerate-acknowledgement-letter', {
        body: {
          complaintId,
          currentLetter,
          instructions,
          complaintDescription,
          referenceNumber
        }
      });

      if (error) {
        if (error.message.includes('Rate limits exceeded')) {
          toast.error('Rate limits exceeded. Please try again later.');
          return;
        }
        if (error.message.includes('Payment required')) {
          toast.error('Payment required. Please add credits to your Lovable AI workspace.');
          return;
        }
        throw error;
      }
      
      if (data.error) throw new Error(data.error);

      if (data.regeneratedLetter) {
        onLetterChange(data.regeneratedLetter);
        toast.success(`Applied: ${option.replace(/-/g, ' ')}`);
      } else {
        throw new Error('No content generated');
      }
    } catch (error) {
      console.error('Quick pick error:', error);
      toast.error(error instanceof Error ? error.message : 'Quick pick modification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-1" />
              Quick Pick
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Tone & Style */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Tone & Style</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('more-empathetic')}
              className="cursor-pointer"
            >
              Make More Empathetic
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('more-apologetic')}
              className="cursor-pointer"
            >
              Make More Apologetic
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('more-formal')}
              className="cursor-pointer"
            >
              Make More Formal
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('warmer-personal')}
              className="cursor-pointer"
            >
              Make Warmer & Personal
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Length & Detail */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Length & Detail</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('more-concise')}
              className="cursor-pointer"
            >
              Make More Concise
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('add-detail')}
              className="cursor-pointer"
            >
              Add More Detail
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Content Enhancement */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Content Enhancement</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('strengthen-process')}
              className="cursor-pointer"
            >
              Strengthen Process Reassurance
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('emphasise-resolution')}
              className="cursor-pointer"
            >
              Emphasise Resolution Commitment
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('clarify-timelines')}
              className="cursor-pointer"
            >
              Clarify Timelines
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQuickPick('simplify-language')}
              className="cursor-pointer"
            >
              Simplify Language
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
