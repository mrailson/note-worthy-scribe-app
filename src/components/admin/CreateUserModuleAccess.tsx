import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { 
  ModuleAccess, 
  moduleCategories, 
  moduleInfo, 
  getDefaultModulesForRole 
} from '@/config/roleDefaultModules';

interface CreateUserModuleAccessProps {
  moduleAccess: ModuleAccess;
  onModuleChange: (key: keyof ModuleAccess, value: boolean) => void;
  role: string;
  isEditing: boolean;
  onAutoSave?: (key: string, value: boolean) => Promise<void>;
}

export const CreateUserModuleAccess = ({
  moduleAccess,
  onModuleChange,
  role,
  isEditing,
  onAutoSave
}: CreateUserModuleAccessProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    core: true,
    clinical: false,
    compliance: false,
    practice: false,
    developer: false
  });

  // Get role defaults for comparison
  const roleDefaults = getDefaultModulesForRole(role);

  // Count enabled modules in each category
  const getCategoryStats = (categoryKey: string) => {
    const category = moduleCategories[categoryKey as keyof typeof moduleCategories];
    const enabledCount = category.modules.filter(
      mod => moduleAccess[mod as keyof ModuleAccess]
    ).length;
    return { enabled: enabledCount, total: category.modules.length };
  };

  // Apply role defaults
  const applyRoleDefaults = () => {
    const defaults = getDefaultModulesForRole(role);
    Object.entries(defaults).forEach(([key, value]) => {
      if (moduleAccess[key as keyof ModuleAccess] !== value) {
        onModuleChange(key as keyof ModuleAccess, value);
      }
    });
  };

  // Check if current settings differ from role defaults
  const hasCustomSettings = () => {
    return Object.entries(roleDefaults).some(
      ([key, value]) => moduleAccess[key as keyof ModuleAccess] !== value
    );
  };

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const handleModuleToggle = async (moduleKey: keyof ModuleAccess, checked: boolean) => {
    onModuleChange(moduleKey, checked);
    if (isEditing && onAutoSave) {
      await onAutoSave(moduleKey, checked);
    }
  };

  const renderModuleToggle = (moduleKey: string) => {
    const key = moduleKey as keyof ModuleAccess;
    const info = moduleInfo[key];
    const isDefault = roleDefaults[key];
    const currentValue = moduleAccess[key];
    const isDifferentFromDefault = currentValue !== isDefault;

    return (
      <div key={moduleKey} className="flex items-center justify-between py-2">
        <div className="space-y-0.5 flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={moduleKey} className="text-sm font-medium">
              {info.label}
            </Label>
            {isDifferentFromDefault && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {currentValue ? 'Added' : 'Removed'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{info.description}</p>
        </div>
        <Switch
          id={moduleKey}
          checked={currentValue}
          onCheckedChange={(checked) => handleModuleToggle(key, checked)}
        />
      </div>
    );
  };

  // Hide developer category for non-admin roles
  const visibleCategories = Object.entries(moduleCategories).filter(([key]) => {
    if (key === 'developer' && role !== 'system_admin') {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Module Access</Label>
          <p className="text-sm text-muted-foreground">
            Configure which modules this user can access
          </p>
        </div>
        {hasCustomSettings() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applyRoleDefaults}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Role Defaults
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {visibleCategories.map(([categoryKey, category]) => {
          const stats = getCategoryStats(categoryKey);
          const isExpanded = expandedCategories[categoryKey];

          return (
            <Collapsible
              key={categoryKey}
              open={isExpanded}
              onOpenChange={() => toggleCategory(categoryKey)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium">{category.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {category.description}
                    </span>
                  </div>
                  <Badge variant={stats.enabled > 0 ? 'default' : 'secondary'}>
                    {stats.enabled}/{stats.total}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-6 pr-2 pb-2 space-y-1 border-l-2 border-muted ml-3">
                  {category.modules.map(moduleKey => renderModuleToggle(moduleKey))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {!isEditing && (
        <p className="text-xs text-muted-foreground italic">
          Tip: Role defaults have been applied. You can customise access before creating the user.
        </p>
      )}
    </div>
  );
};
