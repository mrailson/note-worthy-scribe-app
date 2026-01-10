import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface PatientConsentBannerProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const PatientConsentBanner = ({
  checked,
  onCheckedChange,
  disabled = false
}: PatientConsentBannerProps) => {
  return (
    <div className={`
      flex items-center gap-3 p-4 rounded-lg border transition-colors
      ${checked 
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
      }
    `}>
      {checked ? (
        <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Checkbox
            id="patient-consent"
            checked={checked}
            onCheckedChange={(c) => onCheckedChange(c === true)}
            disabled={disabled}
            className="h-5 w-5"
          />
          <Label 
            htmlFor="patient-consent" 
            className={`text-sm font-medium cursor-pointer ${
              checked 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-amber-800 dark:text-amber-200'
            }`}
          >
            Patient has given verbal consent for AI-assisted note taking
          </Label>
        </div>
        <p className={`text-xs mt-1 ml-8 ${
          checked 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-amber-600 dark:text-amber-400'
        }`}>
          {checked 
            ? "Consent confirmed. You may proceed with the consultation." 
            : "Please confirm consent before starting the consultation."
          }
        </p>
      </div>
    </div>
  );
};
