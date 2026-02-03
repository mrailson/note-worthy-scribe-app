import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TopDrug {
  name: string;
  commonUse: string;
}

interface TopPrescribedDrugsProps {
  onDrugSelect: (drugName: string) => void;
}

// Based on NHS England national prescribing data - top prescribed drugs in primary care
export const TOP_NHS_DRUGS: TopDrug[] = [
  { name: 'Omeprazole', commonUse: 'Acid reflux/GORD' },
  { name: 'Amlodipine', commonUse: 'Hypertension' },
  { name: 'Atorvastatin', commonUse: 'Cholesterol' },
  { name: 'Lansoprazole', commonUse: 'Acid reflux' },
  { name: 'Ramipril', commonUse: 'Hypertension/HF' },
  { name: 'Metformin', commonUse: 'Type 2 Diabetes' },
  { name: 'Paracetamol', commonUse: 'Pain/Fever' },
  { name: 'Simvastatin', commonUse: 'Cholesterol' },
  { name: 'Aspirin', commonUse: 'CV Prevention' },
  { name: 'Levothyroxine', commonUse: 'Hypothyroidism' },
];

export const TopPrescribedDrugs: React.FC<TopPrescribedDrugsProps> = ({ onDrugSelect }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Top 10 NHS Prescribed</h3>
        <Badge variant="secondary" className="text-xs">
          National data
        </Badge>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {TOP_NHS_DRUGS.map((drug) => (
          <button
            key={drug.name}
            onClick={() => onDrugSelect(drug.name)}
            className={cn(
              "group relative px-3 py-1.5 rounded-full",
              "bg-primary/10 hover:bg-primary/20",
              "border border-primary/20 hover:border-primary/40",
              "text-sm font-medium text-primary",
              "transition-all duration-150",
              "active:scale-[0.98] touch-manipulation"
            )}
          >
            <span>{drug.name}</span>
            {/* Tooltip on hover */}
            <span className={cn(
              "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
              "px-2 py-1 rounded text-xs whitespace-nowrap",
              "bg-popover text-popover-foreground border shadow-md",
              "opacity-0 group-hover:opacity-100 pointer-events-none",
              "transition-opacity duration-150 z-10"
            )}>
              {drug.commonUse}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
