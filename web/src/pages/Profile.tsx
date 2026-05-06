import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/Avatar";
import type { User } from "@/lib/auth";

const inputCls = "w-full border border-slate-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500";

export function Profile() {
  const { user, updateUser } = useAuth();

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
      setError("Nombre, apellido y correo son obligatorios."); return;
    }
    if (newPassword) {
      if (!currentPassword) { setError("Debes ingresar tu contraseña actual para cambiarla."); return; }
      if (safeUser.password !== currentPassword) { setError("La contraseña actual es incorrecta."); return; }
      if (newPassword !== confirmPassword) { setError("Las contraseñas nuevas no coinciden."); return; }
    }
    updateUser({ ...safeUser, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), ...(newPassword ? { password: newPassword } : {}) });
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Mi perfil</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Actualiza tu información personal</p>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6 mb-4 flex flex-col items-center gap-3">
        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
          <Avatar firstName={safeUser.firstName} lastName={safeUser.lastName} avatarDataUrl={safeUser.avatarDataUrl} size={80} />
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-xs font-semibold">Cambiar</span>
          </div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs">Haz clic en el avatar para cambiar la foto</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Nombre</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Apellido</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
          </div>

          <hr className="border-slate-200 dark:border-gray-700" />
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">Cambiar contraseña (opcional)</p>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Confirmar nueva contraseña</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">Perfil actualizado correctamente.</p>}

          <button type="submit" className="w-full bg-brand-blue hover:bg-blue-700 text-white font-semibold py-2 rounded-md text-sm transition-colors">
            Guardar cambios
          </button>
        </form>
      </div>
    </div>
  );
}
