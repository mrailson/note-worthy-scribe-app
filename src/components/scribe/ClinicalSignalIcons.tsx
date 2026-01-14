import { Pill, Brain, AlertTriangle, RotateCw, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ClinicalSignal } from "@/utils/clinicalHeadlineGenerator";

interface ClinicalSignalIconsProps {
  signals: ClinicalSignal[];
  size?: 'sm' | 'md';
  className?: string;
}

const SIGNAL_CONFIG: Record<ClinicalSignal, {
  icon: typeof Pill;
  label: string;
  colorClass: string;
}> = {
  medication: {
    icon: Pill,
    label: 'Medication change',
    colorClass: 'text-blue-600 dark:text-blue-400',
  },
  mentalHealth: {
    icon: Brain,
    label: 'Mental health',
    colorClass: 'text-purple-600 dark:text-purple-400',
  },
  safetyNet: {
    icon: AlertTriangle,
    label: 'Safety-netting given',
    colorClass: 'text-amber-600 dark:text-amber-400',
  },
  followUp: {
    icon: RotateCw,
    label: 'Follow-up required',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
  },
  letter: {
    icon: FileText,
    label: 'Letter/referral generated',
    colorClass: 'text-slate-600 dark:text-slate-400',
  },
};

// Order of signal display (most clinically relevant first)
const SIGNAL_ORDER: ClinicalSignal[] = ['medication', 'mentalHealth', 'safetyNet', 'followUp', 'letter'];

export function ClinicalSignalIcons({ signals, size = 'sm', className }: ClinicalSignalIconsProps) {
  if (signals.length === 0) return null;
  
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  
  // Sort signals by clinical relevance order
  const sortedSignals = [...signals].sort(
    (a, b) => SIGNAL_ORDER.indexOf(a) - SIGNAL_ORDER.indexOf(b)
  );
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {sortedSignals.map((signal) => {
        const config = SIGNAL_CONFIG[signal];
        const Icon = config.icon;
        
        return (
          <Tooltip key={signal}>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center justify-center", config.colorClass)}>
                <Icon className={iconSize} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {config.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Get the dominant signal for border coloring
 */
export function getDominantSignalColor(signals: ClinicalSignal[]): string {
  if (signals.length === 0) return 'border-l-muted';
  
  // Priority: medication > mentalHealth > safetyNet > followUp > letter
  if (signals.includes('medication')) return 'border-l-blue-500';
  if (signals.includes('mentalHealth')) return 'border-l-purple-500';
  if (signals.includes('safetyNet')) return 'border-l-amber-500';
  if (signals.includes('followUp')) return 'border-l-emerald-500';
  if (signals.includes('letter')) return 'border-l-slate-500';
  
  return 'border-l-muted';
}
