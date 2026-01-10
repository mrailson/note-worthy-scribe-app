import { PatientContext } from "@/types/scribe";
import { Button } from "@/components/ui/button";
import { User, X } from "lucide-react";

interface PatientContextBannerProps {
  patientContext: PatientContext;
  onClear?: () => void;
  compact?: boolean;
}

export const PatientContextBanner = ({
  patientContext,
  onClear,
  compact = false
}: PatientContextBannerProps) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100/80 dark:bg-green-900/30 rounded-lg text-sm">
        <User className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
        <span className="font-medium text-green-800 dark:text-green-300">
          {patientContext.name}
        </span>
        <span className="text-green-700 dark:text-green-400">|</span>
        <span className="text-green-700 dark:text-green-400">
          NHS: {patientContext.nhsNumber}
        </span>
        {patientContext.dateOfBirth && (
          <>
            <span className="text-green-700 dark:text-green-400">|</span>
            <span className="text-green-700 dark:text-green-400">
              DOB: {patientContext.dateOfBirth}
            </span>
          </>
        )}
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-5 w-5 p-0 ml-1 text-green-700 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Clear patient</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-green-100/80 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-200 dark:bg-green-800">
          <User className="h-4 w-4 text-green-700 dark:text-green-300" />
        </div>
        <div>
          <p className="font-medium text-green-900 dark:text-green-100">
            {patientContext.name}
          </p>
          <div className="flex gap-3 text-sm text-green-700 dark:text-green-400">
            <span>NHS: {patientContext.nhsNumber}</span>
            {patientContext.dateOfBirth && (
              <span>DOB: {patientContext.dateOfBirth}</span>
            )}
          </div>
        </div>
      </div>
      {onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-green-700 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
