import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Download, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const FormularyImporter = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const startImport = async () => {
    setIsImporting(true);
    setImportStatus('importing');
    
    try {
      const { data, error } = await supabase.functions.invoke('import-icn-formulary');
      
      if (error) {
        throw error;
      }
      
      setImportStatus('success');
      setProgress(data);
      
      toast({
        title: "Import Completed",
        description: `Successfully imported ${data.items_inserted} formulary items`,
      });
      
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus('error');
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import formulary",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between w-full cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded-md">
              <div>
                <CardTitle className="flex items-center gap-2 text-left">
                  <Download className="h-5 w-5" />
                  ICN Formulary Importer
                </CardTitle>
                <CardDescription className="text-left mt-1">
                  Import the Integrated Care Northamptonshire formulary data
                </CardDescription>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>This will:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Fetch formulary data from icnorthamptonshire.org.uk</li>
                  <li>Parse BNF chapters, sections, and preferred medicines</li>
                  <li>Clear and replace existing formulary data</li>
                  <li>Extract preference rankings and notes</li>
                </ul>
              </div>
              
              <Button 
                onClick={startImport} 
                disabled={isImporting}
                className="w-full"
              >
                {getStatusIcon()}
                {isImporting ? 'Importing...' : 'Start Formulary Import'}
              </Button>
              
              {progress && importStatus === 'success' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md space-y-2">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ Import completed successfully!
                  </p>
                  <div className="text-xs text-green-700 space-y-1">
                    <p>Items found: {progress.items_found}</p>
                    <p>Items inserted: {progress.items_inserted}</p>
                    <p>Final count: {progress.final_count}</p>
                    {progress.last_published && (
                      <p>Last published: {progress.last_published}</p>
                    )}
                  </div>
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};