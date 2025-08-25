import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock, Search, Upload, FileJson, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginForm } from '@/components/LoginForm';
import { Header } from '@/components/Header';
import AI4GPService from '@/components/AI4GPService';
import { DrugQuickModal } from '@/components/DrugQuickModal';
import { FloatingQuickActions } from '@/components/ai4gp/FloatingQuickActions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

const AI4GP = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [drugModalOpen, setDrugModalOpen] = useState(false);
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingICB, setIsFetchingICB] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);

  // Keyboard shortcut for Drug Quick Lookup (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        setDrugModalOpen(true);
      }
    };

    const handleOpenDrugModal = () => {
      setDrugModalOpen(true);
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('openDrugModal', handleOpenDrugModal);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('openDrugModal', handleOpenDrugModal);
    };
  }, []);

  // Fetch user profile to check AI4GP access
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('ai4gp_access')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const requestAccess = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would send a request to administrators
      // For now, we'll just show a message
      alert('Access request submitted. Please contact your administrator for AI4GP access.');
    } catch (error) {
      console.error('Error requesting access:', error);
    } finally {
      setLoading(false);
    }
  };

  // File upload handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setUploadedFiles(prev => [...prev, { name: file.name, content }]);
        };
        reader.readAsText(file);
      } else {
        toast.error(`File ${file.name} is not a JSON file`);
      }
    });
    
    // Reset the input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processJsonFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one JSON file');
      return;
    }

    setIsUploading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('import-prior-approval-data', {
        body: { files: uploadedFiles }
      });

      if (error) {
        console.error('Error processing files:', error);
        toast.error('Failed to process files');
        return;
      }

      if (data?.success) {
        toast.success(`Import completed: ${data.totalInserted} inserted, ${data.totalUpdated} updated`);
        setUploadedFiles([]);
        setShowUploadSection(false);
      } else {
        toast.error('Failed to process files');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while processing files');
    } finally {
      setIsUploading(false);
    }
  };

  const fetchICBData = async () => {
    setIsFetchingICB(true);
    
    try {
      toast.info('Fetching ICB traffic light drugs data... This may take a few minutes.');
      
      const { data, error } = await supabase.functions.invoke('fetch-icb-traffic-light-drugs');

      if (error) {
        console.error('Error fetching ICB data:', error);
        toast.error('Failed to fetch ICB data');
        return;
      }

      if (data?.success) {
        toast.success(`Successfully fetched ${data.totalItems} drugs from ICB`);
        
        // Optionally auto-import the fetched data
        const importData = {
          files: [{
            name: 'ICB_Traffic_Light_Drugs.json',
            content: JSON.stringify(data.data)
          }]
        };
        
        const { data: importResult, error: importError } = await supabase.functions.invoke('import-prior-approval-data', {
          body: importData
        });
        
        if (importError) {
          console.error('Error importing ICB data:', importError);
          toast.error('Fetched data but failed to import');
          return;
        }
        
        if (importResult?.success) {
          toast.success(`ICB import completed: ${importResult.totalInserted} inserted, ${importResult.totalUpdated} updated`);
        }
        
      } else {
        toast.error('Failed to fetch ICB data');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while fetching ICB data');
    } finally {
      setIsFetchingICB(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">AI4GP Service</h1>
              <p className="text-muted-foreground">
                Please log in to access the AI4GP service
              </p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    );
  }

  // Check if user has AI4GP access
  if (!profile?.ai4gp_access) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <Card className="w-full max-w-md p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Access Required</h2>
                <p className="text-muted-foreground mb-4">
                  You need permission to access the AI4GP service. Please contact your administrator to request access.
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  AI4GP access is controlled at the user level and must be granted by system administrators.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={requestAccess} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Requesting...' : 'Request Access'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col mobile-container safe-area-top safe-area-bottom">
      <Header onNewMeeting={() => {}} />
      
      {/* Drug Quick Lookup Button */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-2 sm:px-4 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrugModalOpen(true)}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Drug Quick Lookup
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">Ctrl</span>K
              </kbd>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploadSection(!showUploadSection)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Update Prior Approval Data
            </Button>
          </div>
        </div>
      </div>

      {/* Prior Approval Data Upload Section */}
      {showUploadSection && (
        <div className="border-b bg-muted/50">
          <div className="container mx-auto px-2 sm:px-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Upload Prior Approval JSON Files
                </CardTitle>
                <CardDescription>
                  Upload up to 3 JSON files containing prior approval data to update the medicine lookup database.
                </CardDescription>
              </CardHeader>
               <CardContent className="space-y-4">
                 {/* ICB Data Fetch Button */}
                 <div className="space-y-2">
                   <Button
                     onClick={fetchICBData}
                     disabled={isFetchingICB || isUploading}
                     className="w-full gap-2"
                     variant="default"
                   >
                     <FileJson className="h-4 w-4" />
                     {isFetchingICB ? 'Fetching ICB Data...' : 'Fetch Latest ICB Traffic Light Drugs'}
                   </Button>
                   <p className="text-xs text-muted-foreground text-center">
                     Automatically fetch and import the latest traffic light medicines from NHS Northamptonshire ICB (886 drugs)
                   </p>
                 </div>

                 <div className="flex items-center gap-4">
                   <div className="flex-1 h-px bg-border"></div>
                   <span className="text-xs text-muted-foreground uppercase tracking-wider">OR</span>
                   <div className="flex-1 h-px bg-border"></div>
                 </div>

                 {/* File Upload Input */}
                 <div className="space-y-2">
                   <input
                     type="file"
                     accept=".json,application/json"
                     multiple
                     onChange={handleFileUpload}
                     className="hidden"
                     id="json-file-upload"
                   />
                   <Button
                     variant="outline"
                     onClick={() => document.getElementById('json-file-upload')?.click()}
                     className="w-full gap-2"
                     disabled={isUploading || isFetchingICB}
                   >
                     <Upload className="h-4 w-4" />
                     Upload Your Own JSON Files
                   </Button>
                   <p className="text-xs text-muted-foreground text-center">
                     Upload custom JSON files with drug information
                   </p>
                 </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Uploaded Files:</h4>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isUploading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Process Button */}
                {uploadedFiles.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={processJsonFiles}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      {isUploading ? 'Processing...' : `Process ${uploadedFiles.length} File${uploadedFiles.length !== 1 ? 's' : ''}`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setUploadedFiles([])}
                      disabled={isUploading}
                    >
                      Clear All
                    </Button>
                  </div>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    JSON files should contain an array of objects with drug information including prior_approval_criteria and traffic_light_status fields.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      <Separator />
      
      <main className="flex-1 flex flex-col min-h-0 mobile-scroll">
        <div className="flex-1 container mx-auto px-2 sm:px-4 py-4 sm:py-6 flex flex-col min-h-0 overflow-y-auto space-y-6">
          <AI4GPService />
        </div>
        
        {/* Floating Quick Actions */}
        {user && profile?.ai4gp_access && (
          <FloatingQuickActions
            setInput={() => {}}
            onOpenDrugModal={() => setDrugModalOpen(true)}
            onOpenAITestModal={() => {}}
            onOpenNews={() => {}}
            onOpenImageService={() => {}}
            onOpenQuickImageModal={() => {}}
          />
        )}
      </main>

      {/* Drug Quick Lookup Modal */}
      <DrugQuickModal 
        open={drugModalOpen} 
        onClose={() => setDrugModalOpen(false)} 
      />
    </div>
  );
};

export default AI4GP;