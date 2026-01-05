import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { NRESHoursEntry } from '@/types/nresHoursTypes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface HoursEntriesTableProps {
  entries: NRESHoursEntry[];
  hourlyRate: number | null;
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
}

export function HoursEntriesTable({ entries, hourlyRate, loading, onDelete }: HoursEntriesTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const formatTime = (time: string) => {
    // time is in HH:mm:ss format, show only HH:mm
    return time.substring(0, 5);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No hours logged yet. Add your first entry above.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Hours Entries</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Notes</TableHead>
                {hourlyRate && <TableHead className="text-right">Amount</TableHead>}
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {format(new Date(entry.work_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {Number(entry.duration_hours).toFixed(2)} hrs
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.activity_type}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {entry.description || '-'}
                  </TableCell>
                  {hourlyRate && (
                    <TableCell className="text-right font-medium">
                      £{(Number(entry.duration_hours) * hourlyRate).toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deletingId === entry.id}
                        >
                          {deletingId === entry.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this hours entry? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(entry.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
