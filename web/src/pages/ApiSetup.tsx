import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUsers, fetchStatuses } from "@/lib/api";

export function ApiSetup() {
  const { user, updateUser } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !user) return;
    setStatus("validating"); setErrorMsg(null);
    try {
      await Promise.all([fetchUsers(apiKey.trim()), fetchStatuses(apiKey.trim())]);
      updateUser({ ...user, apiKey: apiKey.trim() });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar con Simla. Verifica la API Key.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-slate-200 dark:border-gray-700 w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-xl">S</div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">Simla Analíticas</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs">Configuración inicial</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Configura tu API Key</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          Para acceder al panel necesitas una API Key de Simla CRM. Se guardará de forma privada en tu perfil.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">API Key de Simla</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStatus("idle"); }}
              placeholder="Pega aquí tu API Key"
              required
              className="w-full border border-slate-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {status === "validating" && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-blue-700 dark:text-blue-300 text-sm">
              Validando conexión con Simla CRM…
            </div>
          )}
          {status === "error" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-red-700 dark:text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "validating" || !apiKey.trim()}
            className="w-full bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md text-sm transition-colors"
          >
            {status === "validating" ? "Verificando…" : "Guardar y continuar"}
          </button>
        </form>

        <p className="text-slate-400 dark:text-slate-500 text-xs mt-4 text-center">
          Puedes cambiar la API Key en cualquier momento desde <strong>Mi perfil</strong>.
        </p>
      </div>
    </div>
  );
}
