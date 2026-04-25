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

export type DrillDrawerMode = "cohort" | "patient";

export interface DrillCohortContext {
  filterKey: string;
  label: string;
  count?: number;
}

interface OpenDrawerInput {
  mode: DrillDrawerMode;
  filterKey?: string;
  patientId?: string;
  cohortContext?: DrillCohortContext | null;
}

interface DrillContextValue {
  isOpen: boolean;
  mode: DrillDrawerMode;
  filterKeys: string[];
  cohortContext: DrillCohortContext | null;
  selectedPatient: string | null;
  open: (key: string) => void;
  openDrawer: (input: OpenDrawerInput) => void;
  openPatient: (patientId: string, cohortContext?: DrillCohortContext | null) => void;
  backToCohort: () => void;
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
  const [mode, setMode] = useState<DrillDrawerMode>(() => readKeysFromUrl().length ? "cohort" : "cohort");
  const [cohortContext, setCohortContext] = useState<DrillCohortContext | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  // Keep URL in sync with state
  useEffect(() => { writeKeysToUrl(filterKeys); }, [filterKeys]);

  // Listen for back/forward navigation
  useEffect(() => {
    const onPop = () => setFilterKeys(readKeysFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback((key: string) => {
    setMode("cohort");
    setSelectedPatient(null);
    setCohortContext(null);
    setFilterKeys([key]);
  }, []);
  const openDrawer = useCallback((input: OpenDrawerInput) => {
    setMode(input.mode);
    setSelectedPatient(input.patientId ?? null);
    setCohortContext(input.cohortContext ?? null);
    if (input.mode === "cohort" && input.filterKey) setFilterKeys([input.filterKey]);
    if (input.mode === "patient" && input.filterKey) setFilterKeys([input.filterKey]);
  }, []);
  const openPatient = useCallback((patientId: string, context: DrillCohortContext | null = null) => {
    setMode("patient");
    setSelectedPatient(patientId);
    setCohortContext(context);
    if (!context) setFilterKeys([]);
  }, []);
  const backToCohort = useCallback(() => {
    setMode("cohort");
    setSelectedPatient(null);
  }, []);
  const add = useCallback((key: string) =>
    setFilterKeys((prev) => (prev.includes(key) ? prev : [...prev, key])), []);
  const remove = useCallback((key: string) =>
    setFilterKeys((prev) => prev.filter((k) => k !== key)), []);
  const close = useCallback(() => {
    setFilterKeys([]);
    setSelectedPatient(null);
    setCohortContext(null);
    setMode("cohort");
  }, []);

  // Close drawer with ESC
  useEffect(() => {
    if (!filterKeys.length && !selectedPatient) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterKeys.length, selectedPatient, close]);

  const value = useMemo<DrillContextValue>(() => ({
    isOpen: filterKeys.length > 0 || !!selectedPatient,
    mode,
    filterKeys,
    cohortContext,
    selectedPatient,
    open, openDrawer, openPatient, backToCohort, add, remove, close,
  }), [filterKeys, selectedPatient, mode, cohortContext, open, openDrawer, openPatient, backToCohort, add, remove, close]);

  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>;
};

export const useDrillThrough = (): DrillContextValue => {
  const ctx = useContext(DrillContext);
  if (!ctx) throw new Error("useDrillThrough must be used inside <DrillThroughProvider>");
  return ctx;
};
