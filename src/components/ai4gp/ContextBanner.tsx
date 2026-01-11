import React from 'react';
import { Info, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextBannerProps {
  onDismiss?: () => void;
  className?: string;
}

export const ContextBanner: React.FC<ContextBannerProps> = ({ onDismiss, className }) => {
  return (
    <div
      className={cn(
        "relative flex items-start gap-3 p-3 rounded-lg",
        "bg-blue-500/10 border border-blue-500/20",
        "text-sm",
        className
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-blue-700 dark:text-blue-300">
          Tip: Add supporting information for better results
        </p>
        <p className="text-blue-600/80 dark:text-blue-400/80 mt-0.5">
          Paste or upload clinical notes, letters, or test results to help the AI understand the full context.
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-blue-600/70 dark:text-blue-400/70">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Copy & paste text
          </span>
          <span>•</span>
          <span>Drag & drop files</span>
          <span>•</span>
          <span>Use attachment button</span>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-blue-500/20 transition-colors"
          aria-label="Dismiss tip"
        >
          <X className="w-4 h-4 text-blue-600/60 dark:text-blue-400/60" />
        </button>
      )}
    </div>
  );
};
