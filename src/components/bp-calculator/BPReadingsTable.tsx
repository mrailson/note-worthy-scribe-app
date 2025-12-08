import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit2, Check, X, AlertTriangle, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Armchair, PersonStanding, Activity } from 'lucide-react';
import { BPReading, BPPosition } from '@/hooks/useBPCalculator';

interface BPReadingsTableProps {
  readings: BPReading[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<BPReading>) => void;
  onDelete: (id: string) => void;
  showPositionColumn?: boolean;
}

type SortField = 'datetime' | 'systolic' | 'diastolic' | 'pulse' | 'position' | null;
type SortDirection = 'asc' | 'desc';

export const BPReadingsTable = ({ readings, onToggle, onUpdate, onDelete, showPositionColumn = false }: BPReadingsTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editValues, setEditValues] = useState<{ systolic: number; diastolic: number; pulse?: number; position?: BPPosition; standingMinutes?: number }>({ 
    systolic: 0, 
    diastolic: 0 
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const parseDateTime = (reading: BPReading): number => {
    if (!reading.date) return 0;
    // Parse DD/MM/YYYY format
    const dateParts = reading.date.split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
      
      let hours = 0, minutes = 0;
      if (reading.time) {
        const timeParts = reading.time.match(/(\d{1,2}):(\d{2})/);
        if (timeParts) {
          hours = parseInt(timeParts[1], 10);
          minutes = parseInt(timeParts[2], 10);
        }
      }
      return new Date(fullYear, month, day, hours, minutes).getTime();
    }
    return 0;
  };

  const getPositionSortValue = (position?: BPPosition): number => {
    if (position === 'sitting') return 1;
    if (position === 'standing') return 2;
    return 0; // standard or undefined
  };

  const sortedReadings = useMemo(() => {
    if (!sortField) return readings;
    
    return [...readings].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'datetime':
          comparison = parseDateTime(a) - parseDateTime(b);
          break;
        case 'systolic':
          comparison = a.systolic - b.systolic;
          break;
        case 'diastolic':
          comparison = a.diastolic - b.diastolic;
          break;
        case 'pulse':
          const pulseA = a.pulse ?? 0;
          const pulseB = b.pulse ?? 0;
          comparison = pulseA - pulseB;
          break;
        case 'position':
          comparison = getPositionSortValue(a.position) - getPositionSortValue(b.position);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [readings, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const startEditing = (reading: BPReading) => {
    setEditingId(reading.id);
    setEditValues({
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      pulse: reading.pulse,
      position: reading.position,
      standingMinutes: reading.standingMinutes
    });
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, editValues);
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const isOutlier = (reading: BPReading) => {
    return reading.systolic < 90 || reading.systolic > 180 ||
           reading.diastolic < 50 || reading.diastolic > 110;
  };

  // Get original index for display
  const getOriginalIndex = (reading: BPReading) => {
    return readings.findIndex(r => r.id === reading.id) + 1;
  };

  const getPositionIcon = (position?: BPPosition) => {
    if (position === 'sitting') return <Armchair className="h-3 w-3" />;
    if (position === 'standing') return <PersonStanding className="h-3 w-3" />;
    return <Activity className="h-3 w-3" />;
  };

  const getPositionLabel = (position?: BPPosition, standingMinutes?: number) => {
    if (position === 'sitting') return 'Sitting';
    if (position === 'standing') {
      return standingMinutes ? `Stand ${standingMinutes}m` : 'Standing';
    }
    return 'Standard';
  };

  const getPositionBadgeStyle = (position?: BPPosition) => {
    if (position === 'sitting') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    if (position === 'standing') return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
    return 'bg-muted text-muted-foreground';
  };

  const handlePositionChange = (readingId: string, value: string) => {
    let position: BPPosition | undefined;
    let standingMinutes: number | undefined;
    
    if (value === 'sitting') {
      position = 'sitting';
    } else if (value === 'standing-1') {
      position = 'standing';
      standingMinutes = 1;
    } else if (value === 'standing-3') {
      position = 'standing';
      standingMinutes = 3;
    } else if (value === 'standing') {
      position = 'standing';
    } else {
      position = 'standard';
    }
    
    onUpdate(readingId, { position, standingMinutes });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div>
              <h3 className="text-lg font-semibold">Detected BP Readings</h3>
              <p className="text-sm text-muted-foreground">
                {readings.filter(r => r.included).length} of {readings.length} readings included in average
                {showPositionColumn && (
                  <span className="ml-2">
                    • {readings.filter(r => r.position === 'sitting').length} sitting
                    • {readings.filter(r => r.position === 'standing').length} standing
                  </span>
                )}
              </p>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Include</TableHead>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => toggleSort('datetime')}
                >
                  <div className="flex items-center">
                    Date/Time
                    <SortIcon field="datetime" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => toggleSort('systolic')}
                >
                  <div className="flex items-center">
                    Systolic
                    <SortIcon field="systolic" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => toggleSort('diastolic')}
                >
                  <div className="flex items-center">
                    Diastolic
                    <SortIcon field="diastolic" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => toggleSort('pulse')}
                >
                  <div className="flex items-center">
                    Pulse
                    <SortIcon field="pulse" />
                  </div>
                </TableHead>
                {showPositionColumn && (
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => toggleSort('position')}
                  >
                    <div className="flex items-center">
                      Position
                      <SortIcon field="position" />
                    </div>
                  </TableHead>
                )}
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {sortedReadings.map((reading) => (
                <TableRow 
                  key={reading.id}
                  className={`${!reading.included ? 'bg-muted/50' : ''} ${isOutlier(reading) ? 'bg-amber-50 dark:bg-amber-950/20' : ''} ${reading.position === 'sitting' ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''} ${reading.position === 'standing' ? 'bg-purple-50/50 dark:bg-purple-950/10' : ''}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={reading.included}
                      onCheckedChange={() => onToggle(reading.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getOriginalIndex(reading)}
                      {!reading.included && (
                        <Badge 
                          variant="outline" 
                          className="text-muted-foreground border-muted-foreground/50 text-xs"
                          title={reading.excludeReason || 'Excluded'}
                        >
                          Excluded
                        </Badge>
                      )}
                    </div>
                    {reading.excludeReason && !reading.included && (
                      <p className="text-xs text-muted-foreground mt-1">{reading.excludeReason}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {reading.date ? (
                      <span className="text-sm">
                        {reading.date}
                        {reading.time && <span className="text-muted-foreground ml-1">{reading.time}</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === reading.id ? (
                      <Input
                        type="number"
                        value={editValues.systolic}
                        onChange={(e) => setEditValues(prev => ({ ...prev, systolic: parseInt(e.target.value) || 0 }))}
                        className="w-20 h-8"
                      />
                    ) : (
                      <span className="font-mono">{reading.systolic}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === reading.id ? (
                      <Input
                        type="number"
                        value={editValues.diastolic}
                        onChange={(e) => setEditValues(prev => ({ ...prev, diastolic: parseInt(e.target.value) || 0 }))}
                        className="w-20 h-8"
                      />
                    ) : (
                      <span className="font-mono">{reading.diastolic}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === reading.id ? (
                      <Input
                        type="number"
                        value={editValues.pulse || ''}
                        onChange={(e) => setEditValues(prev => ({ ...prev, pulse: parseInt(e.target.value) || undefined }))}
                        className="w-20 h-8"
                        placeholder="—"
                      />
                    ) : (
                      <span className="font-mono">{reading.pulse || '—'}</span>
                    )}
                  </TableCell>
                  {showPositionColumn && (
                    <TableCell>
                      <Select
                        value={reading.position === 'standing' && reading.standingMinutes 
                          ? `standing-${reading.standingMinutes}` 
                          : reading.position || 'standard'}
                        onValueChange={(value) => handlePositionChange(reading.id, value)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue>
                            <Badge variant="outline" className={`gap-1 ${getPositionBadgeStyle(reading.position)}`}>
                              {getPositionIcon(reading.position)}
                              {getPositionLabel(reading.position, reading.standingMinutes)}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">
                            <div className="flex items-center gap-2">
                              <Activity className="h-3 w-3" />
                              Standard
                            </div>
                          </SelectItem>
                          <SelectItem value="sitting">
                            <div className="flex items-center gap-2">
                              <Armchair className="h-3 w-3 text-blue-600" />
                              Sitting
                            </div>
                          </SelectItem>
                          <SelectItem value="standing">
                            <div className="flex items-center gap-2">
                              <PersonStanding className="h-3 w-3 text-purple-600" />
                              Standing
                            </div>
                          </SelectItem>
                          <SelectItem value="standing-1">
                            <div className="flex items-center gap-2">
                              <PersonStanding className="h-3 w-3 text-purple-600" />
                              Standing (1 min)
                            </div>
                          </SelectItem>
                          <SelectItem value="standing-3">
                            <div className="flex items-center gap-2">
                              <PersonStanding className="h-3 w-3 text-purple-600" />
                              Standing (3 min)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell">
                    <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                      {reading.sourceText || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isOutlier(reading) && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 mr-1">
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      )}
                      {editingId === reading.id ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(reading)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(reading.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {readings.some(isOutlier) && (
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Highlighted readings are outside typical range and may be outliers
          </p>
        )}
      </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
