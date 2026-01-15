import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScribeSession, CONSULTATION_TYPE_SHORT, ConsultationCategory } from "@/types/scribe";
import { ChevronDown, ChevronRight, Eye, Pencil, Trash2, MoreVertical, User, Check, X, Stethoscope, Heart, HandHeart, Copy } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { maskPatientName, maskDateOfBirth } from "@/utils/patientDataMasking";
import { getClinicalHeadlineData, getWordCountCategory } from "@/utils/clinicalHeadlineGenerator";
import { ClinicalSignalIcons, getDominantSignalColor } from "./ClinicalSignalIcons";
import { SessionStatusChip } from "./SessionStatusChip";
import { QuickPatientEntryForm } from "./QuickPatientEntryForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SessionHistoryRowProps {
  session: ScribeSession;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  isMobile?: boolean;
  showPatientDetails?: boolean;
}

// Category icon mapping
const categoryIcons: Record<ConsultationCategory, typeof Stethoscope> = {
  general: Stethoscope,
  agewell: Heart,
  social_prescriber: HandHeart,
};

export function SessionHistoryRow({
  session,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onView,
  onDelete,
  onRefresh,
  isMobile = false,
  showPatientDetails = false,
}: SessionHistoryRowProps) {
  const [isQuickPeekOpen, setIsQuickPeekOpen] = useState(false);
  const [isEditingHeadline, setIsEditingHeadline] = useState(false);
  const [editedHeadline, setEditedHeadline] = useState('');
  const [isSavingHeadline, setIsSavingHeadline] = useState(false);
  
  // Generate clinical headline data
  const headlineData = useMemo(() => getClinicalHeadlineData(session), [session]);
  const wordCountCategory = useMemo(() => getWordCountCategory(session.wordCount || 0), [session.wordCount]);
  const CategoryIcon = categoryIcons[session.consultationCategory || 'general'];
  
  // Format date/time compactly
  const formattedDate = format(new Date(session.createdAt), 'd MMM');
  const formattedTime = format(new Date(session.createdAt), 'HH:mm');
  const consultTypeShort = session.consultationType ? CONSULTATION_TYPE_SHORT[session.consultationType] : 'F2F';
  const duration = session.duration ? `${Math.floor(session.duration)}m` : '';
  
  // Get dominant signal color for left border
  const borderColor = getDominantSignalColor(headlineData.signals);
  
  // Extract quick peek data from notes
  const quickPeekData = useMemo(() => {
    const problems: string[] = [];
    const planItems: string[] = [];
    
    const impressionText = session.heidiNote?.impression || session.soapNote?.A || '';
    const planText = session.heidiNote?.plan || session.soapNote?.P || '';
    
    // Extract problems (numbered or bulleted items)
    const problemMatches = impressionText.match(/(?:\d+\.|[-•])\s*([^.\n]+)/g);
    if (problemMatches) {
      problems.push(...problemMatches.slice(0, 3).map(m => m.replace(/^(?:\d+\.|[-•])\s*/, '').trim()));
    }
    
    // Extract plan items
    const planMatches = planText.match(/(?:\d+\.|[-•])\s*([^.\n]+)/g);
    if (planMatches) {
      planItems.push(...planMatches.slice(0, 3).map(m => m.replace(/^(?:\d+\.|[-•])\s*/, '').trim()));
    }
    
    return { problems, planItems, followUpDate: headlineData.followUpDate };
  }, [session, headlineData.followUpDate]);
  
  // Handle headline edit
  const handleStartEditHeadline = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedHeadline(session.customHeadline || headlineData.headline);
    setIsEditingHeadline(true);
  };
  
  const handleSaveHeadline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editedHeadline.trim()) return;
    
    setIsSavingHeadline(true);
    try {
      // Note: custom_headline may not exist in DB yet - store locally for now
      // The headline is generated client-side and can be edited
      // For persistence, would need a migration to add custom_headline column
      session.customHeadline = editedHeadline.trim();
      
      toast.success('Headline updated');
      setIsEditingHeadline(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to save headline:', error);
      toast.error('Failed to save headline');
    } finally {
      setIsSavingHeadline(false);
    }
  };
  
  const handleCancelEditHeadline = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingHeadline(false);
    setEditedHeadline('');
  };
  
  return (
    <Card
      className={cn(
        "transition-colors cursor-pointer border-l-4",
        borderColor,
        isSelectMode && isSelected && "ring-2 ring-primary bg-primary/5",
        !isSelectMode && "hover:bg-muted/30"
      )}
      onClick={() => {
        if (isSelectMode) {
          onToggleSelect();
        } else {
          onView();
        }
      }}
    >
      <CardContent className={cn("py-3", isMobile ? "px-3" : "px-4")}>
        {/* Row 1: Signals + Headline + Status */}
        <div className="flex items-start gap-2">
          {isSelectMode && (
            <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
              />
            </div>
          )}
          
          {/* Clinical Signals */}
          <ClinicalSignalIcons signals={headlineData.signals} size="sm" className="mt-0.5 shrink-0" />
          
          {/* Headline (editable) */}
          <div className="flex-1 min-w-0">
            {isEditingHeadline ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editedHeadline}
                  onChange={(e) => setEditedHeadline(e.target.value)}
                  className="h-7 text-sm"
                  maxLength={80}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveHeadline(e as any);
                    if (e.key === 'Escape') handleCancelEditHeadline(e as any);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleSaveHeadline}
                  disabled={isSavingHeadline}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleCancelEditHeadline}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <p className={cn(
                  "font-medium text-foreground line-clamp-1",
                  isMobile ? "text-sm" : "text-sm"
                )}>
                  {session.customHeadline || headlineData.headline}
                </p>
                {!isSelectMode && (
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                    onClick={handleStartEditHeadline}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Status Chip */}
          <SessionStatusChip status={headlineData.status} className="shrink-0" />
        </div>
        
        {/* Row 2: Date/Time + Patient + Actions */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {/* Date/Time/Type */}
            <div className="flex items-center gap-1.5">
              <CategoryIcon className="h-3 w-3" />
              <span>{formattedDate} · {formattedTime}</span>
              <span>·</span>
              <span>{consultTypeShort}</span>
              {duration && (
                <>
                  <span>·</span>
                  <span>{duration}</span>
                </>
              )}
            </div>
            
            {/* Word Count Category */}
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 capitalize">
              {wordCountCategory}
            </Badge>
            
            {/* Patient Details - shown when toggle is on */}
            {showPatientDetails && session.patientName && (
              <div className="flex items-center gap-1.5 text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md">
                <User className="h-3 w-3" />
                <span className="font-medium">{session.patientName}</span>
                {session.patientDob && (
                  <span className="text-muted-foreground">· DOB: {session.patientDob}</span>
                )}
                {session.patientNhsNumber && (
                  <span className="text-muted-foreground">· NHS: {session.patientNhsNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</span>
                )}
              </div>
            )}
            
            {/* Patient (masked) - shown when toggle is off */}
            {!showPatientDetails && session.patientName && (
              <div className="flex items-center gap-1 text-primary/70">
                <User className="h-3 w-3" />
                <span className="font-medium">{maskPatientName(session.patientName)}</span>
                {session.patientDob && (
                  <span className="text-muted-foreground">· {maskDateOfBirth(session.patientDob)}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Actions */}
          {!isSelectMode && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Quick Peek Toggle */}
              <Collapsible open={isQuickPeekOpen} onOpenChange={setIsQuickPeekOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    Peek
                    {isQuickPeekOpen ? (
                      <ChevronDown className="h-3 w-3 ml-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 ml-1" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
              
              {/* View Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
              
              {/* More Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Add Patient */}
                  {!session.patientName && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <User className="h-4 w-4 mr-2" />
                          Add patient
                        </DropdownMenuItem>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="end">
                        <QuickPatientEntryForm
                          sessionId={session.id}
                          onSave={onRefresh}
                          onCancel={() => {}}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  
                  {/* Edit Patient */}
                  {session.patientName && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit patient
                        </DropdownMenuItem>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="end">
                        <QuickPatientEntryForm
                          sessionId={session.id}
                          existingName={session.patientName}
                          existingNhsNumber={session.patientNhsNumber || ""}
                          existingDob={session.patientDob || ""}
                          onSave={onRefresh}
                          onCancel={() => {}}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  
                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this session and all its data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        {/* Quick Peek Collapsible Content */}
        <Collapsible open={isQuickPeekOpen} onOpenChange={setIsQuickPeekOpen}>
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2" onClick={(e) => e.stopPropagation()}>
              {/* Patient Details - Unmasked */}
              {session.patientName && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-primary">{session.patientName}</span>
                    {session.patientNhsNumber && (
                      <span className="text-muted-foreground">
                        NHS: {session.patientNhsNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                      </span>
                    )}
                    {session.patientDob && (
                      <span className="text-muted-foreground">
                        DOB: {session.patientDob}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Problems Discussed */}
              {quickPeekData.problems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Problems Discussed:</p>
                  <ul className="text-sm space-y-0.5">
                    {quickPeekData.problems.map((problem, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-muted-foreground">•</span>
                        <span className="line-clamp-1">{problem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Plan */}
              {quickPeekData.planItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Plan:</p>
                  <ul className="text-sm space-y-0.5">
                    {quickPeekData.planItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-muted-foreground">•</span>
                        <span className="line-clamp-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Follow-up Date */}
              {quickPeekData.followUpDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">Follow-up:</span>
                  <span>{quickPeekData.followUpDate}</span>
                </div>
              )}
              
              {/* Empty state */}
              {quickPeekData.problems.length === 0 && quickPeekData.planItems.length === 0 && !session.patientName && (
                <p className="text-sm text-muted-foreground italic">No structured notes available</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
