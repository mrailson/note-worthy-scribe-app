import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  MapPin, 
  Clock,
  ChevronDown,
  ChevronUp,
  Chrome,
  Laptop
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuditLog {
  id: string;
  action_type: string;
  action_description: string;
  user_email: string | null;
  created_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  browser_name?: string | null;
  browser_version?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  device_type?: string | null;
  screen_resolution?: string | null;
  timezone?: string | null;
  language?: string | null;
  session_id?: string | null;
  geographic_location?: string | null;
  device_fingerprint?: string | null;
  referrer?: string | null;
}

interface EnhancedAuditLogViewerProps {
  logs: AuditLog[];
}

export const EnhancedAuditLogViewer = ({ logs }: EnhancedAuditLogViewerProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [filterBrowser, setFilterBrowser] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getDeviceIcon = (deviceType?: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const maskIpAddress = (ip?: string | null) => {
    if (!ip || ip === 'unknown') return 'Unknown';
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ip;
  };

  // Get unique browsers and devices for filters
  const uniqueBrowsers = Array.from(new Set(logs.map(log => log.browser_name).filter(Boolean)));
  const uniqueDevices = Array.from(new Set(logs.map(log => log.device_type).filter(Boolean)));

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesDevice = filterDevice === 'all' || log.device_type === filterDevice;
    const matchesBrowser = filterBrowser === 'all' || log.browser_name === filterBrowser;
    const matchesSearch = !searchTerm || 
      log.action_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address?.includes(searchTerm);
    
    return matchesDevice && matchesBrowser && matchesSearch;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complaint Activity Log</CardTitle>
        <CardDescription>Complete audit trail with network and device information</CardDescription>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          
          {uniqueDevices.length > 0 && (
            <Select value={filterDevice} onValueChange={setFilterDevice}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Device type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                {uniqueDevices.map(device => (
                  <SelectItem key={device} value={device!}>
                    {device}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {uniqueBrowsers.length > 0 && (
            <Select value={filterBrowser} onValueChange={setFilterBrowser}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Browser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All browsers</SelectItem>
                {uniqueBrowsers.map(browser => (
                  <SelectItem key={browser} value={browser!}>
                    {browser}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const isExpanded = expandedIds.has(log.id);
              const hasMetadata = log.ip_address || log.browser_name || log.device_type;
              
              return (
                <div 
                  key={log.id} 
                  className="border-l-2 border-primary/20 pl-4 py-2 hover:bg-accent/50 transition-colors rounded-r"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{log.action_type}</h4>
                        
                        {/* Device badge */}
                        {log.device_type && (
                          <Badge variant="outline" className="gap-1">
                            {getDeviceIcon(log.device_type)}
                            <span className="capitalize">{log.device_type}</span>
                          </Badge>
                        )}
                        
                        {/* Browser badge */}
                        {log.browser_name && (
                          <Badge variant="secondary" className="gap-1">
                            <Chrome className="h-3 w-3" />
                            {log.browser_name} {log.browser_version?.split('.')[0]}
                          </Badge>
                        )}
                        
                        {/* Location badge */}
                        {log.geographic_location && (
                          <Badge variant="outline" className="gap-1">
                            <MapPin className="h-3 w-3" />
                            {log.geographic_location}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1">{log.action_description}</p>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        {log.user_email && (
                          <span>By: {log.user_email}</span>
                        )}
                        {log.ip_address && log.ip_address !== 'unknown' && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {maskIpAddress(log.ip_address)}
                          </span>
                        )}
                        {log.session_id && (
                          <span className="font-mono text-[10px]">
                            Session: {log.session_id.substring(0, 12)}...
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                      
                      {hasMetadata && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(log.id)}
                          className="h-6 w-6 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded details */}
                  {isExpanded && hasMetadata && (
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {log.os_name && (
                        <div>
                          <span className="text-muted-foreground">Operating System:</span>
                          <p className="font-medium">{log.os_name} {log.os_version}</p>
                        </div>
                      )}
                      
                      {log.screen_resolution && (
                        <div>
                          <span className="text-muted-foreground">Screen:</span>
                          <p className="font-medium">{log.screen_resolution}</p>
                        </div>
                      )}
                      
                      {log.timezone && (
                        <div>
                          <span className="text-muted-foreground">Timezone:</span>
                          <p className="font-medium">{log.timezone}</p>
                        </div>
                      )}
                      
                      {log.language && (
                        <div>
                          <span className="text-muted-foreground">Language:</span>
                          <p className="font-medium">{log.language}</p>
                        </div>
                      )}
                      
                      {log.device_fingerprint && (
                        <div>
                          <span className="text-muted-foreground">Device ID:</span>
                          <p className="font-medium font-mono text-[10px]">{log.device_fingerprint}</p>
                        </div>
                      )}
                      
                      {log.referrer && (
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-muted-foreground">Referrer:</span>
                          <p className="font-medium text-[10px] truncate">{log.referrer}</p>
                        </div>
                      )}
                      
                      {log.user_agent && (
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-muted-foreground">User Agent:</span>
                          <p className="font-medium text-[10px] break-all">{log.user_agent}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {searchTerm || filterDevice !== 'all' || filterBrowser !== 'all'
                  ? 'No matching activity found.'
                  : 'No activity recorded yet for this complaint.'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
