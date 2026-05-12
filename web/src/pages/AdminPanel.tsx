import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { Avatar } from "@/components/Avatar";
import { fetchUsers } from "@/lib/api";
import * as authLib from "@/lib/auth";
import type { User } from "@/lib/auth";
import { OPENAI_MODELS, DEFAULT_OPENAI_MODEL, DEFAULT_AI_PROMPT } from "@/lib/openai";

type Tab = "usuarios" | "configuracion" | "integraciones";

const inputCls = "w-full border border-slate-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500";

export function AdminPanel() {
  const { user: currentUser, updateUser } = useAuth();
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [users, setUsers] = useState<User[]>(() => authLib.getUsers());

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState(currentUser?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "validating" | "ok" | "error">("idle");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Integrations tab — TLDV
  const [tldvKeyInput, setTldvKeyInput] = useState(currentUser?.tldvApiKey ?? "");
  const [showTldvKey, setShowTldvKey] = useState(false);
  const [tldvKeySaved, setTldvKeySaved] = useState(false);

  function handleSaveTldvKey() {
    if (!currentUser) return;
    updateUser({ ...currentUser, tldvApiKey: tldvKeyInput.trim() });
    setTldvKeySaved(true);
    setTimeout(() => setTldvKeySaved(false), 3000);
  }

  // Integrations tab — AI (OpenAI)
  const [aiKeyInput,    setAiKeyInput]    = useState(currentUser?.openaiApiKey ?? "");
  const [showAiKey,     setShowAiKey]     = useState(false);
  const [aiModel,       setAiModel]       = useState(currentUser?.openaiModel ?? DEFAULT_OPENAI_MODEL);
  const [aiPrompt,      setAiPrompt]      = useState(currentUser?.openaiPrompt ?? DEFAULT_AI_PROMPT);
  const [aiSaved,       setAiSaved]       = useState(false);

  function handleSaveAiSettings() {
    if (!currentUser) return;
    updateUser({ ...currentUser, openaiApiKey: aiKeyInput.trim(), openaiModel: aiModel, openaiPrompt: aiPrompt.trim() });
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 3000);
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

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim() || !currentUser) return;
    setApiKeyStatus("validating"); setApiKeyError(null);
    try {
      await fetchUsers(apiKeyInput.trim());
      updateUser({ ...currentUser, apiKey: apiKeyInput.trim() });
      setApiKeyStatus("ok");
    } catch {
      setApiKeyStatus("error");
      setApiKeyError(t("admin_api_error"));
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">{t("admin_title")}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t("admin_subtitle")}</p>

      <div className="flex gap-1 mb-6 bg-slate-200 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {(["usuarios", "configuracion", "integraciones"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {tab === "usuarios" ? t("admin_tab_users") : tab === "configuracion" ? t("admin_tab_config") : t("admin_tab_integrations")}
          </button>
        ))}
      </div>

      {activeTab === "usuarios" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{t("admin_users_title")}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">{t("admin_col_user")}</th>
                  <th className="text-left px-4 py-2">{t("admin_col_email")}</th>
                  <th className="text-left px-4 py-2">{t("admin_col_role")}</th>
                  <th className="text-left px-4 py-2">{t("admin_col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={u.firstName} lastName={u.lastName} avatarDataUrl={u.avatarDataUrl} size={32} />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === "admin"
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          : "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300"
                      }`}>
                        {u.role === "admin" ? t("admin_role_admin") : t("admin_role_viewer")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== currentUser?.id ? (
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors">
                          {t("admin_delete")}
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{t("admin_add_user_title")}</h3>
              <button
                type="button"
                onClick={() => { setShowAddForm((v) => !v); setAddError(null); setAddSuccess(false); }}
                className="flex items-center gap-1.5 text-xs bg-brand-blue hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors"
              >
                {showAddForm ? t("admin_cancel") : t("admin_add_user_btn")}
              </button>
            </div>
            {showAddForm && (
              <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">{t("admin_name")}</label>
                  <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">{t("admin_lastname")}</label>
                  <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">{t("admin_email")}</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">{t("admin_password")}</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">{t("admin_role")}</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")} className={inputCls}>
                    <option value="viewer">{t("admin_role_viewer")}</option>
                    <option value="admin">{t("admin_role_admin")}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-brand-blue hover:bg-blue-700 text-white font-semibold py-1.5 rounded-md text-sm transition-colors">
                    {t("admin_add_submit")}
                  </button>
                </div>
                {addError   && <p className="col-span-2 text-red-500 text-xs">{addError}</p>}
                {addSuccess && <p className="col-span-2 text-green-500 text-xs">{t("admin_success_created")}</p>}
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === "configuracion" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t("admin_api_key_title")}</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">{t("admin_api_key_desc")}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyStatus("idle"); }}
                  placeholder={t("admin_api_key_placeholder")}
                  className={inputCls + " pr-9"}
                />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button type="button" onClick={handleSaveApiKey} disabled={apiKeyStatus === "validating" || !apiKeyInput.trim()} className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap">
                {apiKeyStatus === "validating" ? t("admin_api_validating") : t("admin_save")}
              </button>
            </div>
            {apiKeyStatus === "ok"    && <p className="text-green-500 text-xs mt-2">{t("admin_api_success")}</p>}
            {apiKeyStatus === "error" && <p className="text-red-500 text-xs mt-2">{apiKeyError}</p>}
          </div>
        </div>
      )}

      {activeTab === "integraciones" && (
        <div className="flex flex-col gap-4">
          {/* TLDV */}
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t("admin_tldv_key_title")}</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">{t("admin_tldv_key_desc")}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showTldvKey ? "text" : "password"}
                  value={tldvKeyInput}
                  onChange={(e) => setTldvKeyInput(e.target.value)}
                  placeholder="tldv_..."
                  className={inputCls + " pr-9"}
                />
                <button type="button" onClick={() => setShowTldvKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  {showTldvKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button type="button" onClick={handleSaveTldvKey} disabled={!tldvKeyInput.trim()} className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap">
                {t("admin_save")}
              </button>
            </div>
            {tldvKeySaved && <p className="text-green-500 text-xs mt-2">✓ {t("admin_api_success")}</p>}
          </div>

          {/* AI (OpenAI) */}
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t("admin_ai_title")}</h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs">{t("admin_ai_desc")}</p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{t("admin_ai_key_label")}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAiKey ? "text" : "password"}
                    value={aiKeyInput}
                    onChange={(e) => setAiKeyInput(e.target.value)}
                    placeholder="sk-..."
                    className={inputCls + " pr-9"}
                  />
                  <button type="button" onClick={() => setShowAiKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showAiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Model selector */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{t("admin_ai_model_label")}</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className={inputCls}
              >
                {OPENAI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* System prompt */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{t("admin_ai_prompt_label")}</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={10}
                className={inputCls + " resize-y font-mono text-xs leading-relaxed"}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={!aiKeyInput.trim()}
                className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
              >
                {t("admin_save")}
              </button>
              {aiSaved && <p className="text-green-500 text-xs">✓ {t("admin_ai_saved")}</p>}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
