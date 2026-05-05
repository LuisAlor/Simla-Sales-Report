import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/Avatar";
import * as authLib from "@/lib/auth";
import type { User } from "@/lib/auth";

type Tab = "usuarios" | "configuracion";

export function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [users, setUsers] = useState<User[]>(() => authLib.getUsers());

  // Add user form state
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  function refreshUsers() {
    setUsers(authLib.getUsers());
  }

  function handleDelete(id: string) {
    if (id === currentUser?.id) return;
    authLib.deleteUser(id);
    refreshUsers();
  }

  function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(false);

    const existing = authLib.getUsers().find((u) => u.email === newEmail);
    if (existing) {
      setAddError("Ya existe un usuario con ese correo electrónico.");
      return;
    }

    authLib.addUser({
      email: newEmail,
      password: newPassword,
      firstName: newFirstName,
      lastName: newLastName,
      role: newRole,
    });

    setNewFirstName("");
    setNewLastName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("viewer");
    setAddSuccess(true);
    refreshUsers();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Panel de administración</h2>
      <p className="text-slate-500 text-sm mb-6">Gestión de usuarios y configuración del sistema</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-200 rounded-lg p-1 w-fit">
        {(["usuarios", "configuracion"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors capitalize ${
              activeTab === tab
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "usuarios" ? "Usuarios" : "Configuración"}
          </button>
        ))}
      </div>

      {activeTab === "usuarios" && (
        <div className="flex flex-col gap-6">
          {/* User table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-semibold text-slate-700 text-sm">Usuarios registrados</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Usuario</th>
                  <th className="text-left px-4 py-2">Correo electrónico</th>
                  <th className="text-left px-4 py-2">Rol</th>
                  <th className="text-left px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={u.firstName} lastName={u.lastName} avatarDataUrl={u.avatarDataUrl} size={32} />
                        <span className="font-medium text-slate-700">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === "admin"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {u.role === "admin" ? "Administrador" : "Visor"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== currentUser?.id ? (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors"
                        >
                          Eliminar
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add user form */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-4">Agregar usuario</h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 text-xs mb-1">Nombre</label>
                <input
                  type="text"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-xs mb-1">Apellido</label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-xs mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-xs mb-1">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-xs mb-1">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                >
                  <option value="viewer">Visor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-brand-blue hover:bg-blue-700 text-white font-semibold py-1.5 rounded-md text-sm transition-colors"
                >
                  Agregar usuario
                </button>
              </div>
              {addError && <p className="col-span-2 text-red-600 text-xs">{addError}</p>}
              {addSuccess && <p className="col-span-2 text-green-600 text-xs">Usuario creado correctamente.</p>}
            </form>
          </div>
        </div>
      )}

      {activeTab === "configuracion" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">API Key almacenada</h3>
            <div>
              <label className="block text-slate-500 text-xs mb-1">Tu API Key (solo lectura)</label>
              <input
                type="password"
                value={currentUser?.apiKey ?? ""}
                readOnly
                placeholder="No configurada"
                className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-slate-50 text-slate-500 cursor-default focus:outline-none"
              />
              {!currentUser?.apiKey && (
                <p className="text-slate-400 text-xs mt-1">
                  Ingresa tu API Key en el panel lateral y carga datos para guardarla en tu perfil.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-1">Filtros guardados</h3>
            <p className="text-slate-500 text-xs">
              Los filtros se guardan automáticamente cada vez que cargas datos. Se restauran al iniciar sesión.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
