import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrafficLightStatus = 'GREEN' | 'AMBER' | 'RED' | 'DOUBLE_RED' | 'SPECIALIST' | 'GREY';

export interface TopDrug {
  name: string;
  commonUse: string;
  trafficLight: TrafficLightStatus;
}

interface TopPrescribedDrugsProps {
  onDrugSelect: (drugName: string) => void;
}

// Traffic light colour mappings matching Northants ICB
const getTrafficLightStyles = (status: TrafficLightStatus): string => {
  switch (status) {
    case 'GREEN':
      return 'bg-[#2E7D32]/15 hover:bg-[#2E7D32]/25 border-[#2E7D32]/40 hover:border-[#2E7D32]/60 text-[#2E7D32]';
    case 'AMBER':
      return 'bg-[#EF6C00]/15 hover:bg-[#EF6C00]/25 border-[#EF6C00]/40 hover:border-[#EF6C00]/60 text-[#EF6C00]';
    case 'RED':
      return 'bg-[#E53935]/15 hover:bg-[#E53935]/25 border-[#E53935]/40 hover:border-[#E53935]/60 text-[#E53935]';
    case 'DOUBLE_RED':
      return 'bg-[#C62828]/15 hover:bg-[#C62828]/25 border-[#C62828]/40 hover:border-[#C62828]/60 text-[#C62828]';
    case 'SPECIALIST':
      return 'bg-[#6A1B9A]/15 hover:bg-[#6A1B9A]/25 border-[#6A1B9A]/40 hover:border-[#6A1B9A]/60 text-[#6A1B9A]';
    case 'GREY':
      return 'bg-[#546E7A]/15 hover:bg-[#546E7A]/25 border-[#546E7A]/40 hover:border-[#546E7A]/60 text-[#546E7A]';
    default:
      return 'bg-primary/10 hover:bg-primary/20 border-primary/20 hover:border-primary/40 text-primary';
  }
};

// Based on NHS England national prescribing data - top prescribed drugs in primary care
// Traffic light statuses from Northants ICB formulary
export const TOP_NHS_DRUGS: TopDrug[] = [
  { name: 'Omeprazole', commonUse: 'Acid reflux/GORD', trafficLight: 'GREEN' },
  { name: 'Amlodipine', commonUse: 'Hypertension', trafficLight: 'GREEN' },
  { name: 'Atorvastatin', commonUse: 'Cholesterol', trafficLight: 'GREEN' },
  { name: 'Lansoprazole', commonUse: 'Acid reflux', trafficLight: 'GREEN' },
  { name: 'Ramipril', commonUse: 'Hypertension/HF', trafficLight: 'GREEN' },
  { name: 'Metformin', commonUse: 'Type 2 Diabetes', trafficLight: 'GREEN' },
  { name: 'Paracetamol', commonUse: 'Pain/Fever', trafficLight: 'GREEN' },
  { name: 'Simvastatin', commonUse: 'Cholesterol', trafficLight: 'GREEN' },
  { name: 'Aspirin', commonUse: 'CV Prevention', trafficLight: 'GREEN' },
  { name: 'Levothyroxine', commonUse: 'Hypothyroidism', trafficLight: 'GREEN' },
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
        <TooltipProvider delayDuration={200}>
          {TOP_NHS_DRUGS.map((drug) => (
            <Tooltip key={drug.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDrugSelect(drug.name)}
                  className={cn(
                    "px-3 py-1.5 rounded-full",
                    "border text-sm font-medium",
                    "transition-all duration-150",
                    "active:scale-[0.98] touch-manipulation",
                    getTrafficLightStyles(drug.trafficLight)
                  )}
                >
                  {drug.name}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{drug.commonUse} • {drug.trafficLight}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
};
