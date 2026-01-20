import { cn } from "@/lib/utils";

interface SystmOneIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Custom icon for TPP SystmOne clinical system
 * S1 monogram in a professional badge style
 */
export const SystmOneIcon = ({ className, size = "sm" }: SystmOneIconProps) => {
  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeClasses[size], className)}
    >
      {/* Background rounded rectangle */}
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="3"
        fill="currentColor"
        opacity="0.15"
      />
      {/* S letter */}
      <path
        d="M7.5 9.5C7.5 8.67 8.17 8 9 8h2c0.83 0 1.5 0.67 1.5 1.5S11.83 11 11 11H9c-0.83 0-1.5 0.67-1.5 1.5S8.17 14 9 14h2c0.83 0 1.5-0.67 1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 1 numeral */}
      <path
        d="M15 8l1.5-0.5V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Small underline accent */}
      <path
        d="M14 14h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};
