import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BPInputOptions } from '@/components/bp-calculator/BPInputOptions';
import { BPReadingsTable } from '@/components/bp-calculator/BPReadingsTable';
import { BPSummaryCard } from '@/components/bp-calculator/BPSummaryCard';
import { BPNICESummaryCard } from '@/components/bp-calculator/BPNICESummaryCard';
import { BPTrendAnalysis } from '@/components/bp-calculator/BPTrendAnalysis';
import { BPExportOptions } from '@/components/bp-calculator/BPExportOptions';
import { BPModeSelector, BPMode } from '@/components/bp-calculator/BPModeSelector';
import { BPSitStandSummaryCard } from '@/components/bp-calculator/BPSitStandSummaryCard';
import { useBPCalculator } from '@/hooks/useBPCalculator';

interface BPCalculatorPanelProps {
  cleanView?: boolean;
}

export const BPCalculatorPanel = ({ cleanView }: BPCalculatorPanelProps) => {
  const [textInput, setTextInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [bpMode, setBpMode] = useState<BPMode>('standard');
  
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

  const isSitStandMode = bpMode === 'sit-stand';

  const handleCalculate = async () => {
    if (!textInput.trim() && uploadedFiles.length === 0) {
      return;
    }

    try {
      if (textInput.trim()) {
        await parseTextInput(textInput, isSitStandMode);
      }
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

  return (
    <div className="space-y-6">
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
          {/* Sit/Stand Summary */}
          {isSitStandMode && (
            <BPSitStandSummaryCard sitStandAverages={sitStandAverages} />
          )}

          {/* Raw Average Summary Card */}
          {averages && (
            <BPSummaryCard 
              averages={averages}
              category={category}
              readingsCount={includedCount}
              diaryEntryCount={isSitStandMode ? sitStandAverages.diaryEntryCount : undefined}
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
            diaryEntryCount={isSitStandMode ? sitStandAverages.diaryEntryCount : undefined}
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
            sitStandAverages={isSitStandMode ? sitStandAverages : undefined}
          />
        </div>
      )}

      <div className="text-center pt-6 pb-4 px-4 space-y-1">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
          This is a test developmental service. There are known issues with AI hallucinations. 
          The clinician should always double-check the data before use.
        </p>
        <p className="text-sm text-muted-foreground">
          For any suggestions or feedback, please email{' '}
          <a href="mailto:malcolm.railson@nhs.net" className="underline hover:text-foreground">
            malcolm.railson@nhs.net
          </a>
        </p>
      </div>
    </div>
  );
};
