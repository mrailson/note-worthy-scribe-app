import { ChevronRight } from 'lucide-react';
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
        return (
          <div key={item.id ?? 'root'} className="flex items-center gap-1 shrink-0">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {item.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(item.id)}
                className="hover:text-foreground hover:underline transition-colors truncate max-w-[200px]"
              >
                {item.name}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
};
