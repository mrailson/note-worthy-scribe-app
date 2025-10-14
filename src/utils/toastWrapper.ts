import { toast as sonnerToast } from 'sonner';
import { toast as shadcnToast } from '@/hooks/use-toast';
import { type ToastSection } from '@/hooks/useToastPreferences';

const STORAGE_KEY = 'toast_preferences';

// Helper to check if a section is enabled
const isSectionEnabled = (section?: ToastSection): boolean => {
  if (!section) return true; // If no section specified, always show

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
  success: (message: string, options?: { section?: ToastSection; duration?: number; id?: string }) => {
    if (!isSectionEnabled(options?.section)) return;
    return sonnerToast.success(message, { duration: options?.duration });
  },

  error: (message: string, options?: { section?: ToastSection; duration?: number }) => {
    if (!isSectionEnabled(options?.section)) return;
    return sonnerToast.error(message, { duration: options?.duration });
  },

  info: (message: string, options?: { section?: ToastSection; duration?: number }) => {
    if (!isSectionEnabled(options?.section)) return;
    return sonnerToast.info(message, { duration: options?.duration });
  },

  warning: (message: string, options?: { section?: ToastSection; duration?: number }) => {
    if (!isSectionEnabled(options?.section)) return;
    return sonnerToast.warning(message, { duration: options?.duration });
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
  const { section, ...toastParams } = params;
  if (!isSectionEnabled(section)) return;
  
  return shadcnToast(toastParams);
};
