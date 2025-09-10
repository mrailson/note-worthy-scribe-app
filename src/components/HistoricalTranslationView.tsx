import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft,
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
import { TranslationEntry } from '@/components/TranslationHistory';
import { TranslationScore } from '@/utils/translationScoring';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';
import { PracticeInfoForm } from '@/components/PracticeInfoForm';
import { usePatientDocumentTranslation } from '@/hooks/usePatientDocumentTranslation';
import { toast } from 'sonner';

interface HistoricalTranslationViewProps {
  sessionId: string;
  sessionTitle: string;
  translations: TranslationEntry[];
  translationScores: TranslationScore[];
  sessionMetadata: {
    sessionStart: Date;
    sessionEnd?: Date;
    patientLanguage: string;
    totalTranslations: number;
    averageAccuracy: number;
    averageConfidence: number;
    overallSafetyRating: 'safe' | 'warning' | 'unsafe';
    safeCount: number;
    warningCount: number;
    unsafeCount: number;
    sessionDuration?: number;
  };
  onBack: () => void;
}

export const HistoricalTranslationView: React.FC<HistoricalTranslationViewProps> = ({
  sessionId,
  sessionTitle,
  translations,
  translationScores,
  sessionMetadata,
  onBack
}) => {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [showPracticeForm, setShowPracticeForm] = useState(false);
  const [isPatientExport, setIsPatientExport] = useState(false);
  const [practiceInfo, setPracticeInfo] = useState({
    name: '',
    address: '',
    phone: ''
  });

  const { translatePatientDocument, isTranslating } = usePatientDocumentTranslation();

  // Deduplicate translations based on exact timestamp to prevent duplicates
  const deduplicatedTranslations = React.useMemo(() => {
    const seen = new Set();
    return translations.filter(translation => {
      // Handle all possible timestamp formats
      let timestamp: number;
      
      if (typeof translation.timestamp === 'number') {
        timestamp = translation.timestamp;
      } else if (translation.timestamp instanceof Date) {
        timestamp = translation.timestamp.getTime();
      } else if (typeof translation.timestamp === 'string') {
        timestamp = new Date(translation.timestamp).getTime();
      } else {
        // Fallback for any other type - use current time or index
        timestamp = Date.now() + Math.random();
      }
      
      if (seen.has(timestamp)) {
        return false;
      }
      seen.add(timestamp);
      return true;
    });
  }, [translations]);

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

  const handleExportDOCX = async () => {
    try {
      const metadata: SessionMetadata = {
        sessionDate: sessionMetadata.sessionStart,
        sessionStart: sessionMetadata.sessionStart,
        sessionEnd: sessionMetadata.sessionEnd || new Date(),
        patientLanguage: sessionMetadata.patientLanguage,
        totalTranslations: sessionMetadata.totalTranslations,
        sessionDuration: sessionMetadata.sessionDuration || 0,
        overallSafetyRating: sessionMetadata.overallSafetyRating,
        averageAccuracy: sessionMetadata.averageAccuracy,
        averageConfidence: sessionMetadata.averageConfidence
      };

      await downloadDOCX(deduplicatedTranslations, metadata, translationScores);
      toast.success('Historical session exported to DOCX successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export historical session');
    }
  };

  const handlePatientExport = async () => {
    setIsPatientExport(true);
    setShowPracticeForm(true);
  };

  const handlePracticeFormSave = async () => {
    if (!practiceInfo.name || !practiceInfo.address) {
      toast.error('Please fill in practice name and address');
      return;
    }

    try {
      setShowPracticeForm(false);
      
      // Translate document content if needed
      const translatedContent = await translatePatientDocument(
        sessionMetadata.patientLanguage,
        practiceInfo
      );

      const metadata: SessionMetadata = {
        sessionDate: sessionMetadata.sessionStart,
        sessionStart: sessionMetadata.sessionStart,
        sessionEnd: sessionMetadata.sessionEnd || new Date(),
        patientLanguage: sessionMetadata.patientLanguage,
        totalTranslations: sessionMetadata.totalTranslations,
        sessionDuration: sessionMetadata.sessionDuration || 0,
        overallSafetyRating: sessionMetadata.overallSafetyRating,
        averageAccuracy: sessionMetadata.averageAccuracy,
        averageConfidence: sessionMetadata.averageConfidence,
        practiceInfo
      };

      // Filter out technical scores and details for patient copy
      const patientFriendlyScores = translationScores.map(score => ({
        ...score,
        issues: [], // Remove technical issues from patient copy
        medicalTermsDetected: [] // Remove medical terms analysis from patient copy
      }));

      await downloadDOCX(deduplicatedTranslations, metadata, patientFriendlyScores, true, translatedContent);
      toast.success('Patient copy exported successfully');
    } catch (error) {
      console.error('Patient export error:', error);
      toast.error('Failed to export patient copy');
    } finally {
      setIsPatientExport(false);
    }
  };

  const handlePracticeFormCancel = () => {
    setShowPracticeForm(false);
    setIsPatientExport(false);
    setPracticeInfo({ name: '', address: '', phone: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sessions
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {sessionTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Historical Translation Session</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportDOCX}
                variant="default"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                GP Export
              </Button>
              <Button
                onClick={handlePatientExport}
                variant="outline"
                size="sm"
                disabled={isTranslating}
              >
                <Download className="w-4 h-4 mr-2" />
                {isTranslating ? 'Preparing...' : 'Patient Copy'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Session Overview */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Session Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Session Date</span>
              </div>
              <p className="text-lg font-bold text-blue-900">{sessionMetadata.sessionStart.toLocaleDateString()}</p>
              <p className="text-sm text-muted-foreground">{sessionMetadata.sessionStart.toLocaleTimeString()}</p>
            </div>
            
            {sessionMetadata.sessionDuration && (
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Timer className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Duration</span>
                </div>
                <p className="text-lg font-bold text-purple-900">{formatDuration(sessionMetadata.sessionDuration)}</p>
              </div>
            )}

            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Translations</span>
              </div>
              <p className="text-lg font-bold text-green-900">{sessionMetadata.totalTranslations}</p>
            </div>

            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-orange-600" />  
                <span className="text-sm font-medium text-orange-700">Avg Accuracy</span>
              </div>
              <p className="text-lg font-bold text-orange-900">{sessionMetadata.averageAccuracy}%</p>
            </div>

            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700">Avg Confidence</span>
              </div>
              <p className="text-lg font-bold text-indigo-900">{sessionMetadata.averageConfidence}%</p>
            </div>

            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                {getOverallSafetyIcon(sessionMetadata.overallSafetyRating)}
                <span className="text-sm font-medium text-slate-700">Safety Rating</span>
              </div>
              <p className="text-lg font-bold text-slate-900 capitalize">{sessionMetadata.overallSafetyRating}</p>
            </div>
          </div>

          {/* Detailed Safety Breakdown */}
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3">Safety Assessment Breakdown</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm">Safe: {sessionMetadata.safeCount}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm">Warning: {sessionMetadata.warningCount}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm">Unsafe: {sessionMetadata.unsafeCount}</span>
              </div>
            </div>
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
                <p>No translations found in this session</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deduplicatedTranslations.map((translation, index) => {
                  const score = translationScores[index];
                  return (
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
                              {(() => {
                                if (typeof translation.timestamp === 'number') {
                                  return new Date(translation.timestamp).toLocaleTimeString();
                                } else if (translation.timestamp instanceof Date) {
                                  return translation.timestamp.toLocaleTimeString();
                                } else if (typeof translation.timestamp === 'string') {
                                  return new Date(translation.timestamp).toLocaleTimeString();
                                } else {
                                  return 'Unknown time';
                                }
                              })()}
                            </span>
                            {score && score.accuracy !== undefined && (
                              <Badge className={getAccuracyColor(score.accuracy)}>
                                {score.accuracy}% accuracy
                              </Badge>
                            )}
                            {score && score.confidence !== undefined && (
                              <Badge className={getAccuracyColor(score.confidence)}>
                                {score.confidence}% confidence
                              </Badge>
                            )}
                            {score && score.safetyFlag && getSafetyBadge(score.safetyFlag)}
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
                                  <p>{translation.originalLanguage} → {translation.targetLanguage}</p>
                                </div>
                                {score && score.confidence !== undefined && (
                                  <div>
                                    <span className="font-medium">Confidence:</span>
                                    <p>{score.confidence}%</p>
                                  </div>
                                )}
                                {translation.translationLatency !== undefined && (
                                  <div>
                                    <span className="font-medium">Processing Time:</span>
                                    <p>{translation.translationLatency}ms</p>
                                  </div>
                                )}
                                {score && score.medicalTermsDetected && score.medicalTermsDetected.length > 0 && (
                                  <div className="col-span-2">
                                    <span className="font-medium">Medical Terms:</span>
                                    <p>{score.medicalTermsDetected.join(', ')}</p>
                                  </div>
                                )}
                                {score && score.issues && score.issues.length > 0 && (
                                  <div className="col-span-2">
                                    <span className="font-medium">Issues:</span>
                                    <p className="text-red-600">{score.issues.join(', ')}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Practice Information Dialog */}
      <Dialog open={showPracticeForm} onOpenChange={setShowPracticeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Practice Information Required</DialogTitle>
          </DialogHeader>
          <PracticeInfoForm
            practiceInfo={practiceInfo}
            onPracticeInfoChange={setPracticeInfo}
            onSave={handlePracticeFormSave}
            onCancel={handlePracticeFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};