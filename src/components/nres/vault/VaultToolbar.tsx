import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface VaultToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const VaultToolbar = ({
  searchQuery,
  onSearchChange,
}: VaultToolbarProps) => {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search files and folders..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-9 pr-8"
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
