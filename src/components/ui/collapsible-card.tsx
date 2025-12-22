import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const CollapsibleCard = ({
  title,
  children,
  defaultOpen = true,
  className,
  headerClassName,
  icon,
  badge,
}: CollapsibleCardProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("bg-white rounded-lg shadow-sm overflow-hidden", className)}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left",
              headerClassName
            )}
          >
            <div className="flex items-center gap-3">
              {icon && <div className="text-[#005EB8]">{icon}</div>}
              <h2 className="text-xl font-bold text-[#003087]">{title}</h2>
              {badge}
            </div>
            <div className="text-slate-500">
              {isOpen ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
