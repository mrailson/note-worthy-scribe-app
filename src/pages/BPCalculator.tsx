import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BPTextInput } from '@/components/bp-calculator/BPTextInput';
import { BPImageUpload } from '@/components/bp-calculator/BPImageUpload';
import { BPReadingsTable } from '@/components/bp-calculator/BPReadingsTable';
import { BPSummaryCard } from '@/components/bp-calculator/BPSummaryCard';
import { BPExportOptions } from '@/components/bp-calculator/BPExportOptions';
import { useBPCalculator } from '@/hooks/useBPCalculator';
import { toast } from 'sonner';

const BPCalculator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [textInput, setTextInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const {
    readings,
    setReadings,
    isProcessing,
    parseTextInput,
    parseImageInput,
    toggleReading,
    updateReading,
    deleteReading,
    getAverages,
    getNHSCategory
  } = useBPCalculator();

  const handleCalculate = async () => {
    if (!textInput.trim() && !uploadedFile) {
      toast.error('Please enter text or upload an image');
      return;
    }

    try {
      if (textInput.trim()) {
        await parseTextInput(textInput);
      }
      if (uploadedFile) {
        await parseImageInput(uploadedFile);
      }
    } catch (error) {
      console.error('Error parsing BP readings:', error);
      toast.error('Failed to parse BP readings');
    }
  };

  const handleClear = () => {
    setTextInput('');
    setUploadedFile(null);
    setReadings([]);
  };

  const averages = getAverages();
  const category = getNHSCategory();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access BP Average Service</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">BP Average Service</h1>
                <p className="text-sm text-muted-foreground">
                  Calculate average blood pressure from emails, letters, or handwritten logs
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BPTextInput 
            value={textInput}
            onChange={setTextInput}
            disabled={isProcessing}
          />
          <BPImageUpload 
            file={uploadedFile}
            onFileChange={setUploadedFile}
            disabled={isProcessing}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleCalculate}
            disabled={isProcessing || (!textInput.trim() && !uploadedFile)}
            size="lg"
            className="min-w-[200px]"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              <>
                <Heart className="mr-2 h-5 w-5" />
                Calculate Average
              </>
            )}
          </Button>
          <Button
            onClick={handleClear}
            variant="outline"
            size="lg"
            disabled={isProcessing}
          >
            Clear All
          </Button>
        </div>

        {/* Results Section */}
        {readings.length > 0 && (
          <div className="space-y-6">
            {/* Summary Card */}
            {averages && (
              <BPSummaryCard 
                averages={averages}
                category={category}
                readingsCount={readings.filter(r => r.included).length}
              />
            )}

            {/* Readings Table */}
            <BPReadingsTable 
              readings={readings}
              onToggle={toggleReading}
              onUpdate={updateReading}
              onDelete={deleteReading}
            />

            {/* Export Options */}
            <BPExportOptions 
              readings={readings}
              averages={averages}
              category={category}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BPCalculator;
