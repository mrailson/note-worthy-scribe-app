import { cn } from "@/lib/utils";
import tppLogo from "@/assets/tpp-logo.png";

interface SystmOneIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * TPP SystmOne logo icon
 * Uses the official TPP brand logo
 */
export const SystmOneIcon = ({ className, size = "sm" }: SystmOneIconProps) => {
  const sizeClasses = {
    sm: "h-3.5 w-auto",
    md: "h-4 w-auto",
    lg: "h-5 w-auto"
  };

  return (
    <img
      src={tppLogo}
      alt="TPP SystmOne"
      className={cn(sizeClasses[size], "object-contain", className)}
    />
  );
};
