import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Video, Bot, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import { Avatar } from "@/components/Avatar";
import { fetchUsers } from "@/lib/api";
import * as authLib from "@/lib/auth";
import type { User } from "@/lib/auth";
import { OPENAI_MODELS, DEFAULT_OPENAI_MODEL, DEFAULT_AI_PROMPT } from "@/lib/openai";
import type { TranslationKey } from "@/lib/i18n";

type Tab = "usuarios" | "integraciones";

const inputCls =
  "w-full border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-400 dark:focus:border-violet-500 bg-white dark:bg-gray-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 transition-all duration-200";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 focus-visible:ring-teal-500 rounded-full transition-colors duration-300"
      style={{
        width: 40,
        height: 22,
        background: checked
          ? "linear-gradient(135deg, #14b8a6, #10b981)"
          : "rgba(100,116,139,0.4)",
      }}
    >
      <span
        className="absolute top-[3px] rounded-full bg-white shadow-sm transition-all duration-300"
        style={{ width: 16, height: 16, left: checked ? 21 : 3 }}
      />
    </button>
  );
}

function SimlaLogo() {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}>
        <span className="text-white text-xs font-bold">S</span>
      </div>
    );
  }
  return (
    <img src="/logo.png" alt="Simla" className="w-8 h-8 object-contain shrink-0" onError={() => setErr(true)} />
  );
}

interface UnsavedDialogState {
  show: boolean;
  onDiscard: () => void;
}

function UnsavedDialog({ state, onKeep, t }: {
  state: UnsavedDialogState;
  onKeep: () => void;
  t: (k: TranslationKey) => string;
}) {
  if (!state.show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onKeep}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-sm p-6 flex flex-col gap-4 animate-[scaleIn_0.15s_ease]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{t("unsaved_title")}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">{t("unsaved_body")}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onKeep}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("unsaved_keep")}
          </button>
          <button
            onClick={state.onDiscard}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            {t("unsaved_discard")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const { user: currentUser, updateUser } = useAuth();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const p = searchParams.get("tab");
    return p === "integraciones" ? "integraciones" : "usuarios";
  });
  const [users, setUsers] = useState<User[]>(() => authLib.getUsers());
  const [unsavedDialog, setUnsavedDialog] = useState<UnsavedDialogState>({ show: false, onDiscard: () => {} });

  // ── Users tab state ─────────────────────────────────────────────────────────
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Simla CRM integration state ─────────────────────────────────────────────
  const [apiKeyInput, setApiKeyInput] = useState(currentUser?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "validating" | "ok" | "error">("idle");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeyEnabled, setApiKeyEnabled] = useState(currentUser?.apiKeyEnabled !== false);

  // ── TLDV integration state ───────────────────────────────────────────────────
  const [tldvKeyInput, setTldvKeyInput] = useState(currentUser?.tldvApiKey ?? "");
  const [showTldvKey, setShowTldvKey] = useState(false);
  const [tldvEnabled, setTldvEnabled] = useState(currentUser?.tldvEnabled !== false);
  const [tldvPrompt, setTldvPrompt] = useState(currentUser?.tldvPrompt ?? currentUser?.openaiPrompt ?? DEFAULT_AI_PROMPT);

  // ── OpenAI integration state ─────────────────────────────────────────────────
  const [aiKeyInput, setAiKeyInput] = useState(currentUser?.openaiApiKey ?? "");
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiModel, setAiModel] = useState(currentUser?.openaiModel ?? DEFAULT_OPENAI_MODEL);
  const [aiEnabled, setAiEnabled] = useState(currentUser?.openaiEnabled !== false);

  // ── Global save state ───────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Clear ?tab= param from URL after consuming it
  useEffect(() => {
    if (searchParams.has("tab")) setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dirty detection ─────────────────────────────────────────────────────────
  const integrationsDirty =
    apiKeyInput.trim() !== (currentUser?.apiKey ?? "") ||
    apiKeyEnabled !== (currentUser?.apiKeyEnabled !== false) ||
    tldvKeyInput.trim() !== (currentUser?.tldvApiKey ?? "") ||
    tldvEnabled !== (currentUser?.tldvEnabled !== false) ||
    tldvPrompt !== (currentUser?.tldvPrompt ?? currentUser?.openaiPrompt ?? DEFAULT_AI_PROMPT) ||
    aiKeyInput.trim() !== (currentUser?.openaiApiKey ?? "") ||
    aiEnabled !== (currentUser?.openaiEnabled !== false) ||
    aiModel !== (currentUser?.openaiModel ?? DEFAULT_OPENAI_MODEL);

  const userFormDirty = showAddForm && (
    newFirstName.trim() !== "" || newLastName.trim() !== "" ||
    newEmail.trim() !== "" || newPassword !== ""
  );

  const isDirty = integrationsDirty || userFormDirty;

  // ── Sync dirty state to global navigation guard ────────────────────────────
  const { setIsDirty: setGuardDirty } = useNavigationGuard();
  useEffect(() => { setGuardDirty(isDirty); }, [isDirty, setGuardDirty]);
  useEffect(() => () => setGuardDirty(false), [setGuardDirty]);

  // ── Browser-level navigation guard (refresh / close tab) ───────────────────
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function requestTabSwitch(newTab: Tab) {
    if (isDirty) {
      setUnsavedDialog({
        show: true,
        onDiscard: () => {
          discardChanges();
          setActiveTab(newTab);
          setUnsavedDialog({ show: false, onDiscard: () => {} });
        },
      });
    } else {
      setActiveTab(newTab);
    }
  }

  function discardChanges() {
    setApiKeyInput(currentUser?.apiKey ?? "");
    setApiKeyEnabled(currentUser?.apiKeyEnabled !== false);
    setApiKeyStatus("idle");
    setApiKeyError(null);
    setTldvKeyInput(currentUser?.tldvApiKey ?? "");
    setTldvEnabled(currentUser?.tldvEnabled !== false);
    setTldvPrompt(currentUser?.tldvPrompt ?? currentUser?.openaiPrompt ?? DEFAULT_AI_PROMPT);
    setAiKeyInput(currentUser?.openaiApiKey ?? "");
    setAiEnabled(currentUser?.openaiEnabled !== false);
    setAiModel(currentUser?.openaiModel ?? DEFAULT_OPENAI_MODEL);
  }

  async function handleSaveAll() {
    if (!currentUser) return;
    setIsSaving(true);
    setApiKeyStatus("idle");
    setApiKeyError(null);

    const newSimlaKey = apiKeyInput.trim();
    const storedSimlaKey = currentUser.apiKey ?? "";
    let updatedUser = {
      ...currentUser,
      tldvApiKey: tldvKeyInput.trim(),
      tldvEnabled,
      tldvPrompt: tldvPrompt.trim(),
      openaiApiKey: aiKeyInput.trim(),
      openaiModel: aiModel,
      openaiEnabled: aiEnabled,
      apiKeyEnabled,
    };

    if (newSimlaKey && newSimlaKey !== storedSimlaKey) {
      setApiKeyStatus("validating");
      try {
        await fetchUsers(newSimlaKey);
        updatedUser = { ...updatedUser, apiKey: newSimlaKey };
        setApiKeyStatus("ok");
      } catch {
        setApiKeyStatus("error");
        setApiKeyError(t("admin_api_error"));
        setIsSaving(false);
        return;
      }
    } else if (storedSimlaKey) {
      updatedUser = { ...updatedUser, apiKey: storedSimlaKey };
    }

    updateUser(updatedUser);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  function refreshUsers() { setUsers(authLib.getUsers()); }

  function handleDelete(id: string) {
    if (id === currentUser?.id) return;
    authLib.deleteUser(id);
    refreshUsers();
  }

  function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null); setAddSuccess(false);
    const existing = authLib.getUsers().find((u) => u.email === newEmail);
    if (existing) { setAddError(t("admin_err_duplicate")); return; }
    authLib.addUser({ email: newEmail, password: newPassword, firstName: newFirstName, lastName: newLastName, role: newRole });
    setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewPassword(""); setNewRole("viewer");
    setAddSuccess(true);
    refreshUsers();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "usuarios", label: t("admin_tab_users") },
    { id: "integraciones", label: t("admin_tab_integrations") },
  ];

  return (
    <>
      <UnsavedDialog
        state={unsavedDialog}
        onKeep={() => {
          setUnsavedDialog({ show: false, onDiscard: () => {} });
          // blocker removed (useBlocker requires data router)
        }}
        t={t}
      />

      <div className="max-w-3xl mx-auto px-1 pb-28">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">{t("admin_title")}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t("admin_subtitle")}</p>

        {/* Tabs */}
        <div className="flex gap-0 mb-8 border-b border-slate-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => requestTabSwitch(tab.id)}
              className={`relative px-5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab.id
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-gradient-to-r from-violet-500 to-indigo-500" />
              )}
            </button>
          ))}
        </div>

        {/* ── Users tab ── */}
        {activeTab === "usuarios" && (
          <div className="flex flex-col gap-6 animate-[fadeIn_0.18s_ease]">
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-gray-700/60 border-b border-slate-200 dark:border-gray-700">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{t("admin_users_title")}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-2.5">{t("admin_col_user")}</th>
                    <th className="text-left px-5 py-2.5">{t("admin_col_email")}</th>
                    <th className="text-left px-5 py-2.5">{t("admin_col_role")}</th>
                    <th className="text-left px-5 py-2.5">{t("admin_col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 dark:border-gray-700/60 hover:bg-slate-50/60 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar firstName={u.firstName} lastName={u.lastName} avatarDataUrl={u.avatarDataUrl} size={30} />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{u.firstName} {u.lastName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400 dark:text-slate-500 text-xs">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === "admin"
                            ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                            : "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400"
                        }`}>
                          {u.role === "admin" ? t("admin_role_admin") : t("admin_role_viewer")}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {u.id !== currentUser?.id ? (
                          <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">
                            {t("admin_delete")}
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{t("admin_add_user_title")}</h3>
                <button
                  type="button"
                  onClick={() => { setShowAddForm((v) => !v); setAddError(null); setAddSuccess(false); }}
                  className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {showAddForm ? t("admin_cancel") : t("admin_add_user_btn")}
                </button>
              </div>
              {showAddForm && (
                <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">{t("admin_name")}</label>
                    <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">{t("admin_lastname")}</label>
                    <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">{t("admin_email")}</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">{t("admin_password")}</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1">{t("admin_role")}</label>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")} className={inputCls}>
                      <option value="viewer">{t("admin_role_viewer")}</option>
                      <option value="admin">{t("admin_role_admin")}</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                      {t("admin_add_submit")}
                    </button>
                  </div>
                  {addError   && <p className="col-span-2 text-red-500 text-xs">{addError}</p>}
                  {addSuccess && <p className="col-span-2 text-emerald-500 text-xs">{t("admin_success_created")}</p>}
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Integrations tab ── */}
        {activeTab === "integraciones" && (
          <div className="flex flex-col gap-4 animate-[fadeIn_0.18s_ease]">

            {/* Simla CRM */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-gray-700/60">
                <div className="flex items-center gap-3">
                  <SimlaLogo />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("admin_api_key_title")}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t("admin_api_key_desc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={`text-xs font-medium transition-colors ${apiKeyEnabled ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {apiKeyEnabled ? t("integration_enabled") : t("integration_disabled")}
                  </span>
                  <Toggle checked={apiKeyEnabled} onChange={setApiKeyEnabled} />
                </div>
              </div>
              <div className={`px-5 py-4 transition-opacity duration-300 ${apiKeyEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyStatus("idle"); }}
                    placeholder={t("admin_api_key_placeholder")}
                    className={inputCls + " pr-9"}
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {apiKeyStatus === "ok" && (
                  <p className="flex items-center gap-1.5 text-emerald-500 text-xs mt-2">
                    <CheckCircle2 size={12} /> {t("admin_api_success")}
                  </p>
                )}
                {apiKeyStatus === "error" && (
                  <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
                    <XCircle size={12} /> {apiKeyError}
                  </p>
                )}
              </div>
            </div>

            {/* TLDV */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-gray-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                    <Video size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("admin_tldv_key_title")}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t("admin_tldv_key_desc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={`text-xs font-medium transition-colors ${tldvEnabled ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {tldvEnabled ? t("integration_enabled") : t("integration_disabled")}
                  </span>
                  <Toggle checked={tldvEnabled} onChange={setTldvEnabled} />
                </div>
              </div>
              <div className={`px-5 py-4 flex flex-col gap-4 transition-opacity duration-300 ${tldvEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <div>
                  <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">API Key</label>
                  <div className="relative">
                    <input
                      type={showTldvKey ? "text" : "password"}
                      value={tldvKeyInput}
                      onChange={(e) => setTldvKeyInput(e.target.value)}
                      placeholder="tldv_..."
                      className={inputCls + " pr-9"}
                    />
                    <button type="button" onClick={() => setShowTldvKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {showTldvKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t("tldv_prompt_label")}</label>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{t("tldv_prompt_desc")}</p>
                  <textarea
                    value={tldvPrompt}
                    onChange={(e) => setTldvPrompt(e.target.value)}
                    rows={10}
                    className={inputCls + " resize-y font-mono text-xs leading-relaxed"}
                  />
                  <button
                    type="button"
                    onClick={() => setTldvPrompt(DEFAULT_AI_PROMPT)}
                    className="text-xs text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors mt-1.5"
                  >
                    {t("admin_prompt_reset")}
                  </button>
                </div>
              </div>
            </div>

            {/* OpenAI */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-gray-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}>
                    <Bot size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("admin_ai_title")}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t("admin_ai_desc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={`text-xs font-medium transition-colors ${aiEnabled ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {aiEnabled ? t("integration_enabled") : t("integration_disabled")}
                  </span>
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} />
                </div>
              </div>
              <div className={`px-5 py-4 flex flex-col gap-4 transition-opacity duration-300 ${aiEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <div>
                  <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{t("admin_ai_key_label")}</label>
                  <div className="relative">
                    <input
                      type={showAiKey ? "text" : "password"}
                      value={aiKeyInput}
                      onChange={(e) => setAiKeyInput(e.target.value)}
                      placeholder="sk-..."
                      className={inputCls + " pr-9"}
                    />
                    <button type="button" onClick={() => setShowAiKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {showAiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{t("admin_ai_model_label")}</label>
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputCls}>
                    {OPENAI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Floating save button (fixed bottom-right, visible when integrations dirty) ── */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 transition-all duration-200 ${
          integrationsDirty ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        {saveSuccess && (
          <span className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-emerald-500 text-xs font-medium px-3 py-2 rounded-xl shadow-lg">
            <CheckCircle2 size={13} /> {t("admin_ai_saved")}
          </span>
        )}
        <button type="button" onClick={discardChanges}
          className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl shadow-lg transition-colors">
          {t("unsaved_discard")}
        </button>
        <button type="button" onClick={handleSaveAll} disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl shadow-lg transition-colors">
          {isSaving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          {t("admin_save_all")}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
