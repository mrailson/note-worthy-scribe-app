import { Badge } from '@/components/ui/badge';

const FILE_TYPE_FILTERS = [
  { label: 'All types', value: 'all' },
  { label: '.pdf', value: 'pdf' },
  { label: '.docx', value: 'docx' },
  { label: '.xlsx', value: 'xlsx' },
] as const;

export type FileTypeFilterValue = typeof FILE_TYPE_FILTERS[number]['value'];

interface VaultFileTypeFilterProps {
  value: FileTypeFilterValue;
  onChange: (v: FileTypeFilterValue) => void;
}

export const VaultFileTypeFilter = ({ value, onChange }: VaultFileTypeFilterProps) => {
  return (
    <div className="flex items-center gap-1.5">
      {FILE_TYPE_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`
            inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border
            ${value === f.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            }
          `}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};
