import { FileSearch, Brain, CheckCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ProcessingStatus } from '@/hooks/useBPCalculator';

interface BPProcessingStatusProps {
  status: ProcessingStatus;
}

const statusConfig: Record<ProcessingStatus, { 
  label: string; 
  icon: React.ElementType; 
  progress: number;
  description: string;
}> = {
  idle: { 
    label: 'Ready', 
    icon: CheckCircle, 
    progress: 0,
    description: ''
  },
  extracting: { 
    label: 'Extracting text...', 
    icon: FileSearch, 
    progress: 25,
    description: 'Reading content from your document'
  },
  analysing: { 
    label: 'Analysing with AI...', 
    icon: Brain, 
    progress: 60,
    description: 'Identifying BP readings'
  },
  validating: { 
    label: 'Validating readings...', 
    icon: CheckCircle, 
    progress: 90,
    description: 'Checking values and formatting'
  },
  complete: { 
    label: 'Complete', 
    icon: CheckCircle, 
    progress: 100,
    description: 'Processing finished'
  }
};

export const BPProcessingStatus = ({ status }: BPProcessingStatusProps) => {
  if (status === 'idle') return null;
  
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex items-center gap-2 text-primary">
        {status === 'complete' ? (
          <Icon className="h-5 w-5" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin" />
        )}
        <span className="font-medium">{config.label}</span>
      </div>
      <div className="w-full max-w-xs">
        <Progress value={config.progress} className="h-2" />
      </div>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
    </div>
  );
};
