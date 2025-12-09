import * as React from "react";

interface WordIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const WordIcon: React.FC<WordIconProps> = ({ className, ...props }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Document background */}
      <rect
        x="3"
        y="2"
        width="18"
        height="20"
        rx="2"
        fill="#2B579A"
      />
      {/* W letter */}
      <path
        d="M7 7L9 17L12 10L15 17L17 7"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default WordIcon;
