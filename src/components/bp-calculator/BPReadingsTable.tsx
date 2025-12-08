import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { BPReading } from '@/hooks/useBPCalculator';

interface BPReadingsTableProps {
  readings: BPReading[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<BPReading>) => void;
  onDelete: (id: string) => void;
}

export const BPReadingsTable = ({ readings, onToggle, onUpdate, onDelete }: BPReadingsTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ systolic: number; diastolic: number; pulse?: number }>({ 
    systolic: 0, 
    diastolic: 0 
  });

  const startEditing = (reading: BPReading) => {
    setEditingId(reading.id);
    setEditValues({
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      pulse: reading.pulse
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Detected BP Readings</CardTitle>
        <CardDescription>
          {readings.filter(r => r.included).length} of {readings.length} readings included in average
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Include</TableHead>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Systolic</TableHead>
                <TableHead>Diastolic</TableHead>
                <TableHead>Pulse</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {readings.map((reading, index) => (
                <TableRow 
                  key={reading.id}
                  className={`${!reading.included ? 'bg-muted/50' : ''} ${isOutlier(reading) ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={reading.included}
                      onCheckedChange={() => onToggle(reading.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {index + 1}
                      {!reading.included && (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50 text-xs">
                          Excluded
                        </Badge>
                      )}
                    </div>
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
    </Card>
  );
};
