import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, Trash2, X, Search, Star, Shield } from 'lucide-react';
import { SearchHistory, Message } from '@/types/ai4gp';

interface SearchHistorySidebarProps {
  searchHistory: SearchHistory[];
  onLoadSearch: (search: SearchHistory) => void;
  onDeleteSearch: (searchId: string) => void;
  onClearAllHistory: () => void;
  onClose: () => void;
  onToggleFlag?: (searchId: string) => void;
  onToggleProtection?: (searchId: string) => void;
}

export const SearchHistorySidebar: React.FC<SearchHistorySidebarProps> = ({
  searchHistory,
  onLoadSearch,
  onDeleteSearch,
  onClearAllHistory,
  onClose,
  onToggleFlag,
  onToggleProtection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showProtectedOnly, setShowProtectedOnly] = useState(false);

  const cleanMarkdown = (text: string) => {
    return text
      .replace(/#{1,6}\s*/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove inline code markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Remove links, keep text
      .replace(/^\s*[-*+]\s+/gm, '') // Remove bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
      .replace(/\n+/g, ' ') // Replace line breaks with spaces
      .trim();
  };

  const getSearchOverview = (search: SearchHistory) => {
    if (search.brief_overview) {
      return cleanMarkdown(search.brief_overview);
    }
    
    // Enhanced content analysis for better summaries
    const allContent = search.messages.map(m => m.content.toLowerCase()).join(' ');
    
    // Medical specialty and topic detection
    const medicalCategories = {
      'Patient Information': ['patient leaflet', 'information leaflet', 'patient education', 'explanation for patient'],
      'Referral Letters': ['referral letter', 'refer to', 'secondary care', 'specialist referral', 'consultant'],
      'Clinical Guidelines': ['nice guideline', 'clinical guidance', 'evidence based', 'best practice', 'protocol'],
      'Prescription/Medication': ['prescription', 'medication', 'prescribe', 'drug interaction', 'dosage', 'bnf'],
      'Diagnosis Support': ['diagnosis', 'diagnostic', 'differential diagnosis', 'symptoms', 'presentation'],
      'Clinical Letters': ['discharge summary', 'clinic letter', 'consultation letter', 'medical report'],
      'Practice Management': ['practice management', 'staff', 'rota', 'appointment', 'admin', 'workflow'],
      'CQC Compliance': ['cqc', 'compliance', 'inspection', 'quality assurance', 'audit'],
      'Clinical Coding': ['read code', 'snomed', 'icd', 'clinical coding', 'qof'],
      'Emergency Care': ['urgent', 'emergency', 'immediate', 'acute', '999', 'ambulance'],
      'Mental Health': ['mental health', 'depression', 'anxiety', 'psychological', 'psychiatry'],
      'Paediatrics': ['child', 'children', 'paediatric', 'infant', 'baby', 'vaccination'],
      'Women\'s Health': ['pregnancy', 'contraception', 'menstrual', 'gynae', 'obstetric'],
      'Cardiology': ['heart', 'cardiac', 'chest pain', 'blood pressure', 'ecg', 'cardiovascular'],
      'Respiratory': ['asthma', 'copd', 'breathing', 'cough', 'lung', 'respiratory'],
      'Diabetes Care': ['diabetes', 'blood sugar', 'insulin', 'hba1c', 'diabetic'],
      'Dermatology': ['skin', 'rash', 'dermatology', 'mole', 'eczema'],
      'Musculoskeletal': ['joint', 'back pain', 'arthritis', 'fracture', 'orthopaedic']
    };
    
    // Find the most relevant category
    let detectedCategory = '';
    let maxMatches = 0;
    
    for (const [category, keywords] of Object.entries(medicalCategories)) {
      const matches = keywords.filter(keyword => allContent.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedCategory = category;
      }
    }
    
    // Skip common generic starting messages
    const skipPhrases = [
      'you are an expert uk nhs',
      'please specify the nice guideline',
      'to proceed with your request',
      'i need more information',
      'could you please provide',
      'what specific information',
      'hello', 'hi', 'help', 'can you help'
    ];
    
    // Find meaningful user messages by skipping generic ones
    const meaningfulMessages = search.messages.filter(msg => {
      if (msg.role !== 'user') return false;
      const content = msg.content.toLowerCase().trim();
      return !skipPhrases.some(phrase => content.startsWith(phrase)) && content.length > 15;
    });
    
    // Generate enhanced summary
    if (meaningfulMessages.length > 0) {
      // Find the most descriptive message
      let bestMessage = meaningfulMessages[meaningfulMessages.length - 1];
      
      // Prefer longer, more descriptive messages
      const longestMessage = meaningfulMessages.reduce((prev, current) => 
        current.content.length > prev.content.length ? current : prev
      );
      
      if (longestMessage.content.length > bestMessage.content.length + 30) {
        bestMessage = longestMessage;
      }
      
      let content = bestMessage.content.trim();
      
      // Clean up and enhance the content
      content = content.replace(/^(create?|write|generate|help me with|can you|please)\s*/i, '');
      content = content.replace(/\?+$/, '');
      
      // Add category prefix if detected and relevant
      if (detectedCategory && maxMatches >= 2) {
        const prefix = `${detectedCategory}: `;
        if (!content.toLowerCase().includes(detectedCategory.toLowerCase().split(' ')[0])) {
          content = prefix + content;
        }
      }
      
      // Capitalize first letter
      content = content.charAt(0).toUpperCase() + content.slice(1);
      
      // Truncate with smart word boundary
      if (content.length > 90) {
        const truncated = content.substring(0, 87);
        const lastSpace = truncated.lastIndexOf(' ');
        content = (lastSpace > 60 ? truncated.substring(0, lastSpace) : truncated) + '...';
      }
      
      return content;
    }
    
    // Enhanced assistant response analysis
    const assistantMessages = search.messages.filter(msg => msg.role === 'assistant');
    if (assistantMessages.length > 0) {
      const content = assistantMessages[0].content.toLowerCase();
      
      // More comprehensive topic extraction from AI responses
      const responsePatterns = {
        'Patient Information Leaflet': ['patient.*leaflet', 'information.*leaflet', 'patient.*guide'],
        'Referral Letter': ['referral.*letter', 'referring.*patient', 'secondary.*care'],
        'Clinical Guidance': ['nice.*guideline', 'clinical.*guidance', 'evidence.*based'],
        'Medication Review': ['medication.*review', 'prescription.*review', 'drug.*history'],
        'Diagnostic Support': ['differential.*diagnosis', 'diagnostic.*criteria', 'clinical.*presentation'],
        'Practice Administration': ['practice.*management', 'administrative', 'workflow'],
        'Emergency Protocol': ['emergency.*procedure', 'urgent.*care', 'immediate.*action'],
        'Preventive Care': ['screening', 'vaccination', 'health.*promotion', 'prevention'],
        'Chronic Disease Management': ['long.*term.*condition', 'chronic.*disease', 'ongoing.*care']
      };
      
      for (const [summary, patterns] of Object.entries(responsePatterns)) {
        if (patterns.some(pattern => new RegExp(pattern).test(content))) {
          return summary;
        }
      }
      
      // Fallback to detected category
      if (detectedCategory && maxMatches >= 1) {
        return `${detectedCategory} consultation`;
      }
    }
    
    // Final fallback with more context
    if (detectedCategory) {
      return `${detectedCategory} query`;
    }
    
    return 'General consultation';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Generate rich preview content for tooltip
  const generatePreviewContent = (search: SearchHistory) => {
    const userMessages = search.messages.filter(m => m.role === 'user');
    const assistantMessages = search.messages.filter(m => m.role === 'assistant');
    
    const firstUserMessage = userMessages.length > 0 ? cleanMarkdown(userMessages[0].content).substring(0, 120) : '';
    const lastAssistantMessage = assistantMessages.length > 0 ? cleanMarkdown(assistantMessages[assistantMessages.length - 1].content).substring(0, 120) : '';
    
    const estimatedReadTime = Math.max(1, Math.ceil(search.messages.reduce((acc, m) => acc + m.content.length, 0) / 1000));
    
    return {
      title: search.title,
      overview: getSearchOverview(search),
      firstUserMessage,
      lastAssistantMessage,
      messageCount: search.messages.length,
      date: formatDateTime(search.created_at),
      readTime: estimatedReadTime,
      isProtected: search.is_protected,
      isFlagged: search.is_flagged
    };
  };

  const filteredHistory = useMemo(() => {
    let filtered = searchHistory;
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(search => 
        search.title.toLowerCase().includes(query) ||
        search.brief_overview?.toLowerCase().includes(query) ||
        search.messages.some(message => 
          message.content.toLowerCase().includes(query)
        )
      );
    }
    
    // Apply flag/protection filters
    if (showFlaggedOnly) {
      filtered = filtered.filter(search => search.is_flagged);
    }
    
    if (showProtectedOnly) {
      filtered = filtered.filter(search => search.is_protected);
    }
    
    return filtered;
  }, [searchHistory, searchQuery, showFlaggedOnly, showProtectedOnly]);

  return (
    <TooltipProvider>
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Search History
            </h3>
            <div className="flex items-center gap-1">
              {searchHistory.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All History</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all non-protected search history. Protected searches will be preserved. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onClearAllHistory}>
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {searchHistory.length > 0 && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              
              {/* Filter toggles */}
              <div className="flex gap-2 text-xs">
                <Button
                  variant={showFlaggedOnly ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setShowFlaggedOnly(!showFlaggedOnly);
                    if (!showFlaggedOnly) setShowProtectedOnly(false);
                  }}
                >
                  <Star className="w-3 h-3 mr-1" />
                  Flagged
                </Button>
                <Button
                  variant={showProtectedOnly ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setShowProtectedOnly(!showProtectedOnly);
                    if (!showProtectedOnly) setShowFlaggedOnly(false);
                  }}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  Protected
                </Button>
              </div>
            </>
          )}
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {searchHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No search history yet. Start a conversation to see it here.
              </p>
            ) : filteredHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No conversations match your search.
              </p>
            ) : (
              filteredHistory.map((search) => {
                const preview = generatePreviewContent(search);
                
                return (
                  <div key={search.id} className="group relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-auto p-3 text-left justify-start flex-col items-start space-y-1 relative"
                          onClick={() => onLoadSearch(search)}
                        >
                          {/* Status indicators in top-right */}
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            {search.is_flagged && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                            {search.is_protected && (
                              <Shield className="w-3 h-3 text-blue-500 fill-blue-500" />
                            )}
                          </div>
                          
                          <div className="font-medium text-sm truncate w-full pr-8">
                            {cleanMarkdown(search.title)}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2 w-full pr-8">
                            {getSearchOverview(search)}
                          </div>
                          <div className="text-xs text-muted-foreground/80 flex items-center gap-2">
                            <span>{formatDateTime(search.created_at)}</span>
                            <span>•</span>
                            <span>{search.messages.length} message{search.messages.length !== 1 ? 's' : ''}</span>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-sm p-3">
                        <div className="space-y-2">
                          <div className="font-medium text-sm">{preview.title}</div>
                          <div className="text-xs text-muted-foreground">{preview.overview}</div>
                          
                          {preview.firstUserMessage && (
                            <div className="text-xs">
                              <div className="font-medium text-muted-foreground">You asked:</div>
                              <div className="text-foreground mt-1">{preview.firstUserMessage}...</div>
                            </div>
                          )}
                          
                          {preview.lastAssistantMessage && (
                            <div className="text-xs">
                              <div className="font-medium text-muted-foreground">AI replied:</div>
                              <div className="text-foreground mt-1">{preview.lastAssistantMessage}...</div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                            <span>{preview.date}</span>
                            <span>{preview.messageCount} messages</span>
                            <span>~{preview.readTime}min read</span>
                          </div>
                          
                          {(preview.isFlagged || preview.isProtected) && (
                            <div className="flex items-center gap-2 pt-1">
                              {preview.isFlagged && (
                                <div className="flex items-center gap-1 text-xs text-yellow-600">
                                  <Star className="w-3 h-3 fill-current" />
                                  Flagged
                                </div>
                              )}
                              {preview.isProtected && (
                                <div className="flex items-center gap-1 text-xs text-blue-600">
                                  <Shield className="w-3 h-3 fill-current" />
                                  Protected
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* Action buttons that appear on hover */}
                    <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded p-1">
                      {/* Flag toggle */}
                      {onToggleFlag && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFlag(search.id);
                          }}
                        >
                          <Star className={`w-3 h-3 ${search.is_flagged ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                        </Button>
                      )}
                      
                      {/* Protection toggle */}
                      {onToggleProtection && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleProtection(search.id);
                          }}
                        >
                          <Shield className={`w-3 h-3 ${search.is_protected ? 'text-blue-500 fill-blue-500' : 'text-muted-foreground'}`} />
                        </Button>
                      )}
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSearch(search.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};