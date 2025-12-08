import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FileText } from 'lucide-react';

interface BPTextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const BPTextInput = ({ value, onChange, disabled }: BPTextInputProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Paste Email or Text</CardTitle>
        </div>
        <CardDescription>
          Paste the entire email content or any text containing BP readings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Example formats accepted:
• 140/90
• BP: 140/90/72 (with pulse)
• Sys 140 Dia 90
• Mon: 142/88, Tue: 138/85
• Blood pressure reading: 140 over 90

Paste the full email content here...`}
          className="min-h-[500px] font-mono text-sm resize-y"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground mt-2">
          The system will automatically identify and extract BP readings from the text
        </p>
      </CardContent>
    </Card>
  );
};
