import { useState, useEffect, useRef } from "react";
import { MapPin, Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_LOCATIONS_KEY = "notewell_f2f_custom_locations";

function loadCustomLocations(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomLocations(locations: string[]) {
  localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(locations));
}

interface F2FLocationSelectorProps {
  value: string;
  onChange: (location: string) => void;
  practiceName?: string;
  disabled?: boolean;
}

export const F2FLocationSelector = ({
  value,
  onChange,
  practiceName,
  disabled = false,
}: F2FLocationSelectorProps) => {
  const [customLocations, setCustomLocations] = useState<string[]>(loadCustomLocations);
  const [isAdding, setIsAdding] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Build full options list: practice first, then custom
  const allLocations: string[] = [];
  if (practiceName) allLocations.push(practiceName);
  for (const loc of customLocations) {
    if (loc !== practiceName) allLocations.push(loc);
  }

  const handleAdd = () => {
    const trimmed = newLocation.trim();
    if (!trimmed) return;
    if (!customLocations.includes(trimmed) && trimmed !== practiceName) {
      const updated = [...customLocations, trimmed];
      setCustomLocations(updated);
      saveCustomLocations(updated);
    }
    onChange(trimmed);
    setNewLocation("");
    setIsAdding(false);
  };

  const handleRemove = (loc: string) => {
    const updated = customLocations.filter((l) => l !== loc);
    setCustomLocations(updated);
    saveCustomLocations(updated);
    // If currently selected, fall back to practice
    if (value === loc && practiceName) {
      onChange(practiceName);
    }
  };

  return (
    <div className="space-y-2 text-center">
      <label className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1">
        <MapPin className="h-3 w-3" />
        Location
      </label>

      {isAdding ? (
        <div className="flex items-center gap-1.5 max-w-xs mx-auto">
          <Input
            ref={inputRef}
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setIsAdding(false);
                setNewLocation("");
              }
            }}
            placeholder="e.g. Patient's home"
            className="h-8 text-sm"
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-primary"
            onClick={handleAdd}
            disabled={!newLocation.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => {
              setIsAdding(false);
              setNewLocation("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 justify-center">
          <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-auto min-w-[180px] max-w-xs text-sm">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {allLocations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  <span className="flex items-center gap-2">
                    {loc}
                    {loc === practiceName && (
                      <span className="text-[10px] text-muted-foreground ml-1">(Practice)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsAdding(true)}
            disabled={disabled}
            title="Add new location"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Remove button for custom locations */}
          {value && value !== practiceName && customLocations.includes(value) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive"
              onClick={() => handleRemove(value)}
              disabled={disabled}
              title="Remove this location"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
