import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  ChevronDown, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar
} from 'lucide-react';
import { UploadedFile } from '@/types/ai4gp';

interface DocumentContextPanelProps {
  uploadedFiles: UploadedFile[];
  onToggleFileSelection?: (index: number) => void;
  selectedFiles?: boolean[];
}

interface DocumentInsight {
  type: 'key_point' | 'statistic' | 'recommendation' | 'warning';
  content: string;
  relevance: 'high' | 'medium' | 'low';
}

const getFileTypeIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf': return '📄';
    case 'docx': case 'doc': return '📝';
    case 'xlsx': case 'xls': return '📊';
    case 'txt': return '📋';
    case 'png': case 'jpg': case 'jpeg': case 'gif': return '🖼️';
    default: return '📁';
  }
};

const getInsightIcon = (type: DocumentInsight['type']) => {
  switch (type) {
    case 'key_point': return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    case 'statistic': return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'recommendation': return <Users className="w-4 h-4 text-purple-500" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
  }
};

const getRelevanceColor = (relevance: DocumentInsight['relevance']) => {
  switch (relevance) {
    case 'high': return 'bg-green-100 text-green-800 border-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Mock function to extract insights from document content
const extractDocumentInsights = (content: string, fileName: string): DocumentInsight[] => {
  const insights: DocumentInsight[] = [];
  
  // Simple keyword-based insight extraction (in real implementation, this would use NLP)
  if (content.includes('guideline') || content.includes('recommendation')) {
    insights.push({
      type: 'recommendation',
      content: 'Contains clinical guidelines and recommendations',
      relevance: 'high'
    });
  }
  
  if (content.match(/\d+%|\d+\.\d+%/)) {
    insights.push({
      type: 'statistic',
      content: 'Contains statistical data and percentages',
      relevance: 'high'
    });
  }
  
  if (content.includes('contraindication') || content.includes('warning') || content.includes('caution')) {
    insights.push({
      type: 'warning',
      content: 'Contains safety warnings or contraindications',
      relevance: 'high'
    });
  }
  
  if (content.includes('evidence') || content.includes('study') || content.includes('research')) {
    insights.push({
      type: 'key_point',
      content: 'Contains research evidence and study findings',
      relevance: 'high'
    });
  }
  
  return insights;
};

export const DocumentContextPanel: React.FC<DocumentContextPanelProps> = ({
  uploadedFiles,
  onToggleFileSelection,
  selectedFiles = []
}) => {
  const [expandedFiles, setExpandedFiles] = useState<number[]>([]);

  const toggleFileExpansion = (index: number) => {
    setExpandedFiles(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  if (uploadedFiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No documents uploaded</p>
            <p className="text-sm">Upload documents to enhance your presentation with relevant context</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Document Context ({uploadedFiles.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => {
              const insights = extractDocumentInsights(file.content, file.name);
              const isExpanded = expandedFiles.includes(index);
              const isSelected = selectedFiles[index] !== false;

              return (
                <div key={index} className="border rounded-lg p-3">
                  <Collapsible 
                    open={isExpanded} 
                    onOpenChange={() => toggleFileExpansion(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-lg">{getFileTypeIcon(file.name)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB • {insights.length} insights
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {onToggleFileSelection && (
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFileSelection(index);
                            }}
                            className="text-xs"
                          >
                            {isSelected ? 'Include' : 'Exclude'}
                          </Button>
                        )}
                        
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    
                    <CollapsibleContent className="mt-3 space-y-2">
                      {insights.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Document Insights:</div>
                          {insights.map((insight, insightIndex) => (
                            <div key={insightIndex} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-xs">
                              {getInsightIcon(insight.type)}
                              <div className="flex-1">
                                <span>{insight.content}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`ml-2 ${getRelevanceColor(insight.relevance)}`}
                                >
                                  {insight.relevance}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Content Preview:</div>
                        <div className="text-xs bg-muted/20 p-2 rounded max-h-20 overflow-y-auto">
                          {file.content.substring(0, 200)}
                          {file.content.length > 200 && '...'}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {uploadedFiles.length > 0 && (
          <div className="mt-4 p-3 bg-primary/5 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Context Integration Ready</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI will incorporate relevant insights from your documents into the presentation content
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};