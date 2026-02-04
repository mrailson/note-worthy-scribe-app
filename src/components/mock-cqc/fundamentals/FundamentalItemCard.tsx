import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Check, 
  AlertTriangle, 
  MinusCircle, 
  Camera,
  ChevronDown,
  ChevronRight,
  Trash2,
  ExternalLink,
  Loader2,
  Bot,
  Mic,
  MicOff,
  User,
  CalendarIcon,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusLabel, FundamentalItem } from './fundamentalsConfig';
import { InspectionQRCaptureModal } from '../InspectionQRCaptureModal';
import { InspectionItemAskAI } from '../InspectionItemAskAI';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { format, addDays, endOfMonth, addWeeks } from 'date-fns';

// Default assignee options
const DEFAULT_ASSIGNEES = [
  'Practice Manager',
  'Deputy Practice Manager',
  'Safeguarding Lead',
  'Senior Partner',
  'Clinical Lead',
  'Nurse Manager',
  'Reception Manager',
  'IT Lead',
  'Infection Control Lead'
];

// Fix by preset options
const FIX_BY_PRESETS = [
  { label: 'ASAP', value: 'asap', getDays: () => 0 },
  { label: 'Next Week', value: 'next_week', getDays: () => 7 },
  { label: 'End of Month', value: 'end_of_month', getDays: () => null },
  { label: '4 Weeks', value: '4_weeks', getDays: () => 28 },
  { label: '6 Weeks', value: '6_weeks', getDays: () => 42 },
  { label: '12 Weeks', value: '12_weeks', getDays: () => 84 }
];

interface FundamentalRecord {
  id: string;
  session_id: string;
  category: string;
  item_key: string;
  item_name: string;
  status: string;
  notes: string | null;
  photo_url: string | null;
  photo_file_name: string | null;
  checked_at: string | null;
  assigned_to: string | null;
  fix_by_date: string | null;
  fix_by_preset: string | null;
}

interface FundamentalItemCardProps {
  item: FundamentalItem;
  record?: FundamentalRecord;
  sessionId: string;
  categoryKey: string;
  categoryName: string;
  onUpdate: (updates: Partial<FundamentalRecord>) => void;
  onRecordCreated?: (record: FundamentalRecord) => void;
}

export const FundamentalItemCard = ({ 
  item, 
  record, 
  sessionId,
  categoryKey,
  categoryName,
  onUpdate,
  onRecordCreated
}: FundamentalItemCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAskAI, setShowAskAI] = useState(false);
  const [notes, setNotes] = useState(record?.notes || '');
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [localRecordId, setLocalRecordId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [assignedTo, setAssignedTo] = useState(record?.assigned_to || '');
  const [customAssignee, setCustomAssignee] = useState('');
  const [customAssignees, setCustomAssignees] = useState<string[]>([]);
  const [fixByDate, setFixByDate] = useState<Date | undefined>(
    record?.fix_by_date ? new Date(record.fix_by_date) : undefined
  );
  const [fixByPreset, setFixByPreset] = useState(record?.fix_by_preset || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load custom assignees for this session
  useEffect(() => {
    const loadCustomAssignees = async () => {
      const { data } = await supabase
        .from('mock_inspection_custom_assignees')
        .select('assignee_name')
        .eq('session_id', sessionId);
      
      if (data) {
        setCustomAssignees(data.map(d => d.assignee_name));
      }
    };
    loadCustomAssignees();
  }, [sessionId]);

  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-GB';
        
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (event.results[event.results.length - 1].isFinal) {
            setNotes(prev => prev + (prev ? ' ' : '') + transcript.trim());
          }
        };
        
        recognition.onerror = () => {
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast.error('Speech recognition not supported in this browser');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const status = record?.status || 'not_checked';
  
  // Get the effective record ID (either from prop or locally created)
  const effectiveRecordId = record?.id || localRecordId;

  const handleStatusChange = (newStatus: string) => {
    onUpdate({ status: newStatus });
  };

  const handleNotesBlur = () => {
    if (notes !== record?.notes) {
      onUpdate({ notes: notes || null });
    }
  };

  const handleAssigneeSelect = (assignee: string) => {
    setAssignedTo(assignee);
    onUpdate({ assigned_to: assignee || null });
  };

  const handleAddCustomAssignee = async () => {
    const trimmed = customAssignee.trim();
    if (!trimmed) return;
    
    // Save to database for reuse
    try {
      await supabase
        .from('mock_inspection_custom_assignees')
        .insert({ session_id: sessionId, assignee_name: trimmed });
      
      setCustomAssignees(prev => [...prev, trimmed]);
      setAssignedTo(trimmed);
      onUpdate({ assigned_to: trimmed });
      setCustomAssignee('');
      showToast.success(`Added "${trimmed}" to assignees`);
    } catch (error) {
      // May already exist, just use it
      setAssignedTo(trimmed);
      onUpdate({ assigned_to: trimmed });
      setCustomAssignee('');
    }
  };

  const handleFixByPreset = (preset: string) => {
    setFixByPreset(preset);
    
    let date: Date;
    const presetConfig = FIX_BY_PRESETS.find(p => p.value === preset);
    
    if (preset === 'end_of_month') {
      date = endOfMonth(new Date());
    } else if (presetConfig) {
      const days = presetConfig.getDays();
      date = days === 0 ? new Date() : addDays(new Date(), days!);
    } else {
      return;
    }
    
    setFixByDate(date);
    onUpdate({ 
      fix_by_preset: preset, 
      fix_by_date: date.toISOString() 
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    setFixByDate(date);
    setFixByPreset('custom');
    setShowDatePicker(false);
    if (date) {
      onUpdate({ 
        fix_by_preset: 'custom', 
        fix_by_date: date.toISOString() 
      });
    }
  };
  
  // Create a record in the database if one doesn't exist yet
  const ensureRecordExists = useCallback(async (): Promise<string | null> => {
    // If we already have a record, return its ID
    if (effectiveRecordId) return effectiveRecordId;
    
    setIsCreatingRecord(true);
    try {
      const { data, error } = await supabase
        .from('mock_inspection_fundamentals')
        .insert({
          session_id: sessionId,
          category: categoryKey,
          item_key: item.key,
          item_name: item.name,
          status: 'not_checked'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Store the ID locally
      setLocalRecordId(data.id);
      
      // Notify parent to add this record to its state
      if (onRecordCreated) {
        onRecordCreated(data as FundamentalRecord);
      }
      
      return data.id;
    } catch (error) {
      console.error('Failed to create fundamental record:', error);
      showToast.error('Failed to prepare for photo capture');
      return null;
    } finally {
      setIsCreatingRecord(false);
    }
  }, [effectiveRecordId, sessionId, categoryKey, item.key, item.name, onRecordCreated]);

  // Handle opening the QR modal - ensure record exists first
  const handleCapturePhoto = async () => {
    const recordId = await ensureRecordExists();
    if (recordId) {
      setShowQRModal(true);
    }
  };

  const handlePhotoReceived = (images: { id: string; file_name: string; file_url: string }[]) => {
    if (images.length > 0) {
      // Use the first image
      onUpdate({ 
        photo_url: images[0].file_url, 
        photo_file_name: images[0].file_name 
      });
    }
  };

  const handleRemovePhoto = () => {
    onUpdate({ photo_url: null, photo_file_name: null });
  };

  return (
    <>
      <Card className={cn(
        "border transition-all",
        status === 'verified' && "border-green-300 bg-green-50/50",
        status === 'issue_found' && "border-red-300 bg-red-50/50"
      )}>
        <div className="p-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-start gap-2 text-left flex-1 min-w-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <h4 className="font-medium text-sm">{item.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              </div>
            </button>
            <Badge className={cn("flex-shrink-0 text-xs", getStatusColor(status))}>
              {getStatusLabel(status)}
            </Badge>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 space-y-4 pl-6">
              {/* Status buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={status === 'verified' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('verified')}
                  className={cn(
                    "gap-1.5",
                    status === 'verified' && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  Verified
                </Button>
                <Button
                  size="sm"
                  variant={status === 'issue_found' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('issue_found')}
                  className={cn(
                    "gap-1.5",
                    status === 'issue_found' && "bg-red-600 hover:bg-red-700"
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Issue Found
                </Button>
                <Button
                  size="sm"
                  variant={status === 'not_applicable' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('not_applicable')}
                  className={cn(
                    "gap-1.5",
                    status === 'not_applicable' && "bg-gray-600 hover:bg-gray-700"
                  )}
                >
                  <MinusCircle className="h-3.5 w-3.5" />
                  N/A
                </Button>
              </div>

              {/* Issue Assignment - only show when issue found */}
              {status === 'issue_found' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
                  <h5 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Issue Action Plan
                  </h5>
                  
                  {/* Assign To */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Assign To
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[...DEFAULT_ASSIGNEES, ...customAssignees].map((assignee) => (
                        <Button
                          key={assignee}
                          size="sm"
                          variant={assignedTo === assignee ? 'default' : 'outline'}
                          onClick={() => handleAssigneeSelect(assignee)}
                          className="h-7 text-xs"
                        >
                          {assignee}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Add custom assignee..."
                        value={customAssignee}
                        onChange={(e) => setCustomAssignee(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomAssignee()}
                        className="h-8 text-sm bg-white flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddCustomAssignee}
                        disabled={!customAssignee.trim()}
                        className="h-8"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {assignedTo && (
                      <p className="text-xs text-muted-foreground">
                        Currently assigned to: <span className="font-medium text-foreground">{assignedTo}</span>
                      </p>
                    )}
                  </div>

                  {/* Fix By / Recheck */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Fix By / Recheck
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {FIX_BY_PRESETS.map((preset) => (
                        <Button
                          key={preset.value}
                          size="sm"
                          variant={fixByPreset === preset.value ? 'default' : 'outline'}
                          onClick={() => handleFixByPreset(preset.value)}
                          className="h-7 text-xs"
                        >
                          {preset.label}
                        </Button>
                      ))}
                      <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant={fixByPreset === 'custom' ? 'default' : 'outline'}
                            className="h-7 text-xs gap-1"
                          >
                            <CalendarIcon className="h-3 w-3" />
                            Pick Date
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start" side="top" sideOffset={8}>
                          <Calendar
                            mode="single"
                            selected={fixByDate}
                            onSelect={handleDateSelect}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {fixByDate && (
                      <p className="text-xs text-muted-foreground">
                        Target date: <span className="font-medium text-foreground">{format(fixByDate, 'dd MMMM yyyy')}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Photo evidence */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photo Evidence
                </label>
                
                {record?.photo_url ? (
                  <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <img 
                      src={record.photo_url} 
                      alt={record.photo_file_name || 'Evidence'} 
                      className="h-16 w-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{record.photo_file_name}</p>
                      <div className="flex gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => window.open(record.photo_url!, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={handleRemovePhoto}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCapturePhoto}
                    disabled={isCreatingRecord}
                    className="gap-2"
                  >
                    {isCreatingRecord ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    Capture Photo
                  </Button>
                )}
              </div>

              {/* Ask AI */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAskAI(true)}
                className="gap-2 w-full"
              >
                <Bot className="h-4 w-4" />
                Ask AI about this item
              </Button>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Notes</label>
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleListening}
                    className="h-7 gap-1.5"
                    title={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {isListening ? "Stop" : "Voice"}
                  </Button>
                </div>
                <Textarea
                  placeholder={isListening ? "Listening..." : "Add any notes about this item..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows={2}
                  className="text-sm bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* QR Capture Modal - only render when we have a valid record ID */}
      {effectiveRecordId && (
        <InspectionQRCaptureModal
          open={showQRModal}
          onOpenChange={setShowQRModal}
          elementId={effectiveRecordId}
          elementKey={item.key}
          elementName={item.name}
          onImagesReceived={handlePhotoReceived}
        />
      )}

      {/* Ask AI Modal */}
      <InspectionItemAskAI
        open={showAskAI}
        onOpenChange={setShowAskAI}
        itemName={item.name}
        itemDescription={item.description}
        categoryName={categoryName}
      />
    </>
  );
};
