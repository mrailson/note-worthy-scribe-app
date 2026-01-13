import React, { useState, useMemo } from 'react';
import { Check, X, AlertTriangle, User, Building2, Mail, Briefcase, ChevronLeft, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { ParsedAttendee } from './BulkAttendeeImporter';

interface BulkImportPreviewProps {
  attendees: ParsedAttendee[];
  onAttendeeChange: (attendees: ParsedAttendee[]) => void;
  onImport: (attendees: ParsedAttendee[]) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
}

const ORGANISATION_TYPES = [
  { value: 'gp_practice', label: 'GP Practice' },
  { value: 'pcn', label: 'PCN' },
  { value: 'icb', label: 'ICB' },
  { value: 'nhs_trust', label: 'NHS Trust' },
  { value: 'community', label: 'Community' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'social_care', label: 'Social Care' },
  { value: 'other', label: 'Other' },
];

export function BulkImportPreview({ 
  attendees, 
  onAttendeeChange, 
  onImport, 
  onBack,
  onCancel 
}: BulkImportPreviewProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkOrgType, setBulkOrgType] = useState<string>('');

  const stats = useMemo(() => {
    const selected = attendees.filter(a => a.selected);
    const duplicates = attendees.filter(a => a.isDuplicate);
    const newAttendees = attendees.filter(a => a.isNew);
    return {
      total: attendees.length,
      selected: selected.length,
      duplicates: duplicates.length,
      new: newAttendees.length,
    };
  }, [attendees]);

  const handleToggleSelect = (id: string) => {
    onAttendeeChange(
      attendees.map(a => a.id === id ? { ...a, selected: !a.selected } : a)
    );
  };

  const handleSelectAll = () => {
    const allSelected = attendees.every(a => a.selected);
    onAttendeeChange(attendees.map(a => ({ ...a, selected: !allSelected })));
  };

  const handleSelectNewOnly = () => {
    onAttendeeChange(attendees.map(a => ({ ...a, selected: a.isNew ?? true })));
    toast.success('Selected new attendees only');
  };

  const handleRemoveDuplicates = () => {
    onAttendeeChange(attendees.filter(a => !a.isDuplicate));
    toast.success('Removed duplicate attendees');
  };

  const handleUpdateAttendee = (id: string, field: keyof ParsedAttendee, value: string) => {
    onAttendeeChange(
      attendees.map(a => a.id === id ? { ...a, [field]: value } : a)
    );
  };

  const handleApplyBulkOrgType = () => {
    if (!bulkOrgType) return;
    onAttendeeChange(
      attendees.map(a => a.selected ? { ...a, organizationType: bulkOrgType } : a)
    );
    toast.success(`Applied organisation type to ${stats.selected} attendees`);
  };

  const handleImport = async () => {
    const selectedAttendees = attendees.filter(a => a.selected);
    if (selectedAttendees.length === 0) {
      toast.error('Please select at least one attendee to import');
      return;
    }

    setIsImporting(true);
    try {
      await onImport(selectedAttendees);
      toast.success(`Successfully imported ${selectedAttendees.length} attendees`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import attendees');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Review Import</h2>
            <p className="text-sm text-muted-foreground">
              Found {stats.total} attendees • {stats.selected} selected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats.duplicates > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
              <AlertTriangle className="h-3 w-3" />
              {stats.duplicates} duplicates
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 bg-emerald-50">
            <Check className="h-3 w-3" />
            {stats.new} new
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Quick actions:</span>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {attendees.every(a => a.selected) ? 'Deselect All' : 'Select All'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectNewOnly}>
              Select New Only
            </Button>
            {stats.duplicates > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRemoveDuplicates}
                className="text-amber-600 hover:text-amber-700"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove Duplicates
              </Button>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Select value={bulkOrgType} onValueChange={setBulkOrgType}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Org type for all..." />
                </SelectTrigger>
                <SelectContent>
                  {ORGANISATION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleApplyBulkOrgType}
                disabled={!bulkOrgType}
              >
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendee List */}
      <Card>
        <CardHeader className="py-3 border-b">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <div className="col-span-1"></div>
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Organisation</div>
            <div className="col-span-2">Org Type</div>
            <div className="col-span-2">Role</div>
          </div>
        </CardHeader>
        <ScrollArea className="h-[400px]">
          <CardContent className="py-2">
            {attendees.map((attendee, index) => (
              <div 
                key={attendee.id}
                className={`
                  grid grid-cols-12 gap-2 py-2 px-1 items-center rounded-lg
                  ${index % 2 === 0 ? 'bg-muted/30' : ''}
                  ${attendee.isDuplicate ? 'opacity-60' : ''}
                  ${editingId === attendee.id ? 'ring-2 ring-primary/20 bg-primary/5' : ''}
                `}
              >
                {/* Checkbox */}
                <div className="col-span-1 flex items-center justify-center">
                  <Checkbox
                    checked={attendee.selected}
                    onCheckedChange={() => handleToggleSelect(attendee.id)}
                  />
                </div>

                {/* Name */}
                <div className="col-span-3 flex items-center gap-2">
                  {editingId === attendee.id ? (
                    <Input
                      value={attendee.name}
                      onChange={(e) => handleUpdateAttendee(attendee.id, 'name', e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  ) : (
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:text-primary"
                      onClick={() => setEditingId(attendee.id)}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{attendee.name}</span>
                      {attendee.isDuplicate && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          Duplicate
                        </Badge>
                      )}
                      {attendee.isNew && (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                          New
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="col-span-2">
                  {editingId === attendee.id ? (
                    <Input
                      value={attendee.email || ''}
                      onChange={(e) => handleUpdateAttendee(attendee.id, 'email', e.target.value)}
                      className="h-8"
                      placeholder="email@example.com"
                    />
                  ) : (
                    <div 
                      className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => setEditingId(attendee.id)}
                    >
                      {attendee.email ? (
                        <>
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{attendee.email}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/50 italic">Click to add</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Organisation */}
                <div className="col-span-2">
                  {editingId === attendee.id ? (
                    <Input
                      value={attendee.organization || ''}
                      onChange={(e) => handleUpdateAttendee(attendee.id, 'organization', e.target.value)}
                      className="h-8"
                      placeholder="Organisation"
                    />
                  ) : (
                    <div 
                      className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground"
                      onClick={() => setEditingId(attendee.id)}
                    >
                      {attendee.organization ? (
                        <>
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{attendee.organization}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/50 italic">Click to add</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Org Type */}
                <div className="col-span-2">
                  <Select 
                    value={attendee.organizationType || ''} 
                    onValueChange={(v) => handleUpdateAttendee(attendee.id, 'organizationType', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANISATION_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Role */}
                <div className="col-span-2">
                  {editingId === attendee.id ? (
                    <Input
                      value={attendee.role || ''}
                      onChange={(e) => handleUpdateAttendee(attendee.id, 'role', e.target.value)}
                      className="h-8"
                      placeholder="Role"
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                    />
                  ) : (
                    <div 
                      className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground"
                      onClick={() => setEditingId(attendee.id)}
                    >
                      {attendee.role ? (
                        <>
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{attendee.role}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/50 italic">Click to add</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {stats.selected} of {stats.total} selected
          </span>
          <Button 
            onClick={handleImport} 
            disabled={stats.selected === 0 || isImporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isImporting ? 'Importing...' : `Import ${stats.selected} Attendees`}
          </Button>
        </div>
      </div>
    </div>
  );
}
