import { useMemo } from 'react';
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, isToday, isBefore, isAfter } from 'date-fns';
import { NRESBoardAction } from '@/types/nresBoardActions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface GanttChartViewProps {
  actions: NRESBoardAction[];
  onEdit: (action: NRESBoardAction) => void;
}

const statusColors: Record<string, string> = {
  'pending': 'bg-muted-foreground/60',
  'in-progress': 'bg-primary',
  'completed': 'bg-green-500',
  'overdue': 'bg-destructive',
};

const priorityBorders: Record<string, string> = {
  'low': 'border-l-2',
  'medium': 'border-l-4',
  'high': 'border-l-[6px]',
};

export function GanttChartView({ actions, onEdit }: GanttChartViewProps) {
  const { weeks, startDate, totalDays } = useMemo(() => {
    if (actions.length === 0) {
      const today = new Date();
      const start = startOfWeek(addDays(today, -14), { weekStartsOn: 1 });
      const end = endOfWeek(addDays(today, 56), { weekStartsOn: 1 });
      return {
        weeks: eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }),
        startDate: start,
        totalDays: differenceInDays(end, start) + 1,
      };
    }

    const dates = actions.flatMap(a => {
      const meetingDate = new Date(a.meeting_date);
      const dueDate = a.due_date ? new Date(a.due_date) : addDays(meetingDate, 14);
      return [meetingDate, dueDate];
    });
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const start = startOfWeek(addDays(minDate, -7), { weekStartsOn: 1 });
    const end = endOfWeek(addDays(maxDate, 14), { weekStartsOn: 1 });
    
    return {
      weeks: eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }),
      startDate: start,
      totalDays: differenceInDays(end, start) + 1,
    };
  }, [actions]);

  const dayWidth = 24;
  const rowHeight = 48;
  const headerHeight = 60;
  const leftPanelWidth = 380;

  const getBarStyle = (action: NRESBoardAction) => {
    const meetingDate = new Date(action.meeting_date);
    const dueDate = action.due_date ? new Date(action.due_date) : addDays(meetingDate, 14);
    
    const startOffset = Math.max(0, differenceInDays(meetingDate, startDate));
    const duration = Math.max(1, differenceInDays(dueDate, meetingDate) + 1);
    
    return {
      left: startOffset * dayWidth,
      width: duration * dayWidth - 4,
    };
  };

  const todayOffset = differenceInDays(new Date(), startDate);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex">
        {/* Left Panel - Fixed */}
        <div className="flex-shrink-0 border-r bg-muted/30" style={{ width: leftPanelWidth }}>
          {/* Header */}
          <div 
            className="border-b bg-muted/50 px-3 flex items-center gap-2 font-medium text-sm"
            style={{ height: headerHeight }}
          >
            <div className="w-16">Ref</div>
            <div className="flex-1">Action</div>
            <div className="w-24">Owner</div>
            <div className="w-20">Status</div>
          </div>
          
          {/* Rows */}
          {actions.map((action) => (
            <div
              key={action.id}
              className="border-b px-3 flex items-center gap-2 text-sm hover:bg-muted/50 cursor-pointer transition-colors"
              style={{ height: rowHeight }}
              onClick={() => onEdit(action)}
            >
              <div className="w-16 font-mono text-xs text-muted-foreground">
                {action.reference_number || '-'}
              </div>
              <div className="flex-1 truncate font-medium">
                {action.action_title}
              </div>
              <div className="w-24 truncate text-muted-foreground">
                {action.responsible_person.split(' ')[0]}
              </div>
              <div className="w-20">
                <Badge 
                  variant={action.status === 'completed' ? 'default' : action.status === 'overdue' ? 'destructive' : 'secondary'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {action.status}
                </Badge>
              </div>
            </div>
          ))}
          
          {actions.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No actions to display
            </div>
          )}
        </div>

        {/* Right Panel - Scrollable Timeline */}
        <ScrollArea className="flex-1">
          <div style={{ width: totalDays * dayWidth, minWidth: '100%' }}>
            {/* Timeline Header */}
            <div className="border-b bg-muted/50" style={{ height: headerHeight }}>
              {/* Month/Week Labels */}
              <div className="flex h-1/2 border-b">
                {weeks.map((weekStart, i) => (
                  <div
                    key={i}
                    className="border-r text-xs font-medium px-2 flex items-center"
                    style={{ width: 7 * dayWidth }}
                  >
                    {format(weekStart, 'd MMM yyyy')}
                  </div>
                ))}
              </div>
              {/* Day Labels */}
              <div className="flex h-1/2">
                {weeks.map((weekStart, wi) => (
                  <div key={wi} className="flex">
                    {Array.from({ length: 7 }).map((_, di) => {
                      const day = addDays(weekStart, di);
                      const isWeekend = di >= 5;
                      return (
                        <div
                          key={di}
                          className={cn(
                            "text-[10px] flex items-center justify-center border-r",
                            isWeekend && "bg-muted/50",
                            isToday(day) && "bg-primary/20 font-bold"
                          )}
                          style={{ width: dayWidth }}
                        >
                          {format(day, 'E')[0]}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Bars */}
            <div className="relative">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {weeks.map((weekStart, wi) => (
                  <div key={wi} className="flex">
                    {Array.from({ length: 7 }).map((_, di) => {
                      const day = addDays(weekStart, di);
                      const isWeekend = di >= 5;
                      return (
                        <div
                          key={di}
                          className={cn(
                            "border-r border-border/30",
                            isWeekend && "bg-muted/20"
                          )}
                          style={{ 
                            width: dayWidth, 
                            height: actions.length * rowHeight || 100 
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Today Line */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
                  style={{ 
                    left: todayOffset * dayWidth + dayWidth / 2,
                    height: actions.length * rowHeight || 100
                  }}
                >
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-destructive" />
                </div>
              )}

              {/* Action Bars */}
              <TooltipProvider>
                {actions.map((action, index) => {
                  const barStyle = getBarStyle(action);
                  return (
                    <div
                      key={action.id}
                      className="relative"
                      style={{ height: rowHeight }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute top-2 rounded-md shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] hover:z-10",
                              statusColors[action.status],
                              priorityBorders[action.priority],
                              "border-l-white/50"
                            )}
                            style={{
                              left: barStyle.left + 2,
                              width: barStyle.width,
                              height: rowHeight - 16,
                            }}
                            onClick={() => onEdit(action)}
                          >
                            <div className="px-2 py-1 text-white text-xs font-medium truncate h-full flex items-center">
                              {action.action_title}
                            </div>
                            
                            {/* Progress indicator for in-progress */}
                            {action.status === 'in-progress' && (
                              <div 
                                className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-b-md"
                                style={{ width: '50%' }}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium">{action.action_title}</p>
                            <p className="text-xs text-muted-foreground">
                              {action.responsible_person}
                            </p>
                            <div className="flex gap-2 text-xs">
                              <span>Meeting: {format(new Date(action.meeting_date), 'dd MMM yyyy')}</span>
                              {action.due_date && (
                                <span>Due: {format(new Date(action.due_date), 'dd MMM yyyy')}</span>
                              )}
                            </div>
                            {action.description && (
                              <p className="text-xs mt-1">{action.description}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      
      {/* Legend */}
      <div className="border-t px-4 py-2 bg-muted/30 flex items-center gap-6 text-xs">
        <span className="text-muted-foreground font-medium">Status:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted-foreground/60" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span>Overdue</span>
        </div>
        <span className="ml-4 text-muted-foreground font-medium">Priority:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted border-l-2 border-white" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted border-l-4 border-white" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted border-l-[6px] border-white" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
