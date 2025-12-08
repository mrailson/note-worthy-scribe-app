import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import nresLogo from '@/assets/nres-logo.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BPInputOptions } from '@/components/bp-calculator/BPInputOptions';
import { BPReadingsTable } from '@/components/bp-calculator/BPReadingsTable';
import { BPSummaryCard } from '@/components/bp-calculator/BPSummaryCard';
import { BPNICESummaryCard } from '@/components/bp-calculator/BPNICESummaryCard';
import { BPTrendAnalysis } from '@/components/bp-calculator/BPTrendAnalysis';
import { BPExportOptions } from '@/components/bp-calculator/BPExportOptions';
import { BPModeSelector, BPMode } from '@/components/bp-calculator/BPModeSelector';
import { BPSitStandSummaryCard } from '@/components/bp-calculator/BPSitStandSummaryCard';
import { BPHistorySection } from '@/components/bp-calculator/BPHistorySection';
import { useBPCalculator, BPReading } from '@/hooks/useBPCalculator';
import { useBPHistory } from '@/hooks/useBPHistory';

const BPCalculator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [textInput, setTextInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [bpMode, setBpMode] = useState<BPMode>('standard');
  const lastSavedReadingsCount = useRef<number>(0);
  
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
    getNHSCategory,
    getNICECategory,
    getNICEHomeBPAverage,
    getTrends,
    getDataQualityScore,
    getDateRange,
    getQOFRelevance,
    getSitStandAverages
  } = useBPCalculator();

  const { sessions, isLoading: isLoadingHistory, saveSession, deleteSession } = useBPHistory();

  const isSitStandMode = bpMode === 'sit-stand';

  const handleCalculate = async () => {
    if (!textInput.trim() && uploadedFiles.length === 0) {
      return;
    }

    try {
      if (textInput.trim()) {
        await parseTextInput(textInput, isSitStandMode);
      }
      // Process all uploaded files
      for (const file of uploadedFiles) {
        await parseImageInput(file, isSitStandMode);
      }
    } catch (error) {
      console.error('Error parsing BP readings:', error);
    }
  };

  const handleClear = () => {
    setTextInput('');
    setUploadedFiles([]);
    setReadings([]);
    lastSavedReadingsCount.current = 0;
  };

  const averages = getAverages();
  const category = getNHSCategory();
  const niceCategory = getNICECategory();
  const niceAverage = getNICEHomeBPAverage();
  const trends = getTrends();
  const dataQuality = getDataQualityScore();
  const dateRange = getDateRange();
  const qofRelevance = getQOFRelevance();
  const sitStandAverages = getSitStandAverages();

  const includedCount = readings.filter(r => r.included).length;
  const excludedCount = readings.filter(r => !r.included).length;

  // Auto-save session when new readings are calculated (not loaded from history)
  useEffect(() => {
    // Only save if we have new readings that haven't been saved
    if (readings.length > 0 && averages && readings.length !== lastSavedReadingsCount.current) {
      const autoSave = async () => {
        await saveSession({
          mode: bpMode,
          readings,
          averages,
          niceAverage,
          niceCategory,
          nhsCategory: category,
          sitStandAverages: isSitStandMode ? sitStandAverages : null,
          trends,
          dataQuality,
          dateRange,
          qofRelevance,
          sourceText: textInput,
          sourceFilesCount: uploadedFiles.length
        });
        lastSavedReadingsCount.current = readings.length;
      };
      // Small delay to ensure all calculations are complete
      const timer = setTimeout(autoSave, 500);
      return () => clearTimeout(timer);
    }
  }, [readings.length]); // Only trigger when readings count changes

  const handleLoadSession = (sessionReadings: BPReading[], mode: 'standard' | 'sit-stand') => {
    setBpMode(mode);
    setReadings(sessionReadings);
    setTextInput('');
    setUploadedFiles([]);
    // Mark as already saved to prevent re-saving
    lastSavedReadingsCount.current = sessionReadings.length;
  };

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
          <div className="flex items-center justify-between">
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
                    Calculate average blood pressure from photos, scans, emails, letters, or handwritten logs
                  </p>
                </div>
              </div>
            </div>
            <img 
              src={nresLogo} 
              alt="NRES - Northamptonshire Rural East and South Neighbourhood" 
              className="h-14 w-auto hidden sm:block"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Selector */}
        <BPModeSelector 
          mode={bpMode} 
          onModeChange={setBpMode}
          disabled={isProcessing || readings.length > 0}
        />

        {/* Input Section */}
        <BPInputOptions 
          textValue={textInput}
          onTextChange={setTextInput}
          files={uploadedFiles}
          onFilesChange={setUploadedFiles}
          disabled={isProcessing}
        />

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleCalculate}
            disabled={isProcessing || (!textInput.trim() && uploadedFiles.length === 0)}
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
            {/* Sit/Stand Summary - ONLY shown when sit-stand mode is selected */}
            {isSitStandMode && (
              <BPSitStandSummaryCard sitStandAverages={sitStandAverages} />
            )}

            {/* Raw Average Summary Card */}
            {averages && (
              <BPSummaryCard 
                averages={averages}
                category={category}
                readingsCount={includedCount}
              />
            )}

            {/* NICE Home BP Average Card */}
            <BPNICESummaryCard 
              niceAverage={niceAverage}
              category={niceCategory}
            />

            {/* Trends and Data Quality */}
            <BPTrendAnalysis 
              trends={trends}
              dataQuality={dataQuality}
              dateRange={dateRange}
              qofRelevance={qofRelevance}
              totalReadings={readings.length}
              includedCount={includedCount}
              excludedCount={excludedCount}
            />

            {/* Readings Table */}
            <BPReadingsTable 
              readings={readings}
              onToggle={toggleReading}
              onUpdate={updateReading}
              onDelete={deleteReading}
              showPositionColumn={isSitStandMode}
            />

            {/* Export Options */}
            <BPExportOptions 
              readings={readings}
              averages={averages}
              category={category}
              niceAverage={niceAverage}
              niceCategory={niceCategory}
              trends={trends}
              dataQuality={dataQuality}
              dateRange={dateRange}
              qofRelevance={qofRelevance}
              originalText={textInput}
              originalImages={uploadedFiles}
              userEmail={user?.email}
              sitStandAverages={isSitStandMode ? sitStandAverages : undefined}
            />
          </div>
        )}

        {/* History Section */}
        <BPHistorySection
          sessions={sessions}
          isLoading={isLoadingHistory}
          onDelete={deleteSession}
          onLoadSession={handleLoadSession}
        />
      </div>
    </div>
  );
};

export default BPCalculator;
