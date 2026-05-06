import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/Avatar";
import { fetchUsers } from "@/lib/api";
import * as authLib from "@/lib/auth";
import type { User } from "@/lib/auth";

type Tab = "usuarios" | "configuracion";

const inputCls = "w-full border border-slate-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500";

export function AdminPanel() {
  const { user: currentUser, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [users, setUsers] = useState<User[]>(() => authLib.getUsers());

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState(currentUser?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "validating" | "ok" | "error">("idle");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

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
    if (existing) { setAddError("Ya existe un usuario con ese correo electrónico."); return; }
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
      setApiKeyError("API Key inválida o sin conexión. Verifica e intenta de nuevo.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Panel de administración</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Gestión de usuarios y configuración del sistema</p>

      <div className="flex gap-1 mb-6 bg-slate-200 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {(["usuarios", "configuracion"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors capitalize ${
              activeTab === tab
                ? "bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {tab === "usuarios" ? "Usuarios" : "Configuración"}
          </button>
        ))}
      </div>

      {activeTab === "usuarios" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Usuarios registrados</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Usuario</th>
                  <th className="text-left px-4 py-2">Correo electrónico</th>
                  <th className="text-left px-4 py-2">Rol</th>
                  <th className="text-left px-4 py-2">Acciones</th>
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
                        {u.role === "admin" ? "Administrador" : "Visor"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== currentUser?.id ? (
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors">
                          Eliminar
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
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4">Agregar usuario</h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">Nombre</label>
                <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">Apellido</label>
                <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">Correo electrónico</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">Contraseña</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">Rol</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")} className={inputCls}>
                  <option value="viewer">Visor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full bg-brand-blue hover:bg-blue-700 text-white font-semibold py-1.5 rounded-md text-sm transition-colors">
                  Agregar usuario
                </button>
              </div>
              {addError && <p className="col-span-2 text-red-500 text-xs">{addError}</p>}
              {addSuccess && <p className="col-span-2 text-green-500 text-xs">Usuario creado correctamente.</p>}
            </form>
          </div>
        </div>
      )}

      {activeTab === "configuracion" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">API Key de Simla CRM</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">
              La API Key se usa para conectar con Simla CRM. Se valida en tiempo real antes de guardar.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyStatus("idle"); }}
                  placeholder="Ingresa tu API Key"
                  className={inputCls + " pr-9"}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={apiKeyStatus === "validating" || !apiKeyInput.trim()}
                className="bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap"
              >
                {apiKeyStatus === "validating" ? "Validando…" : "Guardar"}
              </button>
            </div>
            {apiKeyStatus === "ok" && <p className="text-green-500 text-xs mt-2">✓ API Key válida y guardada.</p>}
            {apiKeyStatus === "error" && <p className="text-red-500 text-xs mt-2">{apiKeyError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
