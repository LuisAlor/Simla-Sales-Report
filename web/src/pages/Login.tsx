import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import * as authLib from "@/lib/auth";

const inputCls = "w-full border border-slate-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const user = login(email, password);
    if (user) { navigate("/"); } else { setError(t("login_err_invalid")); }
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    const users = authLib.getUsers();
    const user = users.find((u) => u.email === resetEmail);
    if (!user) { setResetError(t("login_err_not_found")); return; }
    if (!resetNewPassword) { setResetError(t("login_err_empty_password")); return; }
    if (resetNewPassword !== resetConfirm) { setResetError(t("login_err_no_match")); return; }
    authLib.updateUser({ ...user, password: resetNewPassword });
    setResetSuccess(true);
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-transparent dark:border-gray-700 p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-xl">S</div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{t("login_brand")}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{t("login_tagline")}</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">{t("login_title")}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("login_email")}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("login_email_placeholder")} required className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("login_password")}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className={inputCls} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-brand-blue hover:bg-blue-700 text-white font-semibold py-2 rounded-md text-sm transition-colors">
            {t("login_submit")}
          </button>
        </form>

        <button
          onClick={() => { setShowReset(true); setResetSuccess(false); setResetError(null); }}
          className="mt-4 text-brand-blue text-xs underline"
        >
          {t("login_forgot")}
        </button>
      </div>

      {showReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{t("login_reset_title")}</h2>
            {resetSuccess ? (
              <div>
                <p className="text-green-500 text-sm mb-4">{t("login_password_updated")}</p>
                <button onClick={() => setShowReset(false)} className="w-full bg-brand-blue text-white font-semibold py-2 rounded-md text-sm">
                  {t("login_close")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("login_email")}</label>
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder={t("login_email_placeholder")} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("login_new_password")}</label>
                  <input type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="••••••••" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">{t("login_confirm_password")}</label>
                  <input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="••••••••" required className={inputCls} />
                </div>
                {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setShowReset(false)} className="flex-1 border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-slate-300 py-2 rounded-md text-sm hover:bg-slate-50 dark:hover:bg-gray-700">
                    {t("login_cancel")}
                  </button>
                  <button type="submit" className="flex-1 bg-brand-blue text-white font-semibold py-2 rounded-md text-sm hover:bg-blue-700">
                    {t("login_save")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
