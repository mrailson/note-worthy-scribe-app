import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Download, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportStats {
  totalMedicines: number;
  uniqueStatuses: number;
  firstImport: string | null;
  lastUpdated: string | null;
  statusBreakdown: { status_enum: string; count: number }[];
}

export const ICBTrafficLightManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Fetch summary stats
      const { data: summaryData, error: summaryError } = await supabase
        .from('traffic_light_medicines')
        .select('*', { count: 'exact', head: false });

      if (summaryError) throw summaryError;

      // Calculate status breakdown manually
      let statusBreakdown: { status_enum: string; count: number }[] = [];
      const { data: allMeds } = await supabase
        .from('traffic_light_medicines')
        .select('status_enum');
      
      if (allMeds) {
        const counts: Record<string, number> = {};
        allMeds.forEach(m => {
          counts[m.status_enum] = (counts[m.status_enum] || 0) + 1;
        });
        statusBreakdown = Object.entries(counts).map(([status_enum, count]) => ({
          status_enum,
          count
        })).sort((a, b) => b.count - a.count);
      }

      // Get date range
      const { data: dateData } = await supabase
        .from('traffic_light_medicines')
        .select('created_at, updated_at')
        .order('created_at', { ascending: true })
        .limit(1);

      const { data: lastUpdatedData } = await supabase
        .from('traffic_light_medicines')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);

      setStats({
        totalMedicines: summaryData?.length || 0,
        uniqueStatuses: statusBreakdown.length,
        firstImport: dateData?.[0]?.created_at || null,
        lastUpdated: lastUpdatedData?.[0]?.updated_at || null,
        statusBreakdown
      });
    } catch (error) {
      console.error('Error fetching ICB stats:', error);
      toast.error('Failed to load ICB traffic light statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !stats) {
      fetchStats();
    }
  }, [isOpen]);

  const handleFullScrape = async () => {
    setIsScraping(true);
    setScrapeProgress('Starting full scrape...');
    
    try {
      // Scrape in batches by letter to avoid timeout
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      let totalImported = 0;
      
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i];
        setScrapeProgress(`Scraping letter ${letter} (${i + 1}/${letters.length})...`);
        
        const { data, error } = await supabase.functions.invoke('scrape-icb-traffic-lights', {
          body: { letter }
        });
        
        if (error) {
          console.error(`Error scraping letter ${letter}:`, error);
          continue;
        }
        
        if (data?.imported) {
          totalImported += data.imported;
        }
      }
      
      setScrapeProgress(null);
      toast.success(`Full scrape complete! Imported/updated ${totalImported} medicines.`);
      await fetchStats();
    } catch (error) {
      console.error('Error during full scrape:', error);
      toast.error('Failed to complete full scrape');
      setScrapeProgress(null);
    } finally {
      setIsScraping(false);
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'GREEN':
        return 'default';
      case 'RED':
      case 'DOUBLE_RED':
        return 'destructive';
      case 'AMBER_1':
      case 'AMBER_2':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'GREEN': return 'Green';
      case 'RED': return 'Red';
      case 'DOUBLE_RED': return 'Double Red';
      case 'AMBER_1': return 'Amber 1';
      case 'AMBER_2': return 'Amber 2';
      case 'UNKNOWN': return 'Unknown';
      default: return status;
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between w-full cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded-md">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-left">ICB Traffic Light Medicines</CardTitle>
                  <CardDescription className="text-left mt-1">
                    Manage Northamptonshire ICB traffic light drug database
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stats && (
                  <Badge variant="secondary" className="font-mono">
                    {stats.totalMedicines.toLocaleString()} drugs
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading statistics...</span>
              </div>
            ) : stats ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats.totalMedicines.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Medicines</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats.uniqueStatuses}</div>
                    <div className="text-sm text-muted-foreground">Status Types</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">{formatDate(stats.firstImport)}</div>
                    <div className="text-sm text-muted-foreground">First Import</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium">{formatDate(stats.lastUpdated)}</div>
                    <div className="text-sm text-muted-foreground">Last Updated</div>
                  </div>
                </div>

                {/* Status Breakdown Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Traffic Light Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.statusBreakdown.map((row) => (
                        <TableRow key={row.status_enum}>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(row.status_enum)}>
                              {getStatusLabel(row.status_enum)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {((row.count / stats.totalMedicines) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStats}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                  </Button>
                  <Button
                    onClick={handleFullScrape}
                    disabled={isScraping}
                    size="sm"
                  >
                    {isScraping ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {isScraping ? 'Scraping...' : 'Full Scrape from ICB Website'}
                  </Button>
                </div>

                {/* Scrape Progress */}
                {scrapeProgress && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-blue-800 text-sm">{scrapeProgress}</span>
                    </div>
                  </div>
                )}

                {/* Info Note */}
                <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                  <p>
                    <strong>Note:</strong> The full scrape fetches all medicines from A-Z on the 
                    Northamptonshire ICB traffic light website. This may take 2-3 minutes to complete.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-5 w-5 mr-2" />
                Failed to load statistics
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
