import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Star, CheckCircle2, AlertCircle, MinusCircle, Circle, Ban } from 'lucide-react';
import { InspectionElement } from '@/hooks/useMockInspection';
import { InspectionElementCard } from './InspectionElement';
import { cn } from '@/lib/utils';

interface DomainSectionProps {
  domain: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  isPriority: boolean;
  elements: InspectionElement[];
  onUpdateElement: (elementId: string, updates: Partial<InspectionElement>) => Promise<boolean>;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'met': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'partially_met': return <MinusCircle className="h-4 w-4 text-amber-600" />;
    case 'not_met': return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'not_applicable': return <Ban className="h-4 w-4 text-muted-foreground" />;
    default: return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

export const DomainSection = ({
  domain,
  label,
  description,
  color,
  bgColor,
  borderColor,
  isPriority,
  elements,
  onUpdateElement
}: DomainSectionProps) => {
  const [isOpen, setIsOpen] = useState(isPriority); // Priority domains open by default
  const [expandedElement, setExpandedElement] = useState<string | null>(null);

  const assessed = elements.filter(e => e.status !== 'not_assessed').length;
  const total = elements.length;
  const progressPercent = total > 0 ? Math.round((assessed / total) * 100) : 0;

  // Count by status
  const statusCounts = {
    met: elements.filter(e => e.status === 'met').length,
    partially_met: elements.filter(e => e.status === 'partially_met').length,
    not_met: elements.filter(e => e.status === 'not_met').length,
    not_applicable: elements.filter(e => e.status === 'not_applicable').length,
    not_assessed: elements.filter(e => e.status === 'not_assessed').length
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(borderColor, "transition-all")}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className={cn(bgColor, "cursor-pointer hover:opacity-90 transition-opacity rounded-t-lg")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className={cn(color, "text-lg flex items-center gap-2")}>
                  {label}
                  {isPriority && (
                    <Badge variant="outline" className={cn(color, "ml-2 text-xs")}>
                      <Star className="h-3 w-3 mr-1" />
                      Priority
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini status indicators */}
                <div className="hidden md:flex items-center gap-2 text-xs">
                  {statusCounts.met > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> {statusCounts.met}
                    </span>
                  )}
                  {statusCounts.partially_met > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <MinusCircle className="h-3 w-3" /> {statusCounts.partially_met}
                    </span>
                  )}
                  {statusCounts.not_met > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="h-3 w-3" /> {statusCounts.not_met}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {assessed}/{total}
                </span>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-left mt-1">{description}</p>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-3">
            {elements.map(element => (
              <InspectionElementCard
                key={element.id}
                element={element}
                isExpanded={expandedElement === element.id}
                onToggle={() => setExpandedElement(expandedElement === element.id ? null : element.id)}
                onUpdate={(updates) => onUpdateElement(element.id, updates)}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
