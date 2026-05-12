import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/I18nContext";
import type { TranslationKey } from "@/lib/i18n";

interface GuardContextValue {
  isDirty: boolean;
  setIsDirty: (v: boolean) => void;
  requestNavigate: (to: string) => void;
}

const GuardCtx = createContext<GuardContextValue>({
  isDirty: false,
  setIsDirty: () => {},
  requestNavigate: () => {},
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const requestNavigate = useCallback((to: string) => {
    if (isDirty) {
      setPending(to);
    } else {
      navigate(to);
    }
  }, [isDirty, navigate]);

  function confirm() {
    setIsDirty(false);
    if (pending !== null) { navigate(pending); }
    setPending(null);
  }

  function cancel() {
    setPending(null);
  }

  return (
    <GuardCtx.Provider value={{ isDirty, setIsDirty, requestNavigate }}>
      {children}

      {pending !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {t("unsaved_title" as TranslationKey)}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {t("unsaved_body" as TranslationKey)}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancel}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t("unsaved_keep" as TranslationKey)}
              </button>
              <button
                onClick={confirm}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
              >
                {t("unsaved_discard" as TranslationKey)}
              </button>
            </div>
          </div>
        </div>
      )}
    </GuardCtx.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(GuardCtx);
}
