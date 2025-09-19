import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
  Timer,
  Trash2,
  Trash,
  CheckSquare,
  Square,
  History,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  translationType?: string; // Add translation type prop
  onExportDOCX: () => void;
  onDeleteTranslation?: (translationId: string) => void;
  onDeleteSelectedTranslations?: (translationIds: string[]) => void;
  onDeleteAllTranslations?: () => void;
  isHistorical?: boolean; // Flag to indicate if this is historical data (read-only)
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
  translationType = 'Live Speech Translation', // Default value
  onExportDOCX,
  onDeleteTranslation,
  onDeleteSelectedTranslations,
  onDeleteAllTranslations,
  isHistorical = false
}) => {
  const getLanguageName = (code: string) => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };
  
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [selectedTranslations, setSelectedTranslations] = useState<Set<string>>(new Set());
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<{
    type: 'single' | 'selected' | 'all';
    translationId?: string;
  } | null>(null);
  const [showLastOnly, setShowLastOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem('translation-history-view');
    return saved ? JSON.parse(saved) : false;
  });

  // Persist toggle selection
  useEffect(() => {
    localStorage.setItem('translation-history-view', JSON.stringify(showLastOnly));
  }, [showLastOnly]);

  // Handle individual selection
  const handleTranslationSelect = (translationId: string, checked: boolean) => {
    const newSelected = new Set(selectedTranslations);
    if (checked) {
      newSelected.add(translationId);
    } else {
      newSelected.delete(translationId);
    }
    setSelectedTranslations(newSelected);
  };

  // Handle select all/none
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTranslations(new Set(deduplicatedTranslations.map(t => t.id)));
    } else {
      setSelectedTranslations(new Set());
    }
  };

  // Handle delete confirmation
  const handleConfirmDelete = () => {
    if (!showDeleteConfirmation) return;

    switch (showDeleteConfirmation.type) {
      case 'single':
        if (showDeleteConfirmation.translationId && onDeleteTranslation) {
          onDeleteTranslation(showDeleteConfirmation.translationId);
          toast.success('Translation deleted');
        }
        break;
      case 'selected':
        if (selectedTranslations.size > 0 && onDeleteSelectedTranslations) {
          onDeleteSelectedTranslations(Array.from(selectedTranslations));
          setSelectedTranslations(new Set());
          toast.success(`${selectedTranslations.size} translations deleted`);
        }
        break;
      case 'all':
        if (onDeleteAllTranslations) {
          onDeleteAllTranslations();
          setSelectedTranslations(new Set());
          toast.success('All translations deleted');
        }
        break;
    }
    setShowDeleteConfirmation(null);
  };

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

  // Filter translations based on view mode
  const displayedTranslations = useMemo(() => {
    if (showLastOnly && deduplicatedTranslations.length > 0) {
      // Sort by timestamp descending and return only the most recent one
      const sorted = [...deduplicatedTranslations].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return [sorted[0]];
    }
    return deduplicatedTranslations;
  }, [deduplicatedTranslations, showLastOnly]);

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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Session Date</span>
              </div>
              <p className="text-lg font-bold text-blue-900">{sessionStart.toLocaleDateString()}</p>
              <p className="text-sm text-muted-foreground">{sessionStart.toLocaleTimeString()}</p>
            </div>

            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Translation Type</span>
              </div>
              <p className="text-lg font-bold text-emerald-900">{translationType}</p>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>Translation History</CardTitle>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {showLastOnly ? 'Last Translation Only' : 'Full History'}
                </span>
                <Switch
                  id="history-toggle"
                  checked={showLastOnly}
                  onCheckedChange={setShowLastOnly}
                />
                <History className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            {!isHistorical && !showLastOnly && (onDeleteTranslation || onDeleteSelectedTranslations || onDeleteAllTranslations) && (
              <div className="flex items-center gap-2">
                {deduplicatedTranslations.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedTranslations.size === deduplicatedTranslations.length && deduplicatedTranslations.length > 0}
                      onCheckedChange={handleSelectAll}
                      className="mr-2"
                    />
                    <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                      Select All ({selectedTranslations.size}/{deduplicatedTranslations.length})
                    </label>
                  </div>
                )}
                
                {selectedTranslations.size > 0 && onDeleteSelectedTranslations && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirmation({ type: 'selected' })}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedTranslations.size})
                  </Button>
                )}
                
                {deduplicatedTranslations.length > 0 && onDeleteAllTranslations && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash className="w-4 h-4" />
                        Delete All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Translations?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all {deduplicatedTranslations.length} translations from this session. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => setShowDeleteConfirmation({ type: 'all' })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {displayedTranslations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No translations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedTranslations.map((translation, index) => (
                  <div
                    key={translation.id}
                    className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                      selectedEntry === translation.id ? 'ring-2 ring-primary' : ''
                    } ${
                      translation.speaker === 'gp' 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {!isHistorical && !showLastOnly && onDeleteTranslation && (
                          <Checkbox
                            checked={selectedTranslations.has(translation.id)}
                            onCheckedChange={(checked) => 
                              handleTranslationSelect(translation.id, checked as boolean)
                            }
                            className="mt-1"
                          />
                        )}
                        
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedEntry(selectedEntry === translation.id ? null : translation.id)}
                        >
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
                      
                      {!isHistorical && !showLastOnly && onDeleteTranslation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeleteConfirmation({ type: 'single', translationId: translation.id })}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!showDeleteConfirmation} onOpenChange={() => setShowDeleteConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showDeleteConfirmation?.type === 'single' && 'Delete Translation?'}
              {showDeleteConfirmation?.type === 'selected' && `Delete ${selectedTranslations.size} Selected Translations?`}
              {showDeleteConfirmation?.type === 'all' && 'Delete All Translations?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showDeleteConfirmation?.type === 'single' && 
                'This translation will be permanently deleted. This action cannot be undone.'
              }
              {showDeleteConfirmation?.type === 'selected' && 
                `The ${selectedTranslations.size} selected translations will be permanently deleted. This action cannot be undone.`
              }
              {showDeleteConfirmation?.type === 'all' && 
                `All ${deduplicatedTranslations.length} translations in this session will be permanently deleted. This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {showDeleteConfirmation?.type === 'single' && 'Delete'}
              {showDeleteConfirmation?.type === 'selected' && `Delete ${selectedTranslations.size}`}
              {showDeleteConfirmation?.type === 'all' && 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TranslationHistory;