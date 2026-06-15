import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "system" | "light" | "dark";
export type Accent = "slate" | "blue" | "violet" | "emerald";
export type Density = "comfortable" | "compact";
export type AnalysisType = "reliability" | "gaps" | "full";
export type AnalysisDepth = "quick" | "standard" | "deep";

export interface Preferences {
  theme: Theme;
  accent: Accent;
  density: Density;
  reduceMotion: boolean;
  plainEnglish: boolean;
  defaultAnalysisType: AnalysisType;
  defaultDepth: AnalysisDepth;
  autoRun: boolean;
  modules: {
    guidedUpload: boolean;
    smartLoading: boolean;
    scoreBreakdown: boolean;
    externalEvidence: boolean;
    gapCards: boolean;
    keyClaims: boolean;
    knowledgeGraph: boolean;
    sideAssistant: boolean;
  };
}

export const DEFAULT_PREFS: Preferences = {
  theme: "system",
  accent: "slate",
  density: "comfortable",
  reduceMotion: false,
  plainEnglish: false,
  defaultAnalysisType: "full",
  defaultDepth: "standard",
  autoRun: false,
  modules: {
    guidedUpload: true,
    smartLoading: true,
    scoreBreakdown: true,
    externalEvidence: true,
    gapCards: true,
    keyClaims: true,
    knowledgeGraph: true,
    sideAssistant: true,
  },
};

const STORAGE_KEY = "truthlens.prefs.v1";

type Ctx = {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setModule: (key: keyof Preferences["modules"], value: boolean) => void;
  reset: () => void;
};

const PrefsContext = createContext<Ctx | null>(null);

function load(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      modules: { ...DEFAULT_PREFS.modules, ...(parsed?.modules ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function applyToDocument(prefs: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Theme
  const systemDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);
  root.classList.toggle("dark", dark);

  // Accent / density / motion
  root.setAttribute("data-accent", prefs.accent);
  root.setAttribute("data-density", prefs.density);
  root.setAttribute("data-reduce-motion", prefs.reduceMotion ? "true" : "false");
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  // hydrate once on the client
  useEffect(() => {
    const loaded = load();
    setPrefs(loaded);
    applyToDocument(loaded);
  }, []);

  // apply on every change
  useEffect(() => {
    applyToDocument(prefs);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // ignore quota errors
      }
    }
  }, [prefs]);

  // react to system theme changes when in "system" mode
  useEffect(() => {
    if (prefs.theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDocument(prefs);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [prefs]);

  const set = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((cur) => ({ ...cur, [key]: value }));
    },
    [],
  );

  const setModule = useCallback(
    (key: keyof Preferences["modules"], value: boolean) => {
      setPrefs((cur) => ({ ...cur, modules: { ...cur.modules, [key]: value } }));
    },
    [],
  );

  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  const value = useMemo<Ctx>(() => ({ prefs, set, setModule, reset }), [prefs, set, setModule, reset]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePreferences(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) {
    // Safe fallback so SSR / outside-provider use doesn't crash
    return {
      prefs: DEFAULT_PREFS,
      set: () => {},
      setModule: () => {},
      reset: () => {},
    };
  }
  return ctx;
}
