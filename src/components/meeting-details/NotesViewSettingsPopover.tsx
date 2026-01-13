import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotesViewSettings, SECTION_LABELS } from '@/types/notesSettings';

interface NotesViewSettingsPopoverProps {
  settings: NotesViewSettings;
  onToggleSection: (sectionKey: keyof NotesViewSettings['visibleSections']) => void;
}

export const NotesViewSettingsPopover: React.FC<NotesViewSettingsPopoverProps> = ({
  settings,
  onToggleSection,
}) => {
  const sectionKeys = Object.keys(settings.visibleSections) as Array<keyof NotesViewSettings['visibleSections']>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Notes view settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">Section Visibility</h4>
            <p className="text-xs text-muted-foreground">
              Choose which sections to display in the notes view.
            </p>
          </div>
          <div className="space-y-3">
            {sectionKeys.map((key) => (
              <div key={key} className="flex items-center justify-between">
                <Label
                  htmlFor={`section-toggle-${key}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {SECTION_LABELS[key]}
                </Label>
                <Switch
                  id={`section-toggle-${key}`}
                  checked={settings.visibleSections[key]}
                  onCheckedChange={() => onToggleSection(key)}
                />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
