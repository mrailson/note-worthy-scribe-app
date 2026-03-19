import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";

interface LlmModelBadgeProps {
  meetingId: string;
}

const MODEL_LABELS: Record<string, { label: string; className: string }> = {
  'gemini-3-flash': {
    label: 'Gemini 3 Flash',
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  'claude-sonnet-4-6': {
    label: 'Claude Sonnet 4.6',
    className: 'bg-amber-600 hover:bg-amber-600 text-white',
  },
};

export const LlmModelBadge = ({ meetingId }: LlmModelBadgeProps) => {
  // Show stored model, or default to Gemini (all existing meetings used Gemini)
  const modelKey = localStorage.getItem(`meeting-llm-used-${meetingId}`) || 'gemini-3-flash';
  const model = MODEL_LABELS[modelKey] || { label: modelKey, className: 'bg-muted text-muted-foreground' };

  return (
    <Badge className={`gap-1 cursor-default text-xs ${model.className}`}>
      <Brain className="h-3 w-3" />
      {model.label}
    </Badge>
  );
};
