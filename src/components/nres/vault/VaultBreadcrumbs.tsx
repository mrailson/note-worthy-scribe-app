import { ChevronRight, Home, FolderOpen } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BreadcrumbItem } from '@/hooks/useNRESVaultData';

interface VaultBreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export const VaultBreadcrumbs = ({ items, onNavigate }: VaultBreadcrumbsProps) => {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFirst = index === 0;
        const Icon = isFirst ? Home : FolderOpen;
        return (
          <div key={item.id ?? 'root'} className="flex items-center gap-1 shrink-0">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px] flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.name}
              </span>
            ) : isFirst ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className="hover:text-foreground hover:underline transition-colors truncate max-w-[200px] flex items-center gap-1.5"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {item.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Double-click a folder to open it</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => onNavigate(item.id)}
                className="hover:text-foreground hover:underline transition-colors truncate max-w-[200px] flex items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.name}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
};
