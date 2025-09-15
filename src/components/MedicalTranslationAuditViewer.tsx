import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Download,
  Search,
  Shield,
  Activity
} from 'lucide-react';
import { MedicalTranslationAuditTrail } from '@/utils/medicalTranslationAudit';
import { Input } from '@/components/ui/input';

export const MedicalTranslationAuditViewer: React.FC = () => {
  const getLanguageName = (code: string) => {
    if (!code) return 'Unknown';
    const lower = code.toLowerCase();
    const base = lower.split('-')[0];
    const match = HEALTHCARE_LANGUAGES.find(l => l.code === lower) || HEALTHCARE_LANGUAGES.find(l => l.code === base);
    return match?.name || (base ? base.charAt(0).toUpperCase() + base.slice(1) : code);
  };
  const [isOpen, setIsOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [complianceReport, setComplianceReport] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadAuditData();
    }
  }, [isOpen]);

  const loadAuditData = () => {
    const log = MedicalTranslationAuditTrail.getAuditLog();
    const report = MedicalTranslationAuditTrail.generateComplianceReport();
    setAuditLog(log);
    setComplianceReport(report);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      const results = MedicalTranslationAuditTrail.searchTranslations(searchQuery);
      setAuditLog(results);
    } else {
      const log = MedicalTranslationAuditTrail.getAuditLog();
      setAuditLog(log);
    }
  };

  const getSafetyColor = (level: string) => {
    switch (level) {
      case 'safe': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'unsafe': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSafetyIcon = (level: string) => {
    switch (level) {
      case 'safe': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'unsafe': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const exportAuditLog = () => {
    const exportData = MedicalTranslationAuditTrail.exportAuditLog();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-translation-audit-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          View Translation Audit
          {auditLog.length > 0 && (
            <Badge variant="secondary">{auditLog.length} Records</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Medical Translation Audit Log
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Compliance Summary */}
          {complianceReport && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {complianceReport.safeTranslations}
                  </div>
                  <div className="text-sm text-gray-600">Safe Translations</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {complianceReport.warningTranslations}
                  </div>
                  <div className="text-sm text-gray-600">Warning Level</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {complianceReport.unsafeTranslations}
                  </div>
                  <div className="text-sm text-gray-600">Unsafe/Manual Review</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(complianceReport.averageConfidence * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Avg Confidence</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search and Export */}
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search translations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="sm">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={exportAuditLog} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Audit Entries */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Recent Translation Scans</h3>
            {auditLog.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  No translation audit records found. Perform a medical translation to see validation results.
                </CardContent>
              </Card>
            ) : (
              auditLog.map((entry, index) => (
                <Card key={entry.id || index} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedEntry(entry)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={getSafetyColor(entry.medicalSafetyLevel)}
                        >
                          {getSafetyIcon(entry.medicalSafetyLevel)}
                          <span className="ml-1 capitalize">
                            {entry.medicalSafetyLevel}
                          </span>
                        </Badge>
                        <Badge variant="outline">
                          {Math.round(entry.confidence * 100)}% Confidence
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>Services Used:</strong> {entry.servicesUsed?.join(', ') || 'N/A'}
                      </div>
                      {entry.warnings && entry.warnings.length > 0 && (
                        <div className="text-sm">
                          <strong>Warnings:</strong> {entry.warnings.length} issues detected
                        </div>
                      )}
                      <div className="text-sm text-gray-600 truncate">
                        <strong>Original:</strong> {entry.originalText?.substring(0, 100)}...
                      </div>
                      {entry.userOverride?.applied && (
                        <div className="text-sm text-orange-600">
                          <strong>Override Applied:</strong> {entry.userOverride.reason}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>

      {/* Detailed View Modal */}
      {selectedEntry && (
        <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Translation Audit Details
                <Badge 
                  variant="outline" 
                  className={getSafetyColor(selectedEntry.medicalSafetyLevel)}
                >
                  {getSafetyIcon(selectedEntry.medicalSafetyLevel)}
                  <span className="ml-1 capitalize">
                    {selectedEntry.medicalSafetyLevel}
                  </span>
                </Badge>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Translation Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><strong>Timestamp:</strong> {new Date(selectedEntry.timestamp).toLocaleString()}</div>
                    <div><strong>Confidence:</strong> {Math.round(selectedEntry.confidence * 100)}%</div>
                    <div><strong>Languages:</strong> {getLanguageName(selectedEntry.sourceLanguage)} → {getLanguageName(selectedEntry.targetLanguage)}</div>
                    <div><strong>Services:</strong> {selectedEntry.servicesUsed?.join(', ')}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Safety Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><strong>Safety Level:</strong> 
                      <span className={`ml-1 ${getSafetyColor(selectedEntry.medicalSafetyLevel)}`}>
                        {selectedEntry.medicalSafetyLevel.toUpperCase()}
                      </span>
                    </div>
                    <div><strong>Warnings:</strong> {selectedEntry.warnings?.length || 0}</div>
                    <div><strong>Override:</strong> {selectedEntry.userOverride?.applied ? 'Yes' : 'No'}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Texts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Original Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={selectedEntry.originalText}
                      readOnly
                      className="min-h-[150px] text-sm"
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Translated Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={selectedEntry.translatedText}
                      readOnly
                      className="min-h-[150px] text-sm"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Warnings */}
              {selectedEntry.warnings && selectedEntry.warnings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      Validation Warnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {selectedEntry.warnings.map((warning: string, index: number) => (
                        <li key={index} className="text-yellow-700">{warning}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Validation Results */}
              {selectedEntry.validationResults && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Detailed Validation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-[200px]">
                      {JSON.stringify(selectedEntry.validationResults, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* User Override */}
              {selectedEntry.userOverride?.applied && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-orange-800">Medical Override Applied</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div><strong>Reason:</strong> {selectedEntry.userOverride.reason}</div>
                    <div><strong>Authorized By:</strong> {selectedEntry.userOverride.authorizedBy}</div>
                    <div><strong>Override Time:</strong> {new Date(selectedEntry.userOverride.timestamp).toLocaleString()}</div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};