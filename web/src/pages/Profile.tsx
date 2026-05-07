import { useState, useRef } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT, useI18n } from "@/contexts/I18nContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { Avatar } from "@/components/Avatar";
import type { User } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";

const inputCls = "w-full border border-slate-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500";

const LANG_OPTIONS: { value: Lang; flag: string; nativeName: string; key: "prefs_lang_es" | "prefs_lang_en" | "prefs_lang_ru" }[] = [
  { value: "es", flag: "🇪🇸", nativeName: "Español",  key: "prefs_lang_es" },
  { value: "en", flag: "🇬🇧", nativeName: "English",  key: "prefs_lang_en" },
  { value: "ru", flag: "🇷🇺", nativeName: "Русский",  key: "prefs_lang_ru" },
];

const THEME_OPTIONS: { value: Theme; icon: React.ElementType; key: "theme_light" | "theme_auto" | "theme_dark" }[] = [
  { value: "light", icon: Sun,     key: "theme_light" },
  { value: "auto",  icon: Monitor, key: "theme_auto"  },
  { value: "dark",  icon: Moon,    key: "theme_dark"  },
];

export function Profile() {
  const { user, updateUser } = useAuth();
  const t = useT();
  const { lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const [tab, setTab] = useState<"profile" | "prefs">("profile");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const safeUser = user as User;

  function handleAvatarClick() { fileRef.current?.click(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateUser({ ...safeUser, avatarDataUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(t("profile_err_required")); return;
    }
    if (newPassword) {
      if (!currentPassword) { setError(t("profile_err_current_required")); return; }
      if (safeUser.password !== currentPassword) { setError(t("profile_err_wrong_current")); return; }
      if (newPassword !== confirmPassword) { setError(t("profile_err_no_match")); return; }
    }
    updateUser({ ...safeUser, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), ...(newPassword ? { password: newPassword } : {}) });
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">{t("profile_title")}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t("profile_subtitle")}</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-gray-700">
        {(["profile", "prefs"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {key === "profile" ? t("profile_tab_profile") : t("profile_tab_prefs")}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <>
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6 mb-4 flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <Avatar firstName={safeUser.firstName} lastName={safeUser.lastName} avatarDataUrl={safeUser.avatarDataUrl} size={80} />
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-semibold">{t("profile_change_avatar")}</span>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{t("profile_avatar_hint")}</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("profile_name")}</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("profile_lastname")}</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("profile_email")}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
              </div>

              <hr className="border-slate-200 dark:border-gray-700" />
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">{t("profile_change_password")}</p>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("profile_current_password")}</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("profile_new_password")}</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("profile_confirm_password")}</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>

              {error   && <p className="text-red-500 text-sm">{error}</p>}
              {success && <p className="text-green-500 text-sm">{t("profile_success")}</p>}

              <button type="submit" className="w-full bg-brand-blue hover:bg-blue-700 text-white font-semibold py-2 rounded-md text-sm transition-colors">
                {t("profile_save")}
              </button>
            </form>
          </div>
        </>
      )}

      {tab === "prefs" && (
        <div className="flex flex-col gap-5">
          {/* Language */}
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{t("prefs_language")}</p>
            <div className="grid grid-cols-3 gap-3">
              {LANG_OPTIONS.map(({ value, flag, nativeName, key }) => (
                <button
                  key={value}
                  onClick={() => setLang(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    lang === value
                      ? "border-brand-blue bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-gray-500"
                  }`}
                >
                  <span className="text-2xl">{flag}</span>
                  <span className={`text-xs font-semibold ${lang === value ? "text-brand-blue" : "text-slate-600 dark:text-slate-300"}`}>
                    {nativeName}
                  </span>
                  <span className={`text-[10px] ${lang === value ? "text-blue-500" : "text-slate-400 dark:text-slate-500"}`}>
                    {t(key)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{t("prefs_theme")}</p>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map(({ value, icon: Icon, key }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    theme === value
                      ? "border-brand-blue bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-gray-500"
                  }`}
                >
                  <Icon size={22} className={theme === value ? "text-brand-blue" : "text-slate-500 dark:text-slate-400"} />
                  <span className={`text-xs font-semibold ${theme === value ? "text-brand-blue" : "text-slate-600 dark:text-slate-300"}`}>
                    {t(key)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
