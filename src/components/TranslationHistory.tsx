import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Shield,
  ShieldAlert,
  Calendar,
  Timer
} from 'lucide-react';
import { toast } from 'sonner';

export interface TranslationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  accuracy?: number; // 0-100
  confidence?: number; // 0-100  
  safetyFlag?: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected?: string[];
  translationLatency?: number; // milliseconds
}

interface TranslationHistoryProps {
  translations: TranslationEntry[];
  sessionStart: Date;
  patientLanguage: string;
  onExportDOCX: () => void;
}

interface SessionMetrics {
  totalTranslations: number;
  averageAccuracy: number;
  averageConfidence: number;
  sessionDuration: number;
  safeTranslations: number;
  warningTranslations: number;
  unsafeTranslations: number;
  overallSafetyRating: 'safe' | 'warning' | 'unsafe';
  medicalTermsCount: number;
  averageLatency: number;
}

const TranslationHistory: React.FC<TranslationHistoryProps> = ({
  translations,
  sessionStart,
  patientLanguage,
  onExportDOCX
}) => {
  const getLanguageName = (code: string) => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  // Deduplicate translations based on exact timestamp to prevent showing duplicates
  const deduplicatedTranslations = useMemo(() => {
    const seen = new Set();
    return translations.filter(translation => {
      const timestamp = translation.timestamp.getTime();
      if (seen.has(timestamp)) {
        console.warn('Duplicate translation detected and filtered:', { timestamp: translation.timestamp, text: translation.originalText });
        return false;
      }
      seen.add(timestamp);
      return true;
    });
  }, [translations]);

  // Calculate session metrics
  const sessionMetrics: SessionMetrics = useMemo(() => {
    if (deduplicatedTranslations.length === 0) {
      return {
        totalTranslations: 0,
        averageAccuracy: 0,
        averageConfidence: 0,
        sessionDuration: 0,
        safeTranslations: 0,
        warningTranslations: 0,
        unsafeTranslations: 0,
        overallSafetyRating: 'safe',
        medicalTermsCount: 0,
        averageLatency: 0
      };
    }

    const now = new Date();
    const sessionDuration = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
    
    const accuracies = deduplicatedTranslations.filter(t => t.accuracy !== undefined).map(t => t.accuracy!);
    const confidences = deduplicatedTranslations.filter(t => t.confidence !== undefined).map(t => t.confidence!);
    const latencies = deduplicatedTranslations.filter(t => t.translationLatency !== undefined).map(t => t.translationLatency!);
    
    const safeTranslations = deduplicatedTranslations.filter(t => t.safetyFlag === 'safe').length;
    const warningTranslations = deduplicatedTranslations.filter(t => t.safetyFlag === 'warning').length;
    const unsafeTranslations = deduplicatedTranslations.filter(t => t.safetyFlag === 'unsafe').length;
    
    const allMedicalTerms = deduplicatedTranslations.flatMap(t => t.medicalTermsDetected || []);
    const uniqueMedicalTerms = [...new Set(allMedicalTerms)];
    
    // Determine overall safety rating
    let overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 'safe';
    if (unsafeTranslations > 0) {
      overallSafetyRating = 'unsafe';
    } else if (warningTranslations > deduplicatedTranslations.length * 0.3) {
      overallSafetyRating = 'warning';
    }

    return {
      totalTranslations: deduplicatedTranslations.length,
      averageAccuracy: accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0,
      averageConfidence: confidences.length > 0 ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0,
      sessionDuration,
      safeTranslations,
      warningTranslations,  
      unsafeTranslations,
      overallSafetyRating,
      medicalTermsCount: uniqueMedicalTerms.length,
      averageLatency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0
    };
  }, [deduplicatedTranslations, sessionStart]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600 bg-green-50';
    if (accuracy >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSafetyBadge = (safetyFlag: 'safe' | 'warning' | 'unsafe' | undefined) => {
    switch (safetyFlag) {
      case 'safe':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200"><CheckCircle className="w-3 h-3 mr-1" />Safe</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      case 'unsafe':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200"><XCircle className="w-3 h-3 mr-1" />Unsafe</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getOverallSafetyIcon = (rating: 'safe' | 'warning' | 'unsafe') => {
    switch (rating) {
      case 'safe':
        return <Shield className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'unsafe':
        return <ShieldAlert className="w-5 h-5 text-red-600" />;
    }
  };

  const handleExportDOCX = () => {
    // This will be handled by the parent component
    onExportDOCX();
    toast.success('Exporting translation history to DOCX...');
  };

  return (
    <div className="space-y-6">
      {/* Session Overview */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Translation Session Summary
            <Button
              onClick={handleExportDOCX}
              className="ml-auto"
              variant="default"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to DOCX
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Session Date</span>
              </div>
              <p className="text-lg font-bold text-blue-900">{sessionStart.toLocaleDateString()}</p>
              <p className="text-sm text-muted-foreground">{sessionStart.toLocaleTimeString()}</p>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Duration</span>
              </div>
              <p className="text-lg font-bold text-purple-900">{formatDuration(sessionMetrics.sessionDuration)}</p>
            </div>

            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Translations</span>
              </div>
              <p className="text-lg font-bold text-green-900">{sessionMetrics.totalTranslations}</p>
            </div>

            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-orange-600" />  
                <span className="text-sm font-medium text-orange-700">Avg Accuracy</span>
              </div>
              <p className="text-lg font-bold text-orange-900">{sessionMetrics.averageAccuracy}%</p>
            </div>

            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700">Avg Latency</span>
              </div>
              <p className="text-lg font-bold text-indigo-900">{sessionMetrics.averageLatency}ms</p>
            </div>

            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                {getOverallSafetyIcon(sessionMetrics.overallSafetyRating)}
                <span className="text-sm font-medium text-slate-700">Safety Rating</span>
              </div>
              <p className="text-lg font-bold text-slate-900 capitalize">{sessionMetrics.overallSafetyRating}</p>
            </div>
          </div>

          {/* Detailed Safety Breakdown */}
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3">Safety Assessment Breakdown</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm">Safe: {sessionMetrics.safeTranslations}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm">Warning: {sessionMetrics.warningTranslations}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm">Unsafe: {sessionMetrics.unsafeTranslations}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Medical terms detected: {sessionMetrics.medicalTermsCount} unique terms
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Translation History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Translation History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {deduplicatedTranslations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No translations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deduplicatedTranslations.map((translation, index) => (
                  <div
                    key={translation.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedEntry === translation.id ? 'ring-2 ring-primary' : ''
                    } ${
                      translation.speaker === 'gp' 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-green-50 border-green-200'
                    }`}
                    onClick={() => setSelectedEntry(selectedEntry === translation.id ? null : translation.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            #{index + 1} {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {translation.timestamp.toLocaleTimeString()}
                          </span>
                          {translation.accuracy !== undefined && (
                            <Badge className={getAccuracyColor(translation.accuracy)}>
                              {translation.accuracy}% accuracy
                            </Badge>
                          )}
                          {translation.safetyFlag && getSafetyBadge(translation.safetyFlag)}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="p-2 bg-white/60 rounded border-l-2 border-l-blue-400">
                            <p className="text-sm font-medium text-blue-700">Original:</p>
                            <p className="text-sm">{translation.originalText}</p>
                          </div>
                          <div className="p-2 bg-white/60 rounded border-l-2 border-l-green-400">
                            <p className="text-sm font-medium text-green-700">Translation:</p>
                            <p className="text-sm">{translation.translatedText}</p>
                          </div>
                        </div>

                        {selectedEntry === translation.id && (
                          <div className="mt-3 pt-3 border-t bg-white/40 rounded p-3">
                            <h5 className="font-medium mb-2">Technical Details</h5>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="font-medium">Languages:</span>
                                <p>{getLanguageName(translation.originalLanguage)} → {getLanguageName(translation.targetLanguage)}</p>
                              </div>
                              {translation.confidence !== undefined && (
                                <div>
                                  <span className="font-medium">Confidence:</span>
                                  <p>{translation.confidence}%</p>
                                </div>
                              )}
                              {translation.translationLatency !== undefined && (
                                <div>
                                  <span className="font-medium">Processing Time:</span>
                                  <p>{translation.translationLatency}ms</p>
                                </div>
                              )}
                              {translation.medicalTermsDetected && translation.medicalTermsDetected.length > 0 && (
                                <div className="col-span-2">
                                  <span className="font-medium">Medical Terms:</span>
                                  <p>{translation.medicalTermsDetected.join(', ')}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TranslationHistory;