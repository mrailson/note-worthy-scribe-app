import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const TrafficLightImporter = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<any>(null);
  const { toast } = useToast();

  const startImport = async () => {
    setIsImporting(true);
    setImportStatus('importing');
    
    try {
      const { data, error } = await supabase.functions.invoke('import-complete-traffic-light-medicines');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Import Started",
        description: "Importing all 886 medicines from 30 pages. This will take a few minutes.",
      });
      
      // Poll for progress every 3 seconds by checking database count
      const checkProgress = setInterval(async () => {
        try {
          // Check database count as a simple progress indicator
          const { count, error: countError } = await supabase
            .from('traffic_light_medicines')
            .select('*', { count: 'exact', head: true });
          
          if (!countError && count !== null) {
            const progressData = {
              status: count > 0 ? (count > 800 ? 'complete' : 'importing') : 'scraping',
              importedMedicines: count,
              foundMedicines: 886,
              message: count > 800 ? 'Import complete' : count > 0 ? `Imported ${count} medicines` : 'Scraping pages...'
            };
            
            setProgress(progressData);
            
            if (count > 800) { // Import likely complete
              clearInterval(checkProgress);
              setImportStatus('success');
              setIsImporting(false);
              toast({
                title: "Import Completed",
                description: `Successfully imported ${count} medicines!`,
              });
            }
          }
        } catch (err) {
          console.error('Progress check error:', err);
        }
      }, 3000);
      
      // Stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkProgress);
        if (isImporting) {
          setIsImporting(false);
          setImportStatus('error');
          toast({
            title: "Import Timeout",
            description: "Import is taking longer than expected. Check the function logs.",
            variant: "destructive"
          });
        }
      }, 300000);
      
    } catch (error) {
      console.error('Import error:', error);
      setIsImporting(false);
      setImportStatus('error');
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to start import",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = () => {
    switch (importStatus) {
      case 'importing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Traffic Light Medicines Importer
        </CardTitle>
        <CardDescription>
          Import the complete dataset of ~886 medicines from all 30 pages of the Northamptonshire ICB website
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>This will:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Fetch all 30 pages from icnorthamptonshire.org.uk</li>
              <li>Parse ~886 traffic light medicines</li>
              <li>Clear and replace existing data</li>
              <li>Take approximately 2-3 minutes to complete</li>
            </ul>
          </div>
          
          <Button 
            onClick={startImport} 
            disabled={isImporting}
            className="w-full"
          >
            {getStatusIcon()}
            {isImporting ? 'Importing...' : 'Start Full Import'}
          </Button>
          
          {/* Progress Display */}
          {progress && isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.message}</span>
                <span>{progress.status}</span>
              </div>
              
              {progress.status === 'scraping' && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Scraping pages...</span>
                    <span>Finding medicines</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '30%' }} />
                  </div>
                </div>
              )}
              
              {progress.status === 'importing' && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Importing medicines</span>
                    <span>{progress.importedMedicines} / ~886</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((progress.importedMedicines / 886) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {importStatus === 'success' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 text-sm">
                ✅ Import completed successfully! All medicines are now available in the search.
              </p>
            </div>
          )}
          
          {importStatus === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">
                ❌ Import failed. Please check the function logs for details.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};