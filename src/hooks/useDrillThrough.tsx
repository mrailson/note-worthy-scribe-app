import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Drill-through controller — single global state for the
 * NRES Population Risk dashboard. Every clickable count opens
 * the drawer by calling `open(filterKey)`. Multiple keys can
 * be stacked to intersect filters.
 *
 * Drawer state is mirrored to the URL `?drill=` param
 * (comma-separated keys) so it survives refresh and is shareable.
 */

interface DrillContextValue {
  isOpen: boolean;
  filterKeys: string[];
  open: (key: string) => void;
  add: (key: string) => void;
  remove: (key: string) => void;
  close: () => void;
}

const DrillContext = createContext<DrillContextValue | null>(null);

const QUERY_PARAM = "drill";

const readKeysFromUrl = (): string[] => {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(QUERY_PARAM);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

const writeKeysToUrl = (keys: string[]) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (keys.length) url.searchParams.set(QUERY_PARAM, keys.join(","));
  else url.searchParams.delete(QUERY_PARAM);
  window.history.replaceState(null, "", url.toString());
};

export const DrillThroughProvider = ({ children }: { children: ReactNode }) => {
  const [filterKeys, setFilterKeys] = useState<string[]>(() => readKeysFromUrl());

  // Keep URL in sync with state
  useEffect(() => { writeKeysToUrl(filterKeys); }, [filterKeys]);

  // Listen for back/forward navigation
  useEffect(() => {
    const onPop = () => setFilterKeys(readKeysFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback((key: string) => setFilterKeys([key]), []);
  const add = useCallback((key: string) =>
    setFilterKeys((prev) => (prev.includes(key) ? prev : [...prev, key])), []);
  const remove = useCallback((key: string) =>
    setFilterKeys((prev) => prev.filter((k) => k !== key)), []);
  const close = useCallback(() => setFilterKeys([]), []);

  // Close drawer with ESC
  useEffect(() => {
    if (!filterKeys.length) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterKeys.length, close]);

  const value = useMemo<DrillContextValue>(() => ({
    isOpen: filterKeys.length > 0,
    filterKeys,
    open, add, remove, close,
  }), [filterKeys, open, add, remove, close]);

  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>;
};

export const useDrillThrough = (): DrillContextValue => {
  const ctx = useContext(DrillContext);
  if (!ctx) throw new Error("useDrillThrough must be used inside <DrillThroughProvider>");
  return ctx;
};
