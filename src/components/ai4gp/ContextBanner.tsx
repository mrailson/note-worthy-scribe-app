import React from 'react';
import { Info, FileText, Upload, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextBannerProps {
  onDismiss?: () => void;
  className?: string;
}

export const ContextBanner: React.FC<ContextBannerProps> = ({ onDismiss, className }) => {
  return (
    <div
      className={cn(
        "relative flex items-start gap-4 p-4 rounded-xl",
        "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800",
        "text-sm",
        className
      )}
    >
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-800 dark:text-blue-200">
          Tip: Add supporting information for better results
        </p>
        <p className="text-blue-700/80 dark:text-blue-300/80 mt-1">
          This is a general assistance tool using NICE CKS and NHS guidance. <span className="font-semibold text-blue-800 dark:text-blue-200">Please do not enter patient identifiable information.</span>
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-blue-700 dark:text-blue-300">
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Copy & paste text
          </span>
          <span className="flex items-center gap-1.5">
            <Upload className="w-4 h-4" />
            Drag & drop files
          </span>
          <span className="flex items-center gap-1.5">
            <Paperclip className="w-4 h-4" />
            Use attachment button
          </span>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors"
          aria-label="Dismiss tip"
        >
          <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </button>
      )}
    </div>
  );
};
