import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckCircle
} from "lucide-react";
import { useState } from "react";

interface ComplianceAlert {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: string;
  due_date?: string;
}

interface CQCAlertsPanel {
  alerts: ComplianceAlert[];
}

const CQCAlertsPanel = ({ alerts }: CQCAlertsPanel) => {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [resolvedAlerts, setResolvedAlerts] = useState<Set<string>>(new Set());

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const handleResolveAlert = (alertId: string) => {
    setResolvedAlerts(prev => new Set([...prev, alertId]));
  };

  const urgentAlerts = alerts.filter(alert => alert.priority === 'urgent' || alert.priority === 'high');
  const displayedAlerts = showAllAlerts ? alerts : alerts.slice(0, 3);
  const activeAlerts = displayedAlerts.filter(alert => !resolvedAlerts.has(alert.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alerts & Tasks
            {urgentAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {urgentAlerts.length} urgent
              </Badge>
            )}
          </div>
          {alerts.length > 3 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAllAlerts(!showAllAlerts)}
            >
              {showAllAlerts ? (
                <>
                  Show Less <ChevronUp className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Show All ({alerts.length}) <ChevronDown className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeAlerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p className="font-medium">All alerts resolved!</p>
            <p className="text-sm">Great job on your compliance management.</p>
          </div>
        ) : (
          activeAlerts.map((alert) => (
            <Alert key={alert.id} className="relative">
              <AlertTriangle className={`h-4 w-4 ${getPriorityIcon(alert.priority)}`} />
              <AlertTitle className="flex items-center justify-between pr-8">
                <span>{alert.title}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={getPriorityColor(alert.priority)} className="text-xs">
                    {alert.priority}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolveAlert(alert.id)}
                    className="h-6 px-2 text-xs"
                  >
                    Resolve
                  </Button>
                </div>
              </AlertTitle>
              <AlertDescription className="mt-2">
                <div className="space-y-1">
                  <p>{alert.message}</p>
                  {alert.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {new Date(alert.due_date).toLocaleDateString()}</span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span>
                        {Math.ceil((new Date(alert.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                      </span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ))
        )}

        {resolvedAlerts.size > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              ✅ {resolvedAlerts.size} alert(s) resolved in this session
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CQCAlertsPanel;