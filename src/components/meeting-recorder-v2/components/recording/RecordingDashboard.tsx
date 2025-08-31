import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, FileText, Users } from 'lucide-react';
import { RecordingState } from '../../hooks/useRecordingManager';

interface RecordingDashboardProps {
  state: RecordingState;
  formatDuration: (seconds: number) => string;
}

export const RecordingDashboard = ({ state, formatDuration }: RecordingDashboardProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-background to-accent/5">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="h-5 w-5 text-primary mr-2" />
            <span className="text-sm font-medium text-muted-foreground">Duration</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatDuration(state.duration)}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-background to-accent/5">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-2">
            <FileText className="h-5 w-5 text-primary mr-2" />
            <span className="text-sm font-medium text-muted-foreground">Words</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {state.wordCount.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-background to-accent/5">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-2">
            <Users className="h-5 w-5 text-primary mr-2" />
            <span className="text-sm font-medium text-muted-foreground">Speakers</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {state.speakerCount}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};