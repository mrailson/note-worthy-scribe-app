import { cn } from "@/lib/utils";
import emisLogo from "@/assets/emis-logo.png";

interface EmisIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * EMIS Health logo icon
 * Uses the official EMIS brand logo
 */
export const EmisIcon = ({ className, size = "sm" }: EmisIconProps) => {
  const sizeClasses = {
    sm: "h-6 w-auto",
    md: "h-7 w-auto",
    lg: "h-8 w-auto"
  };

  return (
    <img
      src={emisLogo}
      alt="EMIS Health"
      className={cn(sizeClasses[size], "object-contain", className)}
    />
  );
};
