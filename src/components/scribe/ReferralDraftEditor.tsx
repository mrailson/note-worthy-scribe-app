import React from 'react';
import { ReferralDraft, ToneVersion } from '@/types/referral';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Sparkles, 
  ChevronDown,
  MessageSquare,
  Minimize2,
  PhoneCall
} from 'lucide-react';

interface ReferralDraftEditorProps {
  draft: ReferralDraft;
  onContentChange: (content: string) => void;
  onToneRewrite: (tone: 'friendly' | 'concise' | 'add-availability' | 'formal') => void;
  onSafetyNettingChange: (given: boolean) => void;
  isRewriting: boolean;
}

export function ReferralDraftEditor({
  draft,
  onContentChange,
  onToneRewrite,
  onSafetyNettingChange,
  isRewriting
}: ReferralDraftEditorProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Referral to {draft.recipientService}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={isRewriting}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isRewriting ? 'Rewriting...' : 'Adjust Tone'}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToneRewrite('friendly')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                More Friendly
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToneRewrite('concise')}>
                <Minimize2 className="h-4 w-4 mr-2" />
                More Concise
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToneRewrite('add-availability')}>
                <PhoneCall className="h-4 w-4 mr-2" />
                Add: I'm Available to Discuss
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Editable letter content */}
        <div className="flex-1 min-h-0">
          <Textarea
            value={draft.letterContent}
            onChange={(e) => onContentChange(e.target.value)}
            className="h-full min-h-[300px] resize-none font-mono text-sm"
            placeholder="Referral letter content..."
          />
        </div>

        {/* Safety netting checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="safety-netting"
            checked={draft.safetyNettingGiven}
            onCheckedChange={(checked) => onSafetyNettingChange(!!checked)}
          />
          <Label 
            htmlFor="safety-netting" 
            className="text-sm cursor-pointer"
          >
            Safety-netting advice given to patient
          </Label>
        </div>

        {/* Tone indicator */}
        {draft.toneVersion !== 'neutral' && (
          <p className="text-xs text-muted-foreground">
            Current tone: <span className="font-medium capitalize">{draft.toneVersion}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
