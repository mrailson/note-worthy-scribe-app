import { toast as sonnerToast } from 'sonner';
import { toast as shadcnToast } from '@/hooks/use-toast';
import { type ToastSection } from '@/hooks/useToastPreferences';

const STORAGE_KEY = 'toast_preferences';

// Define extended options that include all sonner toast options
interface ToastOptions {
  section?: ToastSection;
  duration?: number;
  id?: string | number;
  description?: string;
}

// Sections where success/info toasts are disabled
const DISABLED_TOAST_SECTIONS: ToastSection[] = ['complaints', 'ai4gp'];

// Helper to check if a section is enabled
const isSectionEnabled = (section?: ToastSection): boolean => {
  if (!section) return true; // If no section specified, always show
  
  // Check if section is in the disabled list
  if (DISABLED_TOAST_SECTIONS.includes(section)) return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const preferences = JSON.parse(stored);
      return preferences[section] ?? true;
    }
  } catch (error) {
    console.error('Failed to check toast preferences:', error);
  }
  return true; // Default to enabled
};

// Sonner toast wrapper
export const showToast = {
  success: (message: string, options?: ToastOptions) => {
    if (!isSectionEnabled(options?.section)) return;
    const { section, ...sonnerOptions } = options || {};
    return sonnerToast.success(message, sonnerOptions);
  },

  error: (message: string, options?: ToastOptions) => {
    // Always show errors regardless of preferences
    const { section, ...sonnerOptions } = options || {};
    return sonnerToast.error(message, sonnerOptions);
  },

  info: (message: string, options?: ToastOptions) => {
    if (!isSectionEnabled(options?.section)) return;
    const { section, ...sonnerOptions } = options || {};
    return sonnerToast.info(message, sonnerOptions);
  },

  warning: (message: string, options?: ToastOptions) => {
    if (!isSectionEnabled(options?.section)) return;
    const { section, ...sonnerOptions } = options || {};
    return sonnerToast.warning(message, sonnerOptions);
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },
};

// Shadcn toast wrapper
export const showShadcnToast = (params: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  section?: ToastSection;
}) => {
  const { section, variant, ...toastParams } = params;
  
  // Always show destructive (error) toasts regardless of preferences
  if (variant === 'destructive') {
    return shadcnToast({ ...toastParams, variant });
  }
  
  // Check preferences for non-error toasts
  if (!isSectionEnabled(section)) return;
  
  return shadcnToast({ ...toastParams, variant });
};
