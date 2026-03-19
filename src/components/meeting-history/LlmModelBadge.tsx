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
  'claude-opus-4-6': {
    label: 'Claude Opus 4.6',
    className: 'bg-purple-700 hover:bg-purple-700 text-white',
  },
};

export const LlmModelBadge = ({ meetingId }: LlmModelBadgeProps) => {
  const modelKey = localStorage.getItem(`meeting-llm-used-${meetingId}`);
  if (!modelKey) return null;

  const model = MODEL_LABELS[modelKey] || { label: modelKey, className: 'bg-muted text-muted-foreground' };

  return (
    <Badge className={`gap-1 cursor-default text-xs ${model.className}`}>
      <Brain className="h-3 w-3" />
      {model.label}
    </Badge>
  );
};
